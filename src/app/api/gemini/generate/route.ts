import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function normalizeSingleQuestion(item: any, fallbackTipe: string = 'PG') {
  if (!item) return null;
  const targetTipe = item.tipe || fallbackTipe;

  const normalized: any = {
    tipe: targetTipe,
    pertanyaan: item.pertanyaan || item.question || item.soal || '',
    opsi_a: item.opsi_a || item.opsiA || item.a || item.A || item.options?.A || item.options?.a || item.pilihan_a || '',
    opsi_b: item.opsi_b || item.opsiB || item.b || item.B || item.options?.B || item.options?.b || item.pilihan_b || '',
    opsi_c: item.opsi_c || item.opsiC || item.c || item.C || item.options?.C || item.options?.c || item.pilihan_c || '',
    opsi_d: item.opsi_d || item.opsiD || item.d || item.D || item.options?.D || item.options?.d || item.pilihan_d || '',
    opsi_e: item.opsi_e || item.opsiE || item.e || item.E || item.options?.E || item.options?.e || item.pilihan_e || '',
    kunci: (item.kunci || item.kunci_jawaban || item.kunciJawaban || item.jawaban || item.answer || item.correct_answer || '').toString().trim().toUpperCase(),
    skor_maks: Number(item.skor_maks || item.skor || 10),
    pasangan: item.pasangan || [],
    pengecoh: item.pengecoh || []
  };

  // Jika opsi_a masih kosong tapi options/pilihan berbentuk array
  if (!normalized.opsi_a && (targetTipe === 'PG' || targetTipe === 'PG Kompleks')) {
    const arr = Array.isArray(item.options) ? item.options :
                Array.isArray(item.pilihan) ? item.pilihan :
                Array.isArray(item.choices) ? item.choices : null;
    if (arr) {
      normalized.opsi_a = arr[0] || '';
      normalized.opsi_b = arr[1] || '';
      normalized.opsi_c = arr[2] || '';
      normalized.opsi_d = arr[3] || '';
      normalized.opsi_e = arr[4] || '';
    }
  }

  // Jika opsi masih kosong tapi teks pertanyaan memuat A. B. C. D.
  if (!normalized.opsi_a && normalized.pertanyaan && (targetTipe === 'PG' || targetTipe === 'PG Kompleks')) {
    const matchA = normalized.pertanyaan.match(/(?:^|\n)\s*(?:A[\.\)]|\(A\))\s*([^\n\r]+)/i);
    const matchB = normalized.pertanyaan.match(/(?:^|\n)\s*(?:B[\.\)]|\(B\))\s*([^\n\r]+)/i);
    const matchC = normalized.pertanyaan.match(/(?:^|\n)\s*(?:C[\.\)]|\(C\))\s*([^\n\r]+)/i);
    const matchD = normalized.pertanyaan.match(/(?:^|\n)\s*(?:D[\.\)]|\(D\))\s*([^\n\r]+)/i);
    const matchE = normalized.pertanyaan.match(/(?:^|\n)\s*(?:E[\.\)]|\(E\))\s*([^\n\r]+)/i);

    if (matchA && matchB) {
      normalized.opsi_a = matchA[1].trim();
      normalized.opsi_b = matchB[1].trim();
      normalized.opsi_c = matchC ? matchC[1].trim() : '';
      normalized.opsi_d = matchD ? matchD[1].trim() : '';
      normalized.opsi_e = matchE ? matchE[1].trim() : '';

      const splitIdx = normalized.pertanyaan.search(/(?:^|\n)\s*(?:A[\.\)]|\(A\))/i);
      if (splitIdx > 0) {
        normalized.pertanyaan = normalized.pertanyaan.substring(0, splitIdx).trim();
      }
    }
  }

  // Bersihkan prefix 'A. ', 'B. ' dsb. jika AI menyertakannya di teks opsi
  const cleanPrefix = (str: string, prefix: string) => {
    if (!str) return '';
    const regex = new RegExp(`^\\s*\\(?${prefix}[\\.\\)]\\s*`, 'i');
    return str.replace(regex, '').trim();
  };
  normalized.opsi_a = cleanPrefix(normalized.opsi_a, 'A');
  normalized.opsi_b = cleanPrefix(normalized.opsi_b, 'B');
  normalized.opsi_c = cleanPrefix(normalized.opsi_c, 'C');
  normalized.opsi_d = cleanPrefix(normalized.opsi_d, 'D');
  normalized.opsi_e = cleanPrefix(normalized.opsi_e, 'E');

  // Bersihkan opsi dari teks pertanyaan jika opsi terduplikasi di dalam pertanyaan
  if (normalized.opsi_a && normalized.pertanyaan) {
    const splitIdx = normalized.pertanyaan.search(/\n\s*([A-E]\.|\([A-E]\))/i);
    if (splitIdx > 0) {
      normalized.pertanyaan = normalized.pertanyaan.substring(0, splitIdx).trim();
    }
  }

  return normalized;
}

export async function POST(req: Request) {
  try {
    let { prompt, tipe, jumlah = 1 } = await req.json();
    const count = Math.max(1, Math.min(30, Number(jumlah) || 1));

    // 1. Ambil API Key dari Supabase
    const { data: pengaturan } = await supabase.from('pengaturan').select('nilai').eq('kunci', 'groq_api_key').single();
    const apiKey = pengaturan?.nilai?.trim();

    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json({ error: 'API_KEY_MISSING' }, { status: 400 });
    }

    // Deteksi tipe default jika kosong
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

    // 2. Susun System Prompt (Single vs Bulk)
    let systemInstruction = '';
    let fullPrompt = '';

    if (count > 1) {
      // MODE BULK (Banyak Soal Sekaligus)
      systemInstruction = `Anda adalah asisten pembuat bank soal ujian sekolah profesional.
Tugas Anda: Buatlah persis ${count} butir soal ujian berkualitas tinggi berdasarkan instruksi user.
PENTING: Output Anda HARUS berupa JSON murni tanpa markdown, tanpa tag \`\`\`json, dan langsung bisa di-parse.

Format JSON yang diharapkan:
{
  "soal": [
    {
      "nomor": 1,
      "tipe": "${tipe === 'Campuran' ? 'PG' : tipe}",
      "pertanyaan": "Teks pertanyaan saja (DILARANG memasukkan pilihan jawaban A, B, C, D ke dalam teks pertanyaan)",
      "opsi_a": "Teks pilihan jawaban A",
      "opsi_b": "Teks pilihan jawaban B",
      "opsi_c": "Teks pilihan jawaban C",
      "opsi_d": "Teks pilihan jawaban D",
      "opsi_e": "",
      "kunci": "Kunci jawaban huruf kapital yang benar (contoh: 'A' atau 'B', atau panduan singkat jika essay)",
      "skor_maks": 10
    }
  ]
}`;
      fullPrompt = `Tipe Soal: ${tipe}\nJumlah yang WAJIB dibuat: ${count} butir soal\nInstruksi Materi: ${prompt}`;
    } else {
      // MODE SINGLE (1 Butir Soal)
      systemInstruction = `Anda adalah asisten pembuat soal ujian yang profesional. Buatlah SATU soal ujian berdasarkan instruksi user.
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

      fullPrompt = `Tipe Soal: ${tipe}\nInstruksi: ${prompt}`;
    }

    // 3. Ambil daftar model aktif dari Groq
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
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : text.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Gagal parse JSON dari Groq:", text);
      return NextResponse.json({ error: 'AI mengembalikan format yang tidak valid. Silakan coba lagi.' }, { status: 500 });
    }

    // 6. Normalisasi Respon
    if (count > 1) {
      // Ambil array soal dari berbagai kemungkinan struktur JSON AI
      let rawList: any[] = [];
      if (Array.isArray(parsedResult)) {
        rawList = parsedResult;
      } else if (Array.isArray(parsedResult.soal)) {
        rawList = parsedResult.soal;
      } else if (Array.isArray(parsedResult.questions)) {
        rawList = parsedResult.questions;
      } else if (Array.isArray(parsedResult.items)) {
        rawList = parsedResult.items;
      } else if (Array.isArray(parsedResult.data)) {
        rawList = parsedResult.data;
      } else {
        // Fallback jika AI mengembalikan objek tunggal
        rawList = [parsedResult];
      }

      const normalizedList = rawList
        .map((item, idx) => {
          const n = normalizeSingleQuestion(item, tipe);
          if (n) {
            n.tempId = Math.random().toString(36).substring(7);
            n.nomor = idx + 1;
          }
          return n;
        })
        .filter(Boolean);

      return NextResponse.json({ 
        result: normalizedList, 
        is_bulk: true, 
        count: normalizedList.length, 
        tipe 
      });

    } else {
      // Mode Single
      const normalized = normalizeSingleQuestion(parsedResult, tipe);
      return NextResponse.json({ 
        result: normalized, 
        is_bulk: false, 
        tipe 
      });
    }

  } catch (error: any) {
    console.error('Groq Generate API Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server.' }, { status: 500 });
  }
}
