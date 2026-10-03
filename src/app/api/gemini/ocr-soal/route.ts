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
function extractBase64Data(imageInput: string): { base64Data: string; mimeType: string } {
  let mimeType = 'image/jpeg';
  let base64Data = imageInput;

  if (imageInput.includes(';base64,')) {
    const parts = imageInput.split(';base64,');
    base64Data = parts[1];
    const match = parts[0].match(/data:(.*?)$/);
    if (match && match[1]) {
      mimeType = match[1];
    }
  }

  return { base64Data: base64Data.trim(), mimeType };
}

// Helper parsing JSON dari output Gemini
function parseGeminiJson(rawText: string): any {
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
    throw new Error('Gagal mengurai format JSON dari Gemini');
  }
}

// Call Google Gemini Vision models
async function callGeminiVision(apiKey: string, base64Data: string, mimeType: string, userInstruction: string): Promise<string> {
  const candidateModels = [
    'gemini-flash-lite-latest',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash-image',
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
          contents: [
            {
              parts: [
                { text: userInstruction },
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
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

  throw new Error(`Semua model Google Gemini Vision gagal memproses foto: ${lastError}`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, targetTipe = 'auto', autoSolve = true } = body;

    if (!image) {
      return NextResponse.json(
        { error: 'Foto lembaran soal tidak ditemukan. Harap unggah atau foto terlebih dahulu.' },
        { status: 400 }
      );
    }

    // 1. Ambil gemini_api_key dari Supabase
    const { data: configData } = await supabase
      .from('pengaturan')
      .select('nilai')
      .eq('kunci', 'gemini_api_key')
      .maybeSingle();

    const geminiKey = configData?.nilai?.trim();
    if (!geminiKey) {
      return NextResponse.json(
        { error: 'API Key Google Gemini belum diatur di menu Pengaturan. Masukkan Gemini API Key untuk menggunakan fitur scan soal.' },
        { status: 400 }
      );
    }

    // 2. Ekstrak data base64
    const { base64Data, mimeType } = extractBase64Data(image);
    if (!base64Data) {
      return NextResponse.json({ error: 'Format gambar tidak valid.' }, { status: 400 });
    }

    // 3. Susun instruksi OCR khusus soal
    const systemPrompt = `Anda adalah asisten AI OCR spesialis pengenal naskah soal ujian dan lembaran buku sekolah di Indonesia.
Tugas Anda:
1. Pindai dan ekstrak SEMUA butir soal yang tampak pada gambar naskah atau lembaran buku ini.
2. Untuk setiap butir soal:
   - "tipe": Tentukan tipe soal ('PG', 'Essay', atau 'Isian'). Default 'PG' jika memiliki opsi pilihan A/B/C/D.
   - "pertanyaan": Teks lengkap butir pertanyaan. Hilangkan nomor urut soal di awal (misal: "1. Tentukan..." -> "Tentukan..."). Jika ada teks stimulus/bacaan pendek sebelum pertanyaan, sertakan dalam pertanyaan. Tulis rumus atau simbol matematika dalam bentuk bersih (misal: 2³, bukan $2^3$, dan × bukan \\times).
   - "opsi_a": Teks opsi pilihan A (hilangkan huruf "A." atau "a."). Kosongkan jika Essay/Isian.
   - "opsi_b": Teks opsi pilihan B (hilangkan huruf "B." atau "b."). Kosongkan jika Essay/Isian.
   - "opsi_c": Teks opsi pilihan C (hilangkan huruf "C." atau "c."). Kosongkan jika Essay/Isian.
   - "opsi_d": Teks opsi pilihan D (hilangkan huruf "D." atau "d."). Kosongkan jika Essay/Isian.
   - "opsi_e": Teks opsi pilihan E jika ada (misal tingkat SMA/SMK). Jika tidak ada opsi E, kosongkan string "".
   - "kunci": Kunci jawaban yang benar ('A', 'B', 'C', 'D', 'E' untuk PG; atau kalimat jawaban singkat untuk Essay/Isian).
     PENTING: Jika pada lembaran terdapat coretan/tanda lingkaran pensil/kunci jawaban, gunakan itu. Jika naskah belum dikerjakan/kosong, pecahkan soal dan pilih/tulis jawaban yang benar!
   - "skor_maks": Beri nilai skor default (10 untuk PG, 20 untuk Essay).
3. Jangan sertakan judul kop ujian, halaman buku, nama guru, atau petunjuk umum sebagai butir soal.
4. Output HARUS berupa JSON murni dengan struktur persis:
{
  "soal": [
    {
      "tipe": "PG",
      "pertanyaan": "Kalimat soal...",
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

    const rawOutput = await callGeminiVision(geminiKey, base64Data, mimeType, systemPrompt);
    const parsed = parseGeminiJson(rawOutput);

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
        { error: 'Gemini tidak dapat mendeteksi butir soal pada foto ini. Pastikan foto buku/lembaran soal fokus dan terang.' },
        { status: 422 }
      );
    }

    // Normalisasi dan bersihkan notasi matematika
    const cleanedQuestions = rawList.map((q, idx) => {
      let t = q.tipe || (q.opsi_a ? 'PG' : 'Essay');
      if (targetTipe !== 'auto') {
        t = targetTipe;
      }

      let pertanyaan = cleanMathNotation(q.pertanyaan || q.question || q.soal || '');
      // Hilangkan nomor di awal soal: "1.", "12 -", dll
      pertanyaan = pertanyaan.replace(/^[\d\s\.\-\)\/]+/, '').trim();

      const opsi_a = cleanMathNotation(q.opsi_a || q.opsiA || q.a || q.A || '');
      const opsi_b = cleanMathNotation(q.opsi_b || q.opsiB || q.b || q.B || '');
      const opsi_c = cleanMathNotation(q.opsi_c || q.opsiC || q.c || q.C || '');
      const opsi_d = cleanMathNotation(q.opsi_d || q.opsiD || q.d || q.D || '');
      const opsi_e = cleanMathNotation(q.opsi_e || q.opsiE || q.e || q.E || '');

      let kunci = (q.kunci || q.jawaban || q.kunci_jawaban || 'A').toString().trim().toUpperCase();
      if (t === 'PG' && !['A', 'B', 'C', 'D', 'E'].includes(kunci)) {
        // Jika kunci berbentuk kata atau panjang, ambil huruf pertama jika A-E
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
        skor_maks: Number(q.skor_maks) || 10
      };
    }).filter(q => q.pertanyaan.length >= 3);

    if (cleanedQuestions.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ditemukan butir soal yang valid. Silakan gunakan foto dengan teks yang lebih terbaca jelas.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      count: cleanedQuestions.length,
      result: cleanedQuestions
    });

  } catch (error: any) {
    console.error('Error in OCR Soal:', error);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat memproses scan lembar soal dengan Gemini AI.' },
      { status: 500 }
    );
  }
}
