import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

  // Buang markdown wrap ```json ... ``` jika ada
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
    // Coba cari substring { ... } atau [ ... ]
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const sub = cleanText.substring(firstBrace, lastBrace + 1);
      return JSON.parse(sub);
    }
    const firstBracket = cleanText.indexOf('[');
    const lastBracket = cleanText.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const sub = cleanText.substring(firstBracket, lastBracket + 1);
      return JSON.parse(sub);
    }
    throw new Error('Gagal mengurai format JSON dari Gemini');
  }
}

// Call Google Gemini Vision models
async function callGeminiVision(apiKey: string, base64Data: string, mimeType: string): Promise<string> {
  const candidateModels = [
    'gemini-flash-lite-latest',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash-image',
    'gemini-pro-latest'
  ];

  const systemInstruction = `Anda adalah asisten AI OCR spesialis dokumen absensi / daftar presensi / buku induk siswa sekolah di Indonesia.
Tugas Anda:
1. Pindai dan kenali data seluruh siswa yang tertulis di dalam foto absensi atau daftar siswa ini.
2. Untuk setiap siswa, ekstrak:
   - "nama": Nama lengkap siswa. Hapus nomor urut di awal nama jika ada (misal: "1. Budi" -> "Budi"). Jangan sertakan tanda baca coretan atau paraf kehadiran. Rapikan kapitalisasi kata (Title Case).
   - "nisn": Nomor Induk Siswa Nasional (NISN biasanya 10 digit angka) atau NIS jika ada. Hanya ambil digit angka. Jika tidak ada kolom NISN/NIS atau tidak terbaca sama sekali, isi dengan string kosong "".
3. Jangan masukkan judul tabel, nama guru, kolom tanggal, atau teks header lainnya sebagai siswa.
4. Urutkan daftar siswa sesuai urutan baris di dokumen dari atas ke bawah.
5. Kembalikan HANYA JSON murni dengan format persis:
{
  "siswa": [
    { "nama": "Ahmad Dahlan", "nisn": "0081234567" },
    { "nama": "Budi Santoso", "nisn": "0089876543" }
  ]
}`;

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
                { text: systemInstruction },
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
            temperature: 0.1,
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

  throw new Error(`Semua model Google Gemini Vision gagal memproses gambar: ${lastError}`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      image,
      prefix = 'peserta',
      startNumber = 1,
      defaultPassword = '123456',
      usernameMode = 'peserta' // 'peserta' atau 'nisn'
    } = body;

    if (!image) {
      return NextResponse.json(
        { error: 'Foto absensi tidak ditemukan. Harap unggah atau ambil foto terlebih dahulu.' },
        { status: 400 }
      );
    }

    // 1. Ambil gemini_api_key dari tabel pengaturan (HANYA GEMINI)
    const { data: configData } = await supabase
      .from('pengaturan')
      .select('nilai')
      .eq('kunci', 'gemini_api_key')
      .maybeSingle();

    const geminiKey = configData?.nilai?.trim();
    if (!geminiKey) {
      return NextResponse.json(
        {
          error: 'API Key Google Gemini belum diatur di menu Pengaturan. Masukkan Gemini API Key Anda untuk menggunakan fitur scan AI.'
        },
        { status: 400 }
      );
    }

    // 2. Ekstrak data base64
    const { base64Data, mimeType } = extractBase64Data(image);
    if (!base64Data) {
      return NextResponse.json({ error: 'Format gambar tidak valid.' }, { status: 400 });
    }

    // 3. Panggil Gemini Vision
    const rawAiOutput = await callGeminiVision(geminiKey, base64Data, mimeType);
    const parsed = parseGeminiJson(rawAiOutput);

    // 4. Normalisasi daftar siswa
    let rawList: any[] = [];
    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && Array.isArray(parsed.siswa)) {
      rawList = parsed.siswa;
    } else if (parsed && Array.isArray(parsed.students)) {
      rawList = parsed.students;
    } else if (parsed && Array.isArray(parsed.data)) {
      rawList = parsed.data;
    } else if (parsed && typeof parsed === 'object') {
      for (const k of Object.keys(parsed)) {
        if (Array.isArray(parsed[k])) {
          rawList = parsed[k];
          break;
        }
      }
    }

    if (!rawList || rawList.length === 0) {
      return NextResponse.json(
        {
          error: 'Gemini tidak menemukan baris siswa pada foto ini. Pastikan foto absensi memiliki pencahayaan cukup dan tulisan nama terbaca jelas.'
        },
        { status: 422 }
      );
    }

    // Filter baris yang memiliki nama valid
    const cleanList = rawList
      .map(item => {
        let nama = (item.nama || item.name || item.nama_lengkap || item.nama_siswa || '').toString().trim();
        // Bersihkan nomor urut di awal: "1.", "01 -", dll
        nama = nama.replace(/^[\d\s\.\-\)\/]+/, '').trim();
        // Ubah Title Case jika semua huruf kapital atau huruf kecil
        if (nama && (nama === nama.toUpperCase() || nama === nama.toLowerCase())) {
          nama = nama.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
        }

        let nisn = (item.nisn || item.nis || item.nomor_induk || item.id || '').toString().trim();
        // Sisakan hanya digit untuk NISN
        nisn = nisn.replace(/[^\d]/g, '');

        return { nama, nisn };
      })
      .filter(item => item.nama.length >= 2);

    if (cleanList.length === 0) {
      return NextResponse.json(
        {
          error: 'Tidak ditemukan nama siswa yang valid dari hasil scan. Silakan coba gunakan foto yang lebih fokus dan terang.'
        },
        { status: 422 }
      );
    }

    // 5. Susun Username urut (peserta01, peserta02...) dan Password
    const startNum = Math.max(1, Number(startNumber) || 1);
    const cleanPrefix = (prefix || 'peserta').trim().toLowerCase();
    const finalPassword = (defaultPassword || '123456').trim();

    // Hitung digit padding: minimal 2 digit (01, 02), jika total >= 100 maka 3 digit (001)
    const maxNumber = startNum + cleanList.length - 1;
    const padLength = Math.max(2, String(maxNumber).length);

    const formattedStudents = cleanList.map((item, idx) => {
      const currentNumber = startNum + idx;
      const autoSeqUsername = `${cleanPrefix}${String(currentNumber).padStart(padLength, '0')}`;

      let chosenUsername = autoSeqUsername;
      if (usernameMode === 'nisn' && item.nisn && item.nisn.length >= 4) {
        chosenUsername = item.nisn;
      }

      return {
        nama: item.nama,
        nisn: item.nisn,
        username: chosenUsername,
        password: finalPassword
      };
    });

    return NextResponse.json({
      success: true,
      total: formattedStudents.length,
      siswa: formattedStudents
    });

  } catch (error: any) {
    console.error('Error in OCR Siswa:', error);
    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan sistem saat memproses foto dengan Gemini.' },
      { status: 500 }
    );
  }
}
