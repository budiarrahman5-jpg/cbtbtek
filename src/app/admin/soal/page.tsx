'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { List, Edit, Trash2, Plus, Copy, Eye, X, CheckCircle2, Archive, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export default function KelolaSoalPage() {
  const [soal, setSoal] = useState<any[]>([]);
  const [paketList, setPaketList] = useState<any[]>([]);
  const [selectedPaket, setSelectedPaket] = useState('ALL');
  const [selectedTipe, setSelectedTipe] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Fitur Edit Skor Massal
  const [skorMassal, setSkorMassal] = useState('');
  const [selectedSoal, setSelectedSoal] = useState<string[]>([]);
  const [targetPaketId, setTargetPaketId] = useState('');
  const [previewSoal, setPreviewSoal] = useState<any>(null);

  // Zoom Gambar Modal
  const [zoomImageSrc, setZoomImageSrc] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [zoomPosition, setZoomPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingZoom, setIsDraggingZoom] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({ startX: 0, startY: 0, posX: 0, posY: 0 });

  const openImageZoom = (src: string) => {
    setZoomImageSrc(src);
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
    setIsDraggingZoom(false);
  };

  const closeImageZoom = () => {
    setZoomImageSrc(null);
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
    setIsDraggingZoom(false);
  };

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

  const displayedSoal = selectedTipe === 'ALL' ? soal : soal.filter(s => s.tipe === selectedTipe);

  const toggleAllSoal = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedSoal(displayedSoal.map(s => s.id));
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

          <select 
            value={selectedTipe} onChange={e=>setSelectedTipe(e.target.value)}
            className="flex-1 md:flex-none border p-2 rounded bg-gray-50 font-bold outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">-- Semua Tipe Soal --</option>
            <option value="PG">Pilihan Ganda (PG)</option>
            <option value="PG Kompleks">PG Kompleks</option>
            <option value="Menjodohkan">Menjodohkan</option>
            <option value="Isian">Isian Singkat</option>
            <option value="Essay">Uraian / Essay</option>
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
                    checked={displayedSoal.length > 0 && selectedSoal.length === displayedSoal.length}
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
              ) : displayedSoal.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Tidak ada soal ditemukan.</td></tr>
              ) : (
                displayedSoal.map(s => (
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
            <div 
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.tagName.toLowerCase() === 'img') {
                  const img = target as HTMLImageElement;
                  if (img.src) openImageZoom(img.currentSrc || img.src);
                }
              }}
              className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar [&_img]:cursor-zoom-in [&_img]:rounded-lg [&_img]:transition hover:[&_img]:brightness-95"
            >
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
                              <div key={idx} className="flex flex-col md:flex-row md:items-center gap-2 bg-white p-2.5 rounded-lg shadow-xs border border-blue-200 text-sm">
                                <div className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-bold [&_*]:text-slate-950" dangerouslySetInnerHTML={{__html: p?.text || '?'}} />
                                <span className="hidden md:inline font-black text-blue-600">{'->'}</span>
                                <div className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-bold [&_*]:text-slate-950" dangerouslySetInnerHTML={{__html: r?.text || '?'}} />
                              </div>
                            );
                          });
                        } catch (e) {
                          let pData = String(previewSoal.opsi_a || '').split('|');
                          let rData = String(previewSoal.opsi_b || '').split('|');
                          return pData.map((p, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row md:items-center gap-2 bg-white p-2.5 rounded-lg shadow-xs border border-blue-200 text-sm">
                              <div className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-bold">{p.trim()}</div>
                              <span className="hidden md:inline font-black text-blue-600">{'->'}</span>
                              <div className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 font-bold">{rData[idx]?.trim() || '?'}</div>
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
      {/* MODAL ZOOM / PERBESAR GAMBAR SOAL */}
      {zoomImageSrc && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-between p-2 sm:p-4 select-none animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeImageZoom();
          }}
        >
          {/* Top Control Bar */}
          <div className="w-full max-w-4xl bg-slate-900/90 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-white flex items-center justify-between shadow-2xl backdrop-blur-md flex-shrink-0 z-10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-md">
                <ZoomIn size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-wide">Pratinjau Gambar Soal</h3>
                <p className="text-[11px] text-slate-400 hidden sm:block">Perbesar gambar untuk melihat detail soal & grafik</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setZoomScale(prev => Math.max(0.5, Number((prev - 0.25).toFixed(2))))}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
                title="Perkecil (-)"
              >
                <ZoomOut size={18} />
              </button>

              <span className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-blue-400 min-w-[56px] text-center">
                {Math.round(zoomScale * 100)}%
              </span>

              <button
                type="button"
                onClick={() => setZoomScale(prev => Math.min(4, Number((prev + 0.25).toFixed(2))))}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
                title="Perbesar (+)"
              >
                <ZoomIn size={18} />
              </button>

              <button
                type="button"
                onClick={() => { setZoomScale(1); setZoomPosition({ x: 0, y: 0 }); }}
                className="px-2.5 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors text-xs font-medium flex items-center gap-1 active:scale-95"
                title="Reset Ukuran (100%)"
              >
                <RotateCcw size={15} />
                <span className="hidden md:inline text-[11px]">Reset</span>
              </button>

              <div className="h-5 w-[1px] bg-slate-700 mx-1" />

              <button
                type="button"
                onClick={closeImageZoom}
                className="px-3 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                title="Tutup (ESC)"
              >
                <X size={16} />
                <span>Tutup</span>
              </button>
            </div>
          </div>

          {/* Canvas Area */}
          <div 
            className="flex-1 w-full max-w-5xl flex items-center justify-center overflow-hidden my-2 sm:my-3 relative cursor-grab active:cursor-grabbing touch-none"
            onWheel={(e) => {
              e.preventDefault();
              if (e.deltaY < 0) {
                setZoomScale(prev => Math.min(4, Number((prev + 0.2).toFixed(2))));
              } else {
                setZoomScale(prev => Math.max(0.5, Number((prev - 0.2).toFixed(2))));
              }
            }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              setIsDraggingZoom(true);
              dragStartRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                posX: zoomPosition.x,
                posY: zoomPosition.y
              };
            }}
            onMouseMove={(e) => {
              if (!isDraggingZoom) return;
              const dx = e.clientX - dragStartRef.current.startX;
              const dy = e.clientY - dragStartRef.current.startY;
              setZoomPosition({
                x: dragStartRef.current.posX + dx,
                y: dragStartRef.current.posY + dy
              });
            }}
            onMouseUp={() => setIsDraggingZoom(false)}
            onMouseLeave={() => setIsDraggingZoom(false)}
          >
            <div 
              className="transition-transform duration-75 select-none max-h-full max-w-full flex items-center justify-center"
              style={{
                transform: `translate3d(${zoomPosition.x}px, ${zoomPosition.y}px, 0px) scale(${zoomScale})`,
                transformOrigin: 'center center'
              }}
            >
              <img
                src={zoomImageSrc}
                alt="Gambar Soal Ujian"
                className="max-h-[72vh] max-w-[88vw] object-contain rounded-2xl shadow-2xl pointer-events-none select-none bg-white/5 border border-white/10 ring-1 ring-white/10"
                draggable={false}
              />
            </div>
          </div>

          {/* Bottom Hint */}
          <div className="bg-slate-900/85 border border-slate-700/60 rounded-full px-4 py-1.5 text-slate-300 text-[11px] sm:text-xs flex items-center gap-2 shadow-lg backdrop-blur-md text-center">
            <span>💡 <b>Geser mouse</b> untuk menggeser gambar • <b>Scroll roda mouse</b> atau tombol <b>(+ / -)</b> untuk zoom • Tekan <b>Tutup</b> untuk keluar</span>
          </div>
        </div>
      )}
    </div>
  );
}
