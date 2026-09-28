'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { List, Edit, Trash2, Plus, Copy, Eye, X, CheckCircle2, Archive } from 'lucide-react';

export default function KelolaSoalPage() {
  const [soal, setSoal] = useState<any[]>([]);
  const [paketList, setPaketList] = useState<any[]>([]);
  const [selectedPaket, setSelectedPaket] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Fitur Edit Skor Massal
  const [skorMassal, setSkorMassal] = useState('');
  const [selectedSoal, setSelectedSoal] = useState<string[]>([]);
  const [targetPaketId, setTargetPaketId] = useState('');
  const [previewSoal, setPreviewSoal] = useState<any>(null);

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
    if (selectedPaket !== 'ALL') {
      if (!confirm('Keluarkan soal ini dari paket yang sedang dipilih? (Soal akan tetap ada di Bank Soal)')) return;
      await supabase.from('paket_soal').delete().match({ paket_id: selectedPaket, soal_id: id });
    } else {
      if (!confirm('Hapus soal ini permanen dari Bank Soal?')) return;
      await supabase.from('soal').delete().eq('id', id);
    }
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
                        <button onClick={() => setPreviewSoal(s)} className="text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-2 rounded transition-colors" title="Pratinjau Soal">
                          <Eye size={16} />
                        </button>
                        <a href={`/admin/soal/${s.id}`} className="text-amber-500 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 p-2 rounded transition-colors" title="Edit Soal">
                          <Edit size={16} />
                        </a>
                        <button onClick={() => hapusSoal(s.id)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded transition-colors" title={selectedPaket !== 'ALL' ? 'Keluarkan dari Paket' : 'Hapus Soal'}>
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

      {/* MODAL PRATINJAU SOAL TUNGGAL */}
      {previewSoal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-50 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <Eye className="text-indigo-600" /> Pratinjau Soal
              </h2>
              <button 
                onClick={() => setPreviewSoal(null)}
                className="p-2 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded font-bold border border-slate-200">
                    {previewSoal.tipe}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    Bobot: <span className="text-indigo-600">{previewSoal.skor_maks || 10}</span>
                  </span>
                </div>
                <div 
                  className="prose prose-slate max-w-none mb-6 font-medium text-slate-800"
                  dangerouslySetInnerHTML={{ __html: previewSoal.pertanyaan }}
                />
                {(previewSoal.tipe === 'PG' || previewSoal.tipe === 'PG Kompleks') && (
                  <div className="space-y-3 mt-4 ml-2">
                    {['a', 'b', 'c', 'd', 'e'].map(opt => {
                      const key = `opsi_${opt}` as keyof typeof previewSoal;
                      const text = previewSoal[key];
                      if (!text || text === '<p><br></p>') return null;
                      let isKey = false;
                      if (previewSoal.tipe === 'PG Kompleks') {
                        const keys = (previewSoal.kunci || '').split(',').map((k: string) => k.trim().toUpperCase());
                        isKey = keys.includes(opt.toUpperCase());
                      } else {
                        isKey = (previewSoal.kunci || '').toUpperCase() === opt.toUpperCase();
                      }
                      return (
                        <div key={opt} className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-colors ${isKey ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-100'}`}>
                          <div className={`mt-0.5 w-6 h-6 rounded flex items-center justify-center font-bold text-xs shrink-0 ${isKey ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            {opt.toUpperCase()}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div dangerouslySetInnerHTML={{ __html: text }} className={`prose prose-sm max-w-none ${isKey ? 'text-emerald-900 font-medium' : 'text-slate-700'}`} />
                          </div>
                          {isKey && <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />}
                        </div>
                      );
                    })}
                  </div>
                )}
                {(previewSoal.tipe === 'Essay' || previewSoal.tipe === 'Isian') && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-bold text-amber-700 uppercase mb-1">Kunci Jawaban:</p>
                    <p className="font-medium text-amber-900">{previewSoal.kunci || '-'}</p>
                  </div>
                )}
                {previewSoal.tipe === 'Menjodohkan' && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-bold text-blue-700 uppercase mb-2">Pasangan Benar:</p>
                    <div className="space-y-2">
                      {(() => {
                        try {
                          let pData = Array.isArray(JSON.parse(previewSoal.opsi_a || '[]')) ? JSON.parse(previewSoal.opsi_a) : [];
                          let rData = Array.isArray(JSON.parse(previewSoal.opsi_b || '[]')) ? JSON.parse(previewSoal.opsi_b) : [];
                          let kData = Array.isArray(JSON.parse(previewSoal.kunci || '[]')) ? JSON.parse(previewSoal.kunci) : [];
                          if (pData.length === 0) throw new Error("Fallback legacy");
                          return kData.map((k: any, idx: number) => {
                            const p = pData.find((x:any) => x.id === k.premisId);
                            const r = rData.find((x:any) => x.id === k.responsId);
                            return (
                              <div key={idx} className="flex flex-col md:flex-row md:items-center gap-2 bg-white p-2 rounded shadow-sm border border-blue-100 text-sm">
                                <div className="flex-1 p-2 bg-slate-50 rounded" dangerouslySetInnerHTML={{__html: p?.text || '?'}} />
                                <span className="hidden md:inline font-bold text-blue-400">{'->'}</span>
                                <div className="flex-1 p-2 bg-slate-50 rounded" dangerouslySetInnerHTML={{__html: r?.text || '?'}} />
                              </div>
                            );
                          });
                        } catch (e) {
                          let pData = String(previewSoal.opsi_a || '').split('|');
                          let rData = String(previewSoal.opsi_b || '').split('|');
                          return pData.map((p, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row md:items-center gap-2 bg-white p-2 rounded shadow-sm border border-blue-100 text-sm">
                              <div className="flex-1 p-2 bg-slate-50 rounded">{p.trim()}</div>
                              <span className="hidden md:inline font-bold text-blue-400">{'->'}</span>
                              <div className="flex-1 p-2 bg-slate-50 rounded">{rData[idx]?.trim() || '?'}</div>
                            </div>
                          ));
                        }
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
