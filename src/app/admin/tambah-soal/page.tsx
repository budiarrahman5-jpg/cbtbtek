'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PlusCircle, Save } from 'lucide-react';

export default function TambahSoalPage() {
  const [paketList, setPaketList] = useState<any[]>([]);
  const [selectedPaket, setSelectedPaket] = useState('');
  const [tipe, setTipe] = useState('PG');
  const [pertanyaan, setPertanyaan] = useState('');
  const [kunci, setKunci] = useState('');
  const [skor, setSkor] = useState(10);
  
  // Opsi untuk PG
  const [opsi, setOpsi] = useState({ A: '', B: '', C: '', D: '', E: '' });

  useEffect(() => {
    fetchPaket();
  }, []);

  const fetchPaket = async () => {
    const { data } = await supabase.from('paket').select('*').neq('status', 'Diarsipkan');
    if (data) setPaketList(data);
  };

  const simpanSoal = async () => {
    if (!selectedPaket || !pertanyaan || !kunci) {
      alert('Isi semua field yang wajib (*)');
      return;
    }

    const payload: any = {
      paket_id: selectedPaket,
      tipe: tipe,
      pertanyaan: pertanyaan,
      kunci: kunci,
      skor_maks: skor,
    };

    if (tipe === 'PG' || tipe === 'PG Kompleks') {
      payload.opsi_a = opsi.A;
      payload.opsi_b = opsi.B;
      payload.opsi_c = opsi.C;
      payload.opsi_d = opsi.D;
      payload.opsi_e = opsi.E;
    }

    const { error } = await supabase.from('soal').insert(payload);
    
    if (error) {
      alert('Gagal menyimpan soal.');
    } else {
      alert('Soal berhasil disimpan!');
      // Reset form
      setPertanyaan(''); setKunci('');
      setOpsi({ A: '', B: '', C: '', D: '', E: '' });
    }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-sm border-t-4 border-blue-600 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 border-b pb-4">
        <PlusCircle className="text-blue-600 w-8 h-8" />
        <h2 className="text-2xl font-bold text-gray-800">Tambah Soal Baru</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block font-bold text-sm mb-2 text-gray-700">Pilih Paket Soal <span className="text-red-500">*</span></label>
          <select 
            value={selectedPaket} onChange={e=>setSelectedPaket(e.target.value)} 
            className="w-full border-2 p-3 rounded-lg bg-yellow-50 focus:ring-blue-500 focus:border-blue-500 font-bold outline-none border-yellow-300"
          >
            <option value="">- Wajib Pilih Paket -</option>
            {paketList.map(p => <option key={p.id} value={p.id}>{p.nama_paket}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-bold text-sm mb-2 text-gray-700">Tipe Soal <span className="text-red-500">*</span></label>
          <select 
            value={tipe} onChange={e=>setTipe(e.target.value)} 
            className="w-full border-2 p-3 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 font-bold outline-none"
          >
            <option value="PG">Pilihan Ganda (PG)</option>
            <option value="PG Kompleks">PG Kompleks (Banyak Jawaban)</option>
            <option value="Isian">Isian Singkat</option>
            <option value="Essay">Essay / Uraian</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block font-bold text-sm mb-2 text-gray-700">Pertanyaan <span className="text-red-500">*</span></label>
        <textarea 
          rows={4} 
          value={pertanyaan} onChange={e=>setPertanyaan(e.target.value)}
          className="w-full border-2 p-3 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none"
          placeholder="Ketik pertanyaan di sini..."
        />
      </div>

      {(tipe === 'PG' || tipe === 'PG Kompleks') && (
        <div className="bg-blue-50 p-5 rounded-lg border border-blue-200 space-y-4">
          <p className="text-xs text-blue-800 font-bold">PILIHAN JAWABAN</p>
          {['A', 'B', 'C', 'D'].map(opt => (
            <div key={opt} className="flex items-center gap-3">
              <b className="text-lg w-6">{opt}.</b>
              <input 
                type="text" 
                value={(opsi as any)[opt]} onChange={e=>setOpsi({...opsi, [opt]: e.target.value})}
                className="flex-1 border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder={`Teks opsi ${opt}...`} 
              />
            </div>
          ))}
          <div className="flex items-center gap-3 pt-4 border-t border-blue-200">
            <b className="text-lg w-6">E.</b>
            <input 
              type="text" 
              value={opsi.E} onChange={e=>setOpsi({...opsi, E: e.target.value})}
              className="flex-1 border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="[OPSIONAL] Teks opsi E..." 
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block font-bold text-sm mb-2 text-gray-700">Kunci Jawaban <span className="text-red-500">*</span></label>
          <input 
            type="text" 
            value={kunci} onChange={e=>setKunci(e.target.value)}
            className="w-full border-2 p-3 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none uppercase font-bold" 
            placeholder="Contoh: A, B, atau Teks Isian" 
          />
        </div>
        <div>
          <label className="block font-bold text-sm mb-2 text-gray-700">Skor Maksimal</label>
          <input 
            type="number" 
            value={skor} onChange={e=>setSkor(Number(e.target.value))}
            className="w-full border-2 p-3 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none font-bold text-blue-800" 
          />
        </div>
      </div>

      <button 
        onClick={simpanSoal}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg shadow-lg text-lg flex justify-center items-center gap-2 transition-transform active:scale-95"
      >
        <Save size={24} /> Simpan Soal ke Database
      </button>
    </div>
  );
}
