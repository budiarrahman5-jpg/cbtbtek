'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { PieChart, Search, Printer, FileSpreadsheet, Check, X, Download, ArrowUpDown, Users, CheckCircle2, Clock } from 'lucide-react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';

export default function AnalisisSoalPage() {
  const [paketList, setPaketList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [selectedPaket, setSelectedPaket] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('ALL');
  const [kkm, setKkm] = useState(75);
  const [isLoading, setIsLoading] = useState(false);
  const [soalList, setSoalList] = useState<any[]>([]);
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [itemStats, setItemStats] = useState<any[]>([]);
  const [printScale, setPrintScale] = useState('auto');
  const [sortBy, setSortBy] = useState<'nama' | 'nilai'>('nama');

  const getEffectiveZoom = () => {
    if (printScale !== 'auto') return printScale;
    if (soalList.length > 45) return '55%';
    if (soalList.length > 35) return '65%';
    if (soalList.length > 25) return '75%';
    if (soalList.length > 15) return '85%';
    return '100%';
  };

  useEffect(() => {
    fetchInit();
  }, []);

  const fetchInit = async () => {
    let { data: pData } = await supabase.from('paket').select('*').order('nama_paket');
    pData = filterDemoData(pData, 'paket');
    if (pData) setPaketList(pData);

    let { data: kData } = await supabase.from('kelas').select('*').order('nama_kelas');
    kData = filterDemoData(kData, 'kelas');
    if (kData) setKelasList(kData);

    const { data: pengData } = await supabase.from('pengaturan').select('nilai').eq('kunci', 'nilai_kkm').maybeSingle();
    if (pengData?.nilai) {
      setKkm(Number(pengData.nilai) || 75);
    }
  };

  const hitungSkorSoal = (soal: any, jwb: any, detailJawaban: any) => {
    const bobot = soal.skor_maks || 10;
    if (detailJawaban && detailJawaban[`koreksi_${soal.id}`] !== undefined && detailJawaban[`koreksi_${soal.id}`] !== '') {
      return Number(detailJawaban[`koreksi_${soal.id}`]);
    }

    if (!jwb) return 0;

    if (soal.tipe === 'PG') {
      return (typeof jwb === 'string' && jwb.toUpperCase() === soal.kunci?.toUpperCase()) ? bobot : 0;
    }

    if (soal.tipe === 'PG Kompleks') {
      const kunciArr = (soal.kunci || '').split(',').map((k: string) => k.trim().toUpperCase());
      let benarCount = 0;
      if (Array.isArray(jwb)) {
        jwb.forEach((x: string) => { if (kunciArr.includes(x)) benarCount++; });
        return kunciArr.length > 0 ? Math.round((benarCount / kunciArr.length) * bobot) : 0;
      }
      return 0;
    }

    if (soal.tipe === 'Menjodohkan') {
      try {
        const kunciAsli = JSON.parse(soal.kunci || '[]');
        let benarCount = 0;
        if (Array.isArray(jwb)) {
          jwb.forEach((c: any) => {
            if (kunciAsli.find((k: any) => k.premisId === c.premisId && k.responsId === c.responsId)) benarCount++;
          });
        }
        return kunciAsli.length > 0 ? Math.round((benarCount / kunciAsli.length) * bobot) : 0;
      } catch (e) {
        return 0;
      }
    }

    if (soal.tipe === 'Isian') {
      return (soal.kunci && String(jwb).toLowerCase().trim() === soal.kunci.toLowerCase().trim()) ? bobot : 0;
    }

    return 0;
  };

  const prosesAnalisis = async () => {
    if (!selectedPaket) {
      alert('Pilih paket ujian terlebih dahulu!');
      return;
    }

    setIsLoading(true);

    // 1. Ambil soal untuk paket ini
    let { data: relData } = await supabase
      .from('paket_soal')
      .select('soal(*)')
      .eq('paket_id', selectedPaket);

    let rawSoal = relData ? relData.map((r: any) => r.soal) : [];
    rawSoal = filterDemoData(rawSoal, 'soal') || [];
    setSoalList(rawSoal);

    const totalBobotMaks = rawSoal.reduce((sum: number, s: any) => sum + (s.skor_maks || 10), 0) || 100;

    // 2. Ambil data seluruh siswa yang terdaftar di kelas yang dipilih
    let userQuery = supabase
      .from('users')
      .select('id, nama, username, kelas_id, kelas(nama_kelas)')
      .eq('role', 'siswa')
      .order('nama', { ascending: true });

    if (selectedKelas !== 'ALL') {
      userQuery = userQuery.eq('kelas_id', selectedKelas);
    }

    let { data: allSiswa } = await userQuery;
    allSiswa = filterDemoData(allSiswa, 'users') || [];

    // 3. Ambil data hasil ujian untuk paket ini
    let { data: hasilData } = await supabase
      .from('hasil')
      .select('*, users(id, nama, username, kelas_id, kelas(nama_kelas))')
      .eq('paket_id', selectedPaket);

    hasilData = filterDemoData(hasilData, 'hasil') || [];

    // Jika pilih Semua Kelas, pastikan siswa dari hasil yang mungkin belum ada di allSiswa tetap terangkut
    if (selectedKelas === 'ALL' && hasilData) {
      const existingUserIds = new Set(allSiswa.map((s: any) => s.id));
      hasilData.forEach((h: any) => {
        if (!existingUserIds.has(h.user_id) && h.users) {
          allSiswa.push({
            id: h.user_id,
            nama: h.users?.nama || 'Siswa',
            username: h.users?.username || '-',
            kelas_id: h.users?.kelas_id || null,
            kelas: h.users?.kelas || { nama_kelas: '-' }
          });
        }
      });
    }

    if (!allSiswa || allSiswa.length === 0) {
      setProcessedData([]);
      setStats(null);
      setItemStats([]);
      setIsLoading(false);
      alert('Tidak ada siswa yang terdaftar di kelas yang dipilih.');
      return;
    }

    // 4. Proses skor per butir untuk setiap siswa di kelas
    const siswaList = allSiswa.map((siswa: any) => {
      // Cari hasil ujian untuk siswa ini (jika ada lebih dari satu, ambil skor tertinggi/terakhir)
      const studentResults = hasilData ? hasilData.filter((h: any) => h.user_id === siswa.id) : [];
      const h = studentResults.sort((a: any, b: any) => (b.skor_akhir || 0) - (a.skor_akhir || 0))[0];

      if (h) {
        const detailJawaban = h.detail_jawaban || {};
        const scores = rawSoal.map((soal: any) => {
          const jwb = detailJawaban[soal.id];
          return hitungSkorSoal(soal, jwb, detailJawaban);
        });

        const totalSkor = scores.reduce((sum: number, sc: number) => sum + sc, 0);
        const nilaiAkhir = Math.round((totalSkor / totalBobotMaks) * 100);
        const isTuntas = nilaiAkhir >= kkm;

        return {
          id: siswa.id,
          nama: siswa.nama || '-',
          kelas: siswa.kelas?.nama_kelas || '-',
          scores,
          totalSkor,
          nilaiAkhir,
          isTuntas,
          statusUjian: 'Selesai'
        };
      } else {
        // Siswa terdaftar di kelas tapi belum mengerjakan ujian ini
        const scores = rawSoal.map(() => 0);
        return {
          id: siswa.id,
          nama: siswa.nama || '-',
          kelas: siswa.kelas?.nama_kelas || '-',
          scores,
          totalSkor: 0,
          nilaiAkhir: 0,
          isTuntas: false,
          statusUjian: 'Belum Ujian'
        };
      }
    });

    // Urutkan siswa
    if (sortBy === 'nama') {
      siswaList.sort((a: any, b: any) => a.nama.localeCompare(b.nama));
    } else {
      siswaList.sort((a: any, b: any) => {
        if (a.statusUjian === 'Belum Ujian' && b.statusUjian !== 'Belum Ujian') return 1;
        if (a.statusUjian !== 'Belum Ujian' && b.statusUjian === 'Belum Ujian') return -1;
        return b.nilaiAkhir - a.nilaiAkhir || a.nama.localeCompare(b.nama);
      });
    }

    setProcessedData(siswaList);

    // 5. Hitung Statistik Ringkasan Bawah (berdasarkan peserta yang mengikuti ujian)
    const totalSiswa = siswaList.length;
    const pesertaUjian = siswaList.filter((s: any) => s.statusUjian === 'Selesai');
    const countPeserta = pesertaUjian.length;
    const countBelum = totalSiswa - countPeserta;

    if (countPeserta > 0) {
      const sumJumlah = pesertaUjian.reduce((acc: number, s: any) => acc + s.totalSkor, 0);
      const sumNilai = pesertaUjian.reduce((acc: number, s: any) => acc + s.nilaiAkhir, 0);
      const minNilai = Math.min(...pesertaUjian.map((s: any) => s.nilaiAkhir));
      const maxNilai = Math.max(...pesertaUjian.map((s: any) => s.nilaiAkhir));
      const minJumlah = Math.min(...pesertaUjian.map((s: any) => s.totalSkor));
      const maxJumlah = Math.max(...pesertaUjian.map((s: any) => s.totalSkor));
      const avgNilai = parseFloat((sumNilai / countPeserta).toFixed(2));
      const avgJumlah = parseFloat((sumJumlah / countPeserta).toFixed(2));
      const countTuntas = pesertaUjian.filter((s: any) => s.isTuntas).length;
      const countTidakTuntas = countPeserta - countTuntas;

      setStats({
        totalSiswa,
        countPeserta,
        countBelum,
        sumJumlah,
        sumNilai,
        minNilai,
        maxNilai,
        minJumlah,
        maxJumlah,
        avgNilai,
        avgJumlah,
        countTuntas,
        countTidakTuntas
      });

      // 6. Analisis Statistik Butir Soal (P & D) dari peserta yang mengerjakan
      const midIndex = Math.ceil(countPeserta / 2);
      const sortedPeserta = [...pesertaUjian].sort((a: any, b: any) => b.nilaiAkhir - a.nilaiAkhir);
      const kelompokAtas = sortedPeserta.slice(0, midIndex);
      const kelompokBawah = sortedPeserta.slice(midIndex);

      const items = rawSoal.map((soal: any, sIdx: number) => {
        const bobot = soal.skor_maks || 10;
        const sumItemScore = pesertaUjian.reduce((acc: number, s: any) => acc + s.scores[sIdx], 0);
        const avgItemScore = sumItemScore / countPeserta;
        
        // Indeks Kesukaran P = Rata-rata Skor / Bobot Maksimal
        const p = avgItemScore / bobot;
        let kesukaranLabel = 'Sedang';
        let kesukaranColor = 'text-amber-700 bg-amber-50';
        if (p >= 0.70) {
          kesukaranLabel = 'Mudah';
          kesukaranColor = 'text-emerald-700 bg-emerald-50';
        } else if (p < 0.30) {
          kesukaranLabel = 'Sukar';
          kesukaranColor = 'text-rose-700 bg-rose-50';
        }

        // Daya Beda D = (Rata-rata KA - Rata-rata KB) / Bobot Maksimal
        let d = 0;
        let dayaBedaLabel = '-';
        let dayaBedaColor = 'text-slate-600 bg-slate-50';

        if (countPeserta >= 2 && kelompokAtas.length > 0 && kelompokBawah.length > 0) {
          const avgKA = kelompokAtas.reduce((acc: number, s: any) => acc + s.scores[sIdx], 0) / kelompokAtas.length;
          const avgKB = kelompokBawah.reduce((acc: number, s: any) => acc + s.scores[sIdx], 0) / kelompokBawah.length;
          d = (avgKA - avgKB) / bobot;

          if (d >= 0.40) {
            dayaBedaLabel = 'Sangat Baik';
            dayaBedaColor = 'text-emerald-700 bg-emerald-50';
          } else if (d >= 0.30) {
            dayaBedaLabel = 'Baik';
            dayaBedaColor = 'text-blue-700 bg-blue-50';
          } else if (d >= 0.20) {
            dayaBedaLabel = 'Cukup';
            dayaBedaColor = 'text-amber-700 bg-amber-50';
          } else {
            dayaBedaLabel = 'Jelek';
            dayaBedaColor = 'text-rose-700 bg-rose-50';
          }
        }

        return {
          no: sIdx + 1,
          avgItemScore: parseFloat(avgItemScore.toFixed(1)),
          p: parseFloat(p.toFixed(2)),
          kesukaranLabel,
          kesukaranColor,
          d: parseFloat(d.toFixed(2)),
          dayaBedaLabel,
          dayaBedaColor
        };
      });

      setItemStats(items);
    } else {
      // Belum ada siswa di kelas ini yang mengerjakan ujian
      setStats({
        totalSiswa,
        countPeserta: 0,
        countBelum: totalSiswa,
        sumJumlah: 0,
        sumNilai: 0,
        minNilai: 0,
        maxNilai: 0,
        minJumlah: 0,
        maxJumlah: 0,
        avgNilai: 0,
        avgJumlah: 0,
        countTuntas: 0,
        countTidakTuntas: 0
      });

      setItemStats(rawSoal.map((_, i) => ({
        no: i + 1,
        avgItemScore: 0,
        p: 0,
        kesukaranLabel: '-',
        kesukaranColor: 'text-slate-400 bg-slate-50',
        d: 0,
        dayaBedaLabel: '-',
        dayaBedaColor: 'text-slate-400 bg-slate-50'
      })));
    }

    setIsLoading(false);
  };

  const handleSortToggle = (type: 'nama' | 'nilai') => {
    setSortBy(type);
    const sorted = [...processedData];
    if (type === 'nama') {
      sorted.sort((a: any, b: any) => a.nama.localeCompare(b.nama));
    } else {
      sorted.sort((a: any, b: any) => {
        if (a.statusUjian === 'Belum Ujian' && b.statusUjian !== 'Belum Ujian') return 1;
        if (a.statusUjian !== 'Belum Ujian' && b.statusUjian === 'Belum Ujian') return -1;
        return b.nilaiAkhir - a.nilaiAkhir || a.nama.localeCompare(b.nama);
      });
    }
    setProcessedData(sorted);
  };

  const handleDownloadExcel = () => {
    if (processedData.length === 0) return alert('Tidak ada data analisis untuk diunduh.');

    const dataToExport = processedData.map((s, i) => {
      const row: Record<string, any> = {
        'No': i + 1,
        'Nama Siswa': s.nama,
        'Kelas': s.kelas,
        'Status Ujian': s.statusUjian
      };

      soalList.forEach((soal, sIdx) => {
        row[`Soal ${sIdx + 1}`] = s.statusUjian === 'Belum Ujian' ? '-' : s.scores[sIdx];
      });

      row['Jumlah Skor'] = s.statusUjian === 'Belum Ujian' ? '-' : s.totalSkor;
      row['Nilai Akhir'] = s.statusUjian === 'Belum Ujian' ? '-' : s.nilaiAkhir;
      row['Status Ketuntasan'] = s.statusUjian === 'Belum Ujian' ? 'Belum Ujian' : (s.isTuntas ? 'Tuntas' : 'Tidak Tuntas');

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Analisis Matriks");

    const namaKelas = selectedKelas !== 'ALL' ? kelasList.find(k => k.id === selectedKelas)?.nama_kelas || 'Semua_Kelas' : 'Semua_Kelas';
    const namaPaket = selectedPaket ? paketList.find(p => p.id === selectedPaket)?.nama_paket || 'Paket' : 'Paket';
    const fileName = `Analisis_Soal_${namaKelas}_${namaPaket}.xlsx`.replace(/\s+/g, '_');

    XLSX.writeFile(workbook, fileName);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{__html: `
        @page { 
          size: landscape; 
          margin: 4mm; 
        }
        @media print {
          html, body {
            background: white !important;
            width: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, aside, nav, .no-print { 
            display: none !important; 
          }
          .print-area { 
            overflow: visible !important; 
            width: 100% !important; 
            max-width: 100% !important;
            margin: 0 !important; 
            padding: 0 !important; 
            box-shadow: none !important; 
            border: none !important; 
          }
          .print-scale-wrapper {
            zoom: ${getEffectiveZoom()};
            width: 100% !important;
          }
          .matriks-table {
            width: 100% !important;
            font-size: 6.5pt !important;
            border-collapse: collapse !important;
            table-layout: auto !important;
          }
          .matriks-table th, .matriks-table td {
            padding: 1.5px 1px !important;
            font-size: 6.5pt !important;
            min-width: unset !important;
          }
          .matriks-table .col-nama {
            min-width: 85px !important;
            max-width: 120px !important;
            white-space: normal !important;
            word-break: break-word !important;
            font-size: 6.5pt !important;
          }
          .matriks-table .col-soal {
            padding: 1px 0px !important;
            min-width: 14px !important;
            font-size: 6pt !important;
          }
        }
      `}} />

      {/* Kontrol Filter & Aksi */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 gap-4 no-print">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><FileSpreadsheet size={20} /></div> 
            Analisis Butir Soal (Matriks)
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Matriks skor, ketuntasan belajar (KKM: {kkm}), tingkat kesukaran, dan daya beda soal.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select 
            value={selectedPaket} onChange={e=>setSelectedPaket(e.target.value)}
            className="flex-1 sm:flex-none border-2 border-slate-200 p-2.5 rounded-xl bg-white font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
          >
            <option value="">-- Pilih Paket Ujian --</option>
            {paketList.map(p => <option key={p.id} value={p.id}>{p.nama_paket}</option>)}
          </select>

          <select 
            value={selectedKelas} onChange={e=>setSelectedKelas(e.target.value)}
            className="flex-1 sm:flex-none border-2 border-slate-200 p-2.5 rounded-xl bg-white font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
          >
            <option value="ALL">-- Semua Kelas --</option>
            {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>

          <button 
            onClick={prosesAnalisis}
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
          >
            <Search size={18} /> {isLoading ? 'Memproses...' : 'Proses Analisis'}
          </button>

          {processedData.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Toggle Sortir */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <span className="text-slate-500 px-2 flex items-center gap-1"><ArrowUpDown size={13} /> Urut:</span>
                <button
                  onClick={() => handleSortToggle('nama')}
                  className={clsx("px-2.5 py-1 rounded-lg transition-all", sortBy === 'nama' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900")}
                  title="Urutkan berdasarkan Nama Siswa (Sesuai Absen Kelas)"
                >
                  Nama (A-Z)
                </button>
                <button
                  onClick={() => handleSortToggle('nilai')}
                  className={clsx("px-2.5 py-1 rounded-lg transition-all", sortBy === 'nilai' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900")}
                  title="Urutkan berdasarkan Nilai Tertinggi"
                >
                  Nilai
                </button>
              </div>

              {/* Unduh Excel */}
              <button 
                onClick={handleDownloadExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 text-xs"
                title="Unduh Rekap Matriks Analisis ke Excel (.xlsx)"
              >
                <Download size={15} /> Unduh Excel
              </button>

              <select
                value={printScale}
                onChange={e => setPrintScale(e.target.value)}
                className="border-2 border-slate-200 p-2 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none"
                title="Pilih Skala Cetak Matriks"
              >
                <option value="auto">Skala: Auto ({getEffectiveZoom()})</option>
                <option value="100%">Skala: 100%</option>
                <option value="85%">Skala: 85%</option>
                <option value="70%">Skala: 70%</option>
                <option value="60%">Skala: 60%</option>
                <option value="50%">Skala: 50%</option>
              </select>

              <button 
                onClick={handlePrint}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
                title="Cetak Matriks atau Simpan ke PDF"
              >
                <Printer size={18} /> Cetak Matriks
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabel Matriks & Analisis */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden min-h-[400px] flex flex-col print-area">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center flex-1 p-20 gap-4 no-print">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-slate-500 animate-pulse">Menghitung Analisis Butir Soal...</p>
          </div>
        ) : processedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 p-20 text-center no-print">
            <div className="bg-slate-50 p-6 rounded-full mb-4">
              <PieChart size={48} className="text-slate-300" />
            </div>
            <h3 className="font-extrabold text-xl text-slate-700">Analisis Matriks Belum Dimuat</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-sm leading-relaxed">
              Silakan pilih paket ujian dan kelas di atas, lalu klik <b>Proses Analisis</b> untuk melihat matriks skor lengkap.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar flex-1 print-scale-wrapper">
            {/* Header Cetak untuk Print Mode */}
            <div className="hidden print:block p-3 border-b text-center">
              <h2 className="text-lg font-black uppercase">LAPORAN ANALISIS BUTIR SOAL (MATRIKS)</h2>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                Paket: {paketList.find(p => p.id === selectedPaket)?.nama_paket} | Kelas: {selectedKelas !== 'ALL' ? kelasList.find(k => k.id === selectedKelas)?.nama_kelas : 'Semua Kelas'} | KKM: {kkm} | Total Siswa: {stats?.totalSiswa || processedData.length} (Mengikuti: {stats?.countPeserta || 0}, Belum: {stats?.countBelum || 0}) | Total Soal: {soalList.length}
              </p>
            </div>

            {/* Info Kehadiran Siswa di Layar (No Print) */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 no-print text-xs font-bold text-slate-600">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                  <Users size={14} className="text-indigo-600" /> Total Siswa Kelas: <b className="text-slate-800">{stats?.totalSiswa || processedData.length}</b>
                </span>
                <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1 rounded-lg border border-emerald-200 shadow-sm">
                  <CheckCircle2 size={14} className="text-emerald-600" /> Mengikuti Ujian: <b className="text-emerald-900">{stats?.countPeserta || 0}</b>
                </span>
                {(stats?.countBelum > 0) && (
                  <span className="flex items-center gap-1.5 bg-amber-50 text-amber-800 px-3 py-1 rounded-lg border border-amber-200 shadow-sm">
                    <Clock size={14} className="text-amber-600" /> Belum Ujian: <b className="text-amber-900">{stats?.countBelum || 0}</b>
                  </span>
                )}
              </div>
              <div className="text-slate-400 font-normal italic">
                * Menampilkan seluruh siswa di kelas. Siswa yang belum ujian ditandai status khusus.
              </div>
            </div>

            <table className="w-full text-center border-collapse text-xs whitespace-nowrap matriks-table" border={1}>
              <thead className="bg-indigo-900 text-white sticky top-0 z-10 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-2.5 border border-indigo-800 w-10">No</th>
                  <th className="p-2.5 border border-indigo-800 text-left min-w-[160px] col-nama">Nama Siswa</th>
                  <th className="p-2.5 border border-indigo-800 min-w-[70px]">Kelas</th>
                  {soalList.map((soal, i) => (
                    <th key={soal.id} className="p-2 border border-indigo-800 w-9 min-w-[28px] col-soal" title={`Soal ${i + 1} (${soal.tipe})`}>
                      {i + 1}
                    </th>
                  ))}
                  <th className="p-2.5 border border-indigo-800 min-w-[55px] bg-indigo-950">Jumlah</th>
                  <th className="p-2.5 border border-indigo-800 min-w-[55px] bg-indigo-950">Nilai</th>
                  <th className="p-2.5 border border-indigo-800 min-w-[50px] bg-emerald-900 text-emerald-100">Tuntas</th>
                  <th className="p-2.5 border border-indigo-800 min-w-[50px] bg-rose-900 text-rose-100">Tidak</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 divide-y divide-slate-200">
                {processedData.map((s, idx) => (
                  <tr key={s.id} className={clsx("transition-colors", s.statusUjian === 'Belum Ujian' ? "bg-slate-50/50 hover:bg-slate-100/70" : "hover:bg-slate-50")}>
                    <td className="p-2 border border-slate-200 font-bold bg-slate-50 text-slate-600">{idx + 1}</td>
                    <td className="p-2 border border-slate-200 text-left font-bold text-slate-800 truncate max-w-[200px] col-nama" title={s.nama}>
                      {s.nama}
                    </td>
                    <td className="p-2 border border-slate-200 text-slate-600 font-medium">{s.kelas}</td>
                    
                    {s.scores.map((sc: number, scIdx: number) => {
                      const isHigh = sc > 0;
                      return (
                        <td 
                          key={scIdx} 
                          className={clsx(
                            "p-1.5 border border-slate-200 font-bold col-soal",
                            s.statusUjian === 'Belum Ujian'
                              ? "bg-slate-50/50 text-slate-300"
                              : isHigh ? "bg-indigo-50 text-indigo-700 font-black" : "bg-white text-slate-400"
                          )}
                        >
                          {s.statusUjian === 'Belum Ujian' ? '-' : sc}
                        </td>
                      );
                    })}

                    <td className="p-2 border border-slate-200 font-black bg-amber-50 text-amber-900">
                      {s.statusUjian === 'Belum Ujian' ? '-' : s.totalSkor}
                    </td>
                    <td className="p-2 border border-slate-200 font-black bg-indigo-50 text-indigo-900 text-sm">
                      {s.statusUjian === 'Belum Ujian' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200 inline-block">Belum Ujian</span>
                      ) : (
                        s.nilaiAkhir
                      )}
                    </td>
                    <td className="p-2 border border-slate-200 text-center font-bold text-emerald-600">
                      {s.statusUjian === 'Belum Ujian' ? '-' : (s.isTuntas ? <Check className="mx-auto" size={16} /> : '-')}
                    </td>
                    <td className="p-2 border border-slate-200 text-center font-bold text-rose-500">
                      {s.statusUjian === 'Belum Ujian' ? '-' : (!s.isTuntas ? <X className="mx-auto" size={16} /> : '-')}
                    </td>
                  </tr>
                ))}

                {/* Baris Ringkasan Nilai Siswa */}
                {stats && (
                  <>
                    <tr className="font-extrabold bg-slate-100 text-slate-800 border-t-2 border-slate-400">
                      <td colSpan={3 + soalList.length} className="p-2.5 border border-slate-300 text-right uppercase tracking-wider">
                        JUMLAH NILAI {stats.countPeserta > 0 ? `(${stats.countPeserta} PESERTA)` : ''}
                      </td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.countPeserta > 0 ? stats.sumJumlah : '-'}</td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.countPeserta > 0 ? stats.sumNilai : '-'}</td>
                      <td className="p-2.5 border border-slate-300 text-emerald-700 font-black">{stats.countPeserta > 0 ? stats.countTuntas : '-'}</td>
                      <td className="p-2.5 border border-slate-300 text-rose-700 font-black">{stats.countPeserta > 0 ? stats.countTidakTuntas : '-'}</td>
                    </tr>
                    <tr className="font-extrabold bg-slate-100 text-slate-800">
                      <td colSpan={3 + soalList.length} className="p-2.5 border border-slate-300 text-right uppercase tracking-wider">
                        NILAI TERENDAH
                      </td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.countPeserta > 0 ? stats.minJumlah : '-'}</td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.countPeserta > 0 ? stats.minNilai : '-'}</td>
                      <td className="p-2.5 border border-slate-300">-</td>
                      <td className="p-2.5 border border-slate-300">-</td>
                    </tr>
                    <tr className="font-extrabold bg-slate-100 text-slate-800">
                      <td colSpan={3 + soalList.length} className="p-2.5 border border-slate-300 text-right uppercase tracking-wider">
                        NILAI TERTINGGI
                      </td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.countPeserta > 0 ? stats.maxJumlah : '-'}</td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.countPeserta > 0 ? stats.maxNilai : '-'}</td>
                      <td className="p-2.5 border border-slate-300">-</td>
                      <td className="p-2.5 border border-slate-300">-</td>
                    </tr>
                    <tr className="font-extrabold bg-indigo-50 text-indigo-900 border-b-2 border-slate-400">
                      <td colSpan={3 + soalList.length} className="p-2.5 border border-slate-300 text-right uppercase tracking-wider">
                        RATA-RATA KELAS
                      </td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.countPeserta > 0 ? stats.avgJumlah : '-'}</td>
                      <td className="p-2.5 border border-slate-300 font-black text-sm">{stats.countPeserta > 0 ? stats.avgNilai : '-'}</td>
                      <td className="p-2.5 border border-slate-300">-</td>
                      <td className="p-2.5 border border-slate-300">-</td>
                    </tr>

                    {/* Analisis Statistik Butir Soal */}
                    <tr className="bg-slate-200 text-slate-800 font-black">
                      <td colSpan={3} className="p-2 border border-slate-300 text-left uppercase tracking-wider">
                        RATA-RATA SKOR SOAL
                      </td>
                      {itemStats.map((item) => (
                        <td key={item.no} className="p-1.5 border border-slate-300 font-bold">
                          {item.avgItemScore}
                        </td>
                      ))}
                      <td colSpan={4} className="p-1.5 border border-slate-300 bg-slate-100">-</td>
                    </tr>

                    <tr className="bg-purple-50 text-purple-900 font-black">
                      <td colSpan={3} className="p-2 border border-slate-300 text-left uppercase tracking-wider">
                        TINGKAT KESUKARAN (P)
                      </td>
                      {itemStats.map((item) => (
                        <td key={item.no} className={clsx("p-1.5 border border-slate-300 text-[10px] font-black", item.kesukaranColor)} title={`Indeks: ${item.p}`}>
                          {item.kesukaranLabel}
                        </td>
                      ))}
                      <td colSpan={4} className="p-1.5 border border-slate-300 bg-slate-100">-</td>
                    </tr>

                    <tr className="bg-teal-50 text-teal-900 font-black">
                      <td colSpan={3} className="p-2 border border-slate-300 text-left uppercase tracking-wider">
                        DAYA PEMBEDA (D)
                      </td>
                      {itemStats.map((item) => (
                        <td key={item.no} className={clsx("p-1.5 border border-slate-300 text-[10px] font-black", item.dayaBedaColor)} title={`Indeks: ${item.d}`}>
                          {item.dayaBedaLabel}
                        </td>
                      ))}
                      <td colSpan={4} className="p-1.5 border border-slate-300 bg-slate-100">-</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
