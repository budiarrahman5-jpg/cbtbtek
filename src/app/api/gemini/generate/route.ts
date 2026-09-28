import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { prompt, tipe } = await req.json();

    // 1. Ambil API Key dari Supabase
    const { data: pengaturan } = await supabase.from('pengaturan').select('nilai').eq('kunci', 'gemini_api_key').single();
    const apiKey = pengaturan?.nilai;

    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json({ error: 'API_KEY_MISSING' }, { status: 400 });
    }

    // 2. Inisialisasi Gemini (Menggunakan gemini-pro yang sangat stabil)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // 3. Susun Prompt berdasarkan Tipe Soal
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

    const fullPrompt = `${systemInstruction}\n\nTipe Soal: ${tipe}\nInstruksi: ${prompt}`;

    // 4. Panggil Gemini
    const result = await model.generateContent(fullPrompt);
    const text = result.response.text();
    
    // 5. Ekstrak JSON
    let parsedResult;
    try {
      // Bersihkan markdown jika Gemini masih bandel mengembalikan ```json
      const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanText);
    } catch (parseError) {
      console.error("Gagal parse JSON dari Gemini:", text);
      return NextResponse.json({ error: 'AI mengembalikan format yang tidak valid. Silakan coba lagi.' }, { status: 500 });
    }

    return NextResponse.json({ result: parsedResult });

  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server.' }, { status: 500 });
  }
}
