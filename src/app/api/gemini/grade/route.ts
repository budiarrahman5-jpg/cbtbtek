import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { paket_id } = await req.json();

    // 1. Ambil API Key
    const { data: pengaturan } = await supabase.from('pengaturan').select('nilai').eq('kunci', 'gemini_api_key').single();
    const apiKey = pengaturan?.nilai?.trim();

    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json({ error: 'API_KEY_MISSING' }, { status: 400 });
    }

    // 2. Ambil semua jawaban essay/isian yang belum dikoreksi di paket ini
    // Kita filter berdasarkan hasil.paket_id
    const { data: listJawaban, error: errJawab } = await supabase
      .from('jawaban')
      .select(`
        id, 
        jawaban_teks, 
        skor,
        hasil_id,
        hasil!inner(paket_id),
        soal!inner(pertanyaan, kunci, tipe, skor_maks)
      `)
      .eq('hasil.paket_id', paket_id)
      .in('soal.tipe', ['Essay', 'Isian'])
      .not('jawaban_teks', 'is', null)
      .neq('jawaban_teks', '');

    if (errJawab) throw errJawab;
    if (!listJawaban || listJawaban.length === 0) {
      return NextResponse.json({ updated: 0, message: 'Tidak ada jawaban essay/isian yang perlu dikoreksi.' });
    }

    let updatedCount = 0;
    const hasilIdsToRecalculate = new Set<string>();

    // 4. Loop & Koreksi (Bisa dioptimasi jadi batch nanti, tapi loop aman untuk sekarang)
    for (const j of listJawaban as any[]) {
      // Jika sudah ada nilai skor dan lebih dari 0, skip (asumsi sudah dikoreksi manual)
      // Namun jika kita ingin AI override, kita bisa hapus kondisi ini. 
      // Untuk amannya, kita izinkan AI mengoreksi semua yang dikirim.
      
      const prompt = `Anda adalah guru pengoreksi otomatis.
Tugas Anda: Berikan skor angka (0 sampai ${j.soal.skor_maks}) untuk jawaban siswa.

Pertanyaan: ${j.soal.pertanyaan}
Kunci/Panduan Jawaban Guru: ${j.soal.kunci || 'Tidak ada kunci spesifik. Nilai berdasarkan kelogisan.'}
Jawaban Siswa: ${j.jawaban_teks}

PENTING: Output Anda HARUS HANYA ANGKA (contoh: 8) tanpa teks tambahan apapun.`;

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const skorAI = parseInt(textResponse.replace(/[^0-9]/g, ''));
          
          if (!isNaN(skorAI)) {
            const finalSkor = Math.min(skorAI, j.soal.skor_maks);
            await supabase.from('jawaban').update({ skor: finalSkor }).eq('id', j.id);
            updatedCount++;
            hasilIdsToRecalculate.add(j.hasil_id);
          }
        } else {
          console.error(`Gagal mengoreksi jawaban ID ${j.id}:`, data.error);
        }
      } catch (aiErr) {
        console.error(`Gagal koneksi ke Gemini untuk jawaban ID ${j.id}:`, aiErr);
      }
    }

    // 5. Hitung ulang total skor untuk hasil yang terpengaruh
    for (const hid of Array.from(hasilIdsToRecalculate)) {
      const { data: jwbData } = await supabase.from('jawaban').select('skor').eq('hasil_id', hid);
      if (jwbData) {
        const totalSkor = jwbData.reduce((sum, item) => sum + (item.skor || 0), 0);
        await supabase.from('hasil').update({ 
          skor_akhir: totalSkor,
          status_koreksi: 'Selesai'
        }).eq('id', hid);
      }
    }

    return NextResponse.json({ updated: updatedCount });

  } catch (error: any) {
    console.error('Gemini Grade API Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal.' }, { status: 500 });
  }
}
