'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { Archive, Edit, Trash2 } from 'lucide-react';

export default function BankSoalPage() {
  const [paket, setPaket] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBankSoal();
  }, []);

  const fetchBankSoal = async () => {
    setIsLoading(true);
    let { data } = await supabase.from('paket').select('*').order('created_at', { ascending: false });
    data = filterDemoData(data, 'paket');
    if (data) setPaket(data);
    setIsLoading(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from('paket').update({ status: newStatus }).eq('id', id);
    fetchBankSoal();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Archive className="text-blue-600" /> Bank Soal (Arsip Paket Ujian)
        </h2>
        <p className="text-gray-500 text-sm mt-1">Daftar seluruh paket ujian yang pernah dibuat beserta status pengarsipannya.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-gray-50 text-gray-700 border-b">
            <tr>
              <th className="p-4 font-semibold">ID Paket (UUID)</th>
              <th className="p-4 font-semibold">Nama Paket</th>
              <th className="p-4 font-semibold">Durasi</th>
              <th className="p-4 font-semibold text-center">Status / Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500 font-bold">Memuat bank soal...</td></tr>
            ) : paket.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500">Belum ada paket soal.</td></tr>
            ) : (
              paket.map(p => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 text-xs font-mono text-gray-400">{p.id}</td>
                  <td className="p-4">
                    <p className="font-bold text-gray-800 text-base">{p.nama_paket}</p>
                    <p className="text-gray-500">{p.deskripsi}</p>
                  </td>
                  <td className="p-4 font-medium">{p.durasi_menit} Menit</td>
                  <td className="p-4 text-center">
                    <select 
                      value={p.status}
                      onChange={(e) => updateStatus(p.id, e.target.value)}
                      className={`border rounded p-2 text-sm font-bold outline-none cursor-pointer ${
                        p.status === 'Aktif' ? 'bg-green-100 text-green-800 border-green-300' : 
                        p.status === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-300' : 
                        'bg-gray-200 text-gray-800 border-gray-400'
                      }`}
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Nonaktif">Nonaktif</option>
                      <option value="Diarsipkan">Jadikan Arsip (Diarsipkan)</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
