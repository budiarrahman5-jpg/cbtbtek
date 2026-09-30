'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { Info, LogOut, PackageSearch, KeySquare, PlayCircle } from 'lucide-react';

export default function TokenPage() {
  const [user, setUser] = useState<any>(null);
  const [paketList, setPaketList] = useState<any[]>([]);
  const [selectedPaket, setSelectedPaket] = useState('');
  const [token, setToken] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedUser = localStorage.getItem('cbt_user');
    if (!savedUser) {
      router.push('/');
      return;
    }
    
    setUser(JSON.parse(savedUser));
    fetchPaketAktif();
  }, [router]);

  const fetchPaketAktif = async () => {
    let { data, error } = await supabase
      .from('paket')
      .select('*')
      .eq('status', 'Aktif');
      
    data = filterDemoData(data, 'paket');
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

    const paket = paketList.find(p => p.id === selectedPaket);
    if (!paket || paket.token.toUpperCase().trim() !== token.toUpperCase().trim()) {
      setErrorMsg('Token salah atau tidak sesuai paket!');
      return;
    }

    // Request Fullscreen SECARA INSTAN saat tombol diklik (User Gesture murni)
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        (document.documentElement as any).webkitRequestFullscreen();
      }
    } catch (e) {
      console.log('Gagal masuk ke mode fullscreen:', e);
    }

    setIsLoading(true);

    try {
      const { data: cekHasil } = await supabase
        .from('hasil')
        .select('*')
        .eq('user_id', user.id)
        .eq('paket_id', selectedPaket)
        .maybeSingle();
        
      if (cekHasil) {
        // Jika sudah pernah selesai, kembalikan dari fullscreen
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }

        // Cek apakah Mode Review diaktifkan oleh admin/pengawas di pengaturan
        const { data: pengReview } = await supabase
          .from('pengaturan')
          .select('nilai')
          .eq('kunci', 'mode_review')
          .maybeSingle();

        if (pengReview?.nilai === 'ON') {
          localStorage.setItem('cbt_paket', JSON.stringify(paket));
          localStorage.setItem(`cbt_jawaban_${user.id}_${paket.id}`, JSON.stringify(cekHasil.detail_jawaban || {}));
          router.push('/ujian?review=1');
          return;
        }

        setErrorMsg('Anda sudah menyelesaikan paket ujian ini! Silakan pilih paket lain.');
        setIsLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          status_ujian: 'Mengerjakan Ujian', 
          paket_aktif_id: selectedPaket,
          sisa_waktu: paket.durasi_menit * 60
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      localStorage.setItem('cbt_paket', JSON.stringify(paket));
      await supabase.from('log').insert({ user_id: user.id, aktivitas: `Mulai Ujian Paket: ${paket.nama_paket}` });

      router.push('/ujian');
    } catch (error: any) {
      console.error('Error di handleMulaiUjian:', error);
      const errorDetail = error?.message || error?.details || '';
      setErrorMsg(`Terjadi kesalahan. Silakan coba lagi. ${errorDetail ? '(' + errorDetail + ')' : ''}`);
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

  if (!user) return <div className="min-h-screen bg-slate-50 flex items-center justify-center animate-pulse">Memuat sesi ujian...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 w-full h-1/3 bg-gradient-to-b from-indigo-600/10 to-transparent pointer-events-none"></div>

      <div className="bg-white p-6 md:p-10 rounded-2xl shadow-xl w-full max-w-3xl z-10 border border-slate-100 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-teal-400 to-indigo-500 rounded-t-2xl"></div>
        
        <div className="flex justify-between items-center pb-6 border-b border-slate-100 mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">Konfirmasi Akses Ujian</h2>
            <p className="text-sm text-slate-500 mt-1">Sistem Ujian Berbasis Komputer</p>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2 font-semibold text-sm transition-all">
            <LogOut size={16} /> <span className="hidden md:inline">Keluar</span>
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200/60">
           <div className="flex-1">
             <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Peserta Ujian</p>
             <p className="text-lg md:text-xl font-bold text-slate-800 uppercase">{user.nama}</p>
             <div className="flex items-center gap-2 mt-2">
               <span className="bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-bold border border-indigo-200">
                 Kelas: {user.kelas?.nama_kelas || '-'}
               </span>
               <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-bold border border-emerald-200 flex items-center gap-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
               </span>
             </div>
           </div>
           
           <div className="flex-1 bg-white p-4 rounded-lg border border-slate-200 shadow-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Info size={64} />
             </div>
             <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-indigo-600">
               <Info size={16} /> Petunjuk Singkat
             </h3>
             <ul className="list-disc ml-4 text-xs space-y-1.5 text-slate-600 font-medium relative z-10">
               <li>Pilih paket ujian yang dijadwalkan.</li>
               <li>Masukkan token yang diberikan pengawas.</li>
               <li>JANGAN keluar dari layar penuh (*fullscreen*) selama ujian berlangsung.</li>
             </ul>
           </div>
        </div>

        {user?.username?.startsWith('demo_siswa_') && selectedPaket && (
           <div className="mb-6 bg-teal-50 border border-teal-200 text-teal-800 p-4 rounded-xl flex items-start gap-3 animate-in fade-in zoom-in duration-300">
             <Info className="w-5 h-5 text-teal-500 flex-shrink-0 mt-0.5" />
             <div>
               <p className="font-bold text-sm">Info Akun Demo</p>
               <p className="text-xs mt-1">
                 Gunakan token ujian berikut untuk paket yang Anda pilih: <strong className="bg-teal-200 px-2 py-0.5 rounded text-teal-900 ml-1 tracking-wider">{paketList.find(p => p.id === selectedPaket)?.token}</strong>
               </p>
             </div>
           </div>
        )}


        <div className="space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
              <PackageSearch size={16} className="text-teal-500" /> PILIH PAKET UJIAN <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select 
                className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl text-base font-semibold bg-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer hover:border-slate-300"
                value={selectedPaket}
                onChange={(e) => setSelectedPaket(e.target.value)}
              >
                <option value="">-- Silakan Pilih Paket Ujian --</option>
                {paketList.map(paket => (
                  <option key={paket.id} value={paket.id}>{paket.nama_paket} (Durasi: {paket.durasi_menit} Menit)</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-grow w-full">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                <KeySquare size={16} className="text-teal-500" /> TOKEN UJIAN <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl text-lg font-black text-center uppercase tracking-[0.2em] text-indigo-700 placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" 
                placeholder="XXXXXX"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            <button 
              onClick={handleMulaiUjian}
              disabled={isLoading}
              className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3.5 rounded-xl w-full md:w-auto font-bold text-sm md:text-base whitespace-nowrap transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-slate-800/20 hover:shadow-slate-800/40"
            >
              {isLoading ? (
                'MEMERIKSA...'
              ) : (
                <>
                  <PlayCircle size={20} /> MULAI UJIAN
                </>
              )}
            </button>
          </div>
          
          {errorMsg && (
            <div className="bg-red-50 text-red-600 border border-red-100 rounded-lg p-3 text-center text-sm font-bold animate-pulse">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
