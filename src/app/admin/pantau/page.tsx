'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { MonitorPlay, Search, RefreshCw, PowerOff, CheckCircle2, Clock, XCircle, Trash2, MessageSquare, Megaphone, Send, X, AlertTriangle, StopCircle, Plus, Minus, Timer } from 'lucide-react';
import clsx from 'clsx';

export default function PantauSiswaPage() {
  const [siswa, setSiswa] = useState<any[]>([]);
  const [paketList, setPaketList] = useState<any[]>([]);
  const [soalPerPaket, setSoalPerPaket] = useState<Record<string, Set<string>>>({});
  const [hasilUserIds, setHasilUserIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  
  // State Kirim Pesan Teguran / Broadcast
  const [modalPesan, setModalPesan] = useState<{ isOpen: boolean; targetSiswa: any | null; pesan: string }>({
    isOpen: false,
    targetSiswa: null,
    pesan: ''
  });
  const [isSendingPesan, setIsSendingPesan] = useState(false);

  // State Henti Paksa Ujian Siswa
  const [modalHentiPaksa, setModalHentiPaksa] = useState<{
    isOpen: boolean;
    siswa: any | null;
    paketId: string;
    isProcessing: boolean;
  }>({
    isOpen: false,
    siswa: null,
    paketId: '',
    isProcessing: false
  });

  // State Atur Waktu Siswa Individual (+ / -)
  const [modalAturWaktu, setModalAturWaktu] = useState<{
    isOpen: boolean;
    siswa: any | null;
    tipeAksi: 'tambah' | 'kurang';
    menit: number;
    alasan: string;
    isProcessing: boolean;
  }>({
    isOpen: false,
    siswa: null,
    tipeAksi: 'tambah',
    menit: 10,
    alasan: 'Kompensasi kendala laptop / lowbatt',
    isProcessing: false
  });

  // State Atur Waktu Massal Seluruh Siswa (+ / -)
  const [modalWaktuMassal, setModalWaktuMassal] = useState<{
    isOpen: boolean;
    paketId: string;
    tipeAksi: 'tambah' | 'kurang';
    menit: number;
    alasan: string;
    isProcessing: boolean;
  }>({
    isOpen: false,
    paketId: 'SEMUA',
    tipeAksi: 'tambah',
    menit: 10,
    alasan: 'Kompensasi gangguan teknis / jaringan bersama',
    isProcessing: false
  });

  useEffect(() => {
    fetchData();
    
    // Auto-refresh setiap 30 detik (opsional)
    const intervalId = setInterval(() => {
      fetchData(false);
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setIsRefreshing(true);
    
    try {
      let { data } = await supabase
        .from('users')
        .select('*, kelas(nama_kelas), paket:paket_aktif_id(id, nama_paket, durasi_menit)')
        .eq('role', 'siswa')
        .order('status_login', { ascending: false }) // Yang online di atas
        .order('nama');
        
      data = filterDemoData(data, 'users');
      if (data) setSiswa(data);

      const { data: pData } = await supabase
        .from('paket')
        .select('id, nama_paket, durasi_menit, status')
        .order('created_at', { ascending: false });
      if (pData) setPaketList(pData);

      const { data: psData } = await supabase
        .from('paket_soal')
        .select('paket_id, soal_id');
      if (psData) {
        const pMap: Record<string, Set<string>> = {};
        psData.forEach((ps: any) => {
          if (!pMap[ps.paket_id]) {
            pMap[ps.paket_id] = new Set();
          }
          pMap[ps.paket_id].add(ps.soal_id);
        });
        setSoalPerPaket(pMap);
      }

      const { data: hData } = await supabase
        .from('hasil')
        .select('user_id');
      if (hData) {
        setHasilUserIds(new Set(hData.map((h: any) => h.user_id)));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleResetMassalSiswaTanpaHasil = async () => {
    const targetSiswa = siswa.filter(s => s.status_ujian === 'Selesai' && !hasilUserIds.has(s.id));
    if (targetSiswa.length === 0) return;

    if (!confirm(`Terdapat ${targetSiswa.length} siswa berstatus 'Selesai' tetapi hasil ujiannya tidak ada di database. Yakin ingin mereset status ujian mereka ke 'Belum Ujian' agar siswa dapat mengikuti ujian kembali?`)) {
      return;
    }

    try {
      const ids = targetSiswa.map(s => s.id);
      const { error } = await supabase
        .from('users')
        .update({ status_ujian: 'Belum Ujian', status_login: '0', jawaban_sementara: {} })
        .in('id', ids);

      if (error) throw error;
      alert(`Berhasil mereset ${ids.length} siswa! Status mereka kini kembali menjadi 'Belum Ujian' dan dapat mengikuti ujian lagi.`);
      fetchData(false);
    } catch (err: any) {
      alert('Gagal mereset siswa: ' + err.message);
    }
  };

  const handleOpenHentiPaksa = (s: any) => {
    const defaultPaketId = s.paket_aktif_id || s.paket?.id || (paketList.find(p => p.status === 'Aktif')?.id) || (paketList[0]?.id) || '';
    setModalHentiPaksa({
      isOpen: true,
      siswa: s,
      paketId: defaultPaketId,
      isProcessing: false
    });
  };

  const handleExecuteHentiPaksa = async () => {
    const s = modalHentiPaksa.siswa;
    const paketId = modalHentiPaksa.paketId;
    if (!s || !paketId) {
      alert('Pilih paket ujian terlebih dahulu!');
      return;
    }

    setModalHentiPaksa(prev => ({ ...prev, isProcessing: true }));

    try {
      // 1. Ambil butir-butir soal dari paket ujian
      const { data: pSoalData, error: errSoal } = await supabase
        .from('paket_soal')
        .select('soal(*)')
        .eq('paket_id', paketId);

      if (errSoal) throw errSoal;

      const soalList = (pSoalData || []).map((r: any) => r.soal).filter(Boolean);
      const jawaban = s.jawaban_sementara || {};

      // 2. Kalkulasi Skor Siswa secara presisi
      let totalSkorBenar = 0;
      let totalSkorMaks = 0;
      let hasEssayOrIsian = false;

      soalList.forEach((soal: any) => {
        const bobot = soal.skor_maks || 10;
        totalSkorMaks += bobot;

        if (soal.tipe === 'Essay' || soal.tipe === 'Isian') {
          hasEssayOrIsian = true;
        }

        const jwbSiswa = jawaban[soal.id];
        if (jwbSiswa === undefined || jwbSiswa === null || jwbSiswa === '') return;

        if (soal.tipe === 'PG') {
          if (typeof jwbSiswa === 'string' && jwbSiswa.toUpperCase() === soal.kunci?.toUpperCase()) {
            totalSkorBenar += bobot;
          }
        } else if (soal.tipe === 'PG Kompleks') {
          const kunciArr = (soal.kunci || '').split(',').map((k: string) => k.trim().toUpperCase());
          let benarCount = 0;
          if (Array.isArray(jwbSiswa)) {
            jwbSiswa.forEach((j: string) => {
              if (kunciArr.includes(String(j).toUpperCase())) benarCount++;
            });
            if (kunciArr.length > 0) {
              totalSkorBenar += (benarCount / kunciArr.length) * bobot;
            }
          }
        } else if (soal.tipe === 'Menjodohkan') {
          try {
            const kunciAsli = JSON.parse(soal.kunci || '[]');
            let benarCount = 0;
            if (Array.isArray(jwbSiswa)) {
              jwbSiswa.forEach((j: any) => {
                if (kunciAsli.find((k: any) => k.premisId === j.premisId && k.responsId === j.responsId)) {
                  benarCount++;
                }
              });
            }
            if (kunciAsli.length > 0) {
              totalSkorBenar += (benarCount / kunciAsli.length) * bobot;
            }
          } catch (e) {}
        } else if (soal.tipe === 'Isian') {
          if (soal.kunci && String(jwbSiswa).toLowerCase().trim() === soal.kunci.toLowerCase().trim()) {
            totalSkorBenar += bobot;
          }
        }
      });

      const skorAkhir = totalSkorMaks > 0 ? Math.round((totalSkorBenar / totalSkorMaks) * 100) : 0;
      const statusKoreksi = hasEssayOrIsian ? 'Menunggu Koreksi' : 'Selesai';

      // 3. Simpan / Perbarui Hasil ke tabel 'hasil'
      const { data: existingHasil } = await supabase
        .from('hasil')
        .select('id')
        .eq('user_id', s.id)
        .eq('paket_id', paketId)
        .maybeSingle();

      if (existingHasil) {
        const { error: errUpdateHasil } = await supabase
          .from('hasil')
          .update({
            waktu_sisa: s.sisa_waktu || 0,
            detail_jawaban: jawaban,
            skor_akhir: skorAkhir,
            status_koreksi: statusKoreksi
          })
          .eq('id', existingHasil.id);
        if (errUpdateHasil) throw errUpdateHasil;
      } else {
        const { error: errInsertHasil } = await supabase
          .from('hasil')
          .insert({
            user_id: s.id,
            paket_id: paketId,
            waktu_sisa: s.sisa_waktu || 0,
            detail_jawaban: jawaban,
            skor_akhir: skorAkhir,
            status_koreksi: statusKoreksi,
            cheat_count: 0
          });
        if (errInsertHasil) throw errInsertHasil;
      }

      // 4. Ubah status siswa menjadi Selesai & logout
      const { error: errUser } = await supabase
        .from('users')
        .update({
          status_ujian: 'Selesai',
          status_login: '0',
          jawaban_sementara: {}
        })
        .eq('id', s.id);
      if (errUser) throw errUser;

      // 5. Catat log aktivitas
      await supabase.from('log').insert({
        user_id: s.id,
        aktivitas: `HENTI_PAKSA:::Ujian dihentikan paksa oleh Proktor. Skor Akhir: ${skorAkhir}. Jawaban tersimpan ke Hasil Ujian.`
      });

      setModalHentiPaksa({ isOpen: false, siswa: null, paketId: '', isProcessing: false });
      await fetchData(false);
      alert(`Ujian peserta "${s.nama}" BERHASIL DIHENTIKAN PAKSA!\n\n• Skor Akhir: ${skorAkhir}\n• Jumlah Jawaban: ${Object.keys(jawaban).length} butir tersimpan\n• Status: Selesai (tersimpan di menu Hasil Ujian)`);
    } catch (err: any) {
      console.error('Error henti paksa:', err);
      alert('Gagal menghentikan paksa ujian: ' + (err.message || 'Terjadi kesalahan sistem'));
      setModalHentiPaksa(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleResetLogin = async (id: string, nama: string) => {
    if (!confirm(`Paksa logout / Reset sesi ujian untuk ${nama}?`)) return;
    
    try {
      await supabase.from('users').update({ status_login: '0' }).eq('id', id);
      fetchData(false);
      alert('Status login berhasil direset.');
    } catch (error) {
      alert('Gagal mereset status login.');
    }
  };

  const handleResetUjian = async (id: string, nama: string) => {
    if (!confirm(`Yakin ingin mereset ujian siswa ${nama}? Ini akan menghapus hasil secara permanen dan mereset status ujian sehingga siswa dapat mengikuti ujian ini lagi dari awal.`)) return;

    try {
      await supabase.from('hasil').delete().eq('user_id', id);
      await supabase.from('users').update({ status_ujian: 'Belum Ujian', status_login: '0' }).eq('id', id);
      
      alert('Ujian berhasil direset!');
      fetchData(false);
    } catch (error) {
      alert('Gagal mereset ujian.');
    }
  };

  const handleKirimPesan = async () => {
    if (!modalPesan.pesan.trim()) return alert('Pesan teguran tidak boleh kosong!');
    setIsSendingPesan(true);
    try {
      if (modalPesan.targetSiswa) {
        // Kirim teguran ke siswa tertentu via log aktivitas
        const { error } = await supabase.from('log').insert({
          user_id: modalPesan.targetSiswa.id,
          aktivitas: `PESAN_PENGAWAS:::${modalPesan.pesan.trim()}`
        });
        if (error) throw error;
        alert(`Pesan teguran berhasil dikirim langsung ke layar ${modalPesan.targetSiswa.nama}!`);
      } else {
        // Kirim broadcast pengumuman ke seluruh peserta via pengaturan
        const { error } = await supabase.from('pengaturan').upsert({
          kunci: 'pesan_broadcast',
          nilai: JSON.stringify({
            id: Date.now(),
            pesan: modalPesan.pesan.trim(),
            waktu: new Date().toISOString(),
            pengirim: 'Pengawas Ujian'
          })
        }, { onConflict: 'kunci' });
        if (error) throw error;
        alert('Pesan pengumuman berhasil disiarkan ke SEMUA siswa yang sedang ujian!');
      }
      setModalPesan({ isOpen: false, targetSiswa: null, pesan: '' });
    } catch (err: any) {
      console.error(err);
      alert('Gagal mengirim pesan: ' + (err.message || 'Koneksi bermasalah'));
    }
    setIsSendingPesan(false);
  };

  const handleExecuteAturWaktu = async () => {
    if (!modalAturWaktu.siswa) return;
    const s = modalAturWaktu.siswa;
    const menit = Math.max(1, modalAturWaktu.menit || 1);
    const deltaDetik = modalAturWaktu.tipeAksi === 'tambah' ? menit * 60 : -(menit * 60);
    const durasiAwal = s.sisa_waktu > 0 ? s.sisa_waktu : (s.paket?.durasi_menit || 60) * 60;
    const waktuBaru = Math.max(10, durasiAwal + deltaDetik);

    setModalAturWaktu(prev => ({ ...prev, isProcessing: true }));

    try {
      // 1. Update sisa_waktu siswa di tabel users
      const { error: errUpdate } = await supabase
        .from('users')
        .update({ sisa_waktu: waktuBaru })
        .eq('id', s.id);
      if (errUpdate) throw errUpdate;

      // 2. Catat ke tabel log untuk realtime trigger ke browser siswa
      const { error: errLog } = await supabase
        .from('log')
        .insert({
          user_id: s.id,
          aktivitas: `UBAH_WAKTU:::${deltaDetik}:::${modalAturWaktu.alasan.trim() || 'Penyesuaian oleh Proktor'}`
        });
      if (errLog) throw errLog;

      // Update state lokal
      setSiswa(prev => prev.map(item => item.id === s.id ? { ...item, sisa_waktu: waktuBaru } : item));
      setModalAturWaktu({ isOpen: false, siswa: null, tipeAksi: 'tambah', menit: 10, alasan: '', isProcessing: false });
      alert(`Waktu ujian untuk "${s.nama}" berhasil ${modalAturWaktu.tipeAksi === 'tambah' ? 'DITAMBAH' : 'DIKURANGI'} ${menit} menit!\n\nSisa waktu baru: ~${Math.floor(waktuBaru / 60)} menit.`);
    } catch (err: any) {
      console.error('Error atur waktu siswa:', err);
      alert('Gagal mengatur waktu: ' + (err.message || 'Terjadi kesalahan sistem'));
      setModalAturWaktu(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const handleExecuteWaktuMassal = async () => {
    const menit = Math.max(1, modalWaktuMassal.menit || 1);
    const deltaDetik = modalWaktuMassal.tipeAksi === 'tambah' ? menit * 60 : -(menit * 60);

    setModalWaktuMassal(prev => ({ ...prev, isProcessing: true }));

    try {
      // 1. Tentukan target siswa yang sedang ujian
      const siswaTarget = siswa.filter(s => {
        if (s.status_ujian === 'Selesai') return false;
        if (modalWaktuMassal.paketId === 'SEMUA') return true;
        const pId = s.paket_aktif_id || s.paket?.id;
        return pId === modalWaktuMassal.paketId;
      });

      if (siswaTarget.length === 0) {
        alert('Tidak ditemukan siswa yang sedang aktif/mengerjakan pada target paket yang dipilih.');
        setModalWaktuMassal(prev => ({ ...prev, isProcessing: false }));
        return;
      }

      // 2. Update sisa_waktu seluruh siswa target di tabel users & log
      for (const s of siswaTarget) {
        const durasiAwal = s.sisa_waktu > 0 ? s.sisa_waktu : (s.paket?.durasi_menit || 60) * 60;
        const waktuBaru = Math.max(10, durasiAwal + deltaDetik);
        await supabase.from('users').update({ sisa_waktu: waktuBaru }).eq('id', s.id);
        await supabase.from('log').insert({
          user_id: s.id,
          aktivitas: `UBAH_WAKTU:::${deltaDetik}:::${modalWaktuMassal.alasan.trim() || 'Penyesuaian Massal Proktor'}`
        });
      }

      // 3. Upsert ke tabel pengaturan untuk sinkronisasi massal real-time
      await supabase.from('pengaturan').upsert({
        kunci: 'tambah_waktu_massal',
        nilai: JSON.stringify({
          id: Date.now(),
          paket_id: modalWaktuMassal.paketId,
          delta_detik: deltaDetik,
          alasan: modalWaktuMassal.alasan.trim() || 'Penyesuaian Massal Proktor',
          waktu: new Date().toISOString()
        })
      }, { onConflict: 'kunci' });

      setModalWaktuMassal({ isOpen: false, paketId: 'SEMUA', tipeAksi: 'tambah', menit: 10, alasan: '', isProcessing: false });
      await fetchData(false);
      alert(`Waktu ujian massal BERHASIL ${modalWaktuMassal.tipeAksi === 'tambah' ? 'DITAMBAHKAN' : 'DIKURANGI'} ${menit} menit ke ${siswaTarget.length} siswa!`);
    } catch (err: any) {
      console.error('Error waktu massal:', err);
      alert('Gagal mengatur waktu massal: ' + (err.message || 'Terjadi kesalahan sistem'));
      setModalWaktuMassal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const filteredSiswa = siswa.filter(s => 
    s.nama?.toLowerCase().includes(search.toLowerCase()) || 
    s.username?.toLowerCase().includes(search.toLowerCase()) ||
    s.kelas?.nama_kelas?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: siswa.length,
    online: siswa.filter(s => s.status_login === '1').length,
    selesai: siswa.filter(s => s.status_ujian === 'Selesai').length,
    belumMulai: siswa.filter(s => s.status_ujian !== 'Selesai' && s.status_login !== '1').length,
  };

  const siswaTanpaHasil = siswa.filter(s => s.status_ujian === 'Selesai' && !hasilUserIds.has(s.id));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Stats */}
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 flex flex-col justify-center">
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><MonitorPlay size={24} /></div> 
              Live Monitoring Ujian
            </h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setModalWaktuMassal({
                  isOpen: true,
                  paketId: 'SEMUA',
                  tipeAksi: 'tambah',
                  menit: 10,
                  alasan: 'Kompensasi gangguan teknis / kendala bersama',
                  isProcessing: false
                })}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-lg font-bold text-xs md:text-sm transition-all shadow-md shadow-amber-500/20 active:scale-95"
                title="Tambah atau kurangi waktu ujian secara serentak untuk seluruh peserta"
              >
                <Timer size={16} />
                <span className="hidden sm:inline">⏱️ Waktu Massal</span>
              </button>
              <button 
                onClick={() => setModalPesan({ isOpen: true, targetSiswa: null, pesan: '' })}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg font-bold text-xs md:text-sm transition-all shadow-md shadow-indigo-600/20 active:scale-95"
                title="Kirim pengumuman/pesan ke semua siswa yang sedang ujian"
              >
                <Megaphone size={16} />
                <span className="hidden sm:inline">Broadcast Pesan</span>
              </button>
              <button 
                onClick={() => fetchData(true)}
                disabled={isRefreshing}
                className="flex items-center gap-2 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 px-3.5 py-2 rounded-lg font-bold text-xs md:text-sm transition-all disabled:opacity-50 active:scale-95 border border-slate-200"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
                <span className="hidden sm:inline">{isRefreshing ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500 font-medium ml-12">
            Pantau status pengerjaan ujian siswa secara real-time. Data diperbarui otomatis setiap 30 detik.
          </p>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 xl:pb-0 custom-scrollbar">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl min-w-[140px] flex flex-col justify-center shadow-sm">
            <p className="text-emerald-600/80 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Sedang Ujian</p>
            <h3 className="text-3xl font-black text-emerald-700">{stats.online}</h3>
          </div>
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl min-w-[140px] flex flex-col justify-center shadow-sm">
            <p className="text-blue-600/80 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><CheckCircle2 size={12}/> Sudah Selesai</p>
            <h3 className="text-3xl font-black text-blue-700">{stats.selesai}</h3>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl min-w-[140px] flex flex-col justify-center shadow-sm">
            <p className="text-slate-500/80 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Clock size={12}/> Belum Mulai</p>
            <h3 className="text-3xl font-black text-slate-700">{stats.belumMulai}</h3>
          </div>
        </div>
      </div>

      {/* Banner Peringatan Siswa Selesai Tanpa Hasil */}
      {siswaTanpaHasil.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-amber-900 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shrink-0 shadow-md shadow-amber-500/20">
              <AlertTriangle size={22} />
            </div>
            <div>
              <div className="font-extrabold text-sm md:text-base text-amber-950">
                Perhatian: Ditemukan {siswaTanpaHasil.length} Siswa Berstatus Selesai Namun Hasil Belum Masuk Rekap
              </div>
              <div className="text-xs text-amber-800 font-medium mt-0.5">
                Siswa-siswa ini menyelesaikan ujian saat terjadi kendala penyimpanan database. Anda dapat mereset sesi mereka agar dapat mengikuti ujian kembali.
              </div>
            </div>
          </div>
          <button
            onClick={handleResetMassalSiswaTanpaHasil}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-amber-600/20 transition active:scale-95 shrink-0 flex items-center gap-2"
          >
            <RefreshCw size={15} /> Reset Status ke 'Belum Ujian' ({siswaTanpaHasil.length} Siswa)
          </button>
        </div>
      )}

      {/* Tabel Pemantauan */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
          <h3 className="text-lg font-bold text-slate-800">Status Peserta Ujian</h3>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari siswa atau kelas..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 pr-4 py-3 w-full border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-medium text-sm transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead className="bg-white text-slate-500 sticky top-0 z-10 shadow-sm uppercase text-xs tracking-wider font-bold">
              <tr>
                <th className="p-4 border-b border-slate-100 w-16 text-center">No</th>
                <th className="p-4 border-b border-slate-100">Informasi Siswa</th>
                <th className="p-4 border-b border-slate-100">Sesi Login</th>
                <th className="p-4 border-b border-slate-100">Progres Ujian</th>
                <th className="p-4 border-b border-slate-100 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-12 text-center text-indigo-500 font-bold animate-pulse">Memuat data live monitoring...</td></tr>
              ) : filteredSiswa.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-400 font-medium">Tidak ada data peserta.</td></tr>
              ) : (
                filteredSiswa.map((s, idx) => {
                  const isOnline = s.status_login === '1';
                  const isSelesai = s.status_ujian === 'Selesai';
                  
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 last:border-0 group">
                      <td className="p-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-4">
                        <div className="font-black text-slate-800 text-base">{s.nama}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{s.username}</span>
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">{s.kelas?.nama_kelas || '-'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        {isOnline ? (
                          <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Aktif
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border border-slate-200">
                            <XCircle size={14} /> Terputus / Belum Login
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {isSelesai ? (
                          hasilUserIds.has(s.id) ? (
                            <div className="flex flex-col">
                              <span className="font-black text-blue-600 flex items-center gap-1"><CheckCircle2 size={16}/> Selesai</span>
                              <span className="text-xs font-medium text-slate-400 mt-0.5">Sudah submit hasil</span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-bold text-amber-600 flex items-center gap-1"><AlertTriangle size={15}/> Selesai (Tanpa Rekap)</span>
                              <span className="text-[11px] font-medium text-amber-600 mt-0.5">Hasil belum tersimpan</span>
                            </div>
                          )
                        ) : isOnline || s.status_ujian === 'Mengerjakan Ujian' ? (
                          (() => {
                            const activePaketId = s.paket_aktif_id || s.paket?.id;
                            const soalSet = activePaketId ? soalPerPaket[activePaketId] : null;
                            const totalSoal = soalSet ? soalSet.size : 0;
                            const rawJwb = s.jawaban_sementara || {};
                            
                            // Hitung hanya kunci jawaban yang valid milik paket aktif siswa saat ini
                            const terjawabCount = soalSet && totalSoal > 0
                              ? Object.keys(rawJwb).filter(id => soalSet.has(id)).length
                              : Object.keys(rawJwb).length;
                              
                            const persen = totalSoal > 0 ? Math.round((terjawabCount / totalSoal) * 100) : 0;

                            return (
                              <div className="flex flex-col gap-1.5 min-w-[200px] max-w-[240px]">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-emerald-600 flex items-center gap-1.5 text-xs">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Sedang Mengerjakan
                                  </span>
                                  {totalSoal > 0 && (
                                    <span className={clsx(
                                      "text-[10px] font-black px-1.5 py-0.5 rounded-full border shadow-2xs",
                                      persen === 100 
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                        : persen >= 50 
                                          ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                                          : "bg-amber-50 text-amber-700 border-amber-200"
                                    )}>
                                      {persen}%
                                    </span>
                                  )}
                                </div>

                                {s.paket?.nama_paket && (
                                  <span className="text-[11px] font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded truncate" title={s.paket?.nama_paket}>
                                    📦 {s.paket?.nama_paket}
                                  </span>
                                )}

                                {/* Progress Bar Visual */}
                                {totalSoal > 0 && (
                                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60 shadow-inner">
                                    <div 
                                      className={clsx(
                                        "h-full rounded-full transition-all duration-500",
                                        persen === 100 
                                          ? "bg-emerald-500" 
                                          : persen >= 50 
                                            ? "bg-gradient-to-r from-blue-500 to-indigo-600" 
                                            : "bg-amber-500"
                                      )}
                                      style={{ width: `${Math.min(100, Math.max(0, persen))}%` }}
                                    />
                                  </div>
                                )}

                                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                                  <span className="font-bold text-slate-700">
                                    📝 {totalSoal > 0 ? `${terjawabCount} / ${totalSoal} Soal` : `${terjawabCount} Soal`}
                                  </span>
                                  {s.sisa_waktu > 0 ? (
                                    <span className="text-[10px] text-slate-500 font-semibold">⏱️ {Math.floor(s.sisa_waktu / 60)}m</span>
                                  ) : (
                                    <span className="text-[10px] text-rose-500 font-bold">⏱️ Habis</span>
                                  )}
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-slate-400 font-medium text-xs">Belum Mulai</span>
                            {s.paket?.nama_paket && (
                              <span className="text-[11px] text-slate-400 truncate max-w-xs">{s.paket?.nama_paket}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setModalPesan({ isOpen: true, targetSiswa: s, pesan: '' })}
                            className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white px-2.5 py-2 rounded-lg font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                            title="Kirim Teguran / Pesan Langsung ke Layar Siswa"
                          >
                            <MessageSquare size={14} /> Teguran
                          </button>
                          {!isSelesai && (
                            <button 
                              onClick={() => setModalAturWaktu({
                                isOpen: true,
                                siswa: s,
                                tipeAksi: 'tambah',
                                menit: 10,
                                alasan: 'Kompensasi kendala laptop / lowbatt',
                                isProcessing: false
                              })}
                              className="text-xs bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white px-2.5 py-2 rounded-lg font-bold transition-all shadow-sm flex items-center justify-center gap-1 border border-amber-200 active:scale-95"
                              title="Tambah atau kurangi waktu ujian untuk siswa ini"
                            >
                              <Clock size={14} /> Waktu
                            </button>
                          )}
                          {!isSelesai && (
                            <button 
                              onClick={() => handleOpenHentiPaksa(s)}
                              className="text-xs bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white px-2.5 py-2 rounded-lg font-bold transition-all shadow-sm flex items-center justify-center gap-1 border border-rose-200 active:scale-95"
                              title="Hentikan paksa ujian siswa ini dan simpan jawaban saat ini langsung ke Hasil Ujian"
                            >
                              <StopCircle size={14} /> Henti Paksa
                            </button>
                          )}
                          {isOnline && (
                            <button 
                              onClick={() => handleResetLogin(s.id, s.nama)}
                              className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white px-2.5 py-2 rounded-lg font-bold transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95"
                              title="Jika siswa mengalami error/keluar mendadak dan tidak bisa login"
                            >
                              <PowerOff size={14} /> Reset Sesi
                            </button>
                          )}
                          <button 
                            onClick={() => handleResetUjian(s.id, s.nama)}
                            className="text-xs bg-red-100 text-red-700 hover:bg-red-500 hover:text-white px-2.5 py-2 rounded-lg font-bold transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95"
                            title="Hapus hasil dan kembalikan status ke Belum Ujian"
                          >
                            <Trash2 size={14} /> Reset Ujian
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Kirim Teguran / Broadcast */}
      {modalPesan.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl text-white ${modalPesan.targetSiswa ? 'bg-amber-500 shadow-amber-500/20' : 'bg-indigo-600 shadow-indigo-600/20'} shadow-md`}>
                  {modalPesan.targetSiswa ? <AlertTriangle size={20} /> : <Megaphone size={20} />}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-800">
                    {modalPesan.targetSiswa ? `Kirim Teguran: ${modalPesan.targetSiswa.nama}` : 'Kirim Pengumuman Broadcast'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {modalPesan.targetSiswa 
                      ? 'Pesan akan langsung muncul sebagai pop-up di layar ujian siswa ini.' 
                      : 'Pesan akan langsung muncul di layar semua siswa yang sedang mengerjakan ujian.'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalPesan({ isOpen: false, targetSiswa: null, pesan: '' })}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Pilih Pesan Cepat (Template):</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Harap fokus ke layar ujian dan jangan menoleh!",
                    "Dilarang membuka tab lain atau aplikasi tambahan!",
                    "Posisi duduk tegak dan pastikan wajah terlihat!",
                    "Waktu ujian tersisa 10 menit lagi, silakan periksa jawaban Anda!"
                  ].map((temp, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setModalPesan(prev => ({ ...prev, pesan: temp }))}
                      className="text-xs bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 text-left transition"
                    >
                      {temp}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Isi Pesan / Teguran:</label>
                <textarea
                  rows={3}
                  value={modalPesan.pesan}
                  onChange={e => setModalPesan(prev => ({ ...prev, pesan: e.target.value }))}
                  placeholder="Ketik pesan peringatan untuk siswa..."
                  className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalPesan({ isOpen: false, targetSiswa: null, pesan: '' })}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleKirimPesan}
                disabled={isSendingPesan || !modalPesan.pesan.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 text-sm font-bold rounded-xl transition shadow-md flex items-center gap-2 disabled:opacity-50 active:scale-95"
              >
                <Send size={16} /> {isSendingPesan ? 'Mengirim...' : 'Kirim Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Henti Paksa */}
      {modalHentiPaksa.isOpen && modalHentiPaksa.siswa && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-rose-100">
            {/* Header Modal */}
            <div className="p-5 border-b border-rose-100 flex justify-between items-center bg-rose-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl text-white bg-rose-600 shadow-rose-600/20 shadow-md">
                  <StopCircle size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Henti Paksa Ujian Peserta
                  </h3>
                  <p className="text-xs text-rose-700 font-medium">
                    Simpan langsung jawaban peserta ke tabel Hasil Ujian
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalHentiPaksa({ isOpen: false, siswa: null, paketId: '', isProcessing: false })}
                disabled={modalHentiPaksa.isProcessing}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-rose-100 transition disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* Isi Detail Peserta & Konfirmasi */}
            <div className="p-5 space-y-4 text-sm">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Nama Peserta:</span>
                  <span className="font-black text-slate-800 text-sm">{modalHentiPaksa.siswa.nama}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Username / ID:</span>
                  <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{modalHentiPaksa.siswa.username}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Kelas:</span>
                  <span className="font-bold text-slate-700">{modalHentiPaksa.siswa.kelas?.nama_kelas || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Jawaban Tersimpan:</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 text-xs">
                    {Object.keys(modalHentiPaksa.siswa.jawaban_sementara || {}).length} Butir Soal Terisi
                  </span>
                </div>
              </div>

              {/* Pemilihan Paket Ujian */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Paket Ujian yang Diselesaikan:
                </label>
                <select
                  value={modalHentiPaksa.paketId}
                  onChange={(e) => setModalHentiPaksa(prev => ({ ...prev, paketId: e.target.value }))}
                  className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-800 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition bg-white"
                >
                  <option value="" disabled>-- Pilih Paket Ujian --</option>
                  {paketList.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.nama_paket} ({p.durasi_menit} Menit) {p.status === 'Aktif' ? '• Aktif' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Peringatan Konfirmasi */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Konfirmasi Pengawas:</span> Sesi ujian peserta ini akan segera dihentikan. Seluruh jawaban yang telah diisi akan dikalkulasi nilainya secara otomatis dan dimasukkan ke <strong>Hasil Ujian</strong>. Peserta tidak dapat mengerjakan ulang kecuali direset.
                </div>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setModalHentiPaksa({ isOpen: false, siswa: null, paketId: '', isProcessing: false })}
                disabled={modalHentiPaksa.isProcessing}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteHentiPaksa}
                disabled={modalHentiPaksa.isProcessing || !modalHentiPaksa.paketId}
                className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 text-sm font-bold rounded-xl transition shadow-md shadow-rose-600/30 flex items-center gap-2 disabled:opacity-50 active:scale-95"
              >
                {modalHentiPaksa.isProcessing ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Memproses & Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <StopCircle size={16} />
                    <span>Hentikan Paksa & Simpan Jawaban</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Atur Waktu Siswa Individual */}
      {modalAturWaktu.isOpen && modalAturWaktu.siswa && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden border border-amber-200">
            {/* Header Modal (Always Visible) */}
            <div className="px-4 py-3 border-b border-amber-100 flex justify-between items-center bg-amber-50/80 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg text-white bg-amber-500 shadow-sm shrink-0">
                  <Clock size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-slate-900 truncate">
                    Atur Waktu: {modalAturWaktu.siswa.nama}
                  </h3>
                  <p className="text-[11px] text-amber-800 font-medium truncate">
                    Kompensasi kendala teknis / baterai lowbatt
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalAturWaktu({ isOpen: false, siswa: null, tipeAksi: 'tambah', menit: 10, alasan: '', isProcessing: false })}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-amber-100 transition shrink-0 ml-2"
                title="Tutup (ESC)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Konten Modal (Scrollable if screen small) */}
            <div className="p-4 space-y-3 text-xs overflow-y-auto flex-1 custom-scrollbar">
              {/* Ringkasan Sisa Waktu Saat Ini vs Baru */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Saat Ini:</span>
                  <span className="text-sm font-black text-slate-800">
                    {modalAturWaktu.siswa.sisa_waktu > 0
                      ? `${Math.floor(modalAturWaktu.siswa.sisa_waktu / 60)}m ${modalAturWaktu.siswa.sisa_waktu % 60}s`
                      : `${modalAturWaktu.siswa.paket?.durasi_menit || 60}m (Penuh)`}
                  </span>
                </div>
                <div className="text-slate-400 font-bold text-sm">➔</div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Hasil Baru:</span>
                  <span className={clsx(
                    "text-sm font-black",
                    modalAturWaktu.tipeAksi === 'tambah' ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {(() => {
                      const cur = modalAturWaktu.siswa.sisa_waktu > 0 ? modalAturWaktu.siswa.sisa_waktu : (modalAturWaktu.siswa.paket?.durasi_menit || 60) * 60;
                      const delta = modalAturWaktu.tipeAksi === 'tambah' ? (modalAturWaktu.menit || 0) * 60 : -((modalAturWaktu.menit || 0) * 60);
                      const res = Math.max(10, cur + delta);
                      return `~${Math.floor(res / 60)} Menit`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Segmented Mode: Tambah vs Kurang */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Tindakan:</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setModalAturWaktu(prev => ({ ...prev, tipeAksi: 'tambah' }))}
                    className={clsx(
                      "py-1.5 px-3 rounded-lg font-black text-xs flex items-center justify-center gap-1.5 transition",
                      modalAturWaktu.tipeAksi === 'tambah'
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Plus size={14} /> Tambah (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalAturWaktu(prev => ({ ...prev, tipeAksi: 'kurang' }))}
                    className={clsx(
                      "py-1.5 px-3 rounded-lg font-black text-xs flex items-center justify-center gap-1.5 transition",
                      modalAturWaktu.tipeAksi === 'kurang'
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Minus size={14} /> Kurang (-)
                  </button>
                </div>
              </div>

              {/* Pilihan Menit Cepat */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Durasi Cepat:</label>
                <div className="flex flex-wrap gap-1.5">
                  {[5, 10, 15, 20, 30].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModalAturWaktu(prev => ({ ...prev, menit: m }))}
                      className={clsx(
                        "px-2.5 py-1 rounded-lg font-bold text-xs border transition",
                        modalAturWaktu.menit === m
                          ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50"
                      )}
                    >
                      {modalAturWaktu.tipeAksi === 'tambah' ? `+${m}m` : `-${m}m`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Kustom Menit */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Menit Kustom:</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={modalAturWaktu.menit || ''}
                    onChange={(e) => setModalAturWaktu(prev => ({ ...prev, menit: Math.max(1, parseInt(e.target.value) || 0) }))}
                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-amber-500 transition"
                    placeholder="Contoh: 10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Menit</span>
                </div>
              </div>

              {/* Alasan Penyesuaian */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Alasan (Tampil ke Siswa):</label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {[
                    "Laptop lowbatt / mati",
                    "Pindah PC lab",
                    "Koneksi WiFi terputus",
                    "Kendala teknis"
                  ].map((temp, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setModalAturWaktu(prev => ({ ...prev, alasan: temp }))}
                      className="text-[10px] bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-600 font-semibold px-2 py-0.5 rounded border border-slate-200 transition"
                    >
                      {temp}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={modalAturWaktu.alasan}
                  onChange={(e) => setModalAturWaktu(prev => ({ ...prev, alasan: e.target.value }))}
                  placeholder="Ketik keterangan alasan..."
                  className="w-full border-2 border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 transition"
                />
              </div>
            </div>

            {/* Footer Modal (Always Visible) */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setModalAturWaktu({ isOpen: false, siswa: null, tipeAksi: 'tambah', menit: 10, alasan: '', isProcessing: false })}
                disabled={modalAturWaktu.isProcessing}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleExecuteAturWaktu}
                disabled={modalAturWaktu.isProcessing || !modalAturWaktu.menit}
                className={clsx(
                  "px-4 py-1.5 text-xs font-bold text-white rounded-xl transition shadow-sm flex items-center gap-1.5 disabled:opacity-50 active:scale-95",
                  modalAturWaktu.tipeAksi === 'tambah'
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                )}
              >
                {modalAturWaktu.isProcessing ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    {modalAturWaktu.tipeAksi === 'tambah' ? <Plus size={13} /> : <Minus size={13} />}
                    <span>{modalAturWaktu.tipeAksi === 'tambah' ? `Tambah ${modalAturWaktu.menit} Menit` : `Kurang ${modalAturWaktu.menit} Menit`}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah / Kurangi Waktu Massal Seluruh Siswa */}
      {modalWaktuMassal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden border border-amber-200">
            {/* Header Modal (Always Visible) */}
            <div className="px-4 py-3 border-b border-amber-100 flex justify-between items-center bg-amber-50/80 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg text-white bg-amber-500 shadow-sm shrink-0">
                  <Timer size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-slate-900 truncate">
                    Waktu Ujian Massal (Serentak)
                  </h3>
                  <p className="text-[11px] text-amber-800 font-medium truncate">
                    Terapkan durasi ke seluruh siswa sekaligus
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalWaktuMassal({ isOpen: false, paketId: 'SEMUA', tipeAksi: 'tambah', menit: 10, alasan: '', isProcessing: false })}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-amber-100 transition shrink-0 ml-2"
                title="Tutup (ESC)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Konten Modal (Scrollable if screen small) */}
            <div className="p-4 space-y-3 text-xs overflow-y-auto flex-1 custom-scrollbar">
              {/* Target Paket */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Peserta Ujian:
                </label>
                <select
                  value={modalWaktuMassal.paketId}
                  onChange={(e) => setModalWaktuMassal(prev => ({ ...prev, paketId: e.target.value }))}
                  className="w-full border-2 border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 transition bg-white"
                >
                  <option value="SEMUA">🌐 Semua Siswa yang Sedang Ujian ({siswa.filter(s => s.status_ujian !== 'Selesai').length} Siswa)</option>
                  {paketList.map((p: any) => {
                    const count = siswa.filter(s => s.status_ujian !== 'Selesai' && (s.paket_aktif_id === p.id || s.paket?.id === p.id)).length;
                    return (
                      <option key={p.id} value={p.id}>
                        📦 Paket: {p.nama_paket} ({count} Siswa Aktif)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Segmented Mode: Tambah vs Kurang */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Jenis Tindakan:</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setModalWaktuMassal(prev => ({ ...prev, tipeAksi: 'tambah' }))}
                    className={clsx(
                      "py-1.5 px-3 rounded-lg font-black text-xs flex items-center justify-center gap-1.5 transition",
                      modalWaktuMassal.tipeAksi === 'tambah'
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Plus size={14} /> Tambah (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalWaktuMassal(prev => ({ ...prev, tipeAksi: 'kurang' }))}
                    className={clsx(
                      "py-1.5 px-3 rounded-lg font-black text-xs flex items-center justify-center gap-1.5 transition",
                      modalWaktuMassal.tipeAksi === 'kurang'
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Minus size={14} /> Kurang (-)
                  </button>
                </div>
              </div>

              {/* Pilihan Menit Cepat */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Durasi Cepat:</label>
                <div className="flex flex-wrap gap-1.5">
                  {[5, 10, 15, 20, 30].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModalWaktuMassal(prev => ({ ...prev, menit: m }))}
                      className={clsx(
                        "px-2.5 py-1 rounded-lg font-bold text-xs border transition",
                        modalWaktuMassal.menit === m
                          ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50"
                      )}
                    >
                      {modalWaktuMassal.tipeAksi === 'tambah' ? `+${m}m` : `-${m}m`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Kustom Menit */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Menit Kustom:</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={modalWaktuMassal.menit || ''}
                    onChange={(e) => setModalWaktuMassal(prev => ({ ...prev, menit: Math.max(1, parseInt(e.target.value) || 0) }))}
                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-amber-500 transition"
                    placeholder="Contoh: 15"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Menit</span>
                </div>
              </div>

              {/* Alasan / Pengumuman ke Siswa */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Alasan / Pengumuman:</label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {[
                    "Gangguan WiFi / server lab",
                    "Mati listrik / kendala bersama",
                    "Kendala teknis bersama",
                    "Penyesuaian proktor"
                  ].map((temp, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setModalWaktuMassal(prev => ({ ...prev, alasan: temp }))}
                      className="text-[10px] bg-slate-100 hover:bg-amber-50 hover:text-amber-800 text-slate-600 font-semibold px-2 py-0.5 rounded border border-slate-200 transition"
                    >
                      {temp}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={modalWaktuMassal.alasan}
                  onChange={(e) => setModalWaktuMassal(prev => ({ ...prev, alasan: e.target.value }))}
                  placeholder="Ketik keterangan pengumuman..."
                  className="w-full border-2 border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-amber-500 transition"
                />
              </div>
            </div>

            {/* Footer Modal (Always Visible) */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setModalWaktuMassal({ isOpen: false, paketId: 'SEMUA', tipeAksi: 'tambah', menit: 10, alasan: '', isProcessing: false })}
                disabled={modalWaktuMassal.isProcessing}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleExecuteWaktuMassal}
                disabled={modalWaktuMassal.isProcessing || !modalWaktuMassal.menit}
                className={clsx(
                  "px-4 py-1.5 text-xs font-bold text-white rounded-xl transition shadow-sm flex items-center gap-1.5 disabled:opacity-50 active:scale-95",
                  modalWaktuMassal.tipeAksi === 'tambah'
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                )}
              >
                {modalWaktuMassal.isProcessing ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Menerapkan...</span>
                  </>
                ) : (
                  <>
                    {modalWaktuMassal.tipeAksi === 'tambah' ? <Plus size={13} /> : <Minus size={13} />}
                    <span>{modalWaktuMassal.tipeAksi === 'tambah' ? `Terapkan Tambah ${modalWaktuMassal.menit} Menit` : `Terapkan Kurang ${modalWaktuMassal.menit} Menit`}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
