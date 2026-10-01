import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { paket_id } = await req.json();

    if (!paket_id) {
      return NextResponse.json({ error: 'ID Paket tidak valid.' }, { status: 400 });
    }

    // 1. Ambil API Key Groq dari Supabase
    const { data: pengaturan } = await supabase.from('pengaturan').select('nilai').eq('kunci', 'groq_api_key').single();
    const apiKey = pengaturan?.nilai?.trim();

    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json({ error: 'API_KEY_MISSING' }, { status: 400 });
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

    // 3. Ambil data hasil siswa pada paket ini
    const { data: hasilList, error: errHasil } = await supabase
      .from('hasil')
      .select('*')
      .eq('paket_id', paket_id);

    if (errHasil) throw errHasil;
    if (!hasilList || hasilList.length === 0) {
      return NextResponse.json({ updated: 0, message: 'Belum ada data hasil ujian siswa pada paket ini.' });
    }

    // 4. Ambil daftar model aktif dari Groq (Anti-Decommission & Aman dari Prompt-Guard)
    let activeModel = 'openai/gpt-oss-120b';
    try {
      const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
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
      console.warn("Gagal mengambil list model Groq, menggunakan fallback:", e);
    }

    let updatedCount = 0;

    // 5. Loop per siswa dan koreksi jawaban essay/isian yang belum dinilai
    for (const h of hasilList) {
      const jawaban = { ...(h.detail_jawaban || {}) };
      let hasChanges = false;

      for (const soal of essaySoalList) {
        const jwbSiswa = jawaban[soal.id];
        
        // Hanya nilai jika ada jawaban dan belum ada nilai koreksi sebelumnya
        if (jwbSiswa !== undefined && jwbSiswa !== null && String(jwbSiswa).trim() !== '') {
          if (jawaban[`koreksi_${soal.id}`] === undefined || jawaban[`koreksi_${soal.id}`] === '') {
            const prompt = `Anda adalah guru pengoreksi ujian profesional.
Tugas Anda: Berikan skor angka bulat antara 0 sampai ${soal.skor_maks || 10} untuk jawaban siswa berikut berdasarkan pertanyaan dan kunci/panduan guru.

Pertanyaan: ${soal.pertanyaan}
Kunci / Panduan Jawaban Guru: ${soal.kunci || 'Tidak ada kunci spesifik. Berikan penilaian berdasarkan kelogisan, kelengkapan, dan ketepatan konsep.'}
Jawaban Siswa: ${String(jwbSiswa)}

PENTING: Output Anda HARUS HANYA SATU ANGKA BULAT (contoh: 8) tanpa penjelasan atau teks tambahan apapun.`;

            try {
              const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: activeModel,
                  messages: [{ role: 'user', content: prompt }],
                  temperature: 0.1
                })
              });

              const data = await response.json();
              if (response.ok) {
                const textResponse = data.choices?.[0]?.message?.content || '';
                const skorAI = parseInt(textResponse.replace(/[^0-9]/g, ''));
                if (!isNaN(skorAI)) {
                  const finalSkor = Math.min(Math.max(0, skorAI), soal.skor_maks || 10);
                  jawaban[`koreksi_${soal.id}`] = finalSkor;
                  hasChanges = true;
                  updatedCount++;
                }
              } else {
                console.error(`Gagal koreksi AI untuk hasil ${h.id}, soal ${soal.id}:`, data.error);
              }
            } catch (errAi) {
              console.error(`Error koneksi Groq untuk soal ${soal.id}:`, errAi);
            }
          }
        }
      }

      // Jika ada perubahan koreksi atau status masih 'Menunggu Koreksi', kalkulasi ulang skor total siswa
      if (hasChanges || h.status_koreksi === 'Menunggu Koreksi') {
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
      }
    }

    return NextResponse.json({ updated: updatedCount });

  } catch (error: any) {
    console.error('Groq Grade API Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal.' }, { status: 500 });
  }
}
