'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { Info, LogOut, PackageSearch, KeySquare, PlayCircle, Edit3, UserCheck, X, AlertCircle } from 'lucide-react';

export default function TokenPage() {
  const [user, setUser] = useState<any>(null);
  const [paketList, setPaketList] = useState<any[]>([]);
  const [selectedPaket, setSelectedPaket] = useState('');
  const [token, setToken] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appName, setAppName] = useState('CBT B-TEK');
  const [appLogo, setAppLogo] = useState('/logo.png');
  const router = useRouter();

  // State Identitas Mandiri Tryout (Konsep 2)
  const [modalTryoutIdentitas, setModalTryoutIdentitas] = useState({
    isOpen: false,
    namaLengkap: '',
    asalSekolah: '', // Opsional
    kelasAsli: '',   // Opsional
    isSaving: false,
    error: '',
  });

  const updateFavicon = (url: string) => {
    if (typeof document === 'undefined') return;
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url || '/logo.png';
  };

  useEffect(() => {
    const cachedName = localStorage.getItem('cbt_app_name');
    if (cachedName) {
      setAppName(cachedName);
      document.title = `${cachedName} - Konfirmasi Akses Ujian`;
    }
    const cachedLogo = localStorage.getItem('cbt_app_logo');
    if (cachedLogo) {
      setAppLogo(cachedLogo);
      updateFavicon(cachedLogo);
    }

    const fetchConfig = async () => {
      const { data } = await supabase.from('pengaturan').select('*');
      if (data) {
        const nameItem = data.find((d: any) => d.kunci === 'nama_aplikasi');
        if (nameItem?.nilai) {
          setAppName(nameItem.nilai);
          localStorage.setItem('cbt_app_name', nameItem.nilai);
          document.title = `${nameItem.nilai} - Konfirmasi Akses Ujian`;
        }
        const logoItem = data.find((d: any) => d.kunci === 'logo_aplikasi');
        if (logoItem?.nilai) {
          setAppLogo(logoItem.nilai);
          localStorage.setItem('cbt_app_logo', logoItem.nilai);
          updateFavicon(logoItem.nilai);
        }
      }
    };
    fetchConfig();

    const savedUser = localStorage.getItem('cbt_user');
    if (!savedUser) {
      router.push('/');
      return;
    }
    
    const parsedUser = JSON.parse(savedUser);
    setUser(parsedUser);
    fetchPaketAktif();

    // Jika akun tryout belum diisi nama (masih default 'Peserta Tryout XX'), buka modal otomatis
    if (parsedUser.nama?.toLowerCase().startsWith('peserta tryout')) {
      setModalTryoutIdentitas(prev => ({
        ...prev,
        isOpen: true,
        namaLengkap: '',
      }));
    }
  }, [router]);

  const handleSaveTryoutIdentitas = async () => {
    if (!modalTryoutIdentitas.namaLengkap.trim()) {
      setModalTryoutIdentitas(prev => ({ ...prev, error: 'Nama Lengkap wajib diisi!' }));
      return;
    }

    setModalTryoutIdentitas(prev => ({ ...prev, isSaving: true, error: '' }));

    try {
      const cleanNama = modalTryoutIdentitas.namaLengkap.trim();
      const cleanSekolah = modalTryoutIdentitas.asalSekolah.trim();
      const cleanKelas = modalTryoutIdentitas.kelasAsli.trim();

      // Format nama: jika asal sekolah / kelas diisi (opsional), tambahkan di dalam kurung
      let finalNama = cleanNama;
      if (cleanSekolah && cleanKelas) {
        finalNama = `${cleanNama} (${cleanSekolah} - ${cleanKelas})`;
      } else if (cleanSekolah) {
        finalNama = `${cleanNama} (${cleanSekolah})`;
      } else if (cleanKelas) {
        finalNama = `${cleanNama} (${cleanKelas})`;
      }

      // Update di Supabase table 'users'
      const { error: errUpdate } = await supabase
        .from('users')
        .update({ nama: finalNama })
        .eq('id', user.id);

      if (errUpdate) throw errUpdate;

      // Update state user & localStorage
      const updatedUser = { ...user, nama: finalNama };
      setUser(updatedUser);
      localStorage.setItem('cbt_user', JSON.stringify(updatedUser));

      setModalTryoutIdentitas(prev => ({ ...prev, isOpen: false, isSaving: false }));
    } catch (err: any) {
      setModalTryoutIdentitas(prev => ({
        ...prev,
        isSaving: false,
        error: err.message || 'Gagal menyimpan identitas. Silakan coba lagi.'
      }));
    }
  };

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
    if (user?.nama?.toLowerCase().startsWith('peserta tryout')) {
      setErrorMsg('Harap lengkapi Nama Lengkap Anda terlebih dahulu sebelum memulai ujian!');
      setModalTryoutIdentitas(prev => ({ ...prev, isOpen: true }));
      return;
    }
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

      // 1. Ambil data terbaru siswa dari database agar status_ujian & sisa_waktu tidak stale
      const { data: freshUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const currentUser = freshUser || user;
      const durasiPaketDetik = (paket.durasi_menit || 60) * 60;

      // Siswa hanya dianggap 'melanjutkan' jika memang sedang mengerjakan paket yang SAMA
      // dan memiliki sisa waktu valid yang tidak melampaui batas wajar durasi paket
      const isResuming = 
        currentUser.paket_aktif_id === selectedPaket && 
        currentUser.status_ujian === 'Mengerjakan Ujian' &&
        currentUser.sisa_waktu &&
        currentUser.sisa_waktu > 0 &&
        currentUser.sisa_waktu <= (durasiPaketDetik + 1800);

      const userUpdate: any = { 
        status_ujian: 'Mengerjakan Ujian', 
        status_login: '1',
        paket_aktif_id: selectedPaket
      };

      if (!isResuming) {
        // SISWA BARU MULAI ATAU BARU DIRESET: Set sisa waktu tepat ke durasi paket penuh!
        userUpdate.sisa_waktu = durasiPaketDetik;
        userUpdate.jawaban_sementara = {};

        // Bersihkan seluruh cache timer & jawaban lama di browser ini untuk paket tersebut
        localStorage.removeItem(`cbt_timer_${user.id}_${paket.id}`);
        localStorage.removeItem(`cbt_jawaban_${user.id}_${paket.id}`);
        localStorage.removeItem(`cbt_ragu_${user.id}_${paket.id}`);
        localStorage.removeItem(`cbt_cheat_${user.id}_${paket.id}`);
        // Setel timer awal di localStorage tepat sama dengan durasi paket
        localStorage.setItem(`cbt_timer_${user.id}_${paket.id}`, durasiPaketDetik.toString());
      } else {
        userUpdate.sisa_waktu = currentUser.sisa_waktu;
        localStorage.setItem(`cbt_timer_${user.id}_${paket.id}`, currentUser.sisa_waktu.toString());
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(userUpdate)
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Simpan user terbaru ke localStorage agar tidak membawa sisa_waktu usang
      const updatedUserObj = { ...currentUser, ...userUpdate };
      localStorage.setItem('cbt_user', JSON.stringify(updatedUserObj));
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
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 p-1 flex items-center justify-center shadow-sm flex-shrink-0">
              <img 
                src={appLogo} 
                alt="Logo" 
                className="w-full h-full object-contain aspect-square" 
                onError={(e) => { (e.target as any).src = '/logo.png'; }} 
              />
            </div>
            <div>
              <span className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 uppercase tracking-wider mb-0.5">
                {appName}
              </span>
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">Konfirmasi Akses Ujian</h2>
              <p className="text-sm text-slate-500 mt-0.5">Sistem Ujian Berbasis Komputer</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2 font-semibold text-sm transition-all">
            <LogOut size={16} /> <span className="hidden md:inline">Keluar</span>
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6 mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200/60">
           <div className="flex-1">
             <div className="flex items-center justify-between mb-1">
               <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Peserta Ujian</p>
               <button
                 type="button"
                 onClick={() => setModalTryoutIdentitas({
                   isOpen: true,
                   namaLengkap: user.nama?.toLowerCase().startsWith('peserta tryout') ? '' : user.nama || '',
                   asalSekolah: '',
                   kelasAsli: '',
                   isSaving: false,
                   error: ''
                 })}
                 className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline"
                 title="Klik untuk mengubah nama peserta"
               >
                 <Edit3 size={13} />
                 <span>{user.nama?.toLowerCase().startsWith('peserta tryout') ? 'Isi Nama Lengkap' : 'Ubah Nama'}</span>
               </button>
             </div>
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

      {/* MODAL INPUT IDENTITAS PESERTA TRYOUT (KONSEP 2) */}
      {modalTryoutIdentitas.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200">
            {/* Tombol X hanya bisa ditutup jika siswa bukan lagi berstatus default 'Peserta Tryout XX' */}
            {!user.nama?.toLowerCase().startsWith('peserta tryout') && (
              <button
                type="button"
                onClick={() => setModalTryoutIdentitas(prev => ({ ...prev, isOpen: false }))}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all"
              >
                <X size={20} />
              </button>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-md shadow-indigo-500/30">
                <UserCheck size={22} />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-800">Identitas Peserta Ujian</h3>
                <p className="text-xs text-slate-500">Nama akan dicantumkan pada rekap hasil ujian</p>
              </div>
            </div>

            {modalTryoutIdentitas.error && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-xs font-bold mb-4 flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{modalTryoutIdentitas.error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Nama Lengkap Siswa <span className="text-red-500">* (Wajib)</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={modalTryoutIdentitas.namaLengkap}
                  onChange={e => setModalTryoutIdentitas(prev => ({ ...prev, namaLengkap: e.target.value, error: '' }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveTryoutIdentitas();
                  }}
                  className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:font-normal placeholder:text-slate-400 uppercase"
                  placeholder="Ketik Nama Lengkap Anda..."
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Asal Sekolah</label>
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Opsional</span>
                </div>
                <input
                  type="text"
                  value={modalTryoutIdentitas.asalSekolah}
                  onChange={e => setModalTryoutIdentitas(prev => ({ ...prev, asalSekolah: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveTryoutIdentitas();
                  }}
                  className="w-full border-2 border-slate-200 p-3 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400"
                  placeholder="Misal: SMPN 1 Jakarta / SMA Negeri 2"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Kelas Asli di Sekolah</label>
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Opsional</span>
                </div>
                <input
                  type="text"
                  value={modalTryoutIdentitas.kelasAsli}
                  onChange={e => setModalTryoutIdentitas(prev => ({ ...prev, kelasAsli: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveTryoutIdentitas();
                  }}
                  className="w-full border-2 border-slate-200 p-3 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-400 uppercase"
                  placeholder="Misal: IX A / XII MIPA 1"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-500 leading-relaxed">
                ℹ️ <em>Catatan:</em> Asal sekolah dan kelas bersifat <strong>opsional</strong>. Pastikan Nama Lengkap sudah benar karena akan otomatis tercantum pada ranking nilai dan pencetakan hasil.
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              {!user.nama?.toLowerCase().startsWith('peserta tryout') && (
                <button
                  type="button"
                  disabled={modalTryoutIdentitas.isSaving}
                  onClick={() => setModalTryoutIdentitas(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Batal
                </button>
              )}
              <button
                type="button"
                disabled={modalTryoutIdentitas.isSaving}
                onClick={handleSaveTryoutIdentitas}
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-indigo-600/30 text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {modalTryoutIdentitas.isSaving ? 'Menyimpan...' : 'Simpan & Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
