'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PieChart, Search, Download } from 'lucide-react';

export default function AnalisisSoalPage() {
  const [paketList, setPaketList] = useState<any[]>([]);
  const [selectedPaket, setSelectedPaket] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analisis, setAnalisis] = useState<any[]>([]);

  useEffect(() => {
    fetchPaket();
  }, []);

  const fetchPaket = async () => {
    const { data } = await supabase.from('paket').select('*');
    if (data) setPaketList(data);
  };

  const prosesAnalisis = async () => {
    if (!selectedPaket) {
      alert('Pilih paket ujian terlebih dahulu!');
      return;
    }
    
    setIsLoading(true);
    // Ambil semua hasil dari paket ini
    const { data: hasilData } = await supabase
      .from('hasil')
      .select('detail_jawaban, skor_akhir, users(nama)')
      .eq('paket_id', selectedPaket);

    if (hasilData) {
      setAnalisis(hasilData);
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 md:p-6 rounded-lg shadow-sm border border-gray-200 gap-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <PieChart className="text-purple-600" /> Analisis Butir Soal (Matriks)
        </h2>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select 
            value={selectedPaket} onChange={e=>setSelectedPaket(e.target.value)}
            className="flex-1 md:flex-none border p-2 rounded bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">- Pilih Paket Ujian -</option>
            {paketList.map(p => <option key={p.id} value={p.id}>{p.nama_paket}</option>)}
          </select>
          <button 
            onClick={prosesAnalisis}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold flex items-center gap-2 transition"
          >
            <Search size={18} /> Proses
          </button>
          <button 
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold flex items-center gap-2 transition"
            onClick={() => alert('Fitur Export Excel akan diimplementasikan kemudian via library XLSX.')}
          >
            <Download size={18} /> Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto min-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full p-20 font-bold text-gray-500">
            Sedang memproses matriks jawaban...
          </div>
        ) : analisis.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-20 text-center text-gray-500">
            <PieChart size={64} className="text-gray-300 mb-4" />
            <span className="font-bold text-xl">Pilih Paket Ujian</span>
            <p className="mt-2 text-sm max-w-md">Klik "Proses" untuk memuat data analisis skor matriks dari seluruh siswa yang telah menyelesaikan paket ujian tersebut.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-100 text-gray-700 border-b">
              <tr>
                <th className="p-3 border-r">Nama Siswa</th>
                <th className="p-3 border-r text-center">Skor Akhir</th>
                <th className="p-3 font-semibold text-center text-gray-500">Data Raw (Matriks Detail Jawaban JSON)</th>
              </tr>
            </thead>
            <tbody>
              {analisis.map((h, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="p-3 border-r font-bold">{h.users?.nama}</td>
                  <td className="p-3 border-r text-center font-black text-blue-700">{h.skor_akhir}</td>
                  <td className="p-3 font-mono text-xs text-gray-500 truncate max-w-xl">
                    {JSON.stringify(h.detail_jawaban)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
