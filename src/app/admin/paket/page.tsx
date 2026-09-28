'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { Package, Plus, Save, Trash2, Eye, X, CheckCircle2 } from 'lucide-react';

export default function KelolaPaketPage() {
  const [paket, setPaket] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [namaPaket, setNamaPaket] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [durasi, setDurasi] = useState(60);
  const [token, setToken] = useState('');

  // Pratinjau states
  const [previewPaket, setPreviewPaket] = useState<any>(null);
  const [previewSoal, setPreviewSoal] = useState<any[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    fetchPaket();
    const savedUser = localStorage.getItem('cbt_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setIsDemo(user?.username?.startsWith('demo_admin_'));
    }
  }, []);

  const fetchPaket = async () => {
    setIsLoading(true);
    let { data } = await supabase.from('paket').select('*').order('created_at', { ascending: false });
    data = filterDemoData(data, 'paket');
    if (data) setPaket(data);
    setIsLoading(false);
  };

  const simpanPaketBaru = async () => {
    if (isDemo) {
      alert('Fitur ini dinonaktifkan untuk Akun Demo.');
      return;
    }
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
    if (isDemo) {
      alert('Akun Demo tidak bisa mengubah token ujian.');
      return;
    }
    await supabase.from('paket').update({ token: newToken.toUpperCase() }).eq('id', id);
    fetchPaket();
  };

  const hapusPaket = async (id: string) => {
    if (isDemo) {
      alert('Akun Demo tidak bisa menghapus paket ujian.');
      return;
    }
    if (!confirm('Yakin hapus paket ujian ini? (Soal akan tetap aman di Bank Soal)')) return;
    await supabase.from('paket').delete().eq('id', id);
    fetchPaket();
  };

  const openPratinjau = async (p: any) => {
    setPreviewPaket(p);
    setIsPreviewLoading(true);
    const { data } = await supabase.from('paket_soal').select('soal(*)').eq('paket_id', p.id);
    setPreviewSoal(data ? data.map((r: any) => r.soal) : []);
    setIsPreviewLoading(false);
  };

  return (
    <div className="space-y-6">
      {isDemo && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm mb-6 flex items-start gap-3">
          <div className="bg-red-100 p-2 rounded-full mt-0.5 text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <div>
            <h3 className="text-red-800 font-bold text-sm">Mode Akun Demo</h3>
            <p className="text-red-600 text-xs mt-1">Akun Anda adalah akun demo. Anda tidak diizinkan untuk menambah atau mengedit paket ujian. Fitur aksi disembunyikan.</p>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="text-blue-600" /> Daftar Paket Soal
        </h2>
        {!isDemo && (
          <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-bold flex items-center gap-2 transition"
          >
            <Plus size={18} /> Buat Paket Baru
          </button>
        )}
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
                      readOnly={isDemo}
                      onBlur={(e) => updateToken(p.id, e.target.value)}
                      className="border rounded p-1 w-24 text-center font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                      title={isDemo ? "Akun demo tidak bisa mengubah token" : "Ubah Token"}
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
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openPratinjau(p)} className="text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 p-2 rounded transition-colors" title="Pratinjau Soal">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => hapusPaket(p.id)} className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded transition-colors" title="Hapus Paket">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL PRATINJAU SOAL */}
      {previewPaket && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-50 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Header Modal */}
            <div className="bg-white border-b border-slate-200 p-5 flex justify-between items-center sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                  <Eye className="text-indigo-600" /> Pratinjau Soal: {previewPaket.nama_paket}
                </h2>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  Total Soal: {previewSoal.length} | Token: <span className="uppercase font-bold text-indigo-600">{previewPaket.token}</span>
                </p>
              </div>
              <button 
                onClick={() => { setPreviewPaket(null); setPreviewSoal([]); }}
                className="p-2 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Konten Soal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
              {isPreviewLoading ? (
                <div className="flex flex-col items-center justify-center h-40">
                  <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 font-bold text-slate-500 animate-pulse">Memuat Soal...</p>
                </div>
              ) : previewSoal.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Belum ada soal untuk paket ini.</p>
                </div>
              ) : (
                previewSoal.map((soal, index) => (
                  <div key={soal.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
                    <div className="absolute -top-3 -left-3 w-8 h-8 bg-indigo-600 text-white font-black rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/30">
                      {index + 1}
                    </div>
                    
                    <div className="flex justify-between items-start mb-4 ml-6">
                      <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded font-bold border border-slate-200">
                        {soal.tipe}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        Bobot: <span className="text-indigo-600">{soal.skor_maks || 10}</span>
                      </span>
                    </div>

                    <div 
                      className="prose prose-slate max-w-none mb-6 font-medium text-slate-800"
                      dangerouslySetInnerHTML={{ __html: soal.pertanyaan }}
                    />

                    {/* Render Opsi untuk PG & PG Kompleks */}
                    {(soal.tipe === 'PG' || soal.tipe === 'PG Kompleks') && (
                      <div className="space-y-3 mt-4 ml-2">
                        {['a', 'b', 'c', 'd', 'e'].map(opt => {
                          const key = `opsi_${opt}`;
                          const text = soal[key];
                          if (!text || text === '<p><br></p>') return null;
                          
                          // Cek apakah opsi ini adalah kunci jawaban
                          let isKey = false;
                          if (soal.tipe === 'PG Kompleks') {
                            const keys = (soal.kunci || '').split(',').map((k: string) => k.trim().toUpperCase());
                            isKey = keys.includes(opt.toUpperCase());
                          } else {
                            isKey = (soal.kunci || '').toUpperCase() === opt.toUpperCase();
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

                    {/* Tampilkan Kunci untuk Essay & Isian Singkat */}
                    {(soal.tipe === 'Essay' || soal.tipe === 'Isian') && (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs font-bold text-amber-700 uppercase mb-1">Kunci Jawaban:</p>
                        <p className="font-medium text-amber-900">{soal.kunci || '-'}</p>
                      </div>
                    )}

                    {/* Tampilkan Kunci untuk Menjodohkan */}
                    {soal.tipe === 'Menjodohkan' && (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs font-bold text-blue-700 uppercase mb-2">Pasangan Benar:</p>
                        <div className="space-y-2">
                          {(() => {
                            try {
                              // Coba mode JSON
                              let pData = Array.isArray(JSON.parse(soal.opsi_a || '[]')) ? JSON.parse(soal.opsi_a) : [];
                              let rData = Array.isArray(JSON.parse(soal.opsi_b || '[]')) ? JSON.parse(soal.opsi_b) : [];
                              let kData = Array.isArray(JSON.parse(soal.kunci || '[]')) ? JSON.parse(soal.kunci) : [];
                              
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
                              // Legacy string mode
                              let pData = String(soal.opsi_a || '').split('|');
                              let rData = String(soal.opsi_b || '').split('|');
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
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
