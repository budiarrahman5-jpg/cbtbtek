import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    let { paket_id, hasil_id, hasil_ids, provider } = await req.json();

    if (!paket_id && !hasil_id) {
      return NextResponse.json({ error: 'ID Paket atau ID Hasil tidak valid.' }, { status: 400 });
    }

    // 1. Ambil API Keys dari Supabase
    const { data: pengaturanList } = await supabase
      .from('pengaturan')
      .select('kunci, nilai')
      .in('kunci', ['groq_api_key', 'gemini_api_key', 'ai_provider']);

    const settingsMap: Record<string, string> = {};
    (pengaturanList || []).forEach(p => { settingsMap[p.kunci] = p.nilai?.trim() || ''; });

    const groqKey = settingsMap['groq_api_key'] || '';
    const geminiKey = settingsMap['gemini_api_key'] || '';
    const aiProvider = provider || settingsMap['ai_provider'] || 'auto';

    if (!groqKey && !geminiKey) {
      return NextResponse.json({ error: 'API_KEY_MISSING' }, { status: 400 });
    }

    // Jika hasil_id diberikan, cari paket_id dari baris hasil tersebut
    let singleHasil: any = null;
    if (hasil_id) {
      const { data: hData, error: hErr } = await supabase.from('hasil').select('*').eq('id', hasil_id).single();
      if (hErr || !hData) {
        return NextResponse.json({ error: 'Data hasil ujian siswa tidak ditemukan.' }, { status: 404 });
      }
      singleHasil = hData;
      paket_id = hData.paket_id;
    }

    // 2. Ambil semua soal pada paket ini
    const { data: soalRel, error: errSoal } = await supabase
      .from('paket_soal')
      .select('soal(*)')
      .eq('paket_id', paket_id);

    if (errSoal) throw errSoal;
    const soalList = soalRel?.map((s: any) => s.soal) || [];

    const essaySoalList = soalList.filter((s: any) => s.tipe === 'Essay' || s.tipe === 'Isian');
    if (essaySoalList.length === 0) {
      return NextResponse.json({ updated: 0, message: 'Tidak ada soal essay/isian pada paket ini.' });
    }

    // 3. Ambil data hasil siswa
    let hasilList: any[] = [];
    if (singleHasil) {
      hasilList = [singleHasil];
    } else if (Array.isArray(hasil_ids) && hasil_ids.length > 0) {
      // Koreksi hanya untuk siswa yang dipilih
      const { data: hList, error: errHasil } = await supabase
        .from('hasil')
        .select('*')
        .in('id', hasil_ids);
      if (errHasil) throw errHasil;
      hasilList = hList || [];
    } else {
      const { data: hList, error: errHasil } = await supabase
        .from('hasil')
        .select('*')
        .eq('paket_id', paket_id);

      if (errHasil) throw errHasil;
      hasilList = hList || [];
    }

    if (hasilList.length === 0) {
      return NextResponse.json({ updated: 0, message: 'Belum ada data hasil ujian siswa untuk dinilai.' });
    }

    // 4. Ambil daftar model aktif dari Groq (jika Groq aktif)
    let activeModel = 'openai/gpt-oss-120b';
    if (groqKey) {
      try {
        const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${groqKey}` }
        });
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          const isInvalid = (id: string) => {
            const lower = (id || '').toLowerCase();
            return lower.includes('guard') || 
                   lower.includes('safeguard') || 
                   lower.includes('whisper') || 
                   lower.includes('vision') || 
                   lower.includes('audio') || 
                   lower.includes('embed');
          };

          const validModels: string[] = (modelsData.data || [])
            .filter((m: any) => !isInvalid(m.id))
            .map((m: any) => m.id);

          const priorities = [
            'openai/gpt-oss-120b',
            'llama-3.3-70b-versatile',
            'llama-3.1-70b-versatile',
            'qwen/qwen3.8-27b',
            'openai/gpt-oss-20b',
            'llama-3.1-8b-instant',
            'llama3-70b-8192',
            'llama3-8b-8192',
            'mixtral-8x7b-32768',
            'allam-2-7b'
          ];

          const matched = priorities.find(p => validModels.includes(p));
          activeModel = matched || validModels[0] || activeModel;
        }
      } catch (e) {
        console.warn("Gagal auto-detect model Groq, gunakan default:", e);
      }
    }

    let updatedCount = 0;
    const skorPerSoalMap: Record<string, number> = {};

    // Helper koreksi multi-provider dengan fallback
    const gradeSingle = async (prompt: string): Promise<number | null> => {
      const tryGroq = async () => {
        if (!groqKey) throw new Error('No Groq Key');
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: activeModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1
          })
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error?.message || 'Groq error');
        return d.choices?.[0]?.message?.content || '';
      };

      const tryGemini = async () => {
        if (!geminiKey) throw new Error('No Gemini Key');
        const models = ['gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];
        for (const m of models) {
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${geminiKey}`;
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 }
              })
            });
            const d = await res.json();
            if (res.ok) {
              const txt = d.candidates?.[0]?.content?.parts?.[0]?.text;
              if (txt) return txt;
            }
          } catch (e) {}
        }
        throw new Error('Semua model Gemini gagal');
      };

      let text = '';
      if (aiProvider === 'gemini') {
        try {
          text = await tryGemini();
        } catch (e) {
          if (groqKey) {
            try { text = await tryGroq(); } catch (errGroq) {}
          }
        }
      } else {
        try {
          text = await tryGroq();
        } catch (e) {
          if (geminiKey) {
            try { text = await tryGemini(); } catch (errGemini) {}
          }
        }
      }

      const score = parseInt(text.replace(/[^0-9]/g, ''));
      return isNaN(score) ? null : score;
    };

    // 5. Loop per siswa dan koreksi jawaban essay/isian yang belum dinilai
    for (const h of hasilList) {
      const jawaban = { ...(h.detail_jawaban || {}) };
      let hasChanges = false;

      for (const soal of essaySoalList) {
        const jwbSiswa = jawaban[soal.id];
        
        // Nilai jika ada jawaban teks siswa
        if (jwbSiswa !== undefined && jwbSiswa !== null && String(jwbSiswa).trim() !== '') {
          const prompt = `Anda adalah guru pengoreksi ujian profesional.
Tugas Anda: Berikan skor angka bulat antara 0 sampai ${soal.skor_maks || 10} untuk jawaban siswa berikut berdasarkan pertanyaan dan kunci/panduan guru.

Pertanyaan: ${soal.pertanyaan}
Kunci / Panduan Jawaban Guru: ${soal.kunci || 'Tidak ada kunci spesifik. Berikan penilaian berdasarkan kelogisan, kelengkapan, dan ketepatan konsep.'}
Jawaban Siswa: ${String(jwbSiswa)}

PENTING: Output Anda HARUS HANYA SATU ANGKA BULAT (contoh: 8) tanpa penjelasan atau teks tambahan apapun.`;

          try {
            const skorAI = await gradeSingle(prompt);
            if (skorAI !== null) {
              const finalSkor = Math.min(Math.max(0, skorAI), soal.skor_maks || 10);
              jawaban[`koreksi_${soal.id}`] = finalSkor;
              skorPerSoalMap[soal.id] = finalSkor;
              hasChanges = true;
              updatedCount++;
            }
          } catch (errAi) {
            console.error(`Error koreksi AI untuk soal ${soal.id}:`, errAi);
          }
        }
      }

      // Hitung ulang skor total siswa
      let totalSkorBenar = 0;
      let totalSkorMaks = 0;

      soalList.forEach((soal: any) => {
        const bobot = soal.skor_maks || 10;
        totalSkorMaks += bobot;

        if (jawaban[`koreksi_${soal.id}`] !== undefined && jawaban[`koreksi_${soal.id}`] !== '') {
          totalSkorBenar += Number(jawaban[`koreksi_${soal.id}`]);
          return;
        }

        const jwb = jawaban[soal.id];
        if (!jwb) return;

        if (soal.tipe === 'PG') {
          if (jwb === soal.kunci?.toUpperCase()) totalSkorBenar += bobot;
        } else if (soal.tipe === 'PG Kompleks') {
          const kunciArr = (soal.kunci || '').split(',').map((k: string) => k.trim().toUpperCase());
          let benarCount = 0;
          if (Array.isArray(jwb)) {
            jwb.forEach((item: string) => {
              if (kunciArr.includes(item)) benarCount++;
            });
            if (kunciArr.length > 0) {
              totalSkorBenar += (benarCount / kunciArr.length) * bobot;
            }
          }
        } else if (soal.tipe === 'Menjodohkan') {
          try {
            const kunciAsli = JSON.parse(soal.kunci || '[]');
            let benarCount = 0;
            if (Array.isArray(jwb)) {
              jwb.forEach((item: any) => {
                if (kunciAsli.find((k: any) => k.premisId === item.premisId && k.responsId === item.responsId)) {
                  benarCount++;
                }
              });
            }
            if (kunciAsli.length > 0) {
              totalSkorBenar += (benarCount / kunciAsli.length) * bobot;
            }
          } catch (e) {}
        } else if (soal.tipe === 'Isian') {
          if (soal.kunci && String(jwb).toLowerCase().trim() === soal.kunci.toLowerCase().trim()) {
            totalSkorBenar += bobot;
          }
        }
      });

      const skorAkhir = totalSkorMaks > 0 ? Math.round((totalSkorBenar / totalSkorMaks) * 100) : 0;

      await supabase.from('hasil').update({
        detail_jawaban: jawaban,
        skor_akhir: skorAkhir,
        status_koreksi: 'Selesai'
      }).eq('id', h.id);

      h.detail_jawaban = jawaban;
      h.skor_akhir = skorAkhir;
    }

    return NextResponse.json({ 
      updated: updatedCount, 
      skor_per_soal: skorPerSoalMap,
      skor_akhir: hasilList[0]?.skor_akhir,
      detail_jawaban: hasilList[0]?.detail_jawaban
    });

  } catch (error: any) {
    console.error('Groq Grade API Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal.' }, { status: 500 });
  }
}
