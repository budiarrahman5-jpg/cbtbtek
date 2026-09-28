'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { Trophy, Download, Search, Calculator, Sparkles, CheckSquare } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function HasilUjianPage() {
  const [hasil, setHasil] = useState<any[]>([]);
  const [paketList, setPaketList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  
  const [selectedPaket, setSelectedPaket] = useState('ALL');
  const [selectedKelas, setSelectedKelas] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [modalKoreksi, setModalKoreksi] = useState<{isOpen: boolean, data: any, soalList: any[]}>({
    isOpen: false, data: null, soalList: []
  });
  const [skorManual, setSkorManual] = useState<number>(0);
  const [isSavingKoreksi, setIsSavingKoreksi] = useState(false);  useEffect(() => {
    fetchFilters();
    fetchHasil();
  }, [selectedPaket, selectedKelas]);

  const fetchFilters = async () => {
    let { data: p } = await supabase.from('paket').select('*');
    p = filterDemoData(p, 'paket');
    if (p) setPaketList(p);
    
    let { data: k } = await supabase.from('kelas').select('*');
    k = filterDemoData(k, 'kelas');
    if (k) setKelasList(k);
  };

  const fetchHasil = async () => {
    setIsLoading(true);
    let query = supabase
      .from('hasil')
      .select('*, users!inner(nama, kelas_id), paket(nama_paket)');

    if (selectedPaket !== 'ALL') query = query.eq('paket_id', selectedPaket);
    if (selectedKelas !== 'ALL') query = query.eq('users.kelas_id', selectedKelas);

    let { data } = await query;
    data = filterDemoData(data, 'hasil');
    if (data) setHasil(data);
    setIsLoading(false);
  };

  const filteredHasil = hasil.filter(h => 
    h.users?.nama?.toLowerCase().includes(search.toLowerCase())
  );

  const handleKoreksiAI = async () => {
    if (selectedPaket === 'ALL') {
      return alert('Pilih satu paket spesifik terlebih dahulu untuk dikoreksi otomatis.');
    }
    
    if (!confirm('AI akan mengoreksi dan memberikan nilai untuk semua jawaban Essay/Isian yang masih belum dinilai di paket ini. Lanjutkan?')) return;
    
    setIsAILoading(true);
    try {
      const res = await fetch('/api/gemini/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paket_id: selectedPaket })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error === 'API_KEY_MISSING') {
          alert('API Key Groq AI belum diatur! Silakan atur di menu Pengaturan terlebih dahulu.');
        } else {
          alert('Gagal koreksi AI: ' + data.error);
        }
      } else {
        alert(`Berhasil! AI telah mengoreksi ${data.updated} soal essay/isian.`);
        fetchHasil(); // Refresh data
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi saat memanggil AI.');
    }
    setIsAILoading(false);
  };

  const handleDownloadExcel = () => {
    if (filteredHasil.length === 0) return alert('Tidak ada data untuk diunduh.');

    const dataToExport = filteredHasil.map((h, i) => ({
      'No': i + 1,
      'Nama Siswa': h.users?.nama || '-',
      'Kelas': kelasList.find(k => k.id === h.users?.kelas_id)?.nama_kelas || '-',
      'Paket Ujian': h.paket?.nama_paket || '-',
      'Nilai (Skor Akhir)': h.skor_akhir,
      'Cheat Count': h.cheat_count,
      'Waktu Sisa (detik)': h.waktu_sisa,
      'Status Koreksi': h.status_koreksi
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Hasil Ujian");
    
    const namaKelas = selectedKelas !== 'ALL' ? kelasList.find(k => k.id === selectedKelas)?.nama_kelas || 'Semua_Kelas' : 'Semua_Kelas';
    const namaPaket = selectedPaket !== 'ALL' ? paketList.find(p => p.id === selectedPaket)?.nama_paket || 'Semua_Paket' : 'Semua_Paket';
    const fileName = `Hasil_Ujian_${namaKelas}_${namaPaket}.xlsx`.replace(/\s+/g, '_');

    XLSX.writeFile(workbook, fileName);
  };

  const handleHitungUlang = async () => {
    if (selectedPaket === 'ALL') {
      return alert('Pilih satu paket spesifik terlebih dahulu untuk menghitung ulang nilai.');
    }
    
    if (!confirm('Apakah Anda yakin ingin menghitung ulang semua nilai pada paket ini? Proses ini dapat memperbaiki skor jika ada perubahan kunci jawaban.')) return;
    
    setIsRecalculating(true);
    try {
      const { data: soalData, error: errSoal } = await supabase
        .from('paket_soal')
        .select('soal(*)')
        .eq('paket_id', selectedPaket);
        
      if (errSoal) throw errSoal;
      const soalList = soalData.map((s: any) => s.soal);

      for (const h of filteredHasil) {
        let totalSkorBenar = 0;
        let totalSkorMaks = 0;
        const jawaban = h.detail_jawaban || {};

        soalList.forEach((soal: any) => {
          const bobot = soal.skor_maks || 10;
          totalSkorMaks += bobot;
          
          const jwbSiswa = jawaban[soal.id];
          if (!jwbSiswa) return;
          
          if (soal.tipe === 'PG') {
            if (jwbSiswa === soal.kunci?.toUpperCase()) totalSkorBenar += bobot;
          } 
          else if (soal.tipe === 'PG Kompleks') {
            const kunciArr = (soal.kunci || '').split(',').map((k: string) => k.trim().toUpperCase());
            let benarCount = 0;
            if (Array.isArray(jwbSiswa)) {
               jwbSiswa.forEach(j => {
                 if (kunciArr.includes(j)) benarCount++;
               });
               if (kunciArr.length > 0) {
                 totalSkorBenar += (benarCount / kunciArr.length) * bobot;
               }
            }
          }
          else if (soal.tipe === 'Menjodohkan') {
            try {
              const kunciAsli = JSON.parse(soal.kunci || '[]');
              let benarCount = 0;
              if (Array.isArray(jwbSiswa)) {
                 jwbSiswa.forEach((j: any) => {
                   if (kunciAsli.find((k:any) => k.premisId === j.premisId && k.responsId === j.responsId)) {
                     benarCount++;
                   }
                 });
              }
              if (kunciAsli.length > 0) {
                 totalSkorBenar += (benarCount / kunciAsli.length) * bobot;
              }
            } catch(e) {}
          }
          else if (soal.tipe === 'Isian') {
             if (soal.kunci && String(jwbSiswa).toLowerCase().trim() === soal.kunci.toLowerCase().trim()) {
                totalSkorBenar += bobot;
             }
          }
        });

        const skorAkhir = totalSkorMaks > 0 ? Math.round((totalSkorBenar / totalSkorMaks) * 100) : 0;
        
        if (h.skor_akhir !== skorAkhir) {
           await supabase.from('hasil').update({ skor_akhir: skorAkhir }).eq('id', h.id);
        }
      }
      
      alert('Hitung ulang berhasil!');
      fetchHasil();
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menghitung ulang.');
    }
    setIsRecalculating(false);
  };

  const openKoreksi = async (hasilRow: any) => {
    setModalKoreksi({ isOpen: true, data: hasilRow, soalList: [] });
    setSkorManual(hasilRow.skor_akhir || 0);

    const { data: soalData } = await supabase
        .from('paket_soal')
        .select('soal(*)')
        .eq('paket_id', hasilRow.paket_id);
        
    if (soalData) {
       setModalKoreksi(prev => ({ ...prev, soalList: soalData.map((s: any) => s.soal) }));
    }
  };

  const saveKoreksiManual = async () => {
    setIsSavingKoreksi(true);
    try {
      await supabase.from('hasil')
        .update({ skor_akhir: skorManual, status_koreksi: 'Selesai' })
        .eq('id', modalKoreksi.data.id);
        
      alert('Nilai berhasil diperbarui!');
      setModalKoreksi({ isOpen: false, data: null, soalList: [] });
      fetchHasil();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan nilai.');
    }
    setIsSavingKoreksi(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 border-b pb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Trophy className="text-yellow-600" /> Hasil Ujian
          </h2>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button 
              onClick={() => alert('Fitur Koreksi Essay AI sedang dalam tahap pengembangan dan kalibrasi dengan API Groq. Silakan lakukan koreksi secara manual untuk sementara waktu.')}
              className="flex-1 md:flex-none bg-gradient-to-r from-slate-400 to-slate-500 hover:from-slate-500 hover:to-slate-600 text-white px-3 py-2 rounded font-bold flex items-center justify-center gap-2 transition shadow-md cursor-not-allowed"
              title="Sedang Dalam Pengembangan"
            >
              <Sparkles size={18} /> 
              <span className="hidden md:inline">Koreksi Essay AI (Pengembangan)</span>
            </button>
            <button 
              onClick={handleHitungUlang}
              disabled={isRecalculating}
              className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded font-bold flex items-center justify-center gap-2 transition"
            >
              <Calculator size={18} className={isRecalculating ? "animate-spin" : ""} /> 
              <span className="hidden md:inline">{isRecalculating ? 'Menghitung...' : 'Hitung Ulang'}</span>
            </button>
            <button 
              onClick={handleDownloadExcel}
              className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded font-bold flex items-center justify-center gap-2 transition"
            >
              <Download size={18} /> <span className="hidden md:inline">Download Hasil Ujian</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <select 
            value={selectedPaket} onChange={e=>setSelectedPaket(e.target.value)}
            className="border p-2 rounded bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
          >
            <option value="ALL">-- Semua Paket --</option>
            {paketList.map(p => <option key={p.id} value={p.id}>{p.nama_paket}</option>)}
          </select>

          <select 
            value={selectedKelas} onChange={e=>setSelectedKelas(e.target.value)}
            className="border p-2 rounded bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
          >
            <option value="ALL">-- Semua Kelas --</option>
            {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Cari nama siswa..." 
              className="w-full pl-10 pr-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-100 text-gray-700 border-b">
              <tr>
                <th className="p-3 font-semibold">Nama Siswa</th>
                <th className="p-3 font-semibold">Kelas</th>
                <th className="p-3 font-semibold">Paket Ujian</th>
                <th className="p-3 font-semibold text-center">Nilai (Skor Akhir)</th>
                <th className="p-3 font-semibold text-center">Cheat Count</th>
                <th className="p-3 font-semibold text-center">Waktu Sisa</th>
                <th className="p-3 font-semibold text-center">Status Koreksi</th>
                <th className="p-3 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500 font-bold">Memuat hasil...</td></tr>
              ) : filteredHasil.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Tidak ada data hasil.</td></tr>
              ) : (
                filteredHasil.map(h => (
                  <tr key={h.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-800">{h.users?.nama}</td>
                    <td className="p-3 text-gray-600">
                      {kelasList.find(k => k.id === h.users?.kelas_id)?.nama_kelas || '-'}
                    </td>
                    <td className="p-3 font-semibold text-blue-800">{h.paket?.nama_paket}</td>
                    <td className="p-3 text-center">
                       <span className={`px-2 py-1 rounded font-black ${h.skor_akhir >= 75 ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
                         {h.skor_akhir}
                       </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={h.cheat_count > 0 ? "text-red-600 font-bold" : "text-gray-400"}>
                        {h.cheat_count}x
                      </span>
                    </td>
                    <td className="p-3 text-center text-gray-500">
                      {Math.floor(h.waktu_sisa / 60)} mnt {h.waktu_sisa % 60} dtk
                    </td>
                    <td className="p-3 text-center">
                       <span className={`px-2 py-1 rounded text-xs font-bold ${h.status_koreksi === 'Selesai' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-700'}`}>
                         {h.status_koreksi}
                       </span>
                    </td>
                    <td className="p-3 text-center">
                       <button onClick={() => openKoreksi(h)} className="text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded font-bold transition flex items-center gap-1 mx-auto">
                          <CheckSquare size={14} /> Koreksi
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Koreksi Manual */}
      {modalKoreksi.isOpen && modalKoreksi.data && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-lg">Koreksi Manual - {modalKoreksi.data.users?.nama}</h3>
              <button onClick={() => setModalKoreksi({ isOpen: false, data: null, soalList: [] })} className="text-gray-500 hover:text-red-500 font-bold">✕</button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-grow bg-slate-50">
              <div className="mb-4 bg-white p-4 rounded border">
                 <p className="text-sm text-gray-500 mb-4">Detail Jawaban Siswa (Essay/Isian):</p>
                 {modalKoreksi.soalList.length === 0 ? (
                    <p className="text-gray-400 italic text-sm">Memuat detail soal...</p>
                 ) : (
                    <div className="space-y-6">
                      {modalKoreksi.soalList.filter(s => ['Essay', 'Isian'].includes(s.tipe)).map((soal, i) => (
                        <div key={soal.id} className="border-b pb-4 last:border-0 last:pb-0">
                           <div className="font-semibold text-sm mb-2 text-gray-800 flex gap-2">
                              <span className="text-indigo-600 font-black">Q:</span> 
                              <span dangerouslySetInnerHTML={{__html: soal.pertanyaan}} />
                           </div>
                           <div className="text-sm text-gray-600 mb-2">
                              <span className="font-semibold text-emerald-600">Kunci Jawaban:</span> {soal.kunci || '-'} (Bobot: {soal.skor_maks || 10})
                           </div>
                           <div className="text-sm bg-blue-50 p-3 rounded text-blue-900 border border-blue-100">
                             <span className="font-semibold block mb-1">Jawaban Siswa:</span> 
                             {modalKoreksi.data.detail_jawaban[soal.id] || <span className="italic text-gray-400">Tidak dijawab</span>}
                           </div>
                        </div>
                      ))}
                      {modalKoreksi.soalList.filter(s => ['Essay', 'Isian'].includes(s.tipe)).length === 0 && (
                         <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded">Tidak ada soal bertipe Essay atau Isian di paket ini.</p>
                      )}
                    </div>
                 )}
              </div>
            </div>

            <div className="p-5 border-t bg-white rounded-b-xl flex justify-between items-center">
              <div className="flex items-center gap-3">
                 <label className="font-bold text-gray-700">Override Skor Akhir:</label>
                 <input 
                   type="number" 
                   value={skorManual} 
                   onChange={e => setSkorManual(Number(e.target.value))}
                   className="border-2 border-indigo-200 rounded px-3 py-1.5 w-24 font-bold text-lg text-center focus:outline-none focus:border-indigo-500"
                 />
              </div>
              <div className="flex gap-2">
                 <button onClick={() => setModalKoreksi({ isOpen: false, data: null, soalList: [] })} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded transition">Batal</button>
                 <button 
                   onClick={saveKoreksiManual} 
                   disabled={isSavingKoreksi}
                   className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded font-bold transition flex items-center gap-2"
                 >
                   {isSavingKoreksi ? 'Menyimpan...' : 'Simpan Nilai'}
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
