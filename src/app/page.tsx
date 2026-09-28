'use client';

import { useState } from 'react';
import { Monitor, UserCircle, KeyRound, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

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

      if (data.status_login === '1') {
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
    <div className="min-h-screen flex flex-col font-sans relative overflow-hidden bg-slate-900">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-50 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-teal-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] bg-blue-700 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-blob animation-delay-4000"></div>

      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-lg border-b border-white/10 text-white p-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-500 to-teal-400 p-2 rounded-lg shadow-lg">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-wider leading-tight">CBT B-TEK</h1>
            <p className="text-xs text-blue-200 opacity-80">Platform Ujian Berbasis Komputer</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-md">
          {/* Glassmorphism Card */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Selamat Datang</h2>
              <p className="text-indigo-200 text-sm">Silakan masuk untuk memulai sesi ujian Anda</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-indigo-200 mb-2 uppercase tracking-wider">Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-indigo-300 group-focus-within:text-teal-400 transition-colors">
                    <UserCircle className="w-5 h-5" />
                  </div>
                  <input 
                    type="text" 
                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none text-white placeholder-indigo-300/50 transition-all"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-indigo-200 mb-2 uppercase tracking-wider">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-indigo-300 group-focus-within:text-teal-400 transition-colors">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <input 
                    type="password" 
                    className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none text-white placeholder-indigo-300/50 transition-all"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm font-medium animate-pulse">
                  {errorMsg}
                </div>
              )}
              
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-500 to-teal-400 hover:from-indigo-400 hover:to-teal-300 text-white py-3.5 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_25px_rgba(45,212,191,0.6)] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-6"
              >
                {isLoading ? 'Memproses...' : (
                  <>
                    MULAI UJIAN 
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          </div>
          
          <div className="text-center mt-8">
            <p className="text-xs text-white/40 font-medium tracking-wide">
              &copy; 2026 CBT B-TEK by @budhii12
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
