import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function cleanMathNotation(text: string): string {
  if (!text || typeof text !== 'string') return text || '';

  let res = text;

  // 1. Ganti operator LaTeX umum
  res = res.replace(/\\times\b/g, '×');
  res = res.replace(/\\cdot\b/g, '·');
  res = res.replace(/\\div\b/g, '÷');
  res = res.replace(/\\pm\b/g, '±');
  res = res.replace(/\\le(q)?\b/g, '≤');
  res = res.replace(/\\ge(q)?\b/g, '≥');
  res = res.replace(/\\neq\b/g, '≠');
  res = res.replace(/\\approx\b/g, '≈');
  res = res.replace(/\\infty\b/g, '∞');
  res = res.replace(/\\pi\b/g, 'π');
  res = res.replace(/\\alpha\b/g, 'α');
  res = res.replace(/\\beta\b/g, 'β');
  res = res.replace(/\\theta\b/g, 'θ');
  res = res.replace(/\\degree\b|\\circ\b|\^\{\\circ\}|\^\s*°/g, '°');

  // 2. Ganti pecahan sederhana \frac{a}{b} -> a/b
  res = res.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');

  // 3. Ganti akar \sqrt{x} -> √(x)
  res = res.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');

  // 4. Superscript map untuk pangkat matematika
  const supMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'x': 'ˣ', 'y': 'ʸ', 'a': 'ᵃ', 'b': 'ᵇ'
  };

  // Pangkat kurung kurawal: ^{12}
  res = res.replace(/\^\{([0-9a-zA-Z\+\-]+)\}/g, (_, p1) => {
    return p1.split('').map((c: string) => supMap[c] || c).join('');
  });

  // Pangkat 1 karakter: ^2, ^3, ^x
  res = res.replace(/\^([0-9a-zA-Z])/g, (_, p1) => {
    return supMap[p1] || `^${p1}`;
  });

  // Subscript map untuk indeks kimia/matematika
  const subMap: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'x': 'ₓ'
  };

  // Subscript kurung kurawal: _{12}
  res = res.replace(/_\{([0-9a-zA-Z\+\-]+)\}/g, (_, p1) => {
    return p1.split('').map((c: string) => subMap[c] || c).join('');
  });

  // Subscript 1 karakter: _1, _2
  res = res.replace(/_([0-9])/g, (_, p1) => {
    return subMap[p1] || `_${p1}`;
  });

  // 5. Bersihkan tanda dollar $...$ dan $$...$$
  res = res.replace(/\$\$([^\$]+)\$\$/g, '$1');
  res = res.replace(/\$([^\$]+)\$/g, '$1');

  // Bersihkan spasi ganda
  res = res.replace(/[ \t]+/g, ' ');

  return res.trim();
}

function normalizeSingleQuestion(item: any, fallbackTipe: string = 'PG') {
  if (!item) return null;
  const targetTipe = item.tipe || fallbackTipe;

  const normalized: any = {
    tipe: targetTipe,
    pertanyaan: cleanMathNotation(item.pertanyaan || item.question || item.soal || ''),
    opsi_a: cleanMathNotation(item.opsi_a || item.opsiA || item.a || item.A || item.options?.A || item.options?.a || item.pilihan_a || ''),
    opsi_b: cleanMathNotation(item.opsi_b || item.opsiB || item.b || item.B || item.options?.B || item.options?.b || item.pilihan_b || ''),
    opsi_c: cleanMathNotation(item.opsi_c || item.opsiC || item.c || item.C || item.options?.C || item.options?.c || item.pilihan_c || ''),
    opsi_d: cleanMathNotation(item.opsi_d || item.opsiD || item.d || item.D || item.options?.D || item.options?.d || item.pilihan_d || ''),
    opsi_e: cleanMathNotation(item.opsi_e || item.opsiE || item.e || item.E || item.options?.E || item.options?.e || item.pilihan_e || ''),
    kunci: cleanMathNotation((item.kunci || item.kunci_jawaban || item.kunciJawaban || item.jawaban || item.answer || item.correct_answer || '').toString().trim().toUpperCase()),
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

function cleanAndParseJSON(text: string): any {
  if (!text || typeof text !== 'string') return null;

  // 1. Bersihkan reasoning/thinking tag <think>...</think>
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Bersihkan markdown codeblock
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // 3. Ambil substring antara kurung kurawal atau siku terluar
  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');
  let startIdx = -1;
  let endChar = '';

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endChar = '}';
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endChar = ']';
  }

  if (startIdx !== -1) {
    const lastEnd = clean.lastIndexOf(endChar);
    if (lastEnd > startIdx) {
      clean = clean.substring(startIdx, lastEnd + 1);
    } else {
      clean = clean.substring(startIdx);
    }
  }

  // Percobaan 1: Direct JSON.parse
  try {
    return JSON.parse(clean);
  } catch (err1) {
    // Percobaan 2: Bersihkan trailing comma & escaped backslashes (rumus LaTeX \sqrt, \frac, dll)
    let repaired = clean.replace(/,\s*([}\]])/g, '$1');
    repaired = repaired.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

    try {
      return JSON.parse(repaired);
    } catch (err2) {
      // Percobaan 3: Auto-close unclosed string & braces jika teks terpotong di akhir
      let openBraces = 0;
      let openBrackets = 0;
      let inString = false;
      let escaped = false;

      for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === '\\') {
          escaped = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') openBraces++;
          else if (char === '}') openBraces = Math.max(0, openBraces - 1);
          else if (char === '[') openBrackets++;
          else if (char === ']') openBrackets = Math.max(0, openBrackets - 1);
        }
      }

      if (inString) repaired += '"';
      while (openBrackets > 0) {
        repaired += ']';
        openBrackets--;
      }
      while (openBraces > 0) {
        repaired += '}';
        openBraces--;
      }

      try {
        return JSON.parse(repaired);
      } catch (err3) {
        console.warn("JSON repair gagal, mencoba fallback regex:", err3);
        return null;
      }
    }
  }
}

async function callGroq(apiKey: string, systemInstruction: string, fullPrompt: string): Promise<string> {
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
    console.warn("Gagal auto-detect model Groq, gunakan default:", e);
  }

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
      response_format: { type: 'json_object' },
      max_tokens: 8192,
      temperature: 0.6
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Gagal memanggil Groq AI');
  }
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(apiKey: string, systemInstruction: string, fullPrompt: string): Promise<string> {
  const candidateModels = [
    'gemini-flash-lite-latest',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-pro-latest'
  ];

  let lastError = '';
  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `${systemInstruction}\n\n${fullPrompt}` }]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.6,
            maxOutputTokens: 8192
          }
        })
      });

      const data = await response.json();
      if (response.ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } else {
        lastError = data.error?.message || `HTTP ${response.status}`;
      }
    } catch (e: any) {
      lastError = e.message;
    }
  }

  throw new Error(`Semua model Google Gemini gagal diakses: ${lastError}`);
}

export async function POST(req: Request) {
  try {
    let { prompt, tipe, jumlah = 1, provider } = await req.json();
    const count = Math.max(1, Math.min(30, Number(jumlah) || 1));

    // 1. Ambil API Key dari Supabase
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

ATURAN NOTASI MATEMATIKA, RUMUS & SIMBOL:
- DILARANG KERAS menggunakan format kode LaTeX dengan tanda dollar $ (contoh yang DILARANG: $2^3 \\times 3^2$, $\\frac{1}{2}$).
- Tuliskan rumus dan notasi matematika secara rapi, bersih, dan mudah dibaca langsung:
  * Gunakan simbol perkalian asli '×' (contoh: 2³ × 3² × 5)
  * Gunakan angka pangkat/superscript unicode: ², ³, ⁴, ⁵, ⁿ
  * Gunakan simbol pembagian '÷' atau bentuk pecahan biasa 'a/b'
  * Gunakan simbol matematika baku: ±, ≤, ≥, ≠, ≈, √, π, °
  * Gunakan indeks kimia subscript: H₂O, CO₂

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

ATURAN NOTASI MATEMATIKA, RUMUS & SIMBOL:
- DILARANG KERAS menggunakan format kode LaTeX dengan tanda dollar $ (contoh yang DILARANG: $2^3 \\times 3^2$, $\\frac{1}{2}$).
- Tuliskan rumus dan notasi matematika secara rapi, bersih, dan mudah dibaca langsung:
  * Gunakan simbol perkalian asli '×' (contoh: 2³ × 3² × 5)
  * Gunakan angka pangkat/superscript unicode: ², ³, ⁴, ⁵, ⁿ
  * Gunakan simbol pembagian '÷' atau bentuk pecahan biasa 'a/b'
  * Gunakan simbol matematika baku: ±, ≤, ≥, ≠, ≈, √, π, °
  * Gunakan indeks kimia subscript: H₂O, CO₂
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

    // 3. Eksekusi AI dengan Multi-Provider & Auto-Fallback
    let text = '';
    let usedProvider = '';

    const executeGroq = async () => {
      if (!groqKey) throw new Error('Groq API Key belum diatur di Pengaturan');
      const t = await callGroq(groqKey, systemInstruction, fullPrompt);
      return { text: t, provider: 'Groq AI' };
    };

    const executeGemini = async () => {
      if (!geminiKey) throw new Error('Google Gemini API Key belum diatur di Pengaturan');
      const t = await callGemini(geminiKey, systemInstruction, fullPrompt);
      return { text: t, provider: 'Google Gemini' };
    };

    if (aiProvider === 'gemini') {
      try {
        const res = await executeGemini();
        text = res.text;
        usedProvider = res.provider;
      } catch (err: any) {
        console.warn('Google Gemini gagal, beralih ke Groq AI:', err.message);
        if (groqKey) {
          const res = await executeGroq();
          text = res.text;
          usedProvider = `${res.provider} (Cadangan)`;
        } else {
          return NextResponse.json({ error: `Gagal memanggil Google Gemini: ${err.message}` }, { status: 500 });
        }
      }
    } else {
      // Default: 'auto' atau 'groq'
      try {
        const res = await executeGroq();
        text = res.text;
        usedProvider = res.provider;
      } catch (err: any) {
        console.warn('Groq AI gagal, beralih ke Google Gemini:', err.message);
        if (geminiKey) {
          const res = await executeGemini();
          text = res.text;
          usedProvider = `${res.provider} (Cadangan)`;
        } else {
          return NextResponse.json({ error: `Gagal memanggil Groq AI: ${err.message}` }, { status: 500 });
        }
      }
    }
    
    // 4. Ekstrak & Parse JSON secara aman dan tahan error
    let parsedResult: any = cleanAndParseJSON(text);

    if (!parsedResult) {
      console.warn("cleanAndParseJSON gagal, menjalankan fallback ekstraksi teks bebas:", text);
      const questionsRegex = /(?:^|\n)(?:Soal\s*\d+[:\.]?|\d+[\.\)])\s*([\s\S]*?)(?=(?:\n(?:Soal\s*\d+[:\.]?|\d+[\.\)])|$))/gi;
      const matches = [...text.matchAll(questionsRegex)];

      if (matches.length > 0) {
        parsedResult = {
          soal: matches.map((m, i) => {
            const rawQ = m[1].trim();
            return normalizeSingleQuestion({ nomor: i + 1, pertanyaan: rawQ }, tipe);
          })
        };
      } else if (text && text.trim().length > 10) {
        parsedResult = normalizeSingleQuestion({ pertanyaan: text.trim() }, tipe);
      } else {
        return NextResponse.json({ error: 'AI mengembalikan format yang tidak valid. Silakan coba lagi.' }, { status: 500 });
      }
    }

    // 5. Normalisasi Respon
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
        provider: usedProvider,
        tipe 
      });

    } else {
      // Mode Single
      const normalized = normalizeSingleQuestion(parsedResult, tipe);
      return NextResponse.json({ 
        result: normalized, 
        is_bulk: false, 
        provider: usedProvider,
        tipe 
      });
    }

  } catch (error: any) {
    console.error('Generate API Error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal server.' }, { status: 500 });
  }
}
