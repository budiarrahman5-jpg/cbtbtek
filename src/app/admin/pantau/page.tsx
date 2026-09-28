'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { MonitorPlay, Search, RefreshCw, PowerOff, CheckCircle2, Clock, XCircle, Trash2 } from 'lucide-react';
import clsx from 'clsx';

export default function PantauSiswaPage() {
  const [siswa, setSiswa] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
    
    // Auto-refresh setiap 30 detik (opsional)
    const intervalId = setInterval(() => {
      fetchData(false);
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setIsRefreshing(true);
    
    try {
      let { data } = await supabase
        .from('users')
        .select('*, kelas(nama_kelas)')
        .eq('role', 'siswa')
        .order('status_login', { ascending: false }) // Yang online di atas
        .order('nama');
        
      data = filterDemoData(data, 'users');
      if (data) setSiswa(data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleResetLogin = async (id: string, nama: string) => {
    if (!confirm(`Paksa logout / Reset sesi ujian untuk ${nama}?`)) return;
    
    try {
      await supabase.from('users').update({ status_login: '0' }).eq('id', id);
      fetchData(false);
      alert('Status login berhasil direset.');
    } catch (error) {
      alert('Gagal mereset status login.');
    }
  };

  const handleResetUjian = async (id: string, nama: string) => {
    if (!confirm(`Yakin ingin mereset ujian siswa ${nama}? Ini akan menghapus hasil secara permanen dan mereset status ujian sehingga siswa dapat mengikuti ujian ini lagi dari awal.`)) return;

    try {
      await supabase.from('hasil').delete().eq('user_id', id);
      await supabase.from('users').update({ status_ujian: 'Belum Ujian', status_login: '0' }).eq('id', id);
      
      alert('Ujian berhasil direset!');
      fetchData(false);
    } catch (error) {
      alert('Gagal mereset ujian.');
    }
  };

  const filteredSiswa = siswa.filter(s => 
    s.nama?.toLowerCase().includes(search.toLowerCase()) || 
    s.username?.toLowerCase().includes(search.toLowerCase()) ||
    s.kelas?.nama_kelas?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: siswa.length,
    online: siswa.filter(s => s.status_login === '1').length,
    selesai: siswa.filter(s => s.status_ujian === 'Selesai').length,
    belumMulai: siswa.filter(s => s.status_ujian !== 'Selesai' && s.status_login !== '1').length,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Stats */}
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 flex flex-col justify-center">
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><MonitorPlay size={24} /></div> 
              Live Monitoring Ujian
            </h2>
            <button 
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-50 active:scale-95 border border-slate-200"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
            </button>
          </div>
          <p className="text-sm text-slate-500 font-medium ml-12">
            Pantau status pengerjaan ujian siswa secara real-time. Data diperbarui otomatis setiap 30 detik.
          </p>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 xl:pb-0 custom-scrollbar">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl min-w-[140px] flex flex-col justify-center shadow-sm">
            <p className="text-emerald-600/80 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Sedang Ujian</p>
            <h3 className="text-3xl font-black text-emerald-700">{stats.online}</h3>
          </div>
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl min-w-[140px] flex flex-col justify-center shadow-sm">
            <p className="text-blue-600/80 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><CheckCircle2 size={12}/> Sudah Selesai</p>
            <h3 className="text-3xl font-black text-blue-700">{stats.selesai}</h3>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl min-w-[140px] flex flex-col justify-center shadow-sm">
            <p className="text-slate-500/80 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={12}/> Belum Mulai</p>
            <h3 className="text-3xl font-black text-slate-700">{stats.belumMulai}</h3>
          </div>
        </div>
      </div>

      {/* Tabel Pemantauan */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800">Status Peserta Ujian</h3>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari siswa atau kelas..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 pr-4 py-3 w-full border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-medium text-sm transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead className="bg-white text-slate-500 sticky top-0 z-10 shadow-sm uppercase text-xs tracking-wider font-bold">
              <tr>
                <th className="p-4 border-b border-slate-100 w-16 text-center">No</th>
                <th className="p-4 border-b border-slate-100">Informasi Siswa</th>
                <th className="p-4 border-b border-slate-100">Sesi Login</th>
                <th className="p-4 border-b border-slate-100">Progres Ujian</th>
                <th className="p-4 border-b border-slate-100 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-12 text-center text-indigo-500 font-bold animate-pulse">Memuat data live monitoring...</td></tr>
              ) : filteredSiswa.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-400 font-medium">Tidak ada data peserta.</td></tr>
              ) : (
                filteredSiswa.map((s, idx) => {
                  const isOnline = s.status_login === '1';
                  const isSelesai = s.status_ujian === 'Selesai';
                  
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0 group">
                      <td className="p-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-4">
                        <div className="font-black text-slate-800 text-base">{s.nama}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{s.username}</span>
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">{s.kelas?.nama_kelas || '-'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        {isOnline ? (
                          <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Aktif
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border border-slate-200">
                            <XCircle size={14} /> Terputus / Belum Login
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {isSelesai ? (
                          <div className="flex flex-col">
                            <span className="font-black text-blue-600 flex items-center gap-1"><CheckCircle2 size={16}/> Selesai</span>
                            <span className="text-xs font-medium text-slate-400 mt-0.5">Sudah submit hasil</span>
                          </div>
                        ) : isOnline ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-emerald-600 flex items-center gap-1">Mengerjakan</span>
                            <span className="text-xs font-medium text-emerald-400 mt-0.5">Sedang dalam ujian</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium">Belum Mulai</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isOnline && (
                            <button 
                              onClick={() => handleResetLogin(s.id, s.nama)}
                              className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white px-3 py-2 rounded-lg font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                              title="Jika siswa mengalami error/keluar mendadak dan tidak bisa login"
                            >
                              <PowerOff size={14} /> Reset Sesi
                            </button>
                          )}
                          <button 
                            onClick={() => handleResetUjian(s.id, s.nama)}
                            className="text-xs bg-red-100 text-red-700 hover:bg-red-500 hover:text-white px-3 py-2 rounded-lg font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                            title="Hapus hasil dan kembalikan status ke Belum Ujian"
                          >
                            <Trash2 size={14} /> Reset Ujian
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
