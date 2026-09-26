'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, Download, Search, Calculator } from 'lucide-react';

export default function HasilUjianPage() {
  const [hasil, setHasil] = useState<any[]>([]);
  const [paketList, setPaketList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  
  const [selectedPaket, setSelectedPaket] = useState('ALL');
  const [selectedKelas, setSelectedKelas] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFilters();
    fetchHasil();
  }, [selectedPaket, selectedKelas]);

  const fetchFilters = async () => {
    const { data: p } = await supabase.from('paket').select('*');
    if (p) setPaketList(p);
    
    const { data: k } = await supabase.from('kelas').select('*');
    if (k) setKelasList(k);
  };

  const fetchHasil = async () => {
    setIsLoading(true);
    let query = supabase
      .from('hasil')
      .select('*, users!inner(nama, kelas_id), paket(nama_paket)');

    if (selectedPaket !== 'ALL') query = query.eq('paket_id', selectedPaket);
    if (selectedKelas !== 'ALL') query = query.eq('users.kelas_id', selectedKelas);

    const { data } = await query;
    if (data) setHasil(data);
    setIsLoading(false);
  };

  const filteredHasil = hasil.filter(h => 
    h.users?.nama?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b pb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Trophy className="text-yellow-600" /> Hasil Ujian
          </h2>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded font-bold flex items-center justify-center gap-2 transition">
              <Calculator size={18} /> <span className="hidden md:inline">Hitung Ulang</span>
            </button>
            <button className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded font-bold flex items-center justify-center gap-2 transition">
              <Download size={18} /> <span className="hidden md:inline">Download CSV</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <select 
            value={selectedPaket} onChange={e=>setSelectedPaket(e.target.value)}
            className="border p-2 rounded bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
          >
            <option value="ALL">-- Semua Paket --</option>
            {paketList.map(p => <option key={p.id} value={p.id}>{p.nama_paket}</option>)}
          </select>

          <select 
            value={selectedKelas} onChange={e=>setSelectedKelas(e.target.value)}
            className="border p-2 rounded bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
          >
            <option value="ALL">-- Semua Kelas --</option>
            {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Cari nama siswa..." 
              className="w-full pl-10 pr-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-100 text-gray-700 border-b">
              <tr>
                <th className="p-3 font-semibold">Nama Siswa</th>
                <th className="p-3 font-semibold">Kelas</th>
                <th className="p-3 font-semibold">Paket Ujian</th>
                <th className="p-3 font-semibold text-center">Nilai (Skor Akhir)</th>
                <th className="p-3 font-semibold text-center">Cheat Count</th>
                <th className="p-3 font-semibold text-center">Waktu Sisa</th>
                <th className="p-3 font-semibold text-center">Status Koreksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500 font-bold">Memuat hasil...</td></tr>
              ) : filteredHasil.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Tidak ada data hasil.</td></tr>
              ) : (
                filteredHasil.map(h => (
                  <tr key={h.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-800">{h.users?.nama}</td>
                    <td className="p-3 text-gray-600">
                      {kelasList.find(k => k.id === h.users?.kelas_id)?.nama_kelas || '-'}
                    </td>
                    <td className="p-3 font-semibold text-blue-800">{h.paket?.nama_paket}</td>
                    <td className="p-3 text-center">
                       <span className={`px-2 py-1 rounded font-black ${h.skor_akhir >= 75 ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                         {h.skor_akhir}
                       </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={h.cheat_count > 0 ? "text-red-600 font-bold" : "text-gray-400"}>
                        {h.cheat_count}x
                      </span>
                    </td>
                    <td className="p-3 text-center text-gray-500">
                      {Math.floor(h.waktu_sisa / 60)} mnt {h.waktu_sisa % 60} dtk
                    </td>
                    <td className="p-3 text-center">
                       <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-600">
                         {h.status_koreksi}
                       </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
