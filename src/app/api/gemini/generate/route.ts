import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    let { prompt, tipe } = await req.json();

    // 1. Ambil API Key dari Supabase
    const { data: pengaturan } = await supabase.from('pengaturan').select('nilai').eq('kunci', 'groq_api_key').single();
    const apiKey = pengaturan?.nilai?.trim();

    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json({ error: 'API_KEY_MISSING' }, { status: 400 });
    }

    // Deteksi tipe jika prompt menyebut pilihan ganda / pg secara eksplisit
    const lowerPrompt = (prompt || '').toLowerCase();
    if (!tipe || tipe === '') {
      if (lowerPrompt.includes('pilihan ganda') || lowerPrompt.includes('pg') || lowerPrompt.includes('multiple choice')) {
        tipe = 'PG';
      } else if (lowerPrompt.includes('essay') || lowerPrompt.includes('esai') || lowerPrompt.includes('uraian')) {
        tipe = 'Essay';
      } else if (lowerPrompt.includes('isian')) {
        tipe = 'Isian';
      } else {
        tipe = 'PG';
      }
    }

    // 2. Susun Prompt
    let systemInstruction = `Anda adalah asisten pembuat soal ujian yang profesional. Buatlah SATU soal ujian berdasarkan instruksi user.
PENTING: Output Anda HARUS berupa JSON murni tanpa markdown, tanpa tag \`\`\`json, dan langsung bisa di-parse.
`;

    if (tipe === 'PG' || tipe === 'PG Kompleks') {
      systemInstruction += `
Format JSON yang diharapkan:
{
  "pertanyaan": "Teks pertanyaan saja (DILARANG memasukkan pilihan jawaban A, B, C, D ke dalam teks pertanyaan ini)",
  "opsi_a": "Teks pilihan jawaban A",
  "opsi_b": "Teks pilihan jawaban B",
  "opsi_c": "Teks pilihan jawaban C",
  "opsi_d": "Teks pilihan jawaban D",
  "opsi_e": "Teks pilihan jawaban E (boleh dikosongkan jika 4 opsi)",
  "kunci": "Kunci jawaban huruf kapital yang benar (contoh: 'A' atau 'B' untuk PG, atau 'A,C' untuk PG Kompleks)"
}`;
    } else if (tipe === 'Menjodohkan') {
      systemInstruction += `
Format JSON yang diharapkan:
{
  "pertanyaan": "Instruksi menjodohkan",
  "pasangan": [
    { "premis": "Premis 1 (kiri)", "respons": "Respons benar 1 (kanan)" },
    { "premis": "Premis 2 (kiri)", "respons": "Respons benar 2 (kanan)" }
  ],
  "pengecoh": ["Pengecoh 1 (hanya di kanan)", "Pengecoh 2 (hanya di kanan)"]
}`;
    } else {
      systemInstruction += `
Format JSON yang diharapkan:
{
  "pertanyaan": "Teks pertanyaan lengkap",
  "kunci": "Kunci jawaban pasti atau panduan/rubrik singkat penilaian yang benar"
}`;
    }

    const fullPrompt = `Tipe Soal: ${tipe}\nInstruksi: ${prompt}`;

    // 3. Ambil daftar model aktif dari Groq (Anti-Decommission & Aman dari Prompt-Guard)
    let activeModel = 'openai/gpt-oss-120b'; // Fallback
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
    
    // 5. Ekstrak & Parse JSON
    let text = data.choices?.[0]?.message?.content || '';
    let parsedResult: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : text.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Gagal parse JSON dari Groq:", text);
      return NextResponse.json({ error: 'AI mengembalikan format yang tidak valid. Silakan coba lagi.' }, { status: 500 });
    }

    // 6. Normalisasi output agar semua field terisi sempurna
    const normalized: any = {
      pertanyaan: parsedResult.pertanyaan || parsedResult.question || parsedResult.soal || '',
      opsi_a: parsedResult.opsi_a || parsedResult.opsiA || parsedResult.a || parsedResult.A || parsedResult.options?.A || parsedResult.options?.a || parsedResult.pilihan_a || '',
      opsi_b: parsedResult.opsi_b || parsedResult.opsiB || parsedResult.b || parsedResult.B || parsedResult.options?.B || parsedResult.options?.b || parsedResult.pilihan_b || '',
      opsi_c: parsedResult.opsi_c || parsedResult.opsiC || parsedResult.c || parsedResult.C || parsedResult.options?.C || parsedResult.options?.c || parsedResult.pilihan_c || '',
      opsi_d: parsedResult.opsi_d || parsedResult.opsiD || parsedResult.d || parsedResult.D || parsedResult.options?.D || parsedResult.options?.d || parsedResult.pilihan_d || '',
      opsi_e: parsedResult.opsi_e || parsedResult.opsiE || parsedResult.e || parsedResult.E || parsedResult.options?.E || parsedResult.options?.e || parsedResult.pilihan_e || '',
      kunci: (parsedResult.kunci || parsedResult.kunci_jawaban || parsedResult.kunciJawaban || parsedResult.jawaban || parsedResult.answer || parsedResult.correct_answer || '').toString().trim().toUpperCase(),
      pasangan: parsedResult.pasangan || [],
      pengecoh: parsedResult.pengecoh || []
    };

    // Bersihkan opsi dari teks pertanyaan jika opsi terduplikasi di dalam pertanyaan
    if (normalized.opsi_a && normalized.pertanyaan) {
      const splitIdx = normalized.pertanyaan.search(/\n\s*([A-E]\.|\([A-E]\))/i);
      if (splitIdx > 0) {
        normalized.pertanyaan = normalized.pertanyaan.substring(0, splitIdx).trim();
      }
    }

    return NextResponse.json({ result: normalized, tipe });

  } catch (error: any) {
    console.error('Groq Generate API Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server.' }, { status: 500 });
  }
}
