'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { PieChart, Search, Download, FileSpreadsheet, Check, X, Minus } from 'lucide-react';
import clsx from 'clsx';

export default function AnalisisSoalPage() {
  const [paketList, setPaketList] = useState<any[]>([]);
  const [selectedPaket, setSelectedPaket] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analisis, setAnalisis] = useState<any[]>([]);
  const [soalList, setSoalList] = useState<any[]>([]);

  useEffect(() => {
    fetchPaket();
  }, []);

  const fetchPaket = async () => {
    let { data } = await supabase.from('paket').select('*').order('nama_paket');
    data = filterDemoData(data, 'paket');
    if (data) setPaketList(data);
  };

  const prosesAnalisis = async () => {
    if (!selectedPaket) {
      alert('Pilih paket ujian terlebih dahulu!');
      return;
    }
    
    setIsLoading(true);
    
    // 1. Ambil daftar soal untuk header tabel
    let { data: relData } = await supabase
      .from('paket_soal')
      .select('soal(id, kunci, tipe)')
      .eq('paket_id', selectedPaket);
      
    let dataSoal = relData ? relData.map((r: any) => r.soal).sort((a: any, b: any) => a.id.localeCompare(b.id)) : [];
      
    const filteredSoal = filterDemoData(dataSoal, 'soal');
    if (filteredSoal) setSoalList(filteredSoal);

    // 2. Ambil semua hasil dari paket ini
    let { data: hasilData } = await supabase
      .from('hasil')
      .select('detail_jawaban, skor_akhir, users(nama, username)')
      .eq('paket_id', selectedPaket)
      .order('skor_akhir', { ascending: false });

    hasilData = filterDemoData(hasilData, 'hasil');
    if (hasilData) {
      setAnalisis(hasilData);
    }
    
    setIsLoading(false);
  };

  // Fungsi untuk render sel matriks
  const renderSelMatriks = (soal: any, jawabanSiswa: any) => {
    if (!jawabanSiswa || (typeof jawabanSiswa === 'string' && jawabanSiswa.trim() === '') || (Array.isArray(jawabanSiswa) && jawabanSiswa.length === 0)) {
      return (
        <td key={soal.id} className="p-2 border border-slate-200 text-center bg-slate-50">
          <Minus size={16} className="text-slate-300 mx-auto" />
        </td>
      );
    }

    if (soal.tipe === 'PG') {
      const isCorrect = typeof jawabanSiswa === 'string' && jawabanSiswa.toUpperCase() === soal.kunci?.toUpperCase();
      return (
        <td 
          key={soal.id} 
          className={clsx(
            "p-2 border border-slate-200 text-center font-bold text-sm",
            isCorrect ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"
          )}
        >
          {jawabanSiswa.toUpperCase()}
        </td>
      );
    }

    if (soal.tipe === 'PG Kompleks') {
      const isCorrect = Array.isArray(jawabanSiswa) && jawabanSiswa.sort().join(',') === (soal.kunci || '').split(',').map((k:string)=>k.trim().toUpperCase()).sort().join(',');
      return (
        <td 
          key={soal.id} 
          className={clsx(
            "p-2 border border-slate-200 text-center font-bold text-sm",
            isCorrect ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"
          )}
        >
          {Array.isArray(jawabanSiswa) ? jawabanSiswa.join(', ') : jawabanSiswa}
        </td>
      );
    }
    
    if (soal.tipe === 'Menjodohkan') {
      let benarCount = 0;
      let totalKunci = 0;
      try {
        const kunciAsli = JSON.parse(soal.kunci || '[]');
        totalKunci = kunciAsli.length;
        if (Array.isArray(jawabanSiswa)) {
           jawabanSiswa.forEach((j: any) => {
             if (kunciAsli.find((k:any) => k.premisId === j.premisId && k.responsId === j.responsId)) {
               benarCount++;
             }
           });
        }
      } catch(e) {}
      
      const isFullCorrect = benarCount === totalKunci && totalKunci > 0;
      const isPartial = benarCount > 0 && benarCount < totalKunci;

      return (
        <td 
          key={soal.id} 
          className={clsx(
            "p-2 border border-slate-200 text-center font-bold text-xs",
            isFullCorrect ? "bg-emerald-50 text-emerald-600" : isPartial ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-500"
          )}
          title={`Benar ${benarCount} dari ${totalKunci} koneksi`}
        >
          {benarCount}/{totalKunci}
        </td>
      );
    }

    // Untuk Essay / Isian
    const jawabanString = String(jawabanSiswa);
    const isCorrect = soal.kunci && jawabanString.toLowerCase().includes(soal.kunci.toLowerCase());
    return (
      <td 
        key={soal.id} 
        className="p-2 border border-slate-200 text-center relative group"
      >
        <div className="w-16 mx-auto truncate text-xs text-slate-600 font-medium">
          {jawabanString}
        </div>
        {/* Tooltip untuk essay yang panjang */}
        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg hidden group-hover:block whitespace-normal">
          {jawabanString}
        </div>
      </td>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><FileSpreadsheet size={20} /></div> 
            Analisis Butir Soal
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Matriks jawaban siswa untuk evaluasi soal.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <select 
            value={selectedPaket} onChange={e=>setSelectedPaket(e.target.value)}
            className="w-full sm:w-auto border-2 border-slate-200 p-2.5 rounded-xl bg-white font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
          >
            <option value="">-- Pilih Paket Ujian --</option>
            {paketList.map(p => <option key={p.id} value={p.id}>{p.nama_paket}</option>)}
          </select>
          <button 
            onClick={prosesAnalisis}
            disabled={isLoading}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
          >
            <Search size={18} /> {isLoading ? 'Memuat...' : 'Proses Matriks'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden min-h-[400px] flex flex-col">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center flex-1 p-20 gap-4">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-slate-500 animate-pulse">Menyusun Matriks Jawaban...</p>
          </div>
        ) : analisis.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 p-20 text-center">
            <div className="bg-slate-50 p-6 rounded-full mb-4">
              <PieChart size={48} className="text-slate-300" />
            </div>
            <h3 className="font-extrabold text-xl text-slate-700">Pilih Paket Ujian</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-sm leading-relaxed">
              Silakan pilih paket ujian di atas lalu klik <b>Proses Matriks</b> untuk melihat detail jawaban per butir soal dari seluruh siswa.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar flex-1">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex gap-4 text-xs font-bold text-slate-500">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded"></div> Benar</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-rose-100 border border-rose-200 rounded"></div> Salah</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-100 border border-slate-200 rounded flex items-center justify-center"><Minus size={10} className="text-slate-400"/></div> Kosong</div>
            </div>
            <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 font-bold uppercase text-xs tracking-wider">
                <tr>
                  <th className="p-3 border border-slate-200 min-w-[200px] bg-slate-100 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Nama Siswa</th>
                  <th className="p-3 border border-slate-200 text-center min-w-[80px]">Skor</th>
                  {soalList.map((soal, i) => (
                    <th key={soal.id} className="p-3 border border-slate-200 text-center w-12" title={`Soal ${i + 1}`}>
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analisis.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    {/* @ts-ignore */}
                    <td className="p-3 border border-slate-200 font-bold text-slate-700 bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      {h.users?.nama}
                    </td>
                    <td className="p-3 border border-slate-200 text-center font-black text-indigo-600 bg-indigo-50/30">
                      {h.skor_akhir}
                    </td>
                    {soalList.map((soal) => {
                      const jawabanSiswa = h.detail_jawaban?.[soal.id];
                      return renderSelMatriks(soal, jawabanSiswa);
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
