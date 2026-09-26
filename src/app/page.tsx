'use client';

import { useState } from 'react';
import { Monitor, UserCircle, Clock, Grid } from 'lucide-react';
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
      // Fetch user dari Supabase
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

      if (data.status_login === '1') {
        setErrorMsg('Akun sedang aktif di perangkat lain! Minta admin untuk mereset sesi.');
        setIsLoading(false);
        return;
      }

      // Update status login
      await supabase.from('users').update({ status_login: '1' }).eq('id', data.id);
      
      // Catat log aktivitas (opsional)
      await supabase.from('log').insert({ user_id: data.id, aktivitas: 'Login Aplikasi' });

      // Simpan sesi di localStorage
      localStorage.setItem('cbt_user', JSON.stringify(data));
      
      // Redirect ke halaman token ujian
      router.push('/token');

    } catch (err) {
      console.error(err);
      setErrorMsg('Terjadi kesalahan pada server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-blue-800 text-white p-3 md:p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center gap-2 md:gap-3">
          <Monitor className="w-6 h-6 md:w-7 md:h-7" />
          <h1 className="text-sm md:text-xl font-bold tracking-wider truncate">CBT B-TEK - Ujian Online</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border-t-4 border-blue-600">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-700">LOGIN PESERTA</h2>
          
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Username</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-600 mb-2">Password</label>
              <input 
                type="password" 
                className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-bold transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Memproses...' : 'MASUK UJIAN'}
            </button>
            
            {errorMsg && (
              <p className="text-red-500 text-center mt-3 text-sm font-semibold">{errorMsg}</p>
            )}
          </form>

          <p className="text-center text-xs text-gray-400 mt-6 pt-4 border-t border-gray-100">
            CBT B-Tek dibuat oleh @budhii12 &copy; 2026
          </p>
        </div>
      </main>
    </div>
  );
}
