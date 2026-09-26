'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    peserta: 0,
    selesai: 0,
    rataRata: 0,
    cheat: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      // Ambil total user (peserta)
      const { count: countPeserta } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'siswa');

      // Ambil hasil ujian
      const { data: hasilData } = await supabase
        .from('hasil')
        .select('skor_akhir, cheat_count');

      let selesai = 0;
      let totalSkor = 0;
      let totalCheat = 0;

      if (hasilData) {
        selesai = hasilData.length;
        hasilData.forEach(h => {
          totalSkor += h.skor_akhir || 0;
          totalCheat += h.cheat_count || 0;
        });
      }

      const rataRata = selesai > 0 ? Math.round(totalSkor / selesai) : 0;

      setStats({
        peserta: countPeserta || 0,
        selesai,
        rataRata,
        cheat: totalCheat,
      });

    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tombol Segarkan */}
      <div className="flex justify-end">
        <button 
          onClick={fetchStats}
          disabled={isLoading}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold transition-all disabled:opacity-50"
        >
          <svg 
            className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} 
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Segarkan Data
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Peserta */}
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-bold uppercase">Total Peserta</p>
              <h3 className="text-3xl font-black mt-2 text-blue-800">{isLoading ? '...' : stats.peserta}</h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-full">
              <Users className="text-blue-500 w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Selesai Ujian */}
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-bold uppercase">Selesai Ujian</p>
              <h3 className="text-3xl font-black mt-2 text-green-700">{isLoading ? '...' : stats.selesai}</h3>
            </div>
            <div className="p-3 bg-green-50 rounded-full">
              <CheckCircle className="text-green-500 w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Rata-Rata Nilai */}
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-yellow-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-bold uppercase">Rata-Rata Nilai</p>
              <h3 className="text-3xl font-black mt-2 text-yellow-600">{isLoading ? '...' : stats.rataRata}</h3>
            </div>
            <div className="p-3 bg-yellow-50 rounded-full">
              <TrendingUp className="text-yellow-500 w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Pelanggaran / Cheat */}
        <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-red-500 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-bold uppercase">Pelanggaran / Cheat</p>
              <h3 className="text-3xl font-black mt-2 text-red-600">{isLoading ? '...' : stats.cheat}</h3>
            </div>
            <div className="p-3 bg-red-50 rounded-full">
              <AlertTriangle className="text-red-500 w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Placeholders for Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 lg:col-span-2 min-h-[300px] flex items-center justify-center">
          <p className="text-gray-400 font-medium">Area Grafik Rata-Rata Nilai (Dalam Pengembangan)</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 min-h-[300px] flex items-center justify-center">
          <p className="text-gray-400 font-medium">Area Distribusi Rentang (Dalam Pengembangan)</p>
        </div>
      </div>
    </div>
  );
}
