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
    <div className="min-h-screen flex flex-col font-sans relative overflow-hidden bg-zinc-950 text-zinc-100 selection:bg-zinc-800 selection:text-white">
      {/* Dynamic Neutral Ambience (Tidak bentrok dengan warna logo apapun) */}
      <div className="absolute top-[-25%] left-[-15%] w-[600px] h-[600px] bg-zinc-800/40 rounded-full filter blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-slate-800/40 rounded-full filter blur-[120px] pointer-events-none"></div>

      {/* Header Netral */}
      <header className="relative z-10 bg-zinc-900/60 backdrop-blur-md border-b border-zinc-800/80 p-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white p-1 flex items-center justify-center shadow-md border border-zinc-200 flex-shrink-0">
            <img 
              src={appLogo} 
              alt="Logo" 
              className="w-full h-full object-contain aspect-square" 
              onError={(e) => { (e.target as any).src = '/logo.png'; }} 
            />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold tracking-wide text-white leading-tight">{appName}</h1>
            <p className="text-xs text-zinc-400 font-medium">Platform Ujian Berbasis Komputer</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md">
          {/* Neutral Glassmorphism Card */}
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/90 p-8 rounded-3xl shadow-2xl shadow-black/40">
            
            {/* Logo Utama Terpusat di Card */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-2xl p-2.5 shadow-xl border border-zinc-200 flex items-center justify-center transition-transform hover:scale-105 duration-200">
                <img 
                  src={appLogo} 
                  alt="Logo" 
                  className="w-full h-full object-contain aspect-square" 
                  onError={(e) => { (e.target as any).src = '/logo.png'; }} 
                />
              </div>
              <h2 className="text-2xl font-extrabold text-white mb-1.5 tracking-tight">Selamat Datang</h2>
              <p className="text-zinc-400 text-xs">Silakan masuk untuk memulai sesi ujian Anda</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wider">Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-400 group-focus-within:text-white transition-colors">
                    <UserCircle className="w-5 h-5" />
                  </div>
                  <input 
                    type="text" 
                    className="w-full pl-10 pr-4 py-3 bg-zinc-950/60 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400 outline-none text-white placeholder-zinc-500 text-sm font-medium transition-all"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-400 group-focus-within:text-white transition-colors">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <input 
                    type="password" 
                    className="w-full pl-10 pr-4 py-3 bg-zinc-950/60 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400 outline-none text-white placeholder-zinc-500 text-sm font-medium transition-all"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="bg-red-950/60 border border-red-800/80 text-red-200 px-4 py-2.5 rounded-xl text-xs font-semibold animate-pulse">
                  {errorMsg}
                </div>
              )}
              
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-white hover:bg-zinc-100 text-zinc-950 py-3.5 rounded-xl font-extrabold text-sm shadow-lg shadow-black/20 hover:shadow-black/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-4 uppercase tracking-wider"
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
            <p className="text-xs text-zinc-500 font-medium tracking-wide">
              &copy; {new Date().getFullYear()} {appName} by @budhii12
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
