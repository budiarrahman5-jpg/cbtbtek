'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Info, LogOut } from 'lucide-react';

export default function TokenPage() {
  const [user, setUser] = useState<any>(null);
  const [paketList, setPaketList] = useState<any[]>([]);
  const [selectedPaket, setSelectedPaket] = useState('');
  const [token, setToken] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Cek sesi user
    const savedUser = localStorage.getItem('cbt_user');
    if (!savedUser) {
      router.push('/');
      return;
    }
    
    setUser(JSON.parse(savedUser));
    fetchPaketAktif();
  }, [router]);

  const fetchPaketAktif = async () => {
    const { data, error } = await supabase
      .from('paket')
      .select('*')
      .eq('status', 'Aktif');
      
    if (data) {
      setPaketList(data);
    }
  };

  const handleMulaiUjian = async () => {
    setErrorMsg('');
    if (!selectedPaket) {
      setErrorMsg('Silakan pilih paket soal terlebih dahulu!');
      return;
    }
    if (!token) {
      setErrorMsg('Token wajib diisi!');
      return;
    }

    setIsLoading(true);

    try {
      // Cek apakah siswa sudah mengerjakan paket ini
      const { data: cekHasil } = await supabase
        .from('hasil')
        .select('*')
        .eq('user_id', user.id)
        .eq('paket_id', selectedPaket)
        .single();
        
      if (cekHasil) {
        setErrorMsg('Anda sudah menyelesaikan paket ujian ini! Silakan pilih paket lain.');
        setIsLoading(false);
        return;
      }

      // Validasi Token
      const paket = paketList.find(p => p.id === selectedPaket);
      if (!paket || paket.token.toUpperCase() !== token.toUpperCase()) {
        setErrorMsg('Token salah atau tidak sesuai paket!');
        setIsLoading(false);
        return;
      }

      // Cek pengaturan proteksi layar (opsional, bisa diambil dari DB)
      // Jika butuh fullscreen, kita bisa paksa di client side

      // Set session aktif
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          status_ujian: 'Mengerjakan Ujian', 
          paket_aktif_id: selectedPaket,
          sisa_waktu: paket.durasi_menit * 60 // konversi ke detik
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Simpan state paket ke localstorage untuk sesi ujian
      localStorage.setItem('cbt_paket', JSON.stringify(paket));
      
      // Catat log
      await supabase.from('log').insert({ user_id: user.id, aktivitas: `Mulai Ujian Paket: ${paket.nama_paket}` });

      router.push('/ujian');
    } catch (error) {
      console.error(error);
      setErrorMsg('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (user) {
      await supabase.from('users').update({ status_login: '0' }).eq('id', user.id);
      localStorage.removeItem('cbt_user');
      router.push('/');
    }
  };

  if (!user) return <div className="min-h-screen bg-gray-100 flex items-center justify-center">Memuat...</div>;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-lg w-full max-w-2xl">
        <div className="flex justify-between items-center border-b pb-2 mb-4">
          <h2 className="text-xl md:text-2xl font-bold text-blue-800">Konfirmasi Paket & Token</h2>
          <button onClick={handleLogout} className="text-red-500 hover:text-red-700 flex items-center gap-1 font-semibold text-sm">
            <LogOut size={16} /> Keluar
          </button>
        </div>
        
        <div className="mb-4 text-center md:text-left">
           <p className="text-base md:text-lg font-semibold text-gray-700">Selamat Datang, <span className="text-blue-600 uppercase font-bold">{user.nama}</span>!</p>
           <p className="text-sm font-semibold text-gray-500 mt-1">
             Kelas: <span className="text-blue-800 font-bold bg-blue-100 px-2 py-0.5 rounded border border-blue-200">{user.kelas?.nama_kelas || '-'}</span>
           </p>
        </div>

        <div className="bg-blue-50 p-3 md:p-4 rounded-md mb-6 border border-blue-200">
          <h3 className="font-bold text-base md:text-lg mb-2 flex items-center gap-2">
            <Info className="text-blue-600" size={20} /> Petunjuk Ujian:
          </h3>
          <ul className="list-disc ml-5 text-xs md:text-sm space-y-1 text-gray-700">
            <li>Pilih <b>Paket Ujian</b> sesuai instruksi dari pengawas.</li>
            <li>Sistem akan menggunakan mode layar penuh (Fullscreen) saat ujian dimulai.</li>
            <li><b>JANGAN</b> keluar dari fullscreen atau pindah tab browser. Sesi Anda dapat diblokir otomatis.</li>
          </ul>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-700 mb-2">PILIH PAKET UJIAN <span className="text-red-500">*</span></label>
          <select 
            className="w-full px-3 py-2 md:px-4 md:py-3 border-2 border-gray-300 rounded-md text-base md:text-lg font-semibold bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedPaket}
            onChange={(e) => setSelectedPaket(e.target.value)}
          >
            <option value="">- Pilih Paket Ujian -</option>
            {paketList.map(paket => (
              <option key={paket.id} value={paket.id}>{paket.nama_paket} - {paket.durasi_menit} Menit</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-end">
          <div className="flex-grow w-full">
            <label className="block text-sm font-bold text-gray-700 mb-2">TOKEN UJIAN <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              className="w-full px-3 py-2 md:px-4 md:py-3 border-2 border-gray-300 rounded-md text-lg md:text-xl font-bold text-center uppercase focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="MASUKKAN TOKEN"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <button 
            onClick={handleMulaiUjian}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 shadow text-white px-4 py-3 md:px-8 rounded-md min-h-[54px] w-full md:w-auto font-bold text-sm md:text-base whitespace-normal transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Memeriksa...' : 'MULAI UJIAN'}
          </button>
        </div>
        
        {errorMsg && <p className="text-red-500 mt-3 font-semibold text-center text-sm md:text-base">{errorMsg}</p>}
      </div>
    </div>
  );
}
