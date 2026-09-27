'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, CheckCircle, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell
} from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    peserta: 0,
    selesai: 0,
    rataRata: 0,
    cheat: 0,
  });
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [distribusiData, setDistribusiData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    setIsRefreshing(true);
    try {
      // Ambil total user (peserta)
      const { count: countPeserta } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'siswa');

      // Ambil hasil ujian
      const { data: hasilData } = await supabase
        .from('hasil')
        .select('skor_akhir, cheat_count, users(kelas(nama_kelas))');

      let selesai = 0;
      let totalSkor = 0;
      let totalCheat = 0;
      
      const kelasStatMap: Record<string, { total: number, count: number }> = {};
      const rentangMap = {
        '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0
      };

      if (hasilData) {
        selesai = hasilData.length;
        hasilData.forEach(h => {
          const skor = h.skor_akhir || 0;
          totalSkor += skor;
          totalCheat += h.cheat_count || 0;
          
          // Data untuk Rata-rata per kelas
          // @ts-ignore
          const kelasNama = h.users?.kelas?.nama_kelas || 'Tanpa Kelas';
          if (!kelasStatMap[kelasNama]) {
            kelasStatMap[kelasNama] = { total: 0, count: 0 };
          }
          kelasStatMap[kelasNama].total += skor;
          kelasStatMap[kelasNama].count += 1;
          
          // Data untuk Distribusi
          if (skor <= 20) rentangMap['0-20']++;
          else if (skor <= 40) rentangMap['21-40']++;
          else if (skor <= 60) rentangMap['41-60']++;
          else if (skor <= 80) rentangMap['61-80']++;
          else rentangMap['81-100']++;
        });
      }

      const rataRata = selesai > 0 ? Math.round(totalSkor / selesai) : 0;

      setStats({
        peserta: countPeserta || 0,
        selesai,
        rataRata,
        cheat: totalCheat,
      });
      
      // Format data untuk Bar Chart
      const formattedChartData = Object.keys(kelasStatMap).map(k => ({
        kelas: k,
        rata_rata: Math.round(kelasStatMap[k].total / kelasStatMap[k].count)
      })).sort((a, b) => b.rata_rata - a.rata_rata);
      
      setChartData(formattedChartData.length > 0 ? formattedChartData : [{ kelas: 'Belum Ada Data', rata_rata: 0 }]);
      
      // Format data untuk Area Chart
      setDistribusiData(
        Object.keys(rentangMap).map(key => ({
          rentang: key,
          jumlah: rentangMap[key as keyof typeof rentangMap]
        }))
      );

    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsRefreshing(false), 500); // Visual delay for button
    }
  };

  const COLORS = ['#6366f1', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Segarkan */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Ringkasan Eksekutif</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Pantau performa ujian secara *real-time*.</p>
        </div>
        <button 
          onClick={fetchStats}
          disabled={isLoading || isRefreshing}
          className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-5 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 active:scale-95 border border-indigo-100"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Menyinkronkan...' : 'Sinkronkan Data'}</span>
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Peserta */}
        <div className="bg-white p-6 rounded-2xl shadow-xl shadow-blue-500/10 border-b-4 border-blue-500 hover:-translate-y-1 transition-transform duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-500/80 text-xs font-black uppercase tracking-widest">Total Peserta</p>
              <h3 className="text-4xl font-black mt-2 text-slate-800">{isLoading ? '...' : stats.peserta}</h3>
            </div>
            <div className="p-3.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/30 text-white">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Selesai Ujian */}
        <div className="bg-white p-6 rounded-2xl shadow-xl shadow-emerald-500/10 border-b-4 border-emerald-500 hover:-translate-y-1 transition-transform duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-500/80 text-xs font-black uppercase tracking-widest">Telah Selesai</p>
              <h3 className="text-4xl font-black mt-2 text-slate-800">{isLoading ? '...' : stats.selesai}</h3>
            </div>
            <div className="p-3.5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/30 text-white">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Rata-Rata Nilai */}
        <div className="bg-white p-6 rounded-2xl shadow-xl shadow-amber-500/10 border-b-4 border-amber-500 hover:-translate-y-1 transition-transform duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-amber-500/80 text-xs font-black uppercase tracking-widest">Rata-Rata Nilai</p>
              <h3 className="text-4xl font-black mt-2 text-slate-800">{isLoading ? '...' : stats.rataRata}</h3>
            </div>
            <div className="p-3.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg shadow-amber-500/30 text-white">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Pelanggaran / Cheat */}
        <div className="bg-white p-6 rounded-2xl shadow-xl shadow-red-500/10 border-b-4 border-red-500 hover:-translate-y-1 transition-transform duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-red-500/80 text-xs font-black uppercase tracking-widest">Indikasi Curang</p>
              <h3 className="text-4xl font-black mt-2 text-slate-800">{isLoading ? '...' : stats.cheat}</h3>
            </div>
            <div className="p-3.5 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg shadow-red-500/30 text-white">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Grafik Interaktif dengan Recharts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Grafik Rata-Rata Kelas */}
        <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 xl:col-span-2 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <TrendingUp className="text-indigo-500" size={20}/> Peringkat Rata-Rata Kelas
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-1">Perbandingan nilai rata-rata ujian antar kelas secara langsung.</p>
          </div>
          
          <div className="flex-1 min-h-[300px] w-full">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-bold text-slate-400">Memuat Grafik...</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="kelas" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 600}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="rata_rata" name="Nilai Rata-rata" radius={[8, 8, 0, 0]} animationDuration={1500}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Grafik Distribusi Rentang Nilai */}
        <div className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <CheckCircle className="text-teal-500" size={20}/> Distribusi Nilai Siswa
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-1">Pemetaan rentang nilai dari 0 hingga 100.</p>
          </div>
          
          <div className="flex-1 min-h-[300px] w-full">
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-bold text-slate-400">Memuat Kurva...</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={distribusiData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorJumlah" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="rentang" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 600}} />
                  <Tooltip 
                    cursor={{stroke: '#14b8a6', strokeWidth: 2, strokeDasharray: '3 3'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="jumlah" 
                    name="Jumlah Siswa" 
                    stroke="#14b8a6" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorJumlah)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
