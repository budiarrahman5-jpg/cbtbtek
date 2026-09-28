'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { PlusCircle, Save, Image as ImageIcon, Link2, Trash2, Plus, Edit } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
import 'react-quill-new/dist/quill.snow.css';
import 'katex/dist/katex.min.css';
import katex from 'katex';

// Menyematkan katex ke window agar Quill bisa mendeteksinya untuk fitur Formula
if (typeof window !== 'undefined') {
  (window as any).katex = katex;
}

const ReactQuill = dynamic(async () => {
  const mod = await import('react-quill-new');
  const { default: RQ, Quill } = mod;
  
  if (typeof window !== 'undefined') {
    (window as any).Quill = Quill;
    try {
      // @ts-ignore
      const ImageResize = (await import('quill-image-resize-module-react')).default;
      Quill.register('modules/imageResize', ImageResize);
    } catch(e) {
      console.error("Failed to load ImageResize module", e);
    }
  }
  return RQ;
}, { ssr: false });

export default function EditSoalPage() {
  const router = useRouter();
  const params = useParams();
  const [paketList, setPaketList] = useState<any[]>([]);
  const [selectedPaket, setSelectedPaket] = useState('');
  const [tipe, setTipe] = useState('PG');
  const [pertanyaan, setPertanyaan] = useState('');
  const [kunci, setKunci] = useState('');
  const [skor, setSkor] = useState(10);
  
  // Opsi untuk PG (Rich Text)
  const [opsi, setOpsi] = useState({ A: '', B: '', C: '', D: '', E: '' });

  // State untuk Menjodohkan
  const [jodohkanPairs, setJodohkanPairs] = useState<{id: string, premis: string, respons: string}[]>([
    { id: Math.random().toString(36).substring(7), premis: '', respons: '' }
  ]);
  const [jodohkanPengecoh, setJodohkanPengecoh] = useState<{id: string, text: string}[]>([]);

  useEffect(() => {
    fetchPaket();
  }, []);

  useEffect(() => {
    if (params.id) {
      fetchSoalData(params.id as string);
    }
  }, [params.id]);

  const fetchSoalData = async (id: string) => {
    const { data } = await supabase.from('soal').select('*').eq('id', id).single();
    if (data) {
      setSelectedPaket(data.paket_id);
      setTipe(data.tipe);
      setPertanyaan(data.pertanyaan);
      setSkor(data.skor_maks);
      
      if (data.tipe === 'PG' || data.tipe === 'PG Kompleks') {
        const wrapHTML = (txt: string) => {
          if (!txt) return '';
          if (txt.trim().startsWith('<')) return txt;
          return `<p>${txt}</p>`;
        };
        setOpsi({ A: wrapHTML(data.opsi_a), B: wrapHTML(data.opsi_b), C: wrapHTML(data.opsi_c), D: wrapHTML(data.opsi_d), E: wrapHTML(data.opsi_e) });
        setKunci(data.kunci);
      } else if (data.tipe === 'Essay' || data.tipe === 'Isian') {
        setKunci(data.kunci);
      } else if (data.tipe === 'Menjodohkan') {
        try {
          const pList = JSON.parse(data.opsi_a || '[]');
          const rList = JSON.parse(data.opsi_b || '[]');
          const kList = JSON.parse(data.kunci || '[]');
          
          if (pList.length > 0) {
            const newPairs = pList.map((p: any) => {
              const k = kList.find((x: any) => x.premisId === p.id);
              const r = rList.find((x: any) => x.id === k?.responsId);
              return { id: p.id, premis: p.text, respons: r?.text || '' };
            });
            setJodohkanPairs(newPairs);
            
            // Pengecoh: find respons items that are not in kList
            const pengecoh = rList.filter((r: any) => !kList.some((k: any) => k.responsId === r.id));
            setJodohkanPengecoh(pengecoh);
          }
        } catch(e) {
          // Fallback if legacy format
          console.error("Gagal parse opsi menjodohkan:", e);
        }
      }
    }
  };

  const fetchPaket = async () => {
    let { data } = await supabase.from('paket').select('*').neq('status', 'Diarsipkan');
    data = filterDemoData(data, 'paket');
    if (data) setPaketList(data);
  };

  const imageHandler = function(this: any) {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            let width = img.width;
            let height = img.height;
            
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const webpDataUrl = canvas.toDataURL('image/webp', 0.8);
              
              const range = this.quill.getSelection(true);
              this.quill.insertEmbed(range.index, 'image', webpDataUrl);
              this.quill.setSelection(range.index + 1);
            }
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    };
  };

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
        ['link', 'image', 'video', 'formula'],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    },
    imageResize: {
      modules: ['Resize', 'DisplaySize']
    }
  }), []);

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'bullet', 'indent',
    'link', 'image', 'video', 'formula'
  ];

  const updateSoal = async () => {
    if (!selectedPaket || !pertanyaan) {
      alert('Isi Paket Soal dan Pertanyaan terlebih dahulu!');
      return;
    }

    if (tipe !== 'Menjodohkan' && !kunci) {
      alert('Isi Kunci Jawaban!');
      return;
    }

    const payload: any = {
      paket_id: selectedPaket,
      tipe: tipe,
      pertanyaan: pertanyaan,
      skor_maks: skor,
    };

    if (tipe === 'PG' || tipe === 'PG Kompleks') {
      payload.opsi_a = opsi.A;
      payload.opsi_b = opsi.B;
      payload.opsi_c = opsi.C;
      payload.opsi_d = opsi.D;
      payload.opsi_e = opsi.E;
      payload.kunci = kunci;
    } else if (tipe === 'Isian' || tipe === 'Essay') {
      payload.kunci = kunci;
    } else if (tipe === 'Menjodohkan') {
      // Validasi
      if (jodohkanPairs.some(p => !p.premis || !p.respons)) {
        alert('Pastikan semua Premis dan Respons terisi!');
        return;
      }
      
      const premisList = jodohkanPairs.map(p => ({ id: p.id, text: p.premis }));
      const responsList = jodohkanPairs.map(p => ({ id: p.id, text: p.respons }))
        .concat(jodohkanPengecoh.map(p => ({ id: p.id, text: p.text })));
      
      // Kunci adalah array mapping dari premisId ke responsId (yang mana id-nya sama)
      const kunciMap = jodohkanPairs.map(p => ({ premisId: p.id, responsId: p.id }));

      payload.opsi_a = JSON.stringify(premisList);
      payload.opsi_b = JSON.stringify(responsList);
      payload.kunci = JSON.stringify(kunciMap);
    }

    const { error } = await supabase.from('soal').update(payload).eq('id', params.id);
    
    if (error) {
      alert('Gagal memperbarui soal: ' + error.message);
    } else {
      alert('Soal berhasil diperbarui!');
      router.push('/admin/soal');
    }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-sm border-t-4 border-indigo-600 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-2">
          <Edit className="text-amber-500 w-8 h-8" />
          <h2 className="text-2xl font-bold text-slate-800">Edit Soal</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block font-bold text-sm mb-2 text-slate-700">Pilih Paket Soal <span className="text-rose-500">*</span></label>
          <select 
            value={selectedPaket} onChange={e=>setSelectedPaket(e.target.value)} 
            className="w-full border-2 p-3 rounded-lg bg-amber-50 focus:ring-indigo-500 focus:border-indigo-500 font-bold outline-none border-amber-200"
          >
            <option value="">- Wajib Pilih Paket -</option>
            {paketList.map(p => <option key={p.id} value={p.id}>{p.nama_paket}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-bold text-sm mb-2 text-slate-700">Tipe Soal <span className="text-rose-500">*</span></label>
          <select 
            value={tipe} onChange={e=>setTipe(e.target.value)} 
            className="w-full border-2 p-3 rounded-lg bg-slate-50 focus:ring-indigo-500 focus:border-indigo-500 font-bold outline-none"
          >
            <option value="PG">Pilihan Ganda (PG)</option>
            <option value="PG Kompleks">PG Kompleks (Banyak Jawaban)</option>
            <option value="Menjodohkan">Menjodohkan (Tarik Garis)</option>
            <option value="Isian">Isian Singkat</option>
            <option value="Essay">Essay / Uraian</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block font-bold text-sm mb-2 text-slate-700">
          Pertanyaan <span className="text-rose-500">*</span> 
          <span className="text-xs font-normal text-slate-400 ml-2">(Bisa insert rumus KaTeX & Gambar WebP)</span>
        </label>
        <div className="bg-white rounded-lg border-2 overflow-hidden border-slate-200 focus-within:border-indigo-500 transition-colors">
          <ReactQuill 
            theme="snow" 
            value={pertanyaan} 
            onChange={setPertanyaan} 
            modules={modules}
            formats={formats}
            className="min-h-[150px]"
          />
        </div>
      </div>

      {/* Editor Khusus Pilihan Ganda */}
      {(tipe === 'PG' || tipe === 'PG Kompleks') && (
        <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 space-y-6">
          <p className="text-sm text-indigo-800 font-black flex items-center gap-2"><PlusCircle size={16}/> PILIHAN JAWABAN</p>
          {['A', 'B', 'C', 'D'].map(opt => (
            <div key={opt} className="flex flex-col gap-2">
              <b className="text-lg w-full text-indigo-700">Opsi {opt}.</b>
              <div className="bg-white rounded-lg border border-slate-200">
                <ReactQuill 
                  theme="snow" 
                  value={(opsi as any)[opt]} 
                  onChange={(val) => setOpsi(prev => ({...prev, [opt]: val}))} 
                  modules={modules}
                  formats={formats}
                />
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-2 pt-4 border-t border-indigo-200">
            <b className="text-lg w-full text-slate-500">Opsi E. <span className="text-sm font-normal">(Opsional)</span></b>
            <div className="bg-white rounded-lg border border-slate-200">
              <ReactQuill 
                theme="snow" 
                value={opsi.E} 
                onChange={(val) => setOpsi(prev => ({...prev, E: val}))} 
                modules={modules}
                formats={formats}
              />
            </div>
          </div>
        </div>
      )}

      {/* Editor Khusus Menjodohkan */}
      {tipe === 'Menjodohkan' && (
        <div className="bg-amber-50 p-5 rounded-xl border border-amber-200 space-y-6">
          <p className="text-sm text-amber-800 font-black flex items-center gap-2"><Link2 size={16}/> PASANGAN MENJODOHKAN</p>
          
          <div className="space-y-4">
            {jodohkanPairs.map((pair, idx) => (
              <div key={pair.id} className="flex flex-col md:flex-row gap-4 items-start bg-white p-4 rounded-lg shadow-sm border border-amber-100">
                <div className="flex-1 w-full space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Premis (Kiri)</label>
                  <ReactQuill theme="snow" value={pair.premis} onChange={(v) => {
                    const newPairs = [...jodohkanPairs];
                    newPairs[idx].premis = v;
                    setJodohkanPairs(newPairs);
                  }} modules={modules} formats={formats} />
                </div>
                <div className="flex items-center self-stretch justify-center md:pt-8 text-amber-300">
                  <Link2 size={24} />
                </div>
                <div className="flex-1 w-full space-y-2">
                  <label className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Respons Benar (Kanan)</label>
                  <ReactQuill theme="snow" value={pair.respons} onChange={(v) => {
                    const newPairs = [...jodohkanPairs];
                    newPairs[idx].respons = v;
                    setJodohkanPairs(newPairs);
                  }} modules={modules} formats={formats} />
                </div>
                {jodohkanPairs.length > 1 && (
                  <button 
                    onClick={() => setJodohkanPairs(jodohkanPairs.filter(p => p.id !== pair.id))}
                    className="mt-8 text-rose-400 hover:text-rose-600 p-2 bg-rose-50 rounded-lg transition-colors"
                    title="Hapus Pasangan"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            ))}
          </div>
          
          <button 
            onClick={() => setJodohkanPairs([...jodohkanPairs, { id: Math.random().toString(36).substring(7), premis: '', respons: '' }])}
            className="flex items-center gap-2 text-sm font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} /> Tambah Pasangan
          </button>

          {/* Pengecoh */}
          <div className="pt-6 border-t border-amber-200">
            <p className="text-sm text-slate-700 font-bold mb-4">Jawaban Pengecoh (Hanya tampil di Kanan, tidak punya pasangan Kiri)</p>
            <div className="space-y-4">
              {jodohkanPengecoh.map((p, idx) => (
                <div key={p.id} className="flex flex-col md:flex-row gap-4 items-start bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex-1 w-full space-y-2">
                    <ReactQuill theme="snow" value={p.text} onChange={(v) => {
                      const newPengecoh = [...jodohkanPengecoh];
                      newPengecoh[idx].text = v;
                      setJodohkanPengecoh(newPengecoh);
                    }} modules={modules} formats={formats} />
                  </div>
                  <button 
                    onClick={() => setJodohkanPengecoh(jodohkanPengecoh.filter(item => item.id !== p.id))}
                    className="text-rose-400 hover:text-rose-600 p-2 bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setJodohkanPengecoh([...jodohkanPengecoh, { id: Math.random().toString(36).substring(7), text: '' }])}
              className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={16} /> Tambah Pengecoh
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
        <div>
          {tipe !== 'Menjodohkan' && (
            <>
              <label className="block font-bold text-sm mb-2 text-slate-700">Kunci Jawaban <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                value={kunci} onChange={e=>setKunci(e.target.value)}
                className="w-full border-2 p-3 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none uppercase font-bold text-lg" 
                placeholder="Contoh: A, B, atau Teks Isian" 
              />
            </>
          )}
          {tipe === 'Menjodohkan' && (
             <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg border border-emerald-200 text-sm font-bold">
               Kunci jawaban otomatis dibuat berdasarkan pasangan Kiri & Kanan di atas.
             </div>
          )}
        </div>
        <div>
          <label className="block font-bold text-sm mb-2 text-slate-700">Skor Maksimal (Bobot)</label>
          <input 
            type="number" 
            value={skor} onChange={e=>setSkor(Number(e.target.value))}
            className="w-full border-2 p-3 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 outline-none font-black text-indigo-800 text-lg" 
          />
        </div>
      </div>

      <button 
        onClick={updateSoal}
        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black py-4 rounded-xl shadow-xl shadow-amber-500/30 text-lg flex justify-center items-center gap-2 transition-transform active:scale-95"
      >
        <Save size={24} /> UPDATE SOAL
      </button>
      
      {/* KaTeX CSS Global untuk render */}
      <style dangerouslySetInnerHTML={{__html: `
        .ql-editor { font-size: 16px; font-family: inherit; }
        .ql-editor img { max-width: 100%; height: auto; border-radius: 8px; }
      `}} />
    </div>
  );
}
