'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { PieChart, Search, Printer, FileSpreadsheet, Check, X, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';

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

    // 2. Ambil data hasil siswa
    let query = supabase
      .from('hasil')
      .select('*, users!inner(id, nama, username, kelas_id, kelas(nama_kelas))')
      .eq('paket_id', selectedPaket);

    if (selectedKelas !== 'ALL') {
      query = query.eq('users.kelas_id', selectedKelas);
    }

    let { data: hasilData } = await query;
    hasilData = filterDemoData(hasilData, 'hasil') || [];

    if (!hasilData || hasilData.length === 0) {
      setProcessedData([]);
      setStats(null);
      setItemStats([]);
      setIsLoading(false);
      return;
    }

    // 3. Proses skor per butir untuk setiap siswa
    const siswaList = hasilData.map((h: any) => {
      const detailJawaban = h.detail_jawaban || {};
      const scores = rawSoal.map((soal: any) => {
        const jwb = detailJawaban[soal.id];
        return hitungSkorSoal(soal, jwb, detailJawaban);
      });

      const totalSkor = scores.reduce((sum: number, sc: number) => sum + sc, 0);
      const nilaiAkhir = Math.round((totalSkor / totalBobotMaks) * 100);
      const isTuntas = nilaiAkhir >= kkm;

      return {
        id: h.id,
        nama: h.users?.nama || '-',
        kelas: h.users?.kelas?.nama_kelas || '-',
        scores,
        totalSkor,
        nilaiAkhir,
        isTuntas
      };
    });

    siswaList.sort((a: any, b: any) => b.nilaiAkhir - a.nilaiAkhir || a.nama.localeCompare(b.nama));
    setProcessedData(siswaList);

    // 4. Hitung Statistik Ringkasan Bawah
    const count = siswaList.length;
    const sumJumlah = siswaList.reduce((acc: number, s: any) => acc + s.totalSkor, 0);
    const sumNilai = siswaList.reduce((acc: number, s: any) => acc + s.nilaiAkhir, 0);
    const minNilai = Math.min(...siswaList.map((s: any) => s.nilaiAkhir));
    const maxNilai = Math.max(...siswaList.map((s: any) => s.nilaiAkhir));
    const minJumlah = Math.min(...siswaList.map((s: any) => s.totalSkor));
    const maxJumlah = Math.max(...siswaList.map((s: any) => s.totalSkor));
    const avgNilai = parseFloat((sumNilai / count).toFixed(2));
    const avgJumlah = parseFloat((sumJumlah / count).toFixed(2));
    const countTuntas = siswaList.filter((s: any) => s.isTuntas).length;
    const countTidakTuntas = count - countTuntas;

    setStats({
      count,
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

    // 5. Analisis Statistik Butir Soal (Kesukaran & Daya Pembeda)
    const midIndex = Math.ceil(count / 2);
    const kelompokAtas = siswaList.slice(0, midIndex);
    const kelompokBawah = siswaList.slice(midIndex);

    const items = rawSoal.map((soal: any, sIdx: number) => {
      const bobot = soal.skor_maks || 10;
      const sumItemScore = siswaList.reduce((acc: number, s: any) => acc + s.scores[sIdx], 0);
      const avgItemScore = sumItemScore / count;
      
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

      if (count >= 4 && kelompokAtas.length > 0 && kelompokBawah.length > 0) {
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
    setIsLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          header, aside, .no-print { display: none !important; }
          .print-area { overflow: visible !important; width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
          @page { size: landscape; margin: 10mm; }
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
            <button 
              onClick={handlePrint}
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Printer size={18} /> Cetak Matriks
            </button>
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
          <div className="overflow-x-auto custom-scrollbar flex-1">
            {/* Header Cetak untuk Print Mode */}
            <div className="hidden print:block p-4 border-b text-center">
              <h2 className="text-xl font-black uppercase">LAPORAN ANALISIS BUTIR SOAL (MATRIKS)</h2>
              <p className="text-sm font-semibold text-slate-600 mt-1">
                Paket: {paketList.find(p => p.id === selectedPaket)?.nama_paket} | Kelas: {selectedKelas !== 'ALL' ? kelasList.find(k => k.id === selectedKelas)?.nama_kelas : 'Semua Kelas'} | KKM: {kkm}
              </p>
            </div>

            <table className="w-full text-center border-collapse text-xs whitespace-nowrap" border={1}>
              <thead className="bg-indigo-900 text-white sticky top-0 z-10 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-2.5 border border-indigo-800 w-10">No</th>
                  <th className="p-2.5 border border-indigo-800 text-left min-w-[160px]">Nama Siswa</th>
                  <th className="p-2.5 border border-indigo-800 min-w-[80px]">Kelas</th>
                  {soalList.map((soal, i) => (
                    <th key={soal.id} className="p-2 border border-indigo-800 w-9 min-w-[32px]" title={`Soal ${i + 1} (${soal.tipe})`}>
                      {i + 1}
                    </th>
                  ))}
                  <th className="p-2.5 border border-indigo-800 min-w-[65px] bg-indigo-950">Jumlah</th>
                  <th className="p-2.5 border border-indigo-800 min-w-[65px] bg-indigo-950">Nilai</th>
                  <th className="p-2.5 border border-indigo-800 min-w-[60px] bg-emerald-900 text-emerald-100">Tuntas</th>
                  <th className="p-2.5 border border-indigo-800 min-w-[60px] bg-rose-900 text-rose-100">Tidak</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 divide-y divide-slate-200">
                {processedData.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 border border-slate-200 font-bold bg-slate-50 text-slate-600">{idx + 1}</td>
                    <td className="p-2 border border-slate-200 text-left font-bold text-slate-800 truncate max-w-[200px]" title={s.nama}>
                      {s.nama}
                    </td>
                    <td className="p-2 border border-slate-200 text-slate-600 font-medium">{s.kelas}</td>
                    
                    {s.scores.map((sc: number, scIdx: number) => {
                      const isHigh = sc > 0;
                      return (
                        <td 
                          key={scIdx} 
                          className={clsx(
                            "p-1.5 border border-slate-200 font-bold",
                            isHigh ? "bg-indigo-50 text-indigo-700 font-black" : "bg-white text-slate-400"
                          )}
                        >
                          {sc}
                        </td>
                      );
                    })}

                    <td className="p-2 border border-slate-200 font-black bg-amber-50 text-amber-900">{s.totalSkor}</td>
                    <td className="p-2 border border-slate-200 font-black bg-indigo-50 text-indigo-900 text-sm">{s.nilaiAkhir}</td>
                    <td className="p-2 border border-slate-200 text-center font-bold text-emerald-600">
                      {s.isTuntas ? <Check className="mx-auto" size={16} /> : '-'}
                    </td>
                    <td className="p-2 border border-slate-200 text-center font-bold text-rose-500">
                      {!s.isTuntas ? <X className="mx-auto" size={16} /> : '-'}
                    </td>
                  </tr>
                ))}

                {/* Baris Ringkasan Nilai Siswa */}
                {stats && (
                  <>
                    <tr className="font-extrabold bg-slate-100 text-slate-800 border-t-2 border-slate-400">
                      <td colSpan={3 + soalList.length} className="p-2.5 border border-slate-300 text-right uppercase tracking-wider">
                        JUMLAH NILAI
                      </td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.sumJumlah}</td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.sumNilai}</td>
                      <td className="p-2.5 border border-slate-300 text-emerald-700 font-black">{stats.countTuntas}</td>
                      <td className="p-2.5 border border-slate-300 text-rose-700 font-black">{stats.countTidakTuntas}</td>
                    </tr>
                    <tr className="font-extrabold bg-slate-100 text-slate-800">
                      <td colSpan={3 + soalList.length} className="p-2.5 border border-slate-300 text-right uppercase tracking-wider">
                        NILAI TERENDAH
                      </td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.minJumlah}</td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.minNilai}</td>
                      <td className="p-2.5 border border-slate-300">-</td>
                      <td className="p-2.5 border border-slate-300">-</td>
                    </tr>
                    <tr className="font-extrabold bg-slate-100 text-slate-800">
                      <td colSpan={3 + soalList.length} className="p-2.5 border border-slate-300 text-right uppercase tracking-wider">
                        NILAI TERTINGGI
                      </td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.maxJumlah}</td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.maxNilai}</td>
                      <td className="p-2.5 border border-slate-300">-</td>
                      <td className="p-2.5 border border-slate-300">-</td>
                    </tr>
                    <tr className="font-extrabold bg-indigo-50 text-indigo-900 border-b-2 border-slate-400">
                      <td colSpan={3 + soalList.length} className="p-2.5 border border-slate-300 text-right uppercase tracking-wider">
                        RATA-RATA KELAS
                      </td>
                      <td className="p-2.5 border border-slate-300 font-black">{stats.avgJumlah}</td>
                      <td className="p-2.5 border border-slate-300 font-black text-sm">{stats.avgNilai}</td>
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
