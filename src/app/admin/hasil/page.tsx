'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { Trophy, Download, Search, Calculator, Sparkles, CheckSquare, Trash2, RefreshCw, Printer, FileText, X } from 'lucide-react';
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
  const [skorManual, setSkorManual] = useState<Record<string, number>>({});
  const [isSavingKoreksi, setIsSavingKoreksi] = useState(false);
  
  // State Cetak PDF Ber-Kop Surat
  const [modalPrintPDF, setModalPrintPDF] = useState(false);
  const [kopSettings, setKopSettings] = useState({
    instansiAtas: 'PEMERINTAH DAERAH PROVINSI / KABUPATEN',
    dinas: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
    namaSekolah: 'SMK / SMA / SMP CBT B-TEK',
    alamat: 'Jl. Pendidikan No. 123, Telp. (021) 1234567, Website: www.sekolah.sch.id',
    kota: 'Jakarta',
    tanggalCetak: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    kepalaSekolah: 'Nama Kepala Sekolah, M.Pd.',
    nipKepala: '19750101 200003 1 001',
    guruPengampu: 'Guru Pengampu / Proktor CBT',
    nipGuru: '19820515 200801 1 005',
    kkm: 75
  });

  useEffect(() => {
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

    const { data: pengData } = await supabase.from('pengaturan').select('*');
    if (pengData) {
      const map: Record<string, string> = {};
      pengData.forEach((item: any) => { map[item.kunci] = item.nilai; });
      setKopSettings(prev => ({
        ...prev,
        namaSekolah: map.nama_aplikasi || prev.namaSekolah,
        kkm: Number(map.nilai_kkm) || prev.kkm
      }));
    }
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

  const [isAILoadingSiswa, setIsAILoadingSiswa] = useState(false);

  const handleKoreksiAISiswa = async () => {
    if (!modalKoreksi.data) return;
    setIsAILoadingSiswa(true);
    try {
      const res = await fetch('/api/gemini/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasil_id: modalKoreksi.data.id })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'API_KEY_MISSING') {
          alert('API Key Groq AI belum diatur di menu Pengaturan!');
        } else {
          alert('Gagal koreksi AI: ' + data.error);
        }
      } else {
        if (data.skor_per_soal && Object.keys(data.skor_per_soal).length > 0) {
          setSkorManual(prev => ({
            ...prev,
            ...data.skor_per_soal
          }));
        }
        if (data.detail_jawaban) {
          setModalKoreksi(prev => ({
            ...prev,
            data: {
              ...prev.data,
              detail_jawaban: data.detail_jawaban,
              skor_akhir: data.skor_akhir,
              status_koreksi: 'Selesai'
            }
          }));
        }
        alert(`Berhasil! Groq AI telah mengoreksi ${data.updated} soal essay/isian untuk siswa ini. Skor otomatis telah diisikan ke kotak penilaian.`);
        fetchHasil();
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat memanggil AI untuk koreksi siswa.');
    }
    setIsAILoadingSiswa(false);
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
          
          if (jawaban[`koreksi_${soal.id}`] !== undefined && jawaban[`koreksi_${soal.id}`] !== '') {
            totalSkorBenar += Number(jawaban[`koreksi_${soal.id}`]);
            return;
          }

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
          else if (soal.tipe === 'Essay' || soal.tipe === 'Isian') {
             if (jawaban[`koreksi_${soal.id}`] !== undefined) {
               totalSkorBenar += Number(jawaban[`koreksi_${soal.id}`]);
             } else if (soal.tipe === 'Isian' && soal.kunci && String(jwbSiswa).toLowerCase().trim() === soal.kunci.toLowerCase().trim()) {
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
    
    const initialSkor: Record<string, number> = {};
    const detailJawaban = hasilRow.detail_jawaban || {};

    const { data: soalData } = await supabase
        .from('paket_soal')
        .select('soal(*)')
        .eq('paket_id', hasilRow.paket_id);
        
    if (soalData) {
       const sList = soalData.map((s: any) => s.soal);
       sList.forEach((s: any) => {
         const bobot = s.skor_maks || 10;
         if (detailJawaban[`koreksi_${s.id}`] !== undefined) {
           initialSkor[s.id] = Number(detailJawaban[`koreksi_${s.id}`]);
         } else {
           const jwb = detailJawaban[s.id];
           if (!jwb) {
             initialSkor[s.id] = 0;
           } else if (s.tipe === 'PG') {
             initialSkor[s.id] = jwb === s.kunci?.toUpperCase() ? bobot : 0;
           } else if (s.tipe === 'PG Kompleks') {
             const kunciArr = (s.kunci || '').split(',').map((k: string) => k.trim().toUpperCase());
             let benar = 0;
             if (Array.isArray(jwb)) {
               jwb.forEach((j: string) => { if (kunciArr.includes(j)) benar++; });
               initialSkor[s.id] = kunciArr.length > 0 ? Math.round((benar / kunciArr.length) * bobot) : 0;
             } else {
               initialSkor[s.id] = 0;
             }
           } else if (s.tipe === 'Menjodohkan') {
             try {
               const kunciAsli = JSON.parse(s.kunci || '[]');
               let benar = 0;
               if (Array.isArray(jwb)) {
                 jwb.forEach((j: any) => {
                   if (kunciAsli.find((k:any) => k.premisId === j.premisId && k.responsId === j.responsId)) benar++;
                 });
               }
               initialSkor[s.id] = kunciAsli.length > 0 ? Math.round((benar / kunciAsli.length) * bobot) : 0;
             } catch(e) {
               initialSkor[s.id] = 0;
             }
           } else if (s.tipe === 'Isian') {
             initialSkor[s.id] = s.kunci && String(jwb).toLowerCase().trim() === s.kunci.toLowerCase().trim() ? bobot : 0;
           } else {
             initialSkor[s.id] = 0;
           }
         }
       });
       setSkorManual(initialSkor);
       setModalKoreksi(prev => ({ ...prev, soalList: sList }));
    }
  };

  const saveKoreksiManual = async () => {
    setIsSavingKoreksi(true);
    try {
      const h = modalKoreksi.data;
      const jawaban = { ...h.detail_jawaban };
      
      for (const [soalId, score] of Object.entries(skorManual)) {
        jawaban[`koreksi_${soalId}`] = score;
      }

      let totalSkorBenar = 0;
      let totalSkorMaks = 0;
      
      modalKoreksi.soalList.forEach((soal: any) => {
        const bobot = soal.skor_maks || 10;
        totalSkorMaks += bobot;
        
        if (jawaban[`koreksi_${soal.id}`] !== undefined && jawaban[`koreksi_${soal.id}`] !== '') {
          totalSkorBenar += Number(jawaban[`koreksi_${soal.id}`]);
          return;
        }

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

      const finalSkor = totalSkorMaks > 0 ? Math.round((totalSkorBenar / totalSkorMaks) * 100) : 0;

      await supabase.from('hasil')
        .update({ skor_akhir: finalSkor, detail_jawaban: jawaban, status_koreksi: 'Selesai' })
        .eq('id', modalKoreksi.data.id);
        
      alert(`Nilai berhasil disimpan! Skor akhir dikalkulasi menjadi: ${finalSkor}`);
      setModalKoreksi({ isOpen: false, data: null, soalList: [] });
      fetchHasil();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan nilai.');
    }
    setIsSavingKoreksi(false);
  };

  const handleResetUjian = async (hasilRow: any) => {
    if (!confirm(`Yakin ingin mereset ujian siswa ${hasilRow.users?.nama}? Ini akan menghapus hasil secara permanen dan mereset status ujian sehingga siswa dapat mengikuti ujian ini lagi dari awal.`)) return;

    try {
      await supabase.from('hasil').delete().eq('id', hasilRow.id);
      await supabase.from('users').update({ status_ujian: 'Belum Ujian', status_login: '0' }).eq('id', hasilRow.user_id);
      
      alert('Ujian berhasil direset!');
      fetchHasil();
    } catch (err) {
      console.error(err);
      alert('Gagal mereset ujian.');
    }
  };

  const handleResetCheat = async (hasilRow: any) => {
    if (!confirm(`Reset cheat count untuk ${hasilRow.users?.nama}?`)) return;

    try {
      await supabase.from('hasil').update({ cheat_count: 0 }).eq('id', hasilRow.id);
      alert('Cheat count berhasil direset!');
      fetchHasil();
    } catch (err) {
      console.error(err);
      alert('Gagal reset cheat count.');
    }
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
              onClick={handleKoreksiAI}
              disabled={isAILoading || selectedPaket === 'ALL'}
              className="flex-1 md:flex-none bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded font-bold flex items-center justify-center gap-2 transition shadow-md active:scale-95"
              title={selectedPaket === 'ALL' ? 'Pilih satu paket ujian terlebih dahulu untuk koreksi otomatis' : 'Koreksi Otomatis Soal Essay/Isian dengan Groq AI'}
            >
              <Sparkles size={18} className={isAILoading ? 'animate-spin' : 'animate-pulse'} /> 
              <span className="hidden md:inline">{isAILoading ? 'AI Sedang Mengoreksi...' : 'Koreksi Essay AI'}</span>
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
              <Download size={18} /> <span className="hidden md:inline">Download Excel</span>
            </button>
            <button 
              onClick={() => setModalPrintPDF(true)}
              className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded font-bold flex items-center justify-center gap-2 transition shadow-sm"
              title="Cetak Laporan Resmi Ber-Kop Surat / Simpan ke PDF"
            >
              <Printer size={18} /> <span className="hidden md:inline">Cetak / PDF (Kop Resmi)</span>
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
                <tr><td colSpan={8} className="p-8 text-center text-gray-500 font-bold">Memuat hasil...</td></tr>
              ) : filteredHasil.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Tidak ada data hasil.</td></tr>
              ) : (
                filteredHasil.map(h => (
                  <tr key={h.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-800">{h.users?.nama}</td>
                    <td className="p-3 text-gray-600">
                      {kelasList.find(k => k.id === h.users?.kelas_id)?.nama_kelas || '-'}
                    </td>
                    <td className="p-3 font-semibold text-blue-800">{h.paket?.nama_paket}</td>
                    <td className="p-3 text-center">
                       <span className={`px-2.5 py-1 rounded font-black ${h.skor_akhir >= kopSettings.kkm ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'}`}>
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
                       {h.status_koreksi === 'Menunggu Koreksi' ? (
                         <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1.5 shadow-sm animate-pulse">
                           <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                           Perlu Koreksi
                         </span>
                       ) : (
                         <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5 shadow-sm">
                           <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                           Selesai
                         </span>
                       )}
                    </td>
                    <td className="p-3 text-center">
                       <div className="flex items-center justify-center gap-2">
                         <button 
                           onClick={() => openKoreksi(h)} 
                           className={`text-sm px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                             h.status_koreksi === 'Menunggu Koreksi'
                               ? 'bg-amber-500 hover:bg-amber-600 text-white shadow ring-2 ring-amber-300'
                               : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                           }`} 
                           title={h.status_koreksi === 'Menunggu Koreksi' ? 'Koreksi Soal Essay/Isian Sekarang' : 'Koreksi Manual'}
                         >
                            <CheckSquare size={14} /> Koreksi
                         </button>
                         <button onClick={() => handleResetCheat(h)} className="text-sm bg-orange-100 text-orange-700 hover:bg-orange-200 px-2 py-1.5 rounded font-bold transition flex items-center gap-1" title="Reset Cheat">
                            <RefreshCw size={14} />
                         </button>
                         <button onClick={() => handleResetUjian(h)} className="text-sm bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1.5 rounded font-bold transition flex items-center gap-1" title="Reset Ujian">
                            <Trash2 size={14} />
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

      {/* Modal Koreksi Manual Premium */}
      {modalKoreksi.isOpen && modalKoreksi.data && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white">
              <div>
                <h3 className="font-extrabold text-xl text-slate-800 flex items-center gap-2">
                  <CheckSquare className="text-indigo-600" /> Koreksi Jawaban Siswa
                </h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Peserta: <span className="text-indigo-600 font-bold">{modalKoreksi.data.users?.nama}</span></p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  onClick={handleKoreksiAISiswa}
                  disabled={isAILoadingSiswa}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                  title="Gunakan Groq AI untuk menilai seluruh jawaban essay/isian murid ini secara otomatis"
                >
                  <Sparkles size={16} className={isAILoadingSiswa ? "animate-spin" : "animate-pulse"} />
                  <span>{isAILoadingSiswa ? "AI Sedang Menilai..." : "✨ Koreksi AI Murid Ini"}</span>
                </button>
                <button onClick={() => setModalKoreksi({ isOpen: false, data: null, soalList: [] })} className="text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 p-2 rounded-xl transition-colors">
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-grow bg-slate-50/50 custom-scrollbar">
               {modalKoreksi.soalList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                     <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                     <p className="text-indigo-600 font-bold animate-pulse">Memuat lembar jawaban...</p>
                  </div>
               ) : (
                  <div className="space-y-6">
                    {modalKoreksi.soalList.map((soal, i) => {
                      const jwb = modalKoreksi.data.detail_jawaban?.[soal.id];
                      
                      const renderJawaban = () => {
                        if (jwb === undefined || jwb === null || jwb === '') {
                          return <span className="italic text-slate-400 font-medium">Kosong (Tidak dijawab)</span>;
                        }
                        if (Array.isArray(jwb)) {
                          if (soal.tipe === 'Menjodohkan') {
                            return (
                              <div className="flex flex-wrap gap-2">
                                {jwb.map((conn: any, idx: number) => (
                                  <span key={idx} className="inline-flex items-center bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs font-bold">
                                    {conn.premisId} ➔ {conn.responsId}
                                  </span>
                                ))}
                              </div>
                            );
                          }
                          return <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md">{jwb.join(', ')}</span>;
                        }
                        return <div className="text-slate-800 font-medium whitespace-pre-wrap">{String(jwb)}</div>;
                      };

                      return (
                        <div key={soal.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md">
                           <div className="flex justify-between items-start mb-4 gap-4 flex-col sm:flex-row">
                              <div className="flex-1">
                                 <div className="flex items-center gap-3 mb-2">
                                   <span className="bg-slate-100 text-slate-600 font-black px-3 py-1 rounded-lg text-sm">No. {i+1}</span>
                                   <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">{soal.tipe}</span>
                                 </div>
                                 <div className="font-semibold text-slate-800 prose prose-sm max-w-none prose-p:my-1" dangerouslySetInnerHTML={{__html: soal.pertanyaan}} />
                              </div>
                              <div className="flex flex-col items-end gap-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 min-w-[140px] w-full sm:w-auto">
                                 <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Skor Diperoleh</label>
                                 <div className="flex items-center gap-2">
                                    <input 
                                      type="number" 
                                      min="0"
                                      max={soal.skor_maks || 10}
                                      value={skorManual[soal.id] ?? 0} 
                                      onChange={e => setSkorManual(prev => ({...prev, [soal.id]: Number(e.target.value)}))}
                                      className="border-2 border-indigo-200 rounded-lg px-3 py-2 w-20 font-black text-xl text-center text-indigo-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all"
                                    />
                                    <span className="text-slate-400 font-bold text-lg">/ {soal.skor_maks || 10}</span>
                                 </div>
                              </div>
                           </div>
                           
                           {soal.kunci && (
                             <div className="mb-4 text-sm bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                                <span className="font-bold text-emerald-700 block mb-1 text-xs uppercase tracking-wider flex items-center gap-1"><CheckSquare size={14}/> Kunci Jawaban Indikator</span> 
                                <div className="text-emerald-900 font-medium overflow-x-auto" dangerouslySetInnerHTML={{__html: typeof soal.kunci === 'object' ? JSON.stringify(soal.kunci) : soal.kunci}} />
                             </div>
                           )}

                           <div className="text-sm bg-slate-50 p-4 rounded-xl border border-slate-200">
                             <span className="font-bold text-slate-500 block mb-2 text-xs uppercase tracking-wider">Jawaban Siswa</span> 
                             {renderJawaban()}
                           </div>
                        </div>
                      );
                    })}
                  </div>
               )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-white flex flex-col-reverse sm:flex-row justify-between items-center gap-4">
               <p className="text-sm text-slate-500 font-medium text-center sm:text-left">
                 Nilai akhir akan dikalkulasi otomatis berdasarkan bobot soal keseluruhan.
               </p>
               <div className="flex gap-3 w-full sm:w-auto">
                 <button onClick={() => setModalKoreksi({ isOpen: false, data: null, soalList: [] })} className="flex-1 sm:flex-none px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">Batal</button>
                 <button 
                   onClick={saveKoreksiManual} 
                   disabled={isSavingKoreksi}
                   className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                 >
                   {isSavingKoreksi ? 'Mengkalkulasi...' : 'Simpan Nilai'}
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak PDF / Laporan Resmi Ber-Kop Surat */}
      {modalPrintPDF && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-2 md:p-6 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden">
            {/* Modal Header (No Print) */}
            <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 no-print">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                  <Printer size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800">Cetak Laporan Hasil Ujian (Kop Surat Resmi)</h3>
                  <p className="text-xs text-slate-500">Pratinjau cetak A4 ber-Kop Surat resmi untuk diunduh sebagai PDF atau dicetak langsung.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-md transition active:scale-95"
                >
                  <Printer size={16} /> Cetak / Simpan PDF
                </button>
                <button 
                  onClick={() => setModalPrintPDF(false)} 
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body / Scrollable Area */}
            <div className="p-6 overflow-y-auto flex-grow bg-slate-100/60 custom-scrollbar">
              {/* Form Pengaturan Kop Cepat (No Print) */}
              <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm no-print space-y-3">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={14} className="text-indigo-600" /> Kustomisasi Identitas Kop Surat & Penandatangan
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Nama Lembaga / Sekolah</label>
                    <input 
                      type="text" 
                      value={kopSettings.namaSekolah} 
                      onChange={e => setKopSettings({...kopSettings, namaSekolah: e.target.value})}
                      className="w-full border rounded-lg p-2 font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Dinas / Kementerian</label>
                    <input 
                      type="text" 
                      value={kopSettings.dinas} 
                      onChange={e => setKopSettings({...kopSettings, dinas: e.target.value})}
                      className="w-full border rounded-lg p-2 font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Alamat Lembaga</label>
                    <input 
                      type="text" 
                      value={kopSettings.alamat} 
                      onChange={e => setKopSettings({...kopSettings, alamat: e.target.value})}
                      className="w-full border rounded-lg p-2 font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Kota & Tanggal Cetak</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={kopSettings.kota} 
                        onChange={e => setKopSettings({...kopSettings, kota: e.target.value})}
                        className="w-1/2 border rounded-lg p-2 font-semibold text-slate-800"
                      />
                      <input 
                        type="text" 
                        value={kopSettings.tanggalCetak} 
                        onChange={e => setKopSettings({...kopSettings, tanggalCetak: e.target.value})}
                        className="w-1/2 border rounded-lg p-2 font-semibold text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* DOKUMEN RESMI BER-KOP (Print Area) */}
              <div id="printKopArea" className="bg-white p-8 md:p-12 rounded-xl shadow-lg border border-slate-200 max-w-4xl mx-auto print-document text-black">
                {/* KOP SURAT RESMI */}
                <div className="flex items-center gap-6 border-b-4 border-double border-black pb-4 mb-6">
                  <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center border-2 border-dashed border-gray-400 rounded-lg text-gray-400 p-2 text-center text-[10px] font-bold">
                    LOGO RESMI
                  </div>
                  <div className="flex-1 text-center">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">{kopSettings.instansiAtas}</h4>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800">{kopSettings.dinas}</h3>
                    <h2 className="text-xl font-black uppercase text-black tracking-tight">{kopSettings.namaSekolah}</h2>
                    <p className="text-xs text-gray-600 mt-1">{kopSettings.alamat}</p>
                  </div>
                  <div className="w-20 h-20 flex-shrink-0 opacity-0"></div>
                </div>

                {/* JUDUL LAPORAN */}
                <div className="text-center mb-6">
                  <h3 className="text-base font-extrabold uppercase tracking-wide underline underline-offset-4">
                    LAPORAN HASIL NILAI UJIAN BERBASIS KOMPUTER (CBT)
                  </h3>
                  <p className="text-xs font-semibold text-gray-600 mt-1">
                    TAHUN PELAJARAN {new Date().getFullYear()} / {new Date().getFullYear() + 1}
                  </p>
                </div>

                {/* IDENTITAS UJIAN */}
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-gray-800 mb-4 bg-gray-50 p-3 rounded border border-gray-200">
                  <div className="space-y-1">
                    <div>Paket Ujian : <span className="font-bold uppercase">{selectedPaket !== 'ALL' ? paketList.find(p => p.id === selectedPaket)?.nama_paket : 'Semua Paket'}</span></div>
                    <div>Kelas : <span className="font-bold uppercase">{selectedKelas !== 'ALL' ? kelasList.find(k => k.id === selectedKelas)?.nama_kelas : 'Semua Kelas'}</span></div>
                  </div>
                  <div className="space-y-1 text-right">
                    <div>Standar KKM : <span className="font-bold">{kopSettings.kkm}</span></div>
                    <div>Tanggal Cetak : <span className="font-bold">{kopSettings.tanggalCetak}</span></div>
                  </div>
                </div>

                {/* TABEL HASIL RESMI */}
                <table className="w-full text-xs border-collapse border border-gray-400 mb-6">
                  <thead>
                    <tr className="bg-gray-100 text-center font-bold text-gray-900">
                      <th className="border border-gray-400 p-2 w-10">No</th>
                      <th className="border border-gray-400 p-2 text-left">Nama Siswa</th>
                      <th className="border border-gray-400 p-2 w-24">Kelas</th>
                      <th className="border border-gray-400 p-2 text-left">Paket Soal</th>
                      <th className="border border-gray-400 p-2 w-16">Nilai</th>
                      <th className="border border-gray-400 p-2 w-20">Pelanggaran</th>
                      <th className="border border-gray-400 p-2 w-28">Status Koreksi</th>
                      <th className="border border-gray-400 p-2 w-24">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHasil.length === 0 ? (
                      <tr><td colSpan={8} className="p-4 text-center text-gray-500 border border-gray-400">Tidak ada data hasil.</td></tr>
                    ) : (
                      filteredHasil.map((h, i) => {
                        const isTuntas = h.skor_akhir >= kopSettings.kkm;
                        return (
                          <tr key={h.id} className="text-gray-800">
                            <td className="border border-gray-400 p-1.5 text-center">{i + 1}</td>
                            <td className="border border-gray-400 p-1.5 font-bold">{h.users?.nama || '-'}</td>
                            <td className="border border-gray-400 p-1.5 text-center">{kelasList.find(k => k.id === h.users?.kelas_id)?.nama_kelas || '-'}</td>
                            <td className="border border-gray-400 p-1.5">{h.paket?.nama_paket || '-'}</td>
                            <td className="border border-gray-400 p-1.5 text-center font-bold">{h.skor_akhir}</td>
                            <td className="border border-gray-400 p-1.5 text-center">{h.cheat_count > 0 ? `${h.cheat_count}x` : '0'}</td>
                            <td className="border border-gray-400 p-1.5 text-center">{h.status_koreksi}</td>
                            <td className={`border border-gray-400 p-1.5 text-center font-bold ${isTuntas ? 'text-green-700' : 'text-red-600'}`}>
                              {isTuntas ? 'TUNTAS' : 'REMIDIAL'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* STATISTIK RINGKASAN */}
                <div className="grid grid-cols-4 gap-2 text-xs border border-gray-300 p-3 rounded mb-8 bg-gray-50 text-center font-semibold">
                  <div>Total Peserta: <span className="font-bold">{filteredHasil.length}</span></div>
                  <div>Rata-rata Nilai: <span className="font-bold">{(filteredHasil.reduce((a, b) => a + (Number(b.skor_akhir) || 0), 0) / (filteredHasil.length || 1)).toFixed(1)}</span></div>
                  <div>Nilai Tertinggi: <span className="font-bold">{filteredHasil.length > 0 ? Math.max(...filteredHasil.map(h => Number(h.skor_akhir) || 0)) : 0}</span></div>
                  <div>Nilai Terendah: <span className="font-bold">{filteredHasil.length > 0 ? Math.min(...filteredHasil.map(h => Number(h.skor_akhir) || 0)) : 0}</span></div>
                </div>

                {/* KOLOM TANDA TANGAN */}
                <div className="grid grid-cols-2 text-xs font-semibold text-gray-900 pt-4">
                  <div className="text-center">
                    <p>Mengetahui,</p>
                    <p className="font-bold">Kepala Sekolah / Penanggung Jawab CBT</p>
                    <div className="h-20"></div>
                    <p className="font-bold underline uppercase">{kopSettings.kepalaSekolah}</p>
                    <p className="text-gray-600">NIP. {kopSettings.nipKepala}</p>
                  </div>
                  <div className="text-center">
                    <p>{kopSettings.kota}, {kopSettings.tanggalCetak}</p>
                    <p className="font-bold">Guru Pengampu / Proktor CBT</p>
                    <div className="h-20"></div>
                    <p className="font-bold underline uppercase">{kopSettings.guruPengampu}</p>
                    <p className="text-gray-600">NIP. {kopSettings.nipGuru}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Style Cetak Print Khusus */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, aside, nav, .no-print {
            display: none !important;
          }
          .print-document {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          @page {
            size: portrait;
            margin: 10mm;
          }
        }
      `}} />

    </div>
  );
}
