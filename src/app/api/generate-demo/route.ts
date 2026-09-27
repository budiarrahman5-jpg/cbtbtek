import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function generateRandomString(length: number) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST() {
  try {
    const demoId = generateRandomString(5);
    const token = `DEMO${generateRandomString(4).toUpperCase()}`;

    // 1. Create Kelas Demo
    const { data: kelas, error: kelasError } = await supabase
      .from('kelas')
      .insert({ nama_kelas: `Kelas Demo ${demoId}` })
      .select('id')
      .single();
    
    if (kelasError) throw new Error(`Gagal membuat kelas: ${kelasError.message}`);

    // 2. Create Paket Demo
    const { data: paket, error: paketError } = await supabase
      .from('paket')
      .insert({
        nama_paket: `Paket Ujian Demo ${demoId}`,
        deskripsi: 'Paket ini dibuat otomatis untuk demo lingkungan aplikasi.',
        durasi_menit: 60,
        token: token,
        status: 'Aktif'
      })
      .select('id')
      .single();

    if (paketError) throw new Error(`Gagal membuat paket: ${paketError.message}`);

    // 3. Create 5 Soal for the Paket
    const soalData = [
      {
        paket_id: paket.id,
        tipe: 'PG',
        pertanyaan: 'Manakah di bawah ini yang merupakan ibu kota Indonesia?',
        opsi_a: 'Surabaya',
        opsi_b: 'Bandung',
        opsi_c: 'Jakarta',
        opsi_d: 'Medan',
        opsi_e: 'Semarang',
        kunci: 'C',
        skor_maks: 20
      },
      {
        paket_id: paket.id,
        tipe: 'PG Kompleks',
        pertanyaan: 'Pilihlah lebih dari satu hewan mamalia yang hidup di air:',
        opsi_a: 'Paus',
        opsi_b: 'Hiu',
        opsi_c: 'Lumba-lumba',
        opsi_d: 'Kuda Laut',
        opsi_e: 'Penyu',
        kunci: 'A,C',
        skor_maks: 20
      },
      {
        paket_id: paket.id,
        tipe: 'Isian',
        pertanyaan: 'Siapakah presiden pertama Republik Indonesia?',
        kunci: 'Soekarno',
        skor_maks: 20
      },
      {
        paket_id: paket.id,
        tipe: 'Essay',
        pertanyaan: 'Jelaskan bagaimana proses terjadinya hujan secara singkat!',
        kunci: '',
        skor_maks: 20
      },
      {
        paket_id: paket.id,
        tipe: 'Menjodohkan',
        pertanyaan: 'Pasangkan negara dengan ibu kotanya yang tepat!',
        opsi_a: 'Indonesia|Jakarta',
        opsi_b: 'Jepang|Tokyo',
        opsi_c: 'Korea Selatan|Seoul',
        kunci: 'Indonesia-Jakarta, Jepang-Tokyo, Korea Selatan-Seoul',
        skor_maks: 20
      }
    ];

    const { error: soalError } = await supabase.from('soal').insert(soalData);
    if (soalError) throw new Error(`Gagal membuat soal: ${soalError.message}`);

    // 4. Create Admin Demo Account
    const adminUsername = `demo_admin_${demoId}`;
    const adminPassword = generateRandomString(6);
    
    const { error: adminError } = await supabase
      .from('users')
      .insert({
        username: adminUsername,
        password: adminPassword,
        nama: `Admin Demo ${demoId}`,
        role: 'admin'
      });
      
    if (adminError) throw new Error(`Gagal membuat admin: ${adminError.message}`);

    // 5. Create Siswa Demo Account
    const siswaUsername = `demo_siswa_${demoId}`;
    const siswaPassword = generateRandomString(6);
    
    const { error: siswaError } = await supabase
      .from('users')
      .insert({
        username: siswaUsername,
        password: siswaPassword,
        nama: `Siswa Demo ${demoId}`,
        kelas_id: kelas.id,
        role: 'siswa',
        paket_aktif_id: paket.id
      });
      
    if (siswaError) throw new Error(`Gagal membuat siswa: ${siswaError.message}`);

    // Return all credentials
    return NextResponse.json({
      success: true,
      data: {
        admin: {
          username: adminUsername,
          password: adminPassword
        },
        siswa: {
          username: siswaUsername,
          password: siswaPassword
        },
        token: token
      }
    });

  } catch (error: any) {
    console.error('Demo Generation Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Terjadi kesalahan internal' },
      { status: 500 }
    );
  }
}
