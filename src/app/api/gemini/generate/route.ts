import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { prompt, tipe } = await req.json();

    // 1. Ambil API Key dari Supabase
    const { data: pengaturan } = await supabase.from('pengaturan').select('nilai').eq('kunci', 'groq_api_key').single();
    const apiKey = pengaturan?.nilai?.trim();

    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json({ error: 'API_KEY_MISSING' }, { status: 400 });
    }

    // 2. Susun Prompt
    let systemInstruction = `Anda adalah asisten pembuat soal ujian yang profesional. Buatlah SATU soal ujian berdasarkan instruksi user.
PENTING: Output Anda HARUS berupa JSON murni tanpa markdown, tanpa tag \`\`\`json, dan langsung bisa di-parse.
`;

    if (tipe === 'PG' || tipe === 'PG Kompleks') {
      systemInstruction += `
Format JSON yang diharapkan:
{
  "pertanyaan": "Teks pertanyaan lengkap",
  "opsi_a": "Teks opsi A",
  "opsi_b": "Teks opsi B",
  "opsi_c": "Teks opsi C",
  "opsi_d": "Teks opsi D",
  "opsi_e": "Teks opsi E (kosongkan jika tidak perlu)",
  "kunci": "Kunci jawaban yang benar (contoh: 'A' atau 'B,C' untuk PG Kompleks)"
}`;
    } else {
      systemInstruction += `
Format JSON yang diharapkan:
{
  "pertanyaan": "Teks pertanyaan lengkap",
  "kunci": "Kunci jawaban pasti/singkat (jika essay berikan panduan jawaban singkat)"
}`;
    }

    const fullPrompt = `Tipe Soal: ${tipe}\nInstruksi: ${prompt}`;

    // 3. Ambil daftar model aktif dari Groq (Anti-Decommission)
    let activeModel = 'llama-3.3-70b-versatile'; // Fallback
    try {
      const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        // Cari model Llama terbaru, jika tidak ada ambil model teks pertama
        const llamaModel = modelsData.data?.find((m: any) => m.id.includes('llama') && !m.id.includes('vision') && !m.id.includes('audio'));
        activeModel = llamaModel ? llamaModel.id : (modelsData.data?.[0]?.id || activeModel);
      }
    } catch (e) {
      console.warn("Gagal mengambil list model Groq, menggunakan fallback:", e);
    }

    // 4. Panggil Groq API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: fullPrompt }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq API Error Response:", data);
      return NextResponse.json({ error: data.error?.message || 'Gagal memanggil Groq AI' }, { status: response.status });
    }
    
    // 4. Ekstrak JSON
    let text = data.choices?.[0]?.message?.content || '';
    let parsedResult;
    try {
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanText);
    } catch (parseError) {
      console.error("Gagal parse JSON dari Groq:", text);
      return NextResponse.json({ error: 'AI mengembalikan format yang tidak valid. Silakan coba lagi.' }, { status: 500 });
    }

    return NextResponse.json({ result: parsedResult });

  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server.' }, { status: 500 });
  }
}
