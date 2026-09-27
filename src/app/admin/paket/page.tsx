'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { Package, Plus, Save, Trash2 } from 'lucide-react';

export default function KelolaPaketPage() {
  const [paket, setPaket] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [namaPaket, setNamaPaket] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [durasi, setDurasi] = useState(60);
  const [token, setToken] = useState('');

  useEffect(() => {
    fetchPaket();
  }, []);

  const fetchPaket = async () => {
    setIsLoading(true);
    let { data } = await supabase.from('paket').select('*').order('created_at', { ascending: false });
    data = filterDemoData(data, 'paket');
    if (data) setPaket(data);
    setIsLoading(false);
  };

  const simpanPaketBaru = async () => {
    if (!namaPaket || !token) {
      alert('Nama Paket dan Token wajib diisi!');
      return;
    }
    const { error } = await supabase.from('paket').insert({
      nama_paket: namaPaket,
      deskripsi,
      durasi_menit: durasi,
      token: token.toUpperCase(),
      status: 'Aktif'
    });
    
    if (error) {
      alert('Gagal menyimpan paket!');
    } else {
      setShowForm(false);
      setNamaPaket(''); setDeskripsi(''); setDurasi(60); setToken('');
      fetchPaket();
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from('paket').update({ status: newStatus }).eq('id', id);
    fetchPaket();
  };

  const updateToken = async (id: string, newToken: string) => {
    await supabase.from('paket').update({ token: newToken.toUpperCase() }).eq('id', id);
    fetchPaket();
  };

  const hapusPaket = async (id: string) => {
    if (!confirm('Yakin hapus paket ini? Semua soal di dalamnya akan terhapus!')) return;
    await supabase.from('paket').delete().eq('id', id);
    fetchPaket();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="text-blue-600" /> Daftar Paket Soal
        </h2>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-bold flex items-center gap-2 transition"
        >
          <Plus size={18} /> Buat Paket Baru
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-sm border-t-4 border-green-500">
          <h3 className="font-bold mb-4">Form Paket Baru</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Nama Paket</label>
              <input type="text" value={namaPaket} onChange={e=>setNamaPaket(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Contoh: UTS Matematika 12" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Token Ujian</label>
              <input type="text" value={token} onChange={e=>setToken(e.target.value.toUpperCase())} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none uppercase font-bold text-blue-800" placeholder="TOKEN" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Durasi (Menit)</label>
              <input type="number" value={durasi} onChange={e=>setDurasi(Number(e.target.value))} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" min="10" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Deskripsi (Opsional)</label>
              <input type="text" value={deskripsi} onChange={e=>setDeskripsi(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Deskripsi Singkat" />
            </div>
          </div>
          <button onClick={simpanPaketBaru} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded flex items-center gap-2">
            <Save size={18} /> Simpan Paket
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-gray-700 border-b">
            <tr>
              <th className="p-4 font-semibold">Nama Paket</th>
              <th className="p-4 font-semibold">Durasi</th>
              <th className="p-4 font-semibold">Token</th>
              <th className="p-4 font-semibold text-center">Status</th>
              <th className="p-4 font-semibold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500 font-bold">Memuat data...</td></tr>
            ) : paket.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">Belum ada paket soal.</td></tr>
            ) : (
              paket.map(p => (
                <tr key={p.id} className="border-b hover:bg-blue-50">
                  <td className="p-4">
                    <p className="font-bold text-gray-800">{p.nama_paket}</p>
                    <p className="text-xs text-gray-500">{p.deskripsi}</p>
                  </td>
                  <td className="p-4 font-medium">{p.durasi_menit} Menit</td>
                  <td className="p-4">
                    <input 
                      type="text" 
                      defaultValue={p.token} 
                      onBlur={(e) => updateToken(p.id, e.target.value)}
                      className="border rounded p-1 w-24 text-center font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </td>
                  <td className="p-4 text-center">
                    <select 
                      value={p.status}
                      onChange={(e) => updateStatus(p.id, e.target.value)}
                      className={`border rounded p-1 text-sm font-bold outline-none ${
                        p.status === 'Aktif' ? 'bg-green-100 text-green-800 border-green-300' : 
                        p.status === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-300' : 
                        'bg-gray-100 text-gray-800 border-gray-300'
                      }`}
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Nonaktif">Nonaktif</option>
                      <option value="Diarsipkan">Diarsipkan</option>
                    </select>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => hapusPaket(p.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded">
                      <Trash2 size={18} />
                    </button>
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
