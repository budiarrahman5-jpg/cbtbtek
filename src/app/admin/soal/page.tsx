'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { List, Edit, Trash2, Plus, Copy } from 'lucide-react';

export default function KelolaSoalPage() {
  const [soal, setSoal] = useState<any[]>([]);
  const [paketList, setPaketList] = useState<any[]>([]);
  const [selectedPaket, setSelectedPaket] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Fitur Edit Skor Massal
  const [skorMassal, setSkorMassal] = useState('');
  const [selectedSoal, setSelectedSoal] = useState<string[]>([]);
  const [targetPaketId, setTargetPaketId] = useState('');

  useEffect(() => {
    fetchPaket();
    fetchSoal();
  }, [selectedPaket]);

  const fetchPaket = async () => {
    let { data } = await supabase.from('paket').select('*');
    data = filterDemoData(data, 'paket');
    if (data) setPaketList(data);
  };

  const fetchSoal = async () => {
    setIsLoading(true);
    
    if (selectedPaket !== 'ALL') {
      const { data: relData } = await supabase.from('paket_soal').select('soal_id').eq('paket_id', selectedPaket);
      if (!relData || relData.length === 0) {
        setSoal([]);
        setIsLoading(false);
        return;
      }
      const soalIds = relData.map(r => r.soal_id);
      let { data } = await supabase.from('soal').select('*, paket_soal(paket(nama_paket))').in('id', soalIds);
      data = filterDemoData(data, 'soal');
      if (data) setSoal(data);
    } else {
      let { data } = await supabase.from('soal').select('*, paket_soal(paket(nama_paket))');
      data = filterDemoData(data, 'soal');
      if (data) setSoal(data);
    }
    
    setIsLoading(false);
  };

  const toggleAllSoal = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedSoal(soal.map(s => s.id));
    } else {
      setSelectedSoal([]);
    }
  };

  const toggleSoal = (id: string) => {
    if (selectedSoal.includes(id)) {
      setSelectedSoal(selectedSoal.filter(s => s !== id));
    } else {
      setSelectedSoal([...selectedSoal, id]);
    }
  };

  const updateSkorMassal = async () => {
    if (selectedSoal.length === 0) {
      alert('Pilih minimal satu soal!');
      return;
    }
    if (!skorMassal) {
      alert('Masukkan nilai skor!');
      return;
    }

    const { error } = await supabase
      .from('soal')
      .update({ skor_maks: Number(skorMassal) })
      .in('id', selectedSoal);

    if (error) {
      alert('Gagal update skor massal.');
    } else {
      alert(`${selectedSoal.length} soal berhasil diupdate skornya menjadi ${skorMassal}!`);
      setSkorMassal('');
      setSelectedSoal([]);
      fetchSoal();
    }
  };

  const tambahkanKePaket = async () => {
    if (selectedSoal.length === 0) {
      alert('Pilih minimal satu soal dengan mencentang kotak di tabel!');
      return;
    }
    if (!targetPaketId) {
      alert('Pilih paket tujuan terlebih dahulu!');
      return;
    }

    const payload = selectedSoal.map(id => ({
      paket_id: targetPaketId,
      soal_id: id
    }));

    // upsert untuk menghindari error duplicate key jika soal sudah ada di paket tersebut
    const { error } = await supabase.from('paket_soal').upsert(payload, { onConflict: 'paket_id,soal_id' });

    if (error) {
      alert('Gagal menambahkan soal ke paket: ' + error.message);
    } else {
      alert(`${selectedSoal.length} soal berhasil ditambahkan ke paket!`);
      setSelectedSoal([]);
      setTargetPaketId('');
      fetchSoal();
    }
  };

  const hapusSoal = async (id: string) => {
    if (!confirm('Hapus soal ini permanen?')) return;
    await supabase.from('soal').delete().eq('id', id);
    fetchSoal();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 gap-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <List className="text-blue-600" /> Kelola Soal
        </h2>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select 
            value={selectedPaket} onChange={e=>setSelectedPaket(e.target.value)}
            className="flex-1 md:flex-none border p-2 rounded bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">-- Semua Paket --</option>
            {paketList.map(p => <option key={p.id} value={p.id}>{p.nama_paket}</option>)}
          </select>
          
          <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block"></div>
          
          <input 
            type="number" value={skorMassal} onChange={e=>setSkorMassal(e.target.value)} 
            placeholder="Skor" min="1"
            className="w-20 border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 font-bold"
          />
          <button 
            onClick={updateSkorMassal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-bold flex items-center gap-2 transition"
            title="Update skor maksimal soal yang dipilih"
          >
            <Edit size={16} /> Skor
          </button>
          
          <div className="h-6 w-px bg-gray-300 mx-2 hidden md:block"></div>
          
          <select 
            value={targetPaketId} onChange={e=>setTargetPaketId(e.target.value)}
            className="flex-1 md:flex-none border p-2 rounded bg-emerald-50 text-emerald-800 border-emerald-200 font-bold outline-none focus:ring-2 focus:ring-emerald-500 max-w-[150px] truncate"
          >
            <option value="">- Ke Paket -</option>
            {paketList.map(p => <option key={p.id} value={p.id}>{p.nama_paket}</option>)}
          </select>
          <button 
            onClick={tambahkanKePaket}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded font-bold flex items-center gap-2 transition"
            title="Tambahkan soal yang dipilih ke paket tujuan"
          >
            <Plus size={16} /> Tambahkan
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-50 text-gray-700 border-b">
              <tr>
                <th className="p-3 w-12 text-center">
                  <input 
                    type="checkbox" 
                    onChange={toggleAllSoal}
                    checked={soal.length > 0 && selectedSoal.length === soal.length}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="p-3 font-semibold">Paket</th>
                <th className="p-3 font-semibold">Tipe</th>
                <th className="p-3 font-semibold w-1/2">Pertanyaan</th>
                <th className="p-3 font-semibold text-center">Skor Maks</th>
                <th className="p-3 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500 font-bold">Memuat soal...</td></tr>
              ) : soal.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Tidak ada soal ditemukan.</td></tr>
              ) : (
                soal.map(s => (
                  <tr key={s.id} className="border-b hover:bg-blue-50">
                    <td className="p-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedSoal.includes(s.id)}
                        onChange={() => toggleSoal(s.id)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 text-gray-600 font-semibold">{s.paket_soal && s.paket_soal.length > 0 ? s.paket_soal.map((ps: any) => ps.paket?.nama_paket).filter(Boolean).join(', ') : '-'}</td>
                    <td className="p-3 font-bold text-blue-800"><span className="bg-blue-100 px-2 py-1 rounded">{s.tipe}</span></td>
                    <td className="p-3 text-gray-800">
                      <div className="line-clamp-2 max-w-md" dangerouslySetInnerHTML={{ __html: s.pertanyaan }} />
                    </td>
                    <td className="p-3 text-center font-black text-gray-700">{s.skor_maks}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <a href={`/admin/soal/${s.id}`} className="text-amber-500 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 p-2 rounded transition-colors" title="Edit Soal">
                          <Edit size={16} />
                        </a>
                        <button onClick={() => hapusSoal(s.id)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded transition-colors" title="Hapus Soal">
                          <Trash2 size={16} />
                        </button>
                      </div>
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
