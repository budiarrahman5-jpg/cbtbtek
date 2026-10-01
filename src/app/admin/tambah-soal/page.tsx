'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { PlusCircle, Save, Image as ImageIcon, Link2, Trash2, Plus, Download, Upload, FileSpreadsheet, Sparkles, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import * as XLSX from 'xlsx';
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

export default function TambahSoalPage() {
  const [paketList, setPaketList] = useState<any[]>([]);
  const [selectedPaket, setSelectedPaket] = useState('');
  const [tipe, setTipe] = useState('PG');
  const [pertanyaan, setPertanyaan] = useState('');
  const [kunci, setKunci] = useState('');
  const [skor, setSkor] = useState(10);
  
  // Opsi untuk PG (Rich Text)
  const [opsi, setOpsi] = useState({ A: '', B: '', C: '', D: '', E: '' });

  const [jodohkanPairs, setJodohkanPairs] = useState<{id: string, premis: string, respons: string}[]>([
    { id: Math.random().toString(36).substring(7), premis: '', respons: '' }
  ]);
  const [jodohkanPengecoh, setJodohkanPengecoh] = useState<{id: string, text: string}[]>([]);

  // AI Modal States
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    fetchPaket();
  }, []);

  const fetchPaket = async () => {
    let { data } = await supabase.from('paket').select('*').neq('status', 'Diarsipkan');
    data = filterDemoData(data, 'paket');
    if (data) setPaketList(data);
  };

  // --- FITUR EXCEL ---
  const downloadTemplateExcel = () => {
    const data = [
      {
        Tipe: 'PG',
        Pertanyaan: 'Apa ibu kota Indonesia?',
        Opsi_A: 'Jakarta',
        Opsi_B: 'Bandung',
        Opsi_C: 'Surabaya',
        Opsi_D: 'Medan',
        Opsi_E: '',
        Kunci: 'A',
        Skor: 10
      },
      {
        Tipe: 'Isian',
        Pertanyaan: 'Siapakah presiden pertama RI?',
        Opsi_A: '',
        Opsi_B: '',
        Opsi_C: '',
        Opsi_D: '',
        Opsi_E: '',
        Kunci: 'Soekarno',
        Skor: 15
      },
      {
        Tipe: 'Essay',
        Pertanyaan: 'Jelaskan pengertian dari fotosintesis!',
        Opsi_A: '',
        Opsi_B: '',
        Opsi_C: '',
        Opsi_D: '',
        Opsi_E: '',
        Kunci: '-',
        Skor: 20
      }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    
    // Sesuaikan lebar kolom
    const wscols = [
      {wch: 15}, {wch: 40}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 15}, {wch: 10}
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Soal");
    XLSX.writeFile(wb, "Template_Soal_CBT.xlsx");
  };

  const handleUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedPaket) {
      alert('Pilih Paket Soal terlebih dahulu sebelum mengunggah Excel!');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          alert('Excel kosong!');
          return;
        }

        const confirmUpload = confirm(`Ditemukan ${data.length} baris soal. Proses unggah ke database sekarang?`);
        if (!confirmUpload) return;

        const payloadRows = data.map((row: any) => {
          let t = String(row.Tipe || 'PG').trim();
          // Normalisasi tipe soal
          if (t.toLowerCase().includes('isian')) t = 'Isian';
          else if (t.toLowerCase().includes('essay') || t.toLowerCase().includes('esai')) t = 'Essay';
          else if (t.toLowerCase().includes('kompleks')) t = 'PG Kompleks';
          else t = 'PG';

          return {
            paket_id: selectedPaket,
            tipe: t,
            pertanyaan: String(row.Pertanyaan || ''),
            opsi_a: String(row.Opsi_A || ''),
            opsi_b: String(row.Opsi_B || ''),
            opsi_c: String(row.Opsi_C || ''),
            opsi_d: String(row.Opsi_D || ''),
            opsi_e: String(row.Opsi_E || ''),
            kunci: String(row.Kunci || ''),
            skor_maks: Number(row.Skor) || 10
          };
        });

        const soalPayloads = payloadRows.map((row: any) => {
          const { paket_id, ...rest } = row;
          return rest;
        });

        const { data: insertedSoal, error } = await supabase.from('soal').insert(soalPayloads).select();
        
        if (error) {
          alert('Gagal mengunggah soal: ' + error.message);
        } else if (insertedSoal) {
          const paketSoalPayloads = insertedSoal.map(s => ({
            paket_id: selectedPaket,
            soal_id: s.id
          }));
          const { error: relError } = await supabase.from('paket_soal').insert(paketSoalPayloads);
          if (relError) {
             alert('Gagal menghubungkan soal ke paket: ' + relError.message);
          } else {
             alert(`${payloadRows.length} Soal berhasil diunggah dari Excel!`);
          }
        }
      } catch (err: any) {
        alert('Gagal membaca Excel: ' + err.message);
      }
      
      // Reset input file
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };
  // -------------------------

  // Image Handler kustom untuk kompresi WebP Base64
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

  const simpanSoal = async () => {
    if (!selectedPaket || !pertanyaan) {
      alert('Isi Paket Soal dan Pertanyaan terlebih dahulu!');
      return;
    }

    if (tipe !== 'Menjodohkan' && !kunci) {
      alert('Isi Kunci Jawaban!');
      return;
    }

    const payload: any = {
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

    const { data: insertedSoal, error } = await supabase.from('soal').insert(payload).select().single();
    
    if (error) {
      alert('Gagal menyimpan soal: ' + error.message);
    } else if (insertedSoal) {
      const { error: relError } = await supabase.from('paket_soal').insert({
        paket_id: selectedPaket,
        soal_id: insertedSoal.id
      });
      
      if (relError) {
        alert('Soal tersimpan di bank soal, tapi gagal dihubungkan ke paket: ' + relError.message);
      } else {
        alert('Soal berhasil disimpan!');
        // Reset form
        setPertanyaan(''); setKunci('');
        setOpsi({ A: '', B: '', C: '', D: '', E: '' });
        setJodohkanPairs([{ id: Math.random().toString(36).substring(7), premis: '', respons: '' }]);
        setJodohkanPengecoh([]);
      }
    }
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt) return alert('Masukkan instruksi untuk AI terlebih dahulu!');
    
    // Cek API Key dari database (melalui API internal)
    setIsAILoading(true);
    try {
      const res = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, tipe: tipe })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error === 'API_KEY_MISSING') {
          alert('API Key Groq AI belum diatur! Silakan atur di menu Pengaturan terlebih dahulu.');
          setShowAIModal(false);
        } else {
          alert('Gagal generate soal: ' + data.error);
        }
        setIsAILoading(false);
        return;
      }
      
      const targetTipe = data.tipe || tipe;
      setTipe(targetTipe);

      const wrapHTML = (txt: string) => {
        if (!txt) return '';
        if (txt.trim().startsWith('<')) return txt;
        return `<p>${txt}</p>`;
      };

      // Auto fill form based on type
      setPertanyaan(wrapHTML(data.result.pertanyaan || ''));
      setKunci(data.result.kunci || '');
      
      if (targetTipe === 'PG' || targetTipe === 'PG Kompleks') {
        setOpsi({
          A: wrapHTML(data.result.opsi_a || ''),
          B: wrapHTML(data.result.opsi_b || ''),
          C: wrapHTML(data.result.opsi_c || ''),
          D: wrapHTML(data.result.opsi_d || ''),
          E: wrapHTML(data.result.opsi_e || '')
        });
      } else if (targetTipe === 'Menjodohkan' && Array.isArray(data.result.pasangan) && data.result.pasangan.length > 0) {
        setJodohkanPairs(data.result.pasangan.map((p: any) => ({
          id: Math.random().toString(36).substring(7),
          premis: wrapHTML(p.premis || ''),
          respons: wrapHTML(p.respons || '')
        })));
        if (Array.isArray(data.result.pengecoh) && data.result.pengecoh.length > 0) {
          setJodohkanPengecoh(data.result.pengecoh.map((text: string) => ({
            id: Math.random().toString(36).substring(7),
            text: wrapHTML(text)
          })));
        }
      }

      // Force ReactQuill editors to re-render fresh with the new content
      setEditorKey(k => k + 1);
      
      setShowAIModal(false);
      setAiPrompt('');
      alert(`Soal ${targetTipe} berhasil dibuat oleh AI beserta pilihan jawaban dan kunci!`);
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi saat memanggil AI.');
    }
    setIsAILoading(false);
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-sm border-t-4 border-indigo-600 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-2">
          <PlusCircle className="text-indigo-600 w-8 h-8" />
          <h2 className="text-2xl font-bold text-slate-800">Tambah Soal Canggih</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setShowAIModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-sm font-bold shadow-md shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95"
            title="Buat Soal Otomatis dengan Groq AI"
          >
            <Sparkles size={16} className="animate-pulse" /> Buat Soal AI
          </button>
          
          <button 
            onClick={downloadTemplateExcel}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-sm font-bold transition-colors"
          >
            <Download size={16} /> Template Excel
          </button>
          
          <label className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-sm font-bold transition-colors cursor-pointer">
            <FileSpreadsheet size={16} /> Upload Excel
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleUploadExcel} 
            />
          </label>
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
            key={`pertanyaan-${editorKey}`}
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
                  key={`opsi-${opt}-${editorKey}`}
                  theme="snow" 
                  value={(opsi as any)[opt]} 
                  onChange={(val) => setOpsi(prev => ({ ...prev, [opt]: val }))} 
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
                key={`opsi-E-${editorKey}`}
                theme="snow" 
                value={opsi.E} 
                onChange={(val) => setOpsi(prev => ({ ...prev, E: val }))} 
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
        onClick={simpanSoal}
        className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black py-4 rounded-xl shadow-xl shadow-indigo-600/30 text-lg flex justify-center items-center gap-2 transition-transform active:scale-95"
      >
        <Save size={24} /> SIMPAN SOAL
      </button>
      
      {/* AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 border-t-4 border-indigo-500">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <Sparkles className="text-indigo-600" /> Asisten AI B-TEK
              </h3>
              <button onClick={() => setShowAIModal(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Pilih Tipe Soal yang Ingin Dibuat:
              </label>
              <select
                value={tipe}
                onChange={(e) => setTipe(e.target.value)}
                disabled={isAILoading}
                className="w-full border-2 border-indigo-100 rounded-xl p-3 font-bold text-sm bg-indigo-50/50 text-indigo-900 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="PG">Pilihan Ganda (PG) - Ada Pertanyaan, Opsi A-D/E, & Kunci</option>
                <option value="PG Kompleks">PG Kompleks (Banyak Jawaban Benar)</option>
                <option value="Isian">Isian Singkat (Pertanyaan & Kunci Singkat)</option>
                <option value="Essay">Essay / Uraian (Pertanyaan & Rubrik/Kunci)</option>
                <option value="Menjodohkan">Menjodohkan (Pasangan Premis & Respons)</option>
              </select>
              <p className="text-xs text-slate-500 mt-1.5">
                {tipe === 'PG' || tipe === 'PG Kompleks' 
                  ? '✨ AI akan otomatis mengisi teks pertanyaan, opsi jawaban A, B, C, D, dan kunci jawaban.'
                  : tipe === 'Essay' || tipe === 'Isian'
                  ? '✨ AI akan mengisi teks pertanyaan dan kunci/panduan indikator jawaban.'
                  : '✨ AI akan mengisi premis, respons yang benar, dan pengecoh.'
                }
              </p>
            </div>
            <textarea
              className="w-full border-2 border-slate-200 rounded-xl p-4 focus:border-indigo-500 outline-none resize-none mb-4 font-medium"
              rows={4}
              placeholder="Contoh: Buatkan 1 soal HOTS tentang fotosintesis untuk anak SMA, lengkap dengan pengecoh yang mengecoh."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={isAILoading}
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowAIModal(false)}
                className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={isAILoading}
              >
                Batal
              </button>
              <button 
                onClick={handleGenerateAI}
                disabled={isAILoading}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {isAILoading ? 'Menenun Sihir AI...' : <><Sparkles size={18} /> Generate Sekarang</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KaTeX CSS Global untuk render */}
      <style dangerouslySetInnerHTML={{__html: `
        .ql-editor { font-size: 16px; font-family: inherit; }
        .ql-editor img { max-width: 100%; height: auto; border-radius: 8px; }
      `}} />
    </div>
  );
}
