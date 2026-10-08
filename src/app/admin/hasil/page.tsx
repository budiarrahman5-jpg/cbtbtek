'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { Trophy, Download, Search, Calculator, Sparkles, CheckSquare, Trash2, RefreshCw, Printer, FileText, X, Image as ImageIcon, Upload, CheckCircle2, Clock, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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
  const [showKoreksiPaketModal, setShowKoreksiPaketModal] = useState(false);
  const [koreksiAiEngine, setKoreksiAiEngine] = useState<'auto' | 'groq' | 'gemini'>('auto');
  const [koreksiSiswaAiEngine, setKoreksiSiswaAiEngine] = useState<'auto' | 'groq' | 'gemini'>('auto');

  // State Seleksi Siswa & Ubah Status Koreksi Massal
  const [selectedHasilIds, setSelectedHasilIds] = useState<string[]>([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // State Sort Tabel
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  
  // State Cetak PDF (Pilihan Kop Resmi vs Tanpa Kop)
  const [modalPrintPDF, setModalPrintPDF] = useState(false);
  const [pakaiKop, setPakaiKop] = useState<boolean>(true);
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
    kkm: 75,
    logoUrl: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Muat preferensi kop tersimpan dari localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cbt_kop_pdf_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.pakaiKop !== undefined) setPakaiKop(parsed.pakaiKop);
        setKopSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch(e) {}
  }, []);

  const updateKopSettings = (newSettings: any, newPakaiKop?: boolean) => {
    const isPakai = newPakaiKop !== undefined ? newPakaiKop : pakaiKop;
    setKopSettings(newSettings);
    if (newPakaiKop !== undefined) setPakaiKop(newPakaiKop);
    try {
      localStorage.setItem('cbt_kop_pdf_settings', JSON.stringify({ ...newSettings, pakaiKop: isPakai }));
    } catch(e) {}
  };

  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran file logo maksimal 2MB!');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        updateKopSettings({ ...kopSettings, logoUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHapusLogo = () => {
    updateKopSettings({ ...kopSettings, logoUrl: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [isPrinting, setIsPrinting] = useState(false);

  // Fungsi cetak PDF profesional melalui Iframe terisolasi
  // Mengeliminasi tabrakan CSS dashboard, backdrop modal, dan masalah multi-halaman
  const handlePrintPDF = () => {
    const printContent = document.getElementById('printKopArea');
    if (!printContent) return;

    setIsPrinting(true);

    const oldIframe = document.getElementById('cbt-print-frame');
    if (oldIframe) {
      oldIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'cbt-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      setIsPrinting(false);
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan Hasil Ujian CBT - ${selectedPaket !== 'ALL' ? (paketList.find(p => p.id === selectedPaket)?.nama_paket || '') : 'Semua Paket'}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 portrait;
              margin: 12mm 10mm 15mm 10mm;
            }
            *, *::before, *::after {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
              color: #111827;
              background: #ffffff;
              margin: 0;
              padding: 0;
              font-size: 11px;
              line-height: 1.4;
            }
            /* KOP SURAT RESMI */
            .kop-container {
              display: flex;
              align-items: center;
              gap: 18px;
              border-bottom: 4px double #000000;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .kop-logo {
              width: 75px;
              height: 75px;
              object-fit: contain;
              flex-shrink: 0;
            }
            .kop-logo-placeholder {
              width: 70px;
              height: 70px;
              border: 2px dashed #9ca3af;
              border-radius: 6px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              font-size: 9px;
              font-weight: bold;
              color: #9ca3af;
              flex-shrink: 0;
              text-align: center;
            }
            .kop-text {
              flex: 1;
              text-align: center;
            }
            .kop-instansi {
              font-size: 10px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #374151;
              margin: 0;
            }
            .kop-dinas {
              font-size: 12px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #1f2937;
              margin: 2px 0;
            }
            .kop-sekolah {
              font-size: 18px;
              font-weight: 900;
              text-transform: uppercase;
              color: #000000;
              margin: 3px 0;
              letter-spacing: -0.2px;
            }
            .kop-alamat {
              font-size: 10px;
              color: #4b5563;
              margin: 2px 0 0 0;
            }
            .kop-spacer {
              width: 75px;
              flex-shrink: 0;
            }
            /* JUDUL */
            .judul-container {
              text-align: center;
              margin-bottom: 16px;
            }
            .judul-utama {
              font-size: 14px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              text-decoration: underline;
              text-underline-offset: 4px;
              margin: 0;
            }
            .judul-sub {
              font-size: 11px;
              font-weight: 600;
              color: #4b5563;
              margin: 4px 0 0 0;
            }
            .judul-tanpa-kop {
              text-align: center;
              border-bottom: 2px solid #374151;
              padding-bottom: 10px;
              margin-bottom: 16px;
            }
            /* IDENTITAS */
            .identitas-grid {
              display: flex;
              justify-content: space-between;
              background-color: #f8fafc !important;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 10px 14px;
              margin-bottom: 14px;
              font-size: 10.5px;
              font-weight: 600;
            }
            .identitas-col {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            /* TABEL HASIL */
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 14px;
              page-break-inside: auto;
            }
            thead {
              display: table-header-group;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            th, td {
              border: 1px solid #4b5563;
              padding: 6px 8px;
              font-size: 10px;
            }
            th {
              background-color: #f3f4f6 !important;
              font-weight: bold;
              color: #111827;
              text-align: center;
            }
            td.text-center { text-align: center; }
            td.text-left { text-align: left; }
            td.text-right { text-align: right; }
            .badge-tuntas {
              color: #166534 !important;
              font-weight: 900;
            }
            .badge-remidial {
              color: #991b1b !important;
              font-weight: 900;
            }
            /* STATISTIK */
            .stats-container {
              display: flex;
              border: 1px solid #cbd5e1;
              background-color: #f8fafc !important;
              border-radius: 6px;
              padding: 8px 12px;
              margin-bottom: 20px;
              font-size: 10.5px;
              font-weight: 600;
              justify-content: space-around;
              text-align: center;
            }
            .stats-item span {
              font-weight: 900;
            }
            /* TANDA TANGAN */
            .ttd-container {
              display: flex;
              justify-content: space-between;
              page-break-inside: avoid;
              margin-top: 24px;
              font-size: 11px;
              font-weight: 600;
            }
            .ttd-box {
              width: 45%;
              text-align: center;
            }
            .ttd-space {
              height: 65px;
            }
            .ttd-nama {
              font-weight: 900;
              text-decoration: underline;
              text-transform: uppercase;
              margin: 0;
            }
            .ttd-nip {
              color: #4b5563;
              margin: 2px 0 0 0;
              font-size: 10px;
            }
            /* UTILITY FALLBACKS FOR PRINT */
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .font-extrabold { font-weight: 800; }
            .font-black { font-weight: 900; }
            .uppercase { text-transform: uppercase; }
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .text-xs { font-size: 10px; }
            .text-sm { font-size: 11px; }
            .text-base { font-size: 13px; }
            .text-lg { font-size: 15px; }
            .text-xl { font-size: 17px; }
            .text-gray-500, .text-slate-500 { color: #6b7280; }
            .text-gray-600, .text-slate-600 { color: #4b5563; }
            .text-gray-700, .text-slate-700 { color: #374151; }
            .text-gray-800, .text-slate-800 { color: #1f2937; }
            .text-gray-900, .text-slate-900 { color: #111827; }
            .text-green-700 { color: #15803d; }
            .text-red-600 { color: #dc2626; }
            .border-collapse { border-collapse: collapse; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    const triggerPrint = () => {
      setIsPrinting(false);
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Gagal cetak iframe, fallback:', err);
        window.print();
      }
    };

    const images = doc.getElementsByTagName('img');
    if (images.length > 0) {
      let loaded = 0;
      for (let i = 0; i < images.length; i++) {
        if (images[i].complete) {
          loaded++;
        } else {
          images[i].onload = () => {
            loaded++;
            if (loaded === images.length) setTimeout(triggerPrint, 150);
          };
          images[i].onerror = () => {
            loaded++;
            if (loaded === images.length) setTimeout(triggerPrint, 150);
          };
        }
      }
      if (loaded === images.length) {
        setTimeout(triggerPrint, 250);
      }
    } else {
      setTimeout(triggerPrint, 250);
    }
  };

  // Tangani shortcut Ctrl+P / Cmd+P saat modal cetak terbuka
  useEffect(() => {
    if (!modalPrintPDF) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrintPDF();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalPrintPDF, handlePrintPDF]);

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

  const filteredHasil = (() => {
    const filtered = hasil.filter(h =>
      h.users?.nama?.toLowerCase().includes(search.toLowerCase())
    );
    if (!sortConfig) return filtered;

    return [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortConfig.key === 'nama') {
        aVal = a.users?.nama?.toLowerCase() || '';
        bVal = b.users?.nama?.toLowerCase() || '';
      } else if (sortConfig.key === 'kelas') {
        aVal = kelasList.find((k: any) => k.id === a.users?.kelas_id)?.nama_kelas?.toLowerCase() || '';
        bVal = kelasList.find((k: any) => k.id === b.users?.kelas_id)?.nama_kelas?.toLowerCase() || '';
      } else if (sortConfig.key === 'paket') {
        aVal = a.paket?.nama_paket?.toLowerCase() || '';
        bVal = b.paket?.nama_paket?.toLowerCase() || '';
      } else if (sortConfig.key === 'skor') {
        aVal = a.skor_akhir ?? 0;
        bVal = b.skor_akhir ?? 0;
      } else if (sortConfig.key === 'cheat') {
        aVal = a.cheat_count ?? 0;
        bVal = b.cheat_count ?? 0;
      } else if (sortConfig.key === 'status') {
        aVal = a.status_koreksi || '';
        bVal = b.status_koreksi || '';
      } else {
        return 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  })();

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortConfig?.key !== col) return <ArrowUpDown size={13} className="text-gray-400 ml-1 inline" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={13} className="text-indigo-600 ml-1 inline" />
      : <ArrowDown size={13} className="text-indigo-600 ml-1 inline" />;
  };

  const handleToggleSelect = (id: string) => {
    setSelectedHasilIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedHasilIds.length === filteredHasil.length) {
      setSelectedHasilIds([]);
    } else {
      setSelectedHasilIds(filteredHasil.map(h => h.id));
    }
  };

  const handleBulkUpdateStatus = async (newStatus: 'Selesai' | 'Menunggu Koreksi') => {
    if (selectedHasilIds.length === 0) return;
    setIsUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('hasil')
        .update({ status_koreksi: newStatus })
        .in('id', selectedHasilIds);

      if (error) {
        alert('Gagal memperbarui status: ' + error.message);
      } else {
        setHasil(prev => prev.map(h => selectedHasilIds.includes(h.id) ? { ...h, status_koreksi: newStatus } : h));
        setSelectedHasilIds([]);
      }
    } catch(err: any) {
      alert('Terjadi kesalahan: ' + err.message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSingleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Selesai' ? 'Menunggu Koreksi' : 'Selesai';
    try {
      const { error } = await supabase
        .from('hasil')
        .update({ status_koreksi: nextStatus })
        .eq('id', id);

      if (error) {
        alert('Gagal mengubah status: ' + error.message);
      } else {
        setHasil(prev => prev.map(h => h.id === id ? { ...h, status_koreksi: nextStatus } : h));
      }
    } catch(err: any) {
      alert('Terjadi kesalahan: ' + err.message);
    }
  };

  const handleKoreksiAI = async (engine = koreksiAiEngine) => {
    if (selectedPaket === 'ALL') {
      return alert('Pilih satu paket spesifik terlebih dahulu untuk dikoreksi otomatis.');
    }
    
    setIsAILoading(true);
    setShowKoreksiPaketModal(false);
    try {
      const body: any = { paket_id: selectedPaket, provider: engine };
      // Jika ada siswa yang dipilih, kirim ID mereka saja
      if (selectedHasilIds.length > 0) {
        body.hasil_ids = selectedHasilIds;
      }

      const res = await fetch('/api/gemini/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (data.error === 'API_KEY_MISSING') {
          alert('API Key AI (Groq AI atau Google Gemini) belum diatur! Silakan atur di menu Pengaturan terlebih dahulu.');
        } else {
          alert('Gagal koreksi AI: ' + data.error);
        }
      } else {
        alert(`🎉 Berhasil! AI telah mengoreksi ${data.updated} butir soal essay/isian pada paket ini.`);
        fetchHasil(); // Refresh data
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi saat memanggil AI.');
    }
    setIsAILoading(false);
  };

  const [isAILoadingSiswa, setIsAILoadingSiswa] = useState(false);

  const handleKoreksiAISiswa = async (engine = koreksiSiswaAiEngine) => {
    if (!modalKoreksi.data) return;
    setIsAILoadingSiswa(true);
    try {
      const res = await fetch('/api/gemini/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasil_id: modalKoreksi.data.id, provider: engine })
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'API_KEY_MISSING') {
          alert('API Key AI (Groq AI atau Google Gemini) belum diatur di menu Pengaturan!');
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
        alert(`🎉 Berhasil! AI telah mengoreksi ${data.updated} butir soal essay/isian untuk siswa ini. Skor otomatis telah terisi.`);
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
    const namaPaket = hasilRow.paket?.nama_paket || 'paket ini';
    if (!confirm(`Yakin ingin mereset hasil ujian "${namaPaket}" untuk siswa ${hasilRow.users?.nama}?\n\n• Hanya nilai paket "${namaPaket}" yang akan dihapus agar siswa dapat mengulang.\n• Nilai ujian paket mata pelajaran lain TETAP AMAN dan tidak akan terhapus.`)) return;

    try {
      await supabase.from('hasil').delete().eq('id', hasilRow.id);
      await supabase.from('users').update({ 
        status_ujian: 'Belum Ujian', 
        status_login: '0',
        paket_aktif_id: null,
        jawaban_sementara: {},
        sisa_waktu: null
      }).eq('id', hasilRow.user_id);
      
      alert(`✅ Hasil ujian paket "${namaPaket}" untuk siswa ${hasilRow.users?.nama} berhasil direset! Siswa dapat mengulang ujian paket ini.`);
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
              onClick={() => setShowKoreksiPaketModal(true)}
              disabled={isAILoading || selectedPaket === 'ALL'}
              className="flex-1 md:flex-none bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded font-bold flex items-center justify-center gap-2 transition shadow-md active:scale-95"
              title={selectedPaket === 'ALL' ? 'Pilih satu paket ujian terlebih dahulu untuk koreksi otomatis' : 'Koreksi Otomatis Soal Essay/Isian dengan AI'}
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
              title="Cetak Laporan Hasil Ujian / Simpan ke PDF"
            >
              <Printer size={18} /> <span className="hidden md:inline">Cetak / PDF Laporan</span>
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

        {/* Bulk Action Bar jika ada siswa yang dipilih */}
        {selectedHasilIds.length > 0 && (
          <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm mb-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <span className="bg-indigo-600 text-white text-xs font-black px-3 py-1.5 rounded-full shadow-sm">
                {selectedHasilIds.length} Siswa Dipilih
              </span>
              <span className="text-xs md:text-sm font-bold text-slate-800">
                Ubah Status Koreksi Massal:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleBulkUpdateStatus('Selesai')}
                disabled={isUpdatingStatus}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 size={16} /> Tandai Selesai
              </button>
              <button
                onClick={() => handleBulkUpdateStatus('Menunggu Koreksi')}
                disabled={isUpdatingStatus}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs md:text-sm font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                <Clock size={16} /> Tandai Menunggu Koreksi
              </button>
              <button
                onClick={handleToggleSelectAll}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs md:text-sm font-bold px-3 py-2 rounded-lg transition"
              >
                {selectedHasilIds.length === filteredHasil.length ? 'Batal Pilih Semua' : `Pilih Semua (${filteredHasil.length})`}
              </button>
              <button
                onClick={() => setSelectedHasilIds([])}
                className="text-slate-500 hover:text-slate-700 text-xs md:text-sm font-semibold px-2 py-2"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-100 text-gray-700 border-b">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input 
                    type="checkbox" 
                    checked={filteredHasil.length > 0 && selectedHasilIds.length === filteredHasil.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    title="Pilih Semua Siswa"
                  />
                </th>
                <th className="p-3 font-semibold">
                  <button onClick={() => handleSort('nama')} className="flex items-center gap-0.5 hover:text-indigo-700 transition-colors font-semibold">
                    Nama Siswa<SortIcon col="nama" />
                  </button>
                </th>
                <th className="p-3 font-semibold">
                  <button onClick={() => handleSort('kelas')} className="flex items-center gap-0.5 hover:text-indigo-700 transition-colors font-semibold">
                    Kelas<SortIcon col="kelas" />
                  </button>
                </th>
                <th className="p-3 font-semibold">
                  <button onClick={() => handleSort('paket')} className="flex items-center gap-0.5 hover:text-indigo-700 transition-colors font-semibold">
                    Paket Ujian<SortIcon col="paket" />
                  </button>
                </th>
                <th className="p-3 font-semibold text-center">
                  <button onClick={() => handleSort('skor')} className="flex items-center gap-0.5 hover:text-indigo-700 transition-colors font-semibold mx-auto">
                    Nilai (Skor Akhir)<SortIcon col="skor" />
                  </button>
                </th>
                <th className="p-3 font-semibold text-center">
                  <button onClick={() => handleSort('cheat')} className="flex items-center gap-0.5 hover:text-indigo-700 transition-colors font-semibold mx-auto">
                    Cheat Count<SortIcon col="cheat" />
                  </button>
                </th>
                <th className="p-3 font-semibold text-center">Waktu Sisa</th>
                <th className="p-3 font-semibold text-center">
                  <button onClick={() => handleSort('status')} className="flex items-center gap-0.5 hover:text-indigo-700 transition-colors font-semibold mx-auto">
                    Status Koreksi<SortIcon col="status" />
                  </button>
                </th>
                <th className="p-3 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-500 font-bold">Memuat hasil...</td></tr>
              ) : filteredHasil.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-500">Tidak ada data hasil.</td></tr>
              ) : (
                filteredHasil.map(h => (
                  <tr key={h.id} className={`border-b hover:bg-gray-50 transition-colors ${selectedHasilIds.includes(h.id) ? 'bg-indigo-50/40' : ''}`}>
                    <td className="p-3 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedHasilIds.includes(h.id)}
                        onChange={() => handleToggleSelect(h.id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
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
                       <button
                         onClick={() => handleSingleToggleStatus(h.id, h.status_koreksi)}
                         className="cursor-pointer transition-transform active:scale-95"
                         title="Klik untuk mengubah status koreksi siswa ini (Selesai / Belum)"
                       >
                         {h.status_koreksi === 'Selesai' ? (
                           <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5 shadow-sm hover:bg-emerald-200 transition">
                             <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                             Selesai
                           </span>
                         ) : (
                           <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1.5 shadow-sm hover:bg-amber-200 transition">
                             <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                             Belum
                           </span>
                         )}
                       </button>
                    </td>
                    <td className="p-3 text-center">
                       <div className="flex items-center justify-center gap-2">
                         <button 
                           onClick={() => openKoreksi(h)} 
                           className={`text-sm px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                             h.status_koreksi !== 'Selesai'
                               ? 'bg-amber-500 hover:bg-amber-600 text-white shadow ring-2 ring-amber-300'
                               : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                           }`} 
                           title={h.status_koreksi !== 'Selesai' ? 'Koreksi Soal Essay/Isian Sekarang' : 'Koreksi Manual'}
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
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
                <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-inner">
                  <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Mesin AI:</span>
                  <select
                    value={koreksiSiswaAiEngine}
                    onChange={(e) => setKoreksiSiswaAiEngine(e.target.value as any)}
                    disabled={isAILoadingSiswa}
                    className="bg-transparent text-xs font-black text-indigo-700 outline-none cursor-pointer"
                  >
                    <option value="auto">⚡ Otomatis (Groq + Gemini)</option>
                    <option value="groq">🚀 Groq AI</option>
                    <option value="gemini">🌟 Google Gemini</option>
                  </select>
                </div>

                <button
                  onClick={() => handleKoreksiAISiswa(koreksiSiswaAiEngine)}
                  disabled={isAILoadingSiswa}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                  title="Gunakan AI yang dipilih untuk menilai seluruh jawaban essay/isian murid ini secara otomatis"
                >
                  <Sparkles size={16} className={isAILoadingSiswa ? "animate-spin" : "animate-pulse"} />
                  <span>{isAILoadingSiswa ? "Menilai..." : "✨ Koreksi AI Murid Ini"}</span>
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

      {/* Modal Cetak PDF / Laporan Hasil Ujian */}
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
                  <h3 className="font-extrabold text-lg text-slate-800">
                    Cetak Laporan Hasil Ujian {pakaiKop ? '(Kop Surat Resmi)' : '(Format Standar / Tanpa Kop)'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pratinjau cetak A4 untuk diunduh sebagai PDF atau dicetak langsung.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintPDF}
                  disabled={isPrinting}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-md transition active:scale-95 disabled:opacity-50"
                  title="Cetak Dokumen atau Simpan sebagai PDF"
                >
                  <Printer size={16} className={isPrinting ? 'animate-spin' : ''} /> 
                  {isPrinting ? 'Menyiapkan Dokumen...' : 'Cetak / Simpan PDF'}
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
              {/* Form Opsi & Kustomisasi (No Print) */}
              <div className="mb-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm no-print space-y-4">
                {/* PILIHAN FORMAT: KOP RESMI VS TANPA KOP */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-indigo-600" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Pilihan Tampilan Dokumen</h4>
                      <p className="text-xs text-slate-500">Tentukan apakah ingin menyertakan Kop Surat & Tanda Tangan atau hanya Judul.</p>
                    </div>
                  </div>

                  <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => updateKopSettings(kopSettings, true)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        pakaiKop 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <CheckCircle2 size={14} className={pakaiKop ? 'inline' : 'hidden'} />
                      Pakai Kop Resmi (Lengkap)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateKopSettings(kopSettings, false)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        !pakaiKop 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <CheckCircle2 size={14} className={!pakaiKop ? 'inline' : 'hidden'} />
                      Tanpa Kop Resmi (Hanya Judul)
                    </button>
                  </div>
                </div>

                {/* FORM KUSTOMISASI: JIKA PAKAI KOP RESMI */}
                {pakaiKop ? (
                  <div className="space-y-4">
                    {/* Baris 1: Logo & Info Sekolah */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                      {/* Upload / Ganti Logo */}
                      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex flex-col items-center justify-center text-center">
                        <label className="text-[11px] font-bold text-slate-600 uppercase mb-2">Logo Resmi Sekolah</label>
                        <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden mb-2 shadow-sm">
                          {kopSettings.logoUrl ? (
                            <img src={kopSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                          ) : (
                            <ImageIcon size={24} className="text-slate-400" />
                          )}
                        </div>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleUploadLogo} 
                          accept="image/*" 
                          className="hidden" 
                        />
                        <div className="flex gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold py-1 px-2 rounded-lg flex items-center justify-center gap-1 transition"
                          >
                            <Upload size={12} /> {kopSettings.logoUrl ? 'Ganti' : 'Upload'}
                          </button>
                          {kopSettings.logoUrl && (
                            <button
                              type="button"
                              onClick={handleHapusLogo}
                              className="bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-bold py-1 px-2 rounded-lg transition"
                              title="Hapus Logo"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Nama Lembaga, Dinas, Alamat */}
                      <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Nama Lembaga / Sekolah</label>
                          <input 
                            type="text" 
                            value={kopSettings.namaSekolah} 
                            onChange={e => updateKopSettings({...kopSettings, namaSekolah: e.target.value})}
                            className="w-full border rounded-lg p-2 font-semibold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Dinas / Kementerian</label>
                          <input 
                            type="text" 
                            value={kopSettings.dinas} 
                            onChange={e => updateKopSettings({...kopSettings, dinas: e.target.value})}
                            className="w-full border rounded-lg p-2 font-semibold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Instansi Induk (Atas)</label>
                          <input 
                            type="text" 
                            value={kopSettings.instansiAtas} 
                            onChange={e => updateKopSettings({...kopSettings, instansiAtas: e.target.value})}
                            className="w-full border rounded-lg p-2 font-semibold text-slate-800"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-slate-600 font-bold mb-1">Alamat Lembaga & Kontak</label>
                          <input 
                            type="text" 
                            value={kopSettings.alamat} 
                            onChange={e => updateKopSettings({...kopSettings, alamat: e.target.value})}
                            className="w-full border rounded-lg p-2 font-semibold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-600 font-bold mb-1">Kota & Tanggal Cetak</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={kopSettings.kota} 
                              onChange={e => updateKopSettings({...kopSettings, kota: e.target.value})}
                              className="w-1/2 border rounded-lg p-2 font-semibold text-slate-800"
                              placeholder="Kota"
                            />
                            <input 
                              type="text" 
                              value={kopSettings.tanggalCetak} 
                              onChange={e => updateKopSettings({...kopSettings, tanggalCetak: e.target.value})}
                              className="w-1/2 border rounded-lg p-2 font-semibold text-slate-800"
                              placeholder="Tanggal"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Baris 2: Kepala Sekolah & Guru Pengampu (Penandatangan) */}
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Nama Kepala Sekolah</label>
                        <input 
                          type="text" 
                          value={kopSettings.kepalaSekolah} 
                          onChange={e => updateKopSettings({...kopSettings, kepalaSekolah: e.target.value})}
                          className="w-full border rounded-lg p-2 font-semibold text-slate-800 bg-white"
                          placeholder="Nama & Gelar"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">NIP Kepala Sekolah</label>
                        <input 
                          type="text" 
                          value={kopSettings.nipKepala} 
                          onChange={e => updateKopSettings({...kopSettings, nipKepala: e.target.value})}
                          className="w-full border rounded-lg p-2 font-semibold text-slate-800 bg-white"
                          placeholder="Nomor Induk Pegawai"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">Nama Guru Pengampu / Proktor</label>
                        <input 
                          type="text" 
                          value={kopSettings.guruPengampu} 
                          onChange={e => updateKopSettings({...kopSettings, guruPengampu: e.target.value})}
                          className="w-full border rounded-lg p-2 font-semibold text-slate-800 bg-white"
                          placeholder="Nama & Gelar"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-bold mb-1">NIP Guru Pengampu</label>
                        <input 
                          type="text" 
                          value={kopSettings.nipGuru} 
                          onChange={e => updateKopSettings({...kopSettings, nipGuru: e.target.value})}
                          className="w-full border rounded-lg p-2 font-semibold text-slate-800 bg-white"
                          placeholder="Nomor Induk Pegawai"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* FORM JIKA TANPA KOP RESMI */
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-amber-50/50 p-3 rounded-xl border border-amber-200">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Nama Sekolah / Lembaga</label>
                      <input 
                        type="text" 
                        value={kopSettings.namaSekolah} 
                        onChange={e => updateKopSettings({...kopSettings, namaSekolah: e.target.value})}
                        className="w-full border rounded-lg p-2 font-semibold text-slate-800 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Kota & Tanggal Cetak</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={kopSettings.kota} 
                          onChange={e => updateKopSettings({...kopSettings, kota: e.target.value})}
                          className="w-1/2 border rounded-lg p-2 font-semibold text-slate-800 bg-white"
                        />
                        <input 
                          type="text" 
                          value={kopSettings.tanggalCetak} 
                          onChange={e => updateKopSettings({...kopSettings, tanggalCetak: e.target.value})}
                          className="w-1/2 border rounded-lg p-2 font-semibold text-slate-800 bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex items-center text-xs text-amber-800 font-medium">
                      ℹ️ Format Standar: Hanya menampilkan judul laporan, tanggal, tabel nilai, dan statistik. Tidak menampilkan logo dan kolom tanda tangan.
                    </div>
                  </div>
                )}
              </div>

              {/* DOKUMEN CETAK (Print Area) */}
              <div id="printKopArea" className="bg-white p-8 md:p-12 rounded-xl shadow-lg border border-slate-200 max-w-4xl mx-auto print-document text-black">
                {/* 1. KOP SURAT RESMI (HANYA DITAMPILKAN JIKA pakaiKop === true) */}
                {pakaiKop && (
                  <div className="kop-container flex items-center gap-6 border-b-4 border-double border-black pb-4 mb-6">
                    {/* Logo Sekolah */}
                    <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center">
                      {kopSettings.logoUrl ? (
                        <img src={kopSettings.logoUrl} alt="Logo Sekolah" className="kop-logo max-w-full max-h-full object-contain" />
                      ) : (
                        <div className="kop-logo-placeholder w-16 h-16 border-2 border-dashed border-gray-400 rounded-lg flex flex-col items-center justify-center text-gray-400 p-1 text-center text-[9px] font-bold">
                          <span>LOGO</span>
                          <span>SEKOLAH</span>
                        </div>
                      )}
                    </div>

                    {/* Identitas Instansi & Sekolah */}
                    <div className="kop-text flex-1 text-center">
                      <h4 className="kop-instansi text-xs font-bold uppercase tracking-wider text-gray-700">{kopSettings.instansiAtas}</h4>
                      <h3 className="kop-dinas text-sm font-bold uppercase tracking-wider text-gray-800">{kopSettings.dinas}</h3>
                      <h2 className="kop-sekolah text-xl font-black uppercase text-black tracking-tight">{kopSettings.namaSekolah}</h2>
                      <p className="kop-alamat text-xs text-gray-600 mt-1">{kopSettings.alamat}</p>
                    </div>

                    {/* Spacer agar posisi tengah simetris */}
                    <div className="kop-spacer w-20 h-20 flex-shrink-0 opacity-0 hidden sm:block"></div>
                  </div>
                )}

                {/* 2. JUDUL LAPORAN */}
                {pakaiKop ? (
                  <div className="judul-container text-center mb-6">
                    <h3 className="judul-utama text-base font-extrabold uppercase tracking-wide underline underline-offset-4">
                      LAPORAN HASIL NILAI UJIAN BERBASIS KOMPUTER (CBT)
                    </h3>
                    <p className="judul-sub text-xs font-semibold text-gray-600 mt-1">
                      TAHUN PELAJARAN {new Date().getFullYear()} / {new Date().getFullYear() + 1}
                    </p>
                  </div>
                ) : (
                  /* Format Tanpa Kop: Hanya Judul, Tanpa Logo & TTD */
                  <div className="judul-tanpa-kop text-center border-b-2 border-gray-400 pb-3 mb-6">
                    <h2 className="judul-utama text-lg font-black uppercase text-black tracking-wide">
                      LAPORAN HASIL NILAI UJIAN BERBASIS KOMPUTER (CBT)
                    </h2>
                    <p className="judul-sub text-sm font-bold text-gray-700 uppercase mt-0.5">
                      {kopSettings.namaSekolah}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      TAHUN PELAJARAN {new Date().getFullYear()} / {new Date().getFullYear() + 1}
                    </p>
                  </div>
                )}

                {/* 3. IDENTITAS UJIAN */}
                <div className="identitas-grid grid grid-cols-2 gap-4 text-xs font-semibold text-gray-800 mb-4 bg-gray-50 p-3 rounded border border-gray-200">
                  <div className="identitas-col space-y-1">
                    <div>Paket Ujian : <span className="font-bold uppercase">{selectedPaket !== 'ALL' ? paketList.find(p => p.id === selectedPaket)?.nama_paket : 'Semua Paket'}</span></div>
                    <div>Kelas : <span className="font-bold uppercase">{selectedKelas !== 'ALL' ? kelasList.find(k => k.id === selectedKelas)?.nama_kelas : 'Semua Kelas'}</span></div>
                  </div>
                  <div className="identitas-col space-y-1 text-right">
                    <div>Standar KKM : <span className="font-bold">{kopSettings.kkm}</span></div>
                    <div>Tanggal Cetak : <span className="font-bold">{kopSettings.tanggalCetak}</span></div>
                  </div>
                </div>

                {/* 4. TABEL HASIL RESMI */}
                <table className="w-full text-xs border-collapse border border-gray-400 mb-6">
                  <thead>
                    <tr className="bg-gray-100 text-center font-bold text-gray-900">
                      <th style={{ width: '35px' }}>No</th>
                      <th style={{ textAlign: 'left' }}>Nama Siswa</th>
                      <th style={{ width: '85px' }}>Kelas</th>
                      <th style={{ textAlign: 'left' }}>Paket Soal</th>
                      <th style={{ width: '60px' }}>Nilai</th>
                      <th style={{ width: '65px' }}>Pelanggaran</th>
                      <th style={{ width: '90px' }}>Status Koreksi</th>
                      <th style={{ width: '85px' }}>Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHasil.length === 0 ? (
                      <tr><td colSpan={8} className="text-center text-gray-500">Tidak ada data hasil.</td></tr>
                    ) : (
                      filteredHasil.map((h, i) => {
                        const isTuntas = h.skor_akhir >= kopSettings.kkm;
                        return (
                          <tr key={h.id} className="text-gray-800">
                            <td className="text-center">{i + 1}</td>
                            <td className="text-left font-bold">{h.users?.nama || '-'}</td>
                            <td className="text-center">{kelasList.find(k => k.id === h.users?.kelas_id)?.nama_kelas || '-'}</td>
                            <td className="text-left">{h.paket?.nama_paket || '-'}</td>
                            <td className="text-center font-bold">{h.skor_akhir}</td>
                            <td className="text-center">{h.cheat_count > 0 ? `${h.cheat_count}x` : '0'}</td>
                            <td className="text-center">{h.status_koreksi}</td>
                            <td className={`text-center font-bold ${isTuntas ? 'badge-tuntas text-green-700' : 'badge-remidial text-red-600'}`}>
                              {isTuntas ? 'TUNTAS' : 'REMIDIAL'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* 5. STATISTIK RINGKASAN */}
                <div className="stats-container grid grid-cols-4 gap-2 text-xs border border-gray-300 p-3 rounded mb-8 bg-gray-50 text-center font-semibold">
                  <div className="stats-item">Total Peserta: <span className="font-bold">{filteredHasil.length}</span></div>
                  <div className="stats-item">Rata-rata Nilai: <span className="font-bold">{(filteredHasil.reduce((a, b) => a + (Number(b.skor_akhir) || 0), 0) / (filteredHasil.length || 1)).toFixed(1)}</span></div>
                  <div className="stats-item">Nilai Tertinggi: <span className="font-bold">{filteredHasil.length > 0 ? Math.max(...filteredHasil.map(h => Number(h.skor_akhir) || 0)) : 0}</span></div>
                  <div className="stats-item">Nilai Terendah: <span className="font-bold">{filteredHasil.length > 0 ? Math.min(...filteredHasil.map(h => Number(h.skor_akhir) || 0)) : 0}</span></div>
                </div>

                {/* 6. KOLOM TANDA TANGAN (HANYA JIKA pakaiKop === true) */}
                {pakaiKop && (
                  <div className="ttd-container grid grid-cols-2 text-xs font-semibold text-gray-900 pt-4">
                    <div className="ttd-box text-center">
                      <p>Mengetahui,</p>
                      <p className="font-bold">Kepala Sekolah / Penanggung Jawab CBT</p>
                      <div className="ttd-space h-20"></div>
                      <p className="ttd-nama font-bold underline uppercase">{kopSettings.kepalaSekolah}</p>
                      <p className="ttd-nip text-gray-600">{kopSettings.nipKepala ? `NIP. ${kopSettings.nipKepala}` : '-'}</p>
                    </div>
                    <div className="ttd-box text-center">
                      <p>{kopSettings.kota}, {kopSettings.tanggalCetak}</p>
                      <p className="font-bold">Guru Pengampu / Proktor CBT</p>
                      <div className="ttd-space h-20"></div>
                      <p className="ttd-nama font-bold underline uppercase">{kopSettings.guruPengampu}</p>
                      <p className="ttd-nip text-gray-600">{kopSettings.nipGuru ? `NIP. ${kopSettings.nipGuru}` : '-'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* MODAL PILIH MESIN AI UNTUK KOREKSI PAKET */}
      {showKoreksiPaketModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border-t-4 border-purple-600 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                <Sparkles className="text-purple-600" /> Koreksi Essay Otomatis AI
              </h3>
              <button 
                onClick={() => setShowKoreksiPaketModal(false)}
                className="text-slate-400 hover:text-red-500 transition-colors font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              AI akan menilai seluruh jawaban essay/isian siswa pada paket <strong>{paketList.find(p => p.id === selectedPaket)?.nama_paket || 'yang dipilih'}</strong> secara otomatis dan proporsional.
            </p>

            {/* Peringatan Seleksi Siswa */}
            {selectedHasilIds.length === 0 ? (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-xl p-3.5 mb-4">
                <span className="text-amber-500 text-lg mt-0.5 shrink-0">⚠️</span>
                <div>
                  <p className="text-xs font-bold text-amber-800 mb-0.5">Belum ada siswa yang ditandai!</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    AI akan mengkoreksi <strong>seluruh siswa</strong> pada paket ini. Jika ingin mengkoreksi siswa tertentu saja, tutup modal ini lalu <strong>centang siswa yang diinginkan</strong> pada tabel terlebih dahulu.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 mb-4">
                <span className="text-indigo-500 text-lg mt-0.5 shrink-0">✅</span>
                <div>
                  <p className="text-xs font-bold text-indigo-800 mb-0.5">{selectedHasilIds.length} siswa siap dikoreksi</p>
                  <p className="text-[11px] text-indigo-700 leading-relaxed">
                    AI hanya akan mengkoreksi <strong>{selectedHasilIds.length} siswa yang sudah Anda tandai</strong> sebelumnya.
                  </p>
                </div>
              </div>
            )}

            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Pilih Mesin AI yang Digunakan:
              </label>
              <div className="space-y-2">
                {[
                  { id: 'auto', label: '⚡ Otomatis (Rekomendasi)', desc: 'Groq super cepat + Google Gemini cadangan otomatis' },
                  { id: 'groq', label: '🚀 Groq AI Saja', desc: 'Pemrosesan super kilat (~1-2 detik)' },
                  { id: 'gemini', label: '🌟 Google Gemini Saja', desc: 'Analisis mendalam & bahasa alami akurat' },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    onClick={() => setKoreksiAiEngine(opt.id as any)}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      koreksiAiEngine === opt.id
                        ? 'border-purple-600 bg-purple-50/70 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="koreksi_engine"
                      checked={koreksiAiEngine === opt.id}
                      onChange={() => setKoreksiAiEngine(opt.id as any)}
                      className="mt-0.5 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <div className="font-bold text-xs text-slate-800">{opt.label}</div>
                      <div className="text-[11px] text-slate-500">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowKoreksiPaketModal(false)}
                disabled={isAILoading}
                className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-lg text-xs transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => handleKoreksiAI(koreksiAiEngine)}
                disabled={isAILoading}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md text-xs flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                <Sparkles size={14} className={isAILoading ? 'animate-spin' : ''} />
                {isAILoading ? 'Sedang Mengoreksi...' : 'Mulai Koreksi Sekarang'}
              </button>
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
