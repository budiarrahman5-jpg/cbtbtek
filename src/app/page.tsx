'use client';

import { useState, useEffect } from 'react';
import { Monitor, UserCircle, KeyRound, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appName, setAppName] = useState('CBT B-TEK');
  const [appLogo, setAppLogo] = useState('/logo.png');
  const router = useRouter();

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
    const cached = localStorage.getItem('cbt_app_name');
    if (cached) {
      setAppName(cached);
      document.title = `${cached} - Platform Ujian`;
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
          document.title = `${nameItem.nilai} - Platform Ujian`;
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
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username || !password) {
      setErrorMsg('Username dan Password wajib diisi!');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, kelas(nama_kelas)')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        setErrorMsg('Username atau Password salah!');
        setIsLoading(false);
        return;
      }

      if (data.username.startsWith('demo_')) {
        const createdAt = new Date(data.created_at);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - createdAt.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) {
          setErrorMsg('Akun demo ini telah kedaluwarsa. Silakan buat akun demo baru.');
          setIsLoading(false);
          return;
        }
      }

      // Proteksi login ganda (status_login === '1') hanya berlaku untuk siswa
      if (data.role?.toLowerCase() !== 'admin' && data.status_login === '1') {
        setErrorMsg('Akun sedang aktif di perangkat lain! Hubungi pengawas.');
        setIsLoading(false);
        return;
      }

      await supabase.from('users').update({ status_login: '1' }).eq('id', data.id);
      await supabase.from('log').insert({ user_id: data.id, aktivitas: 'Login Aplikasi' });

      localStorage.setItem('cbt_user', JSON.stringify(data));
      
      if (data.role.toLowerCase() === 'admin') {
        router.push('/admin');
      } else {
        router.push('/token');
      }

    } catch (err) {
      console.error(err);
      setErrorMsg('Terjadi kesalahan pada server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-hidden bg-slate-50 text-slate-800 selection:bg-blue-100 selection:text-blue-900">
      {/* Dynamic Soft Ambient Dots / Lighting */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-400/10 rounded-full filter blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-red-400/10 rounded-full filter blur-[100px] pointer-events-none"></div>

      {/* Header Bagian Atas: Warna Biru dan Merah Sesuai Logo */}
      <header className="relative z-10 bg-gradient-to-r from-blue-700 via-indigo-700 to-red-600 text-white p-4 shadow-md flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white p-1 flex items-center justify-center shadow-lg border border-white/30 flex-shrink-0">
            <img 
              src={appLogo} 
              alt="Logo" 
              className="w-full h-full object-contain aspect-square" 
              onError={(e) => { (e.target as any).src = '/logo.png'; }} 
            />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold tracking-wide text-white leading-tight">{appName}</h1>
            <p className="text-xs text-blue-100/90 font-medium">Platform Ujian Berbasis Komputer</p>
          </div>
        </div>
      </header>

      {/* Main Content Area - Tema Putih Bersih & Cantik */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10 my-4 sm:my-8">
        <div className="w-full max-w-md">
          {/* Card Putih Elegan dengan Shadow Mewah */}
          <div className="bg-white border border-slate-200/90 p-8 sm:p-10 rounded-3xl shadow-[0_20px_50px_rgba(30,58,138,0.09)] relative overflow-hidden">
            {/* Top Border Accent Biru-Merah */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-red-600"></div>

            {/* Logo Utama Terpusat di Card */}
            <div className="text-center mb-6 pt-2">
              <div className="w-20 h-20 mx-auto mb-3 bg-white rounded-2xl p-2 shadow-md border border-slate-200 flex items-center justify-center transition-transform hover:scale-105 duration-200">
                <img 
                  src={appLogo} 
                  alt="Logo" 
                  className="w-full h-full object-contain aspect-square" 
                  onError={(e) => { (e.target as any).src = '/logo.png'; }} 
                />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-1 tracking-tight">Selamat Datang</h2>
              <p className="text-slate-500 text-xs font-medium">Silakan masuk untuk memulai sesi ujian Anda</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    <UserCircle className="w-5 h-5" />
                  </div>
                  <input 
                    type="text" 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none text-slate-800 placeholder-slate-400 text-sm font-semibold transition-all"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <input 
                    type="password" 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none text-slate-800 placeholder-slate-400 text-sm font-semibold transition-all"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs font-semibold animate-pulse">
                  {errorMsg}
                </div>
              )}
              
              {/* Tombol Login Gradasi Biru ke Merah */}
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-red-600 hover:from-blue-700 hover:via-indigo-700 hover:to-red-700 text-white py-3.5 rounded-xl font-black text-sm shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-5 uppercase tracking-wider"
              >
                {isLoading ? 'Memproses...' : (
                  <>
                    <span>MULAI UJIAN</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
          
          <div className="text-center mt-6">
            <p className="text-xs text-slate-400 font-semibold tracking-wide">
              &copy; {new Date().getFullYear()} {appName} by @budhii12
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
