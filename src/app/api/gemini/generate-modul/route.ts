import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper membersihkan notasi matematika LaTeX ke teks Unicode yang rapi
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

  res = res.replace(/\^\{([0-9a-zA-Z\+\-]+)\}/g, (_, p1) => {
    return p1.split('').map((c: string) => supMap[c] || c).join('');
  });

  res = res.replace(/\^([0-9a-zA-Z])/g, (_, p1) => {
    return supMap[p1] || `^${p1}`;
  });

  // Subscript map
  const subMap: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'x': 'ₓ'
  };

  res = res.replace(/_\{([0-9a-zA-Z\+\-]+)\}/g, (_, p1) => {
    return p1.split('').map((c: string) => subMap[c] || c).join('');
  });

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

// Helper membersihkan data base64
function extractBase64Data(input: string): { base64Data: string; mimeType: string } {
  let mimeType = 'application/pdf';
  let base64Data = input;

  if (input.includes(';base64,')) {
    const parts = input.split(';base64,');
    base64Data = parts[1];
    const match = parts[0].match(/data:(.*?)$/);
    if (match && match[1]) {
      mimeType = match[1];
    }
  }

  return { base64Data: base64Data.trim(), mimeType };
}

// Helper parsing JSON dari output AI
function parseJsonOutput(rawText: string): any {
  if (!rawText) return null;
  let cleanText = rawText.trim();

  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.substring(7);
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.substring(3);
  }
  if (cleanText.endsWith('```')) {
    cleanText = cleanText.substring(0, cleanText.length - 3);
  }
  cleanText = cleanText.trim();

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleanText.substring(firstBrace, lastBrace + 1));
    }
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return JSON.parse(cleanText.substring(firstBracket, lastBracket + 1));
    }
    throw new Error('Gagal mengurai format JSON dari AI');
  }
}

// Panggil Groq AI untuk teks
async function callGroq(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.6,
      max_tokens: 8192,
      response_format: { type: 'json_object' }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || 'Gagal memanggil Groq AI');
  }
  return data.choices?.[0]?.message?.content || '';
}

// Panggil Gemini Multimodal (PDF, Dokumen, Gambar, atau Teks)
async function callGeminiMultimodal(apiKey: string, systemPrompt: string, userPrompt: string, base64Data?: string, mimeType?: string): Promise<string> {
  const candidateModels = [
    'gemini-flash-lite-latest',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-2.5-flash-lite',
    'gemini-pro-latest'
  ];

  const parts: any[] = [{ text: `${systemPrompt}\n\n${userPrompt}` }];

  if (base64Data) {
    parts.push({
      inlineData: {
        mimeType: mimeType || 'application/pdf',
        data: base64Data
      }
    });
  }

  let lastError = '';

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.5,
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

  throw new Error(`Semua model Google Gemini gagal memproses modul: ${lastError}`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      fileBase64,
      fileMimeType,
      textContent,
      jumlah = 5,
      tipe = 'PG',
      tingkat = 'proporsional',
      instruksiTambahan = '',
      provider = 'auto'
    } = body;

    const count = Math.max(1, Math.min(30, Number(jumlah) || 5));

    if (!fileBase64 && (!textContent || textContent.trim().length < 10)) {
      return NextResponse.json(
        { error: 'Harap unggah file PDF modul / RPP atau tempelkan teks materi terlebih dahulu.' },
        { status: 400 }
      );
    }

    // Ambil API keys dari Supabase
    const { data: pengaturanList } = await supabase
      .from('pengaturan')
      .select('kunci, nilai')
      .in('kunci', ['groq_api_key', 'gemini_api_key', 'ai_provider']);

    const settingsMap: Record<string, string> = {};
    (pengaturanList || []).forEach(p => { settingsMap[p.kunci] = p.nilai?.trim() || ''; });

    const groqKey = settingsMap['groq_api_key'] || '';
    const geminiKey = settingsMap['gemini_api_key'] || '';
    const preferredProvider = provider !== 'auto' ? provider : (settingsMap['ai_provider'] || 'auto');

    if (!groqKey && !geminiKey) {
      return NextResponse.json(
        { error: 'API Key AI belum diatur di menu Pengaturan. Masukkan Gemini API Key atau Groq API Key terlebih dahulu.' },
        { status: 400 }
      );
    }

    // Susun System Prompt
    let deskripsiTipe = 'Pilihan Ganda (PG) dengan opsi A, B, C, D, E dan 1 kunci jawaban yang benar';
    if (tipe === 'Essay') deskripsiTipe = 'Esai / Uraian pemahaman konsep mendalam';
    else if (tipe === 'Isian') deskripsiTipe = 'Isian singkat dengan jawaban pasti dan ringkas';
    else if (tipe === 'Campuran') deskripsiTipe = 'Campuran antara Pilihan Ganda (80%) dan Esai (20%)';
    else if (tipe === 'HOTS') deskripsiTipe = 'Pilihan Ganda bertipe HOTS (Higher Order Thinking Skills) dengan stimulus kasus/data/grafik dan analisis tingkat tinggi';

    const systemPrompt = `Anda adalah asisten perancang bank soal ujian sekolah profesional berstandar Kurikulum Merdeka dan Asesmen Nasional di Indonesia.
Tugas Anda:
1. Pelajari seluruh materi, Capaian Pembelajaran (CP), Tujuan Pembelajaran (TP), atau isi modul ajar/RPP yang dilampirkan secara seksama.
2. Buatlah persis ${count} butir soal ujian berkualitas tinggi yang menguji kompetensi esensial dari dokumen tersebut.
3. Kriteria soal:
   - Format: ${deskripsiTipe}
   - Tingkat Kesukaran: ${tingkat === 'hots' ? 'Seluruh soal bertipe HOTS (Analisis, Evaluasi, Kreasi)' : tingkat === 'standar' ? 'Standar Ujian Sekolah (Sedang hingga Sulit)' : 'Proporsional (20% Mudah, 50% Sedang, 30% Sulit)'}
   - Tulis rumus atau simbol matematika dalam bentuk bersih Unicode (misal: 2³, bukan $2^3$, dan × bukan \\times).
   - Jangan menyertakan nomor urut pada teks pertanyaan ("1.", "2.", dsb).
   - Opsi jawaban A-E harus realistis dan memiliki daya pembeda yang baik.
   - Kunci jawaban HARUS tepat dan sesuai fakta pada materi.
4. Output HARUS berupa JSON murni dengan format persis:
{
  "soal": [
    {
      "tipe": "PG",
      "pertanyaan": "Teks pertanyaan lengkap...",
      "opsi_a": "Teks opsi A",
      "opsi_b": "Teks opsi B",
      "opsi_c": "Teks opsi C",
      "opsi_d": "Teks opsi D",
      "opsi_e": "Teks opsi E",
      "kunci": "A",
      "skor_maks": 10
    }
  ]
}`;

    const userPrompt = `Silakan buatkan ${count} butir soal berdasarkan dokumen materi/RPP terlampir.
${instruksiTambahan ? `Catatan Tambahan Guru: ${instruksiTambahan}` : ''}
${textContent ? `\n--- ISI MATERI / RPP ---\n${textContent.slice(0, 20000)}` : ''}`;

    let rawOutput = '';
    let usedProvider = '';

    // Jika ada file lampiran (PDF / Gambar) -> Wajib gunakan Gemini Multimodal
    if (fileBase64) {
      if (!geminiKey) {
        return NextResponse.json(
          { error: 'Untuk memproses file dokumen PDF atau Gambar, diperlukan Google Gemini API Key. Silakan atur Gemini API Key di Pengaturan.' },
          { status: 400 }
        );
      }
      const { base64Data, mimeType } = extractBase64Data(fileBase64);
      rawOutput = await callGeminiMultimodal(geminiKey, systemPrompt, userPrompt, base64Data, fileMimeType || mimeType);
      usedProvider = 'Google Gemini Multimodal';
    } else {
      // Jika berupa teks murni (copy-paste / txt)
      if (preferredProvider === 'groq' && groqKey) {
        rawOutput = await callGroq(groqKey, systemPrompt, userPrompt);
        usedProvider = 'Groq AI (Llama 3.3)';
      } else if (preferredProvider === 'gemini' && geminiKey) {
        rawOutput = await callGeminiMultimodal(geminiKey, systemPrompt, userPrompt);
        usedProvider = 'Google Gemini';
      } else if (groqKey) {
        rawOutput = await callGroq(groqKey, systemPrompt, userPrompt);
        usedProvider = 'Groq AI (Llama 3.3)';
      } else if (geminiKey) {
        rawOutput = await callGeminiMultimodal(geminiKey, systemPrompt, userPrompt);
        usedProvider = 'Google Gemini';
      } else {
        throw new Error('Tidak ada API Key yang aktif.');
      }
    }

    const parsed = parseJsonOutput(rawOutput);

    let rawList: any[] = [];
    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && Array.isArray(parsed.soal)) {
      rawList = parsed.soal;
    } else if (parsed && Array.isArray(parsed.questions)) {
      rawList = parsed.questions;
    } else if (parsed && Array.isArray(parsed.data)) {
      rawList = parsed.data;
    }

    if (!rawList || rawList.length === 0) {
      return NextResponse.json(
        { error: 'AI tidak dapat menyusun soal dari dokumen ini. Pastikan dokumen memuat materi ajar yang jelas.' },
        { status: 422 }
      );
    }

    const cleanedQuestions = rawList.map((q, idx) => {
      let t = q.tipe || (q.opsi_a ? 'PG' : 'Essay');
      if (tipe === 'PG' || tipe === 'HOTS') t = 'PG';
      else if (tipe === 'Essay') t = 'Essay';
      else if (tipe === 'Isian') t = 'Isian';

      let pertanyaan = cleanMathNotation(q.pertanyaan || q.question || q.soal || '');
      pertanyaan = pertanyaan.replace(/^[\d\s\.\-\)\/]+/, '').trim();

      const opsi_a = cleanMathNotation(q.opsi_a || q.opsiA || q.a || q.A || '');
      const opsi_b = cleanMathNotation(q.opsi_b || q.opsiB || q.b || q.B || '');
      const opsi_c = cleanMathNotation(q.opsi_c || q.opsiC || q.c || q.C || '');
      const opsi_d = cleanMathNotation(q.opsi_d || q.opsiD || q.d || q.D || '');
      const opsi_e = cleanMathNotation(q.opsi_e || q.opsiE || q.e || q.E || '');

      let kunci = (q.kunci || q.jawaban || q.kunci_jawaban || 'A').toString().trim().toUpperCase();
      if (t === 'PG' && !['A', 'B', 'C', 'D', 'E'].includes(kunci)) {
        const m = kunci.match(/^[A-E]/);
        kunci = m ? m[0] : 'A';
      }

      return {
        tempId: Math.random().toString(36).substring(7),
        tipe: t,
        pertanyaan,
        opsi_a,
        opsi_b,
        opsi_c,
        opsi_d,
        opsi_e,
        kunci,
        skor_maks: Number(q.skor_maks) || (t === 'Essay' ? 20 : 10)
      };
    }).filter(q => q.pertanyaan.length >= 3);

    return NextResponse.json({
      success: true,
      provider: usedProvider,
      count: cleanedQuestions.length,
      result: cleanedQuestions
    });

  } catch (error: any) {
    console.error('Error in Generate Modul:', error);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat membuat soal dari modul.' },
      { status: 500 }
    );
  }
}
