'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { UserPlus, Search, Edit, Trash2, Plus, Users, BookOpen, Sparkles, Camera, Upload, Check, AlertCircle, RefreshCw, X, KeyRound, ArrowRight, CheckCircle2, Printer, CreditCard, Eye, EyeOff, SlidersHorizontal, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';

export default function KelolaSiswaPage() {
  const [siswa, setSiswa] = useState<any[]>([]);
  const [kelas, setKelas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // State Input Kelas
  const [namaKelas, setNamaKelas] = useState('');
  
  // State Input Siswa Single
  const [sUsername, setSUsername] = useState('');
  const [sPassword, setSPassword] = useState('');
  const [sNama, setSNama] = useState('');
  const [sKelasId, setSKelasId] = useState('');

  // State Input Bulk & Mode
  const [inputMode, setInputMode] = useState<'single' | 'bulk' | 'ai'>('single');
  const [bulkData, setBulkData] = useState('');

  // State Input AI Vision Scan (Google Gemini Only)
  const [aiImageBase64, setAiImageBase64] = useState<string>('');
  const [aiImageFileName, setAiImageFileName] = useState<string>('');
  const [aiPrefix, setAiPrefix] = useState('peserta');
  const [aiStartNumber, setAiStartNumber] = useState(1);
  const [aiDefaultPassword, setAiDefaultPassword] = useState('123456');
  const [aiUsernameMode, setAiUsernameMode] = useState<'peserta' | 'nisn'>('peserta');
  const [aiKelasId, setAiKelasId] = useState('');
  const [isScanningAi, setIsScanningAi] = useState(false);
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [scannedStudents, setScannedStudents] = useState<Array<{
    nama: string;
    nisn: string;
    username: string;
    password: string;
  }>>([]);
  const [aiError, setAiError] = useState('');
  const [bulkPasswordEdit, setBulkPasswordEdit] = useState('123456');

  const [isDemo, setIsDemo] = useState(false);

  // State Foto Siswa (Opsional)
  const [fotoSiswaMap, setFotoSiswaMap] = useState<Record<string, string>>({});
  const [sFotoBase64, setSFotoBase64] = useState<string>('');
  const [modalFotoSiswa, setModalFotoSiswa] = useState<{ isOpen: boolean; siswa: any | null; tempFoto: string }>({
    isOpen: false,
    siswa: null,
    tempFoto: ''
  });
  const [isSavingFoto, setIsSavingFoto] = useState(false);

  // Helper Kompresi Foto Siswa (Pas Foto 2x3 Ringan & Tajam)
  const compressImage = (file: File, maxWidth = 240, maxHeight = 320): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new (window as any).Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // State Cetak Kartu Peserta Ujian (Format 8 Kartu per A4)
  const [modalKartu, setModalKartu] = useState(false);
  const [appLogo, setAppLogo] = useState('/logo.png');
  const [appNama, setAppNama] = useState('CBT B-TEK');
  const [filterKelasKartu, setFilterKelasKartu] = useState('ALL');
  const [searchKartu, setSearchKartu] = useState('');
  const [showConfigKartu, setShowConfigKartu] = useState(false);
  const [kartuConfig, setKartuConfig] = useState({
    namaSekolah: 'SMK / SMA / SMP CBT B-TEK',
    judulUjian: 'KARTU PESERTA ASESMEN SUMATIF',
    subJudul: 'TAHUN AJARAN 2025/2026',
    ruangSesi: 'Sesi 1 / Lab CBT',
    namaPenandatangan: 'Ketua Panitia Ujian',
    nipPenandatangan: '19820515 200801 1 005',
    kotaTanggal: `Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    tampilkanPassword: true,
    catatanBawah: '*Bawa kartu ini selama ujian & jaga kerahasiaan login.',
    customLogoUrl: ''
  });

  useEffect(() => {
    fetchData();
    const savedUser = localStorage.getItem('cbt_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setIsDemo(user?.username?.startsWith('demo_admin_'));
    }

    // Muat cache foto siswa
    try {
      const cachedFoto = localStorage.getItem('cbt_foto_siswa_map');
      if (cachedFoto) setFotoSiswaMap(JSON.parse(cachedFoto));
    } catch (e) {
      console.error(e);
    }

    // Muat preferensi kartu peserta jika ada
    try {
      const savedKartuConfig = localStorage.getItem('cbt_kartu_config');
      if (savedKartuConfig) {
        setKartuConfig(prev => ({ ...prev, ...JSON.parse(savedKartuConfig) }));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch Kelas
    let { data: dataKelas } = await supabase.from('kelas').select('*').order('nama_kelas');
    dataKelas = filterDemoData(dataKelas, 'kelas');
    if (dataKelas) setKelas(dataKelas);
    
    // Fetch Siswa
    let { data: dataSiswa } = await supabase
      .from('users')
      .select('*, kelas(nama_kelas)')
      .eq('role', 'siswa')
      .order('nama');
      
    dataSiswa = filterDemoData(dataSiswa, 'siswa');
    if (dataSiswa) setSiswa(dataSiswa);

    // Fetch Pengaturan Logo, Nama Sekolah, dan Foto Siswa
    try {
      const { data: dataSetting } = await supabase.from('pengaturan').select('*');
      if (dataSetting) {
        const settingObj: Record<string, string> = {};
        const fotoMap: Record<string, string> = {};
        dataSetting.forEach(item => {
          settingObj[item.kunci] = item.nilai;
          if (item.kunci?.startsWith('foto_siswa_')) {
            const studentId = item.kunci.replace('foto_siswa_', '');
            fotoMap[studentId] = item.nilai;
          }
        });
        if (settingObj.logo_aplikasi) setAppLogo(settingObj.logo_aplikasi);
        if (settingObj.nama_aplikasi) {
          setAppNama(settingObj.nama_aplikasi);
          setKartuConfig(prev => ({
            ...prev,
            namaSekolah: prev.namaSekolah === 'SMK / SMA / SMP CBT B-TEK' ? settingObj.nama_aplikasi : prev.namaSekolah
          }));
        }
        setFotoSiswaMap(fotoMap);
        localStorage.setItem('cbt_foto_siswa_map', JSON.stringify(fotoMap));
      }
    } catch (e) {
      console.error('Gagal mengambil pengaturan/foto siswa:', e);
    }
      
    setIsLoading(false);
  };

  const simpanKelas = async () => {
    if (isDemo) { alert('Fitur dinonaktifkan untuk Akun Demo.'); return; }
    if (!namaKelas) {
      alert('Nama kelas tidak boleh kosong');
      return;
    }
    const { error } = await supabase.from('kelas').insert({ nama_kelas: namaKelas.toUpperCase() });
    if (error) {
      alert('Gagal menyimpan kelas (Mungkin nama kelas sudah ada).');
    } else {
      setNamaKelas('');
      fetchData();
    }
  };

  const hapusKelas = async (id: string) => {
    if (isDemo) { alert('Fitur dinonaktifkan untuk Akun Demo.'); return; }
    if (!confirm('Hapus kelas ini? Siswa yang terhubung akan kehilangan data kelas.')) return;
    await supabase.from('kelas').delete().eq('id', id);
    fetchData();
  };

  const simpanSiswaSingle = async () => {
    if (isDemo) { alert('Fitur dinonaktifkan untuk Akun Demo.'); return; }
    if (!sUsername || !sPassword || !sNama || !sKelasId) {
      alert('Lengkapi semua data siswa!');
      return;
    }

    const { data: newSiswa, error } = await supabase.from('users').insert({
      username: sUsername,
      password: sPassword,
      nama: sNama,
      kelas_id: sKelasId,
      role: 'siswa'
    }).select().single();

    if (error) {
      alert('Gagal menyimpan siswa. Pastikan username belum dipakai.');
    } else {
      // Simpan foto siswa jika ada yang diupload
      if (sFotoBase64 && newSiswa?.id) {
        await supabase.from('pengaturan').upsert({
          kunci: `foto_siswa_${newSiswa.id}`,
          nilai: sFotoBase64
        });
        setFotoSiswaMap(prev => {
          const next = { ...prev, [newSiswa.id]: sFotoBase64 };
          localStorage.setItem('cbt_foto_siswa_map', JSON.stringify(next));
          return next;
        });
      }
      alert('Siswa berhasil ditambahkan!');
      setSUsername(''); setSPassword(''); setSNama(''); setSKelasId(''); setSFotoBase64('');
      fetchData();
    }
  };

  const handleSaveFotoModal = async () => {
    if (!modalFotoSiswa.siswa) return;
    setIsSavingFoto(true);
    const sId = modalFotoSiswa.siswa.id;
    try {
      if (modalFotoSiswa.tempFoto) {
        await supabase.from('pengaturan').upsert({
          kunci: `foto_siswa_${sId}`,
          nilai: modalFotoSiswa.tempFoto
        });
        setFotoSiswaMap(prev => {
          const next = { ...prev, [sId]: modalFotoSiswa.tempFoto };
          localStorage.setItem('cbt_foto_siswa_map', JSON.stringify(next));
          return next;
        });
        alert('Foto siswa berhasil disimpan!');
      } else {
        await supabase.from('pengaturan').delete().eq('kunci', `foto_siswa_${sId}`);
        setFotoSiswaMap(prev => {
          const next = { ...prev };
          delete next[sId];
          localStorage.setItem('cbt_foto_siswa_map', JSON.stringify(next));
          return next;
        });
        alert('Foto siswa berhasil dihapus.');
      }
      setModalFotoSiswa({ isOpen: false, siswa: null, tempFoto: '' });
    } catch (e: any) {
      alert(e.message || 'Gagal menyimpan foto siswa.');
    } finally {
      setIsSavingFoto(false);
    }
  };

  const simpanSiswaBulk = async () => {
    if (isDemo) { alert('Fitur dinonaktifkan untuk Akun Demo.'); return; }
    if (!bulkData.trim()) {
      alert('Data massal kosong!');
      return;
    }

    const barisData = bulkData.split('\n');
    const records = [];
    
    for (let baris of barisData) {
      if (!baris.trim()) continue;
      const [usr, pwd, nama, namaKls] = baris.split(',');
      
      if (!usr || !pwd || !nama || !namaKls) {
         alert(`Format salah pada baris: ${baris}. Format yang benar: username,password,nama,namakelas`);
         return;
      }
      
      // Cari ID kelas berdasarkan nama (case insensitive)
      let idKelas = kelas.find(k => k.nama_kelas.toLowerCase() === namaKls.trim().toLowerCase())?.id;
      
      // Jika kelas belum ada, buat kelas baru
      if (!idKelas) {
        const { data: newKelas, error: errKls } = await supabase.from('kelas').insert({ nama_kelas: namaKls.trim().toUpperCase() }).select().single();
        if (!errKls && newKelas) {
           idKelas = newKelas.id;
           setKelas(prev => [...prev, newKelas]);
        } else {
           alert(`Gagal membuat kelas baru: ${namaKls}`);
           return;
        }
      }

      records.push({
        username: usr.trim(),
        password: pwd.trim(),
        nama: nama.trim(),
        kelas_id: idKelas,
        role: 'siswa'
      });
    }

    const { error } = await supabase.from('users').insert(records);
    if (error) {
      alert('Gagal menginput massal. Pastikan tidak ada username duplikat.');
    } else {
      alert(`${records.length} siswa berhasil diinput!`);
      setBulkData('');
      fetchData();
    }
  };

  const hapusSiswa = async (id: string) => {
    if (isDemo) { alert('Fitur dinonaktifkan untuk Akun Demo.'); return; }
    if (!confirm('Hapus siswa ini? Semua hasil ujiannya juga akan terhapus.')) return;
    await supabase.from('users').delete().eq('id', id);
    fetchData();
  };

  const handleResetLogin = async (id: string) => {
    if (isDemo) { alert('Fitur dinonaktifkan untuk Akun Demo.'); return; }
    if (!confirm('Reset status login siswa ini?')) return;
    await supabase.from('users').update({ status_login: '0' }).eq('id', id);
    fetchData();
    alert('Status login berhasil direset.');
  };

  // Handler AI Vision Scan (Gemini Only)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Harap unggah file gambar (JPG, PNG, atau WEBP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Ukuran file maksimal 10MB.');
      return;
    }

    setAiImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAiImageBase64(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleScanAi = async () => {
    if (isDemo) { alert('Fitur dinonaktifkan untuk Akun Demo.'); return; }
    if (!aiImageBase64) {
      alert('Harap pilih atau foto dokumen absensi terlebih dahulu!');
      return;
    }
    if (!aiKelasId) {
      alert('Harap pilih kelas tujuan terlebih dahulu!');
      return;
    }

    setIsScanningAi(true);
    setAiError('');

    try {
      const res = await fetch('/api/gemini/ocr-siswa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: aiImageBase64,
          prefix: aiPrefix || 'peserta',
          startNumber: aiStartNumber || 1,
          defaultPassword: aiDefaultPassword || '123456',
          usernameMode: aiUsernameMode
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memindai foto dengan Gemini AI.');
      }

      if (!data.siswa || data.siswa.length === 0) {
        throw new Error('Tidak ada data siswa yang berhasil dideteksi.');
      }

      setScannedStudents(data.siswa);
      setBulkPasswordEdit(aiDefaultPassword || '123456');
    } catch (err: any) {
      setAiError(err.message || 'Terjadi kesalahan saat memindai.');
    } finally {
      setIsScanningAi(false);
    }
  };

  const updateScannedStudent = (index: number, field: string, value: string) => {
    setScannedStudents(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeScannedStudent = (index: number) => {
    setScannedStudents(prev => prev.filter((_, i) => i !== index));
  };

  const addEmptyScannedStudent = () => {
    const nextNum = (aiStartNumber || 1) + scannedStudents.length;
    const padLength = Math.max(2, String(nextNum).length);
    setScannedStudents(prev => [
      ...prev,
      {
        nama: '',
        nisn: '',
        username: `${aiPrefix || 'peserta'}${String(nextNum).padStart(padLength, '0')}`,
        password: bulkPasswordEdit || aiDefaultPassword || '123456'
      }
    ]);
  };

  const applyBulkPassword = () => {
    if (!bulkPasswordEdit.trim()) {
      alert('Masukkan password baru terlebih dahulu.');
      return;
    }
    setScannedStudents(prev =>
      prev.map(s => ({ ...s, password: bulkPasswordEdit.trim() }))
    );
  };

  const resetAiScan = () => {
    setScannedStudents([]);
    setAiImageBase64('');
    setAiImageFileName('');
    setAiError('');
  };

  const simpanSiswaAi = async () => {
    if (isDemo) { alert('Fitur dinonaktifkan untuk Akun Demo.'); return; }
    if (scannedStudents.length === 0) {
      alert('Tidak ada data siswa untuk disimpan.');
      return;
    }
    if (!aiKelasId) {
      alert('Harap pilih kelas tujuan terlebih dahulu!');
      return;
    }

    // Cek kelengkapan baris
    const invalidRow = scannedStudents.findIndex(s => !s.nama.trim() || !s.username.trim() || !s.password.trim());
    if (invalidRow !== -1) {
      alert(`Baris ke-${invalidRow + 1} belum lengkap. Pastikan Nama, Username, dan Password terisi.`);
      return;
    }

    setIsSavingAi(true);
    try {
      const records = scannedStudents.map(s => ({
        username: s.username.trim(),
        password: s.password.trim(),
        nama: s.nama.trim(),
        kelas_id: aiKelasId,
        role: 'siswa'
      }));

      const { error } = await supabase.from('users').insert(records);
      if (error) {
        if (error.message?.includes('duplicate key') || error.message?.includes('users_username_key')) {
          alert('Gagal menyimpan: Ada username yang duplikat atau sudah terdaftar di database. Silakan sesuaikan username siswa.');
        } else {
          alert(`Gagal menyimpan data siswa: ${error.message}`);
        }
      } else {
        const namaKls = kelas.find(k => k.id === aiKelasId)?.nama_kelas || '';
        alert(`Berhasil mendaftarkan ${records.length} siswa ke kelas ${namaKls}!`);
        resetAiScan();
        fetchData();
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSavingAi(false);
    }
  };

  const handleCetakKartu = () => {
    const cardSheets = document.querySelectorAll('.a4-sheet-card');
    if (!cardSheets || cardSheets.length === 0) {
      alert('Tidak ada kartu yang dapat dicetak.');
      return;
    }

    // Ambil style lembar dan kartu
    let sheetsHtml = '';
    cardSheets.forEach((sheet, idx) => {
      const isLast = idx === cardSheets.length - 1;
      sheetsHtml += `
        <div class="print-single-a4" style="${isLast ? 'page-break-after: auto; break-after: auto;' : 'page-break-after: always; break-after: page;'}">
          ${sheet.innerHTML}
        </div>
      `;
    });

    // Ambil semua tag style dan link CSS halaman
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join('\n');

    let iframe = document.getElementById('iframe-cetak-kartu-cbt') as HTMLIFrameElement;
    if (iframe) {
      iframe.remove();
    }
    iframe = document.createElement('iframe');
    iframe.id = 'iframe-cetak-kartu-cbt';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${kartuConfig.judulUjian || 'Kartu Peserta Ujian'}</title>
          ${styles}
          <style>
            @page {
              size: 210mm 297mm portrait;
              margin: 4mm 5mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            .print-single-a4 {
              width: 200mm !important;
              height: 288mm !important;
              max-height: 288mm !important;
              margin: 0 auto !important;
              padding: 2mm !important;
              display: grid !important;
              grid-template-columns: repeat(2, 1fr) !important;
              grid-template-rows: repeat(4, 1fr) !important;
              gap: 3mm !important;
              box-sizing: border-box !important;
              background: #ffffff !important;
            }
            .card-unit {
              border: 1px dashed #64748b !important;
              border-radius: 6px !important;
              padding: 2.2mm 2.5mm !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              height: 100% !important;
              max-height: 68mm !important;
              box-sizing: border-box !important;
              background: #ffffff !important;
              overflow: hidden !important;
            }
          </style>
        </head>
        <body>
          ${sheetsHtml}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 450);
  };

  const filteredSiswa = siswa.filter(s => 
    s.nama?.toLowerCase().includes(search.toLowerCase()) || 
    s.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {isDemo && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm mb-6 flex items-start gap-3">
          <div className="bg-red-100 p-2 rounded-full mt-0.5 text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <div>
            <h3 className="text-red-800 font-bold text-sm">Mode Akun Demo</h3>
            <p className="text-red-600 text-xs mt-1">Akun Anda adalah akun demo. Anda tidak diizinkan untuk menambah kelas atau siswa baru, serta tidak dapat menghapus data yang ada. Fitur input disembunyikan.</p>
          </div>
        </div>
      )}
      
      {/* BAGIAN ATAS: INPUT KELAS & SISWA */}
      {!isDemo && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Kolom Kelola Kelas */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 p-6 flex flex-col">
          <h3 className="font-extrabold text-lg mb-6 text-slate-800 flex items-center gap-3 border-b border-slate-100 pb-4">
             <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><BookOpen size={20}/></div> 
             Manajemen Kelas
          </h3>
          
          <div className="flex flex-col gap-2 mb-6">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tambah Kelas Baru</label>
            <div className="flex flex-col gap-3">
              <input 
                type="text" 
                value={namaKelas}
                onChange={(e) => setNamaKelas(e.target.value)}
                className="w-full border-2 border-slate-200 p-2.5 rounded-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none uppercase font-bold text-slate-700 transition-all placeholder:font-medium placeholder:normal-case placeholder:text-slate-400" 
                placeholder="Misal: XII IPA 1" 
              />
              <button 
                onClick={simpanKelas} 
                className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95 flex justify-center items-center gap-2"
              >
                <Plus size={18} /> SIMPAN KELAS
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-64 rounded-xl border border-slate-200 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 sticky top-0 shadow-sm">
                <tr>
                  <th className="p-4 font-bold text-slate-600 border-b border-slate-200">Nama Kelas</th>
                  <th className="p-4 font-bold text-slate-600 border-b border-slate-200 w-16 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {kelas.map(k => (
                  <tr key={k.id} className="border-b border-slate-100 hover:bg-indigo-50/50 transition-colors">
                    <td className="p-4 font-black text-slate-700">{k.nama_kelas}</td>
                    <td className="p-4 text-center">
                       <button onClick={() => hapusKelas(k.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all" title="Hapus Kelas">
                         <Trash2 size={18}/>
                       </button>
                    </td>
                  </tr>
                ))}
                {kelas.length === 0 && <tr><td colSpan={2} className="p-6 text-center text-slate-400 font-medium">Belum ada data kelas</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolom Tambah Siswa */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 p-6 lg:col-span-2">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 mb-6 gap-4">
            <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><UserPlus size={20}/></div> 
              Registrasi Siswa
            </h3>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setInputMode('single')}
                className={clsx(
                  "px-3.5 py-2 rounded-xl text-xs font-bold transition-all border",
                  inputMode === 'single'
                    ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                Input Manual
              </button>
              <button
                type="button"
                onClick={() => setInputMode('bulk')}
                className={clsx(
                  "px-3.5 py-2 rounded-xl text-xs font-bold transition-all border",
                  inputMode === 'bulk'
                    ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                )}
              >
                CSV Massal
              </button>
              <button
                type="button"
                onClick={() => setInputMode('ai')}
                className={clsx(
                  "px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all border flex items-center gap-1.5 shadow-sm",
                  inputMode === 'ai'
                    ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white border-transparent shadow-indigo-500/25 ring-2 ring-indigo-400"
                    : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                )}
              >
                <Sparkles size={14} className="text-amber-300" />
                Scan Absensi (Gemini AI)
              </button>
            </div>
          </div>

          {inputMode === 'single' ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Username</label>
                  <input type="text" value={sUsername} onChange={e=>setSUsername(e.target.value)} className="w-full border-2 border-slate-200 p-3.5 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 transition-all placeholder:font-medium placeholder:text-slate-300" placeholder="Ketik Username..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                  <input type="text" value={sPassword} onChange={e=>setSPassword(e.target.value)} className="w-full border-2 border-slate-200 p-3.5 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 transition-all placeholder:font-medium placeholder:text-slate-300" placeholder="Ketik Password..." />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nama Lengkap</label>
                  <input type="text" value={sNama} onChange={e=>setSNama(e.target.value)} className="w-full border-2 border-slate-200 p-3.5 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 transition-all placeholder:font-medium placeholder:text-slate-300" placeholder="Ketik Nama Lengkap..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pilih Kelas</label>
                  <select value={sKelasId} onChange={e=>setSKelasId(e.target.value)} className="w-full border-2 border-slate-200 p-3.5 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 cursor-pointer transition-all">
                    <option value="">-- Pilih Kelas --</option>
                    {kelas.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                  </select>
                </div>
              </div>

              {/* Upload Foto Siswa (Opsional) */}
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-16 h-20 border border-slate-300 rounded-lg overflow-hidden bg-white flex items-center justify-center flex-shrink-0 shadow-sm relative group">
                  {sFotoBase64 ? (
                    <img src={sFotoBase64} alt="Preview Foto" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-300 p-1 text-center">
                      <Camera size={18} className="mb-0.5" />
                      <span className="text-[8px] font-bold">2x3</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <span className="text-xs font-bold text-slate-700">Foto Pas Siswa 2x3</span>
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold">Opsional</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Format JPG/PNG. Otomatis dikompresi & tampil pada Kartu Peserta Ujian.
                  </p>
                  
                  <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                    <label className="cursor-pointer bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 transition-all shadow-sm active:scale-95 inline-flex items-center gap-1.5">
                      <Upload size={13} />
                      <span>{sFotoBase64 ? 'Ganti Foto' : 'Pilih Foto'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const b64 = await compressImage(file);
                              setSFotoBase64(b64);
                            } catch (err) {
                              alert('Gagal memproses gambar foto.');
                            }
                          }
                        }}
                      />
                    </label>

                    {sFotoBase64 && (
                      <button
                        type="button"
                        onClick={() => setSFotoBase64('')}
                        className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded hover:bg-red-50 transition-colors"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <button onClick={simpanSiswaSingle} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.98] uppercase tracking-wider mt-2">
                Simpan Data Siswa
              </button>
            </div>
          ) : inputMode === 'bulk' ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-600 bg-amber-50 p-4 rounded-xl border border-amber-200/60 leading-relaxed shadow-sm">
                <span className="font-bold text-amber-800 uppercase text-xs mb-1 block">Petunjuk Format Massal:</span>
                Gunakan format koma per baris: <code className="font-bold bg-white px-1.5 py-0.5 rounded text-indigo-600 border border-amber-100">username,password,Nama Lengkap,Nama Kelas</code><br/>
                Contoh: <br/>
                <code className="block mt-2 font-mono bg-white p-2 rounded text-slate-700 border border-amber-100">
                  siswa01,1234,Andi Purnomo,XII IPA 1<br/>
                  siswa02,1234,Siti Aminah,XII IPS 2
                </code>
              </div>
              <textarea 
                rows={6} 
                className="w-full border-2 border-slate-200 p-4 rounded-xl font-mono text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none leading-relaxed transition-all shadow-inner bg-slate-50" 
                placeholder="Tempel data CSV di sini..."
                value={bulkData}
                onChange={e=>setBulkData(e.target.value)}
              />
              <button onClick={simpanSiswaBulk} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg shadow-slate-800/20 transition-all active:scale-[0.98] uppercase tracking-wider">
                Proses Input Massal
              </button>
            </div>
          ) : (
            /* Mode AI Vision Scan */
            <div className="space-y-5">
              {scannedStudents.length === 0 ? (
                /* Form Konfigurasi & Upload/Ambil Foto */
                <div className="space-y-5">
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 p-4 rounded-xl text-xs text-purple-900 leading-relaxed shadow-sm">
                    <div className="font-extrabold flex items-center gap-1.5 text-purple-800 text-sm mb-1">
                      <Sparkles size={16} className="text-purple-600 animate-pulse" />
                      Scan Absensi Otomatis dengan Google Gemini Vision
                    </div>
                    Cukup foto dokumen absensi atau daftar hadir kelas Anda. AI Gemini akan membaca <strong>NISN</strong> dan <strong>Nama Lengkap</strong>, lalu otomatis membuat username berurutan (<code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-indigo-700">peserta01</code>, <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-indigo-700">peserta02</code>, dst.) serta mengisi password default untuk semua siswa.
                  </div>

                  {/* Upload Box */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Unggah / Foto Lembar Absensi Siswa
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      id="ai-photo-input"
                      onChange={handleImageUpload}
                      className="hidden"
                    />

                    {!aiImageBase64 ? (
                      <label
                        htmlFor="ai-photo-input"
                        className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-indigo-100 group-hover:scale-110 text-indigo-600 flex items-center justify-center transition-all shadow-sm">
                          <Camera size={28} />
                        </div>
                        <div>
                          <span className="font-extrabold text-sm text-indigo-700 block">
                            Klik untuk Membuka Kamera atau Pilih Foto Absensi
                          </span>
                          <span className="text-xs text-slate-400 mt-1 block">
                            Mendukung file JPG, PNG, WEBP dari kamera ponsel / scan dokumen (maks. 10MB)
                          </span>
                        </div>
                      </label>
                    ) : (
                      <div className="border-2 border-indigo-100 bg-slate-50 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative w-full sm:w-36 h-28 bg-slate-200 rounded-xl overflow-hidden shadow-sm flex-shrink-0">
                          <img
                            src={aiImageBase64}
                            alt="Preview Absensi"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0 text-left w-full">
                          <div className="flex items-center gap-2 text-emerald-600 font-extrabold text-sm mb-1">
                            <CheckCircle2 size={16} /> Foto Siap Dipindai
                          </div>
                          <p className="text-xs text-slate-600 font-medium truncate mb-3">
                            {aiImageFileName || 'Foto Absensi Siswa'}
                          </p>
                          <div className="flex gap-2">
                            <label
                              htmlFor="ai-photo-input"
                              className="cursor-pointer text-xs bg-white border border-slate-200 hover:bg-slate-50 font-bold px-3 py-1.5 rounded-lg text-slate-700 transition-all inline-flex items-center gap-1.5"
                            >
                              <RefreshCw size={13} /> Ganti Foto
                            </label>
                            <button
                              type="button"
                              onClick={() => { setAiImageBase64(''); setAiImageFileName(''); }}
                              className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-lg transition-all inline-flex items-center gap-1"
                            >
                              <X size={13} /> Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Konfigurasi Kelas, Format Username, & Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        Pilih Kelas Tujuan <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={aiKelasId}
                        onChange={e => setAiKelasId(e.target.value)}
                        className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 bg-white cursor-pointer transition-all"
                      >
                        <option value="">-- Pilih Kelas Siswa --</option>
                        {kelas.map(k => (
                          <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        Password Default Semua Siswa
                      </label>
                      <div className="relative">
                        <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={aiDefaultPassword}
                          onChange={e => setAiDefaultPassword(e.target.value)}
                          placeholder="Contoh: 123456"
                          className="w-full border-2 border-slate-200 pl-10 pr-3 py-3 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 bg-white transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">Disetel seragam untuk seluruh siswa hasil scan.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        Format Username
                      </label>
                      <select
                        value={aiUsernameMode}
                        onChange={e => setAiUsernameMode(e.target.value as any)}
                        className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 bg-white cursor-pointer transition-all"
                      >
                        <option value="peserta">Otomatis Urut (peserta01, peserta02, ...)</option>
                        <option value="nisn">Gunakan NISN (jika terdeteksi)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                          Prefix Username
                        </label>
                        <input
                          type="text"
                          value={aiPrefix}
                          onChange={e => setAiPrefix(e.target.value)}
                          placeholder="peserta"
                          className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                          Mulai No.
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={aiStartNumber}
                          onChange={e => setAiStartNumber(parseInt(e.target.value) || 1)}
                          className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 bg-white transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {aiError && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start gap-3 text-red-700 text-xs">
                      <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold">Gagal Memindai Absensi</div>
                        <p className="mt-0.5">{aiError}</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleScanAi}
                    disabled={isScanningAi || !aiImageBase64}
                    className={clsx(
                      "w-full py-4 rounded-xl font-black uppercase tracking-wider text-sm transition-all flex items-center justify-center gap-2 shadow-lg",
                      isScanningAi || !aiImageBase64
                        ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                        : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-indigo-600/30 active:scale-[0.98]"
                    )}
                  >
                    {isScanningAi ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Gemini Vision Sedang Membaca Absensi...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} className="text-amber-300" />
                        <span>Pindai Foto Absensi Sekarang (Gemini AI)</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Tabel Hasil Pindaian & Edit Sebelum Simpan */
                <div className="space-y-4">
                  {/* Banner Info Hasil */}
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                    <div>
                      <div className="text-emerald-800 font-extrabold text-sm flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-emerald-600" />
                        Berhasil Mendeteksi {scannedStudents.length} Siswa dari Foto
                      </div>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Kelas Tujuan: <strong className="uppercase font-black text-indigo-700">{kelas.find(k => k.id === aiKelasId)?.nama_kelas || '-'}</strong>. Periksa atau edit data sebelum disimpan ke database.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetAiScan}
                      className="text-xs bg-white border border-emerald-200 hover:bg-emerald-100/50 text-emerald-800 font-bold px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <RefreshCw size={14} /> Scan Ulang / Ganti Foto
                    </button>
                  </div>

                  {/* Quick Edit Password Massal */}
                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <KeyRound size={16} className="text-indigo-600" />
                      <span className="text-xs font-bold text-slate-700">Ubah Password Semua Siswa Sekaligus:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={bulkPasswordEdit}
                        onChange={e => setBulkPasswordEdit(e.target.value)}
                        placeholder="Password baru..."
                        className="border-2 border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 w-36 bg-white"
                      />
                      <button
                        type="button"
                        onClick={applyBulkPassword}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-2 rounded-lg transition-all shadow-sm active:scale-95"
                      >
                        Terapkan
                      </button>
                    </div>
                  </div>

                  {/* Tabel Siswa Editable */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-600 sticky top-0 font-bold uppercase tracking-wider shadow-sm z-10">
                        <tr>
                          <th className="p-3 w-12 text-center border-b border-slate-200">No</th>
                          <th className="p-3 border-b border-slate-200">Nama Lengkap Siswa</th>
                          <th className="p-3 border-b border-slate-200 w-32">NISN</th>
                          <th className="p-3 border-b border-slate-200 w-36">Username</th>
                          <th className="p-3 border-b border-slate-200 w-32">Password</th>
                          <th className="p-3 border-b border-slate-200 w-12 text-center">Hapus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white font-medium">
                        {scannedStudents.map((item, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="p-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={item.nama}
                                onChange={e => updateScannedStudent(idx, 'nama', e.target.value)}
                                placeholder="Nama Siswa..."
                                className="w-full border border-slate-200 rounded-lg p-2 font-bold text-slate-800 text-xs focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={item.nisn}
                                onChange={e => updateScannedStudent(idx, 'nisn', e.target.value)}
                                placeholder="NISN..."
                                className="w-full border border-slate-200 rounded-lg p-2 font-mono font-semibold text-slate-700 text-xs focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={item.username}
                                onChange={e => updateScannedStudent(idx, 'username', e.target.value)}
                                placeholder="Username..."
                                className="w-full border border-slate-200 rounded-lg p-2 font-mono font-bold text-indigo-700 text-xs focus:border-indigo-500 outline-none bg-indigo-50/30 focus:bg-white"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={item.password}
                                onChange={e => updateScannedStudent(idx, 'password', e.target.value)}
                                placeholder="Password..."
                                className="w-full border border-slate-200 rounded-lg p-2 font-mono text-slate-700 text-xs focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white"
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeScannedStudent(idx)}
                                className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                                title="Hapus Baris"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Tombol Tambah Baris Manual & Simpan Final */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={addEmptyScannedStudent}
                      className="w-full sm:w-auto text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus size={16} /> Tambah Siswa Manual
                    </button>

                    <button
                      type="button"
                      onClick={simpanSiswaAi}
                      disabled={isSavingAi || scannedStudents.length === 0}
                      className="w-full sm:w-auto flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-600/30 transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2 active:scale-95"
                    >
                      {isSavingAi ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Menyimpan ke Database...</span>
                        </>
                      ) : (
                        <>
                          <Check size={18} />
                          <span>Simpan Semua ({scannedStudents.length} Siswa) ke Database</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}
      
      {/* ... TABEL SISWA TETAP SEPERTI SEBELUMNYA ATAU BISA DI-UPGRADE ... */}
      {/* Memperbarui desain tabel bawah */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <Users size={20} className="text-indigo-600"/> Direktori Siswa
            </h2>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {siswa.length} Siswa
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                setFilterKelasKartu('ALL');
                setSearchKartu('');
                setModalKartu(true);
              }}
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-red-600 hover:from-blue-700 hover:to-red-700 text-white font-black px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/25 text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <CreditCard size={16} />
              <span>Cetak Kartu Ujian (A4)</span>
            </button>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Cari nama atau username..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2.5 w-full border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-medium text-xs transition-all bg-white"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead className="bg-white text-slate-500 sticky top-0 z-10 shadow-sm uppercase text-xs tracking-wider font-bold">
              <tr>
                <th className="p-4 border-b border-slate-100 w-14 text-center">No</th>
                <th className="p-4 border-b border-slate-100 w-16 text-center">Foto</th>
                <th className="p-4 border-b border-slate-100">Username</th>
                <th className="p-4 border-b border-slate-100">Password</th>
                <th className="p-4 border-b border-slate-100">Nama Lengkap</th>
                <th className="p-4 border-b border-slate-100">Kelas</th>
                <th className="p-4 border-b border-slate-100 text-center">Status</th>
                <th className="p-4 border-b border-slate-100 text-center">Opsi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="p-12 text-center text-indigo-500 font-bold animate-pulse">Memuat direktori siswa...</td></tr>
              ) : filteredSiswa.length === 0 ? (
                <tr><td colSpan={8} className="p-12 text-center text-slate-400 font-medium">Tidak ada data siswa ditemukan.</td></tr>
              ) : (
                filteredSiswa.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-indigo-50/40 transition-colors border-b border-slate-50 last:border-0 group">
                    <td className="p-4 text-center font-bold text-slate-400">{idx + 1}</td>
                    
                    {/* Kolom Foto Siswa */}
                    <td className="p-3 text-center">
                      {fotoSiswaMap[s.id] ? (
                        <div 
                          onClick={() => setModalFotoSiswa({ isOpen: true, siswa: s, tempFoto: fotoSiswaMap[s.id] })}
                          className="w-8 h-10 rounded border border-slate-200 overflow-hidden shadow-sm mx-auto cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all group/f"
                          title="Klik untuk ganti atau hapus foto"
                        >
                          <img src={fotoSiswaMap[s.id]} alt="Foto" className="w-full h-full object-cover group-hover/f:scale-105 transition-transform" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setModalFotoSiswa({ isOpen: true, siswa: s, tempFoto: '' })}
                          className="w-8 h-10 rounded border border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 flex flex-col items-center justify-center text-[7px] font-bold transition-all mx-auto"
                          title="Upload Foto Siswa"
                        >
                          <Camera size={13} className="mb-0.5" />
                          <span>+Foto</span>
                        </button>
                      )}
                    </td>

                    <td className="p-4 font-bold text-slate-700">{s.username}</td>
                    <td className="p-4 font-mono text-xs font-semibold text-slate-400 bg-slate-50 rounded px-2 m-2 inline-block border border-slate-100">{s.password}</td>
                    <td className="p-4 font-black text-slate-800">{s.nama}</td>
                    <td className="p-4">
                      <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-100/50">
                        {s.kelas?.nama_kelas || '-'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {s.status_login === '1' ? (
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Offline</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                        {s.status_login === '1' && !isDemo && (
                          <button 
                            onClick={() => handleResetLogin(s.id)}
                            className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-lg font-bold transition-all"
                            title="Paksa Logout Siswa"
                          >
                            Reset Sesi
                          </button>
                        )}
                        {!isDemo && (
                          <button onClick={() => hapusSiswa(s.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all" title="Hapus Permanen">
                            <Trash2 size={18} />
                          </button>
                        )}
                        {isDemo && <span className="text-xs text-slate-400 italic">Read-Only</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL KELOLA FOTO SISWA */}
      {/* ========================================================================= */}
      {modalFotoSiswa.isOpen && modalFotoSiswa.siswa && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 no-print animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-6 text-center">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Camera size={16} className="text-indigo-600" />
                <span>Foto Siswa (Pas Foto 2x3)</span>
              </h4>
              <button
                onClick={() => setModalFotoSiswa({ isOpen: false, siswa: null, tempFoto: '' })}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-3 text-left bg-slate-50 p-3 rounded-xl border border-slate-200/60">
              <div className="font-black text-slate-800 text-sm truncate">{modalFotoSiswa.siswa.nama}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                No. Peserta: <strong className="font-mono text-indigo-700">{modalFotoSiswa.siswa.username}</strong> • Kelas: {modalFotoSiswa.siswa.kelas?.nama_kelas || '-'}
              </div>
            </div>

            <div className="my-4 flex justify-center">
              <div className="w-24 h-32 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white flex items-center justify-center shadow-inner relative">
                {modalFotoSiswa.tempFoto ? (
                  <img src={modalFotoSiswa.tempFoto} alt="Pas Foto Siswa" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-300 p-2">
                    <Camera size={24} className="mb-1 text-slate-300" />
                    <span className="text-[9px] font-bold">FOTO 2x3</span>
                    <span className="text-[8px] text-slate-400 mt-0.5">Belum ada</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95">
                <Upload size={14} />
                <span>{modalFotoSiswa.tempFoto ? 'Ganti Foto Lain' : 'Unggah Foto Baru'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const b64 = await compressImage(file);
                        setModalFotoSiswa(prev => ({ ...prev, tempFoto: b64 }));
                      } catch (err) {
                        alert('Gagal memproses gambar foto.');
                      }
                    }
                  }}
                />
              </label>

              {modalFotoSiswa.tempFoto && (
                <button
                  type="button"
                  onClick={() => setModalFotoSiswa(prev => ({ ...prev, tempFoto: '' }))}
                  className="text-xs text-red-500 hover:text-red-700 font-bold py-1 transition-colors block mx-auto"
                >
                  Hapus Foto Ini
                </button>
              )}

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalFotoSiswa({ isOpen: false, siswa: null, tempFoto: '' })}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSavingFoto}
                  onClick={handleSaveFotoModal}
                  className="flex-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-red-600 hover:from-blue-700 hover:to-red-700 disabled:opacity-50 text-white py-2.5 text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
                >
                  {isSavingFoto ? 'Menyimpan...' : 'Simpan Foto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CETAK KARTU PESERTA UJIAN (FORMAT 8 KARTU PER LEMBAR A4) */}
      {/* ========================================================================= */}
      {modalKartu && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col justify-start items-center overflow-y-auto p-2 sm:p-4 md:p-6 print-modal-container">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden flex flex-col my-auto max-h-[96vh] print-modal-box">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-red-600 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 flex-shrink-0 no-print shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl shadow-md border border-white/20">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg">Cetak Kartu Peserta Ujian</h3>
                  <p className="text-xs text-blue-100 font-medium">Format 8 Kartu per Lembar A4 (2 Kolom x 4 Baris) • Tampilan Cetak 100% Sesuai Preview</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setShowConfigKartu(!showConfigKartu)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    showConfigKartu 
                      ? 'bg-indigo-600 text-white border-indigo-500' 
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <SlidersHorizontal size={14} />
                  <span>{showConfigKartu ? 'Tutup Pengaturan' : 'Pengaturan Kop & Kartu'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalKartu(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Panel Pengaturan Kop & Kartu (Expandable) */}
            {showConfigKartu && (
              <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-5 text-xs space-y-4 flex-shrink-0 animate-in fade-in duration-200 no-print">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Instansi / Sekolah</label>
                    <input
                      type="text"
                      value={kartuConfig.namaSekolah}
                      onChange={e => {
                        const newCfg = { ...kartuConfig, namaSekolah: e.target.value };
                        setKartuConfig(newCfg);
                        localStorage.setItem('cbt_kartu_config', JSON.stringify(newCfg));
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white focus:border-indigo-500 outline-none"
                      placeholder="SMP / SMA / SMK CBT B-TEK"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Judul Ujian</label>
                    <input
                      type="text"
                      value={kartuConfig.judulUjian}
                      onChange={e => {
                        const newCfg = { ...kartuConfig, judulUjian: e.target.value };
                        setKartuConfig(newCfg);
                        localStorage.setItem('cbt_kartu_config', JSON.stringify(newCfg));
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white focus:border-indigo-500 outline-none"
                      placeholder="KARTU PESERTA ASESMEN SUMATIF"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tahun Ajaran / Semester</label>
                    <input
                      type="text"
                      value={kartuConfig.subJudul}
                      onChange={e => {
                        const newCfg = { ...kartuConfig, subJudul: e.target.value };
                        setKartuConfig(newCfg);
                        localStorage.setItem('cbt_kartu_config', JSON.stringify(newCfg));
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white focus:border-indigo-500 outline-none"
                      placeholder="TAHUN AJARAN 2025/2026"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Ruang / Sesi</label>
                    <input
                      type="text"
                      value={kartuConfig.ruangSesi}
                      onChange={e => {
                        const newCfg = { ...kartuConfig, ruangSesi: e.target.value };
                        setKartuConfig(newCfg);
                        localStorage.setItem('cbt_kartu_config', JSON.stringify(newCfg));
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white focus:border-indigo-500 outline-none"
                      placeholder="Sesi 1 / Lab CBT"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Kota & Tanggal Cetak</label>
                    <input
                      type="text"
                      value={kartuConfig.kotaTanggal}
                      onChange={e => {
                        const newCfg = { ...kartuConfig, kotaTanggal: e.target.value };
                        setKartuConfig(newCfg);
                        localStorage.setItem('cbt_kartu_config', JSON.stringify(newCfg));
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white focus:border-indigo-500 outline-none"
                      placeholder="Jakarta, 5 Oktober 2026"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nama Penandatangan / Panitia</label>
                    <input
                      type="text"
                      value={kartuConfig.namaPenandatangan}
                      onChange={e => {
                        const newCfg = { ...kartuConfig, namaPenandatangan: e.target.value };
                        setKartuConfig(newCfg);
                        localStorage.setItem('cbt_kartu_config', JSON.stringify(newCfg));
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white focus:border-indigo-500 outline-none"
                      placeholder="Ketua Panitia Ujian"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Kustom Logo URL (Opsional)</label>
                    <input
                      type="text"
                      value={kartuConfig.customLogoUrl}
                      onChange={e => {
                        const newCfg = { ...kartuConfig, customLogoUrl: e.target.value };
                        setKartuConfig(newCfg);
                        localStorage.setItem('cbt_kartu_config', JSON.stringify(newCfg));
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2 font-medium bg-white focus:border-indigo-500 outline-none"
                      placeholder="Kosongkan untuk pakai Logo Aplikasi"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
                    <input
                      type="checkbox"
                      checked={kartuConfig.tampilkanPassword}
                      onChange={e => {
                        const newCfg = { ...kartuConfig, tampilkanPassword: e.target.checked };
                        setKartuConfig(newCfg);
                        localStorage.setItem('cbt_kartu_config', JSON.stringify(newCfg));
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Tampilkan Password Siswa di Kartu</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const resetCfg = {
                          namaSekolah: appNama || 'SMK / SMA / SMP CBT B-TEK',
                          judulUjian: 'KARTU PESERTA ASESMEN SUMATIF',
                          subJudul: 'TAHUN AJARAN 2025/2026',
                          ruangSesi: 'Sesi 1 / Lab CBT',
                          namaPenandatangan: 'Ketua Panitia Ujian',
                          nipPenandatangan: '19820515 200801 1 005',
                          kotaTanggal: `Jakarta, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`,
                          tampilkanPassword: true,
                          catatanBawah: '*Bawa kartu ini selama ujian & jaga kerahasiaan login.',
                          customLogoUrl: ''
                        };
                        setKartuConfig(resetCfg);
                        localStorage.removeItem('cbt_kartu_config');
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                    >
                      Reset Pengaturan ke Default
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Filter & Toolbar Modal */}
            <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 flex-shrink-0 no-print">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Filter Kelas:</span>
                  <select
                    value={filterKelasKartu}
                    onChange={e => setFilterKelasKartu(e.target.value)}
                    className="border-2 border-slate-200 text-xs font-bold rounded-xl px-3 py-2 bg-slate-50 focus:border-indigo-500 outline-none text-slate-700"
                  >
                    <option value="ALL">Semua Kelas ({siswa.length} Siswa)</option>
                    {kelas.map(k => {
                      const count = siswa.filter(s => s.kelas_id === k.id).length;
                      return (
                        <option key={k.id} value={k.id}>
                          {k.nama_kelas} ({count} Siswa)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Saring nama / username..."
                    value={searchKartu}
                    onChange={e => setSearchKartu(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-slate-200 text-xs rounded-xl focus:border-indigo-500 outline-none w-48 bg-slate-50"
                  />
                </div>
              </div>

              {/* Status & Tombol Print */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                {(() => {
                  const filteredForPrint = siswa.filter(s => {
                    const matchKls = filterKelasKartu === 'ALL' || s.kelas_id === filterKelasKartu;
                    const matchSrch = !searchKartu || 
                      s.nama?.toLowerCase().includes(searchKartu.toLowerCase()) || 
                      s.username?.toLowerCase().includes(searchKartu.toLowerCase());
                    return matchKls && matchSrch;
                  });
                  const totalLembar = Math.ceil(filteredForPrint.length / 8);

                  return (
                    <>
                      <div className="text-right">
                        <div className="text-xs font-extrabold text-slate-800">
                          {filteredForPrint.length} Siswa Terpilih
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {totalLembar} Lembar A4 (Format 8/Lembar)
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleCetakKartu}
                        disabled={filteredForPrint.length === 0}
                        className="bg-gradient-to-r from-blue-600 via-indigo-600 to-red-600 hover:from-blue-700 hover:to-red-700 disabled:bg-slate-300 text-white font-black px-6 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 text-xs flex items-center gap-2 transition-all active:scale-95 flex-shrink-0"
                      >
                        <Printer size={16} />
                        <span>Cetak / Simpan PDF</span>
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Area Pratinjau & Cetak Lembar A4 Tunggal (Preview == Cetak 100%) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/60 custom-scrollbar flex flex-col items-center gap-6 print-preview-scroll">
              {(() => {
                const targetSiswa = siswa.filter(s => {
                  const matchKls = filterKelasKartu === 'ALL' || s.kelas_id === filterKelasKartu;
                  const matchSrch = !searchKartu || 
                    s.nama?.toLowerCase().includes(searchKartu.toLowerCase()) || 
                    s.username?.toLowerCase().includes(searchKartu.toLowerCase());
                  return matchKls && matchSrch;
                });

                if (targetSiswa.length === 0) {
                  return (
                    <div className="bg-white p-12 rounded-2xl shadow text-center max-w-md my-auto no-print">
                      <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h4 className="font-extrabold text-slate-700 text-base">Tidak Ada Siswa Terpilih</h4>
                      <p className="text-xs text-slate-400 mt-1">Silakan sesuaikan filter kelas atau kata kunci pencarian di atas.</p>
                    </div>
                  );
                }

                // Chunking tepat 8 kartu per halaman A4
                const pages: any[][] = [];
                for (let i = 0; i < targetSiswa.length; i += 8) {
                  pages.push(targetSiswa.slice(i, i + 8));
                }

                const effectiveLogo = kartuConfig.customLogoUrl || appLogo || '/logo.png';

                return pages.map((pageSiswa, pageIdx) => (
                  <div key={pageIdx} className="w-full flex flex-col items-center page-wrapper-print">
                    <div className="text-[11px] font-bold text-slate-500 mb-2 self-start max-w-[210mm] w-full px-1 flex justify-between no-print">
                      <span>📄 Halaman {pageIdx + 1} dari {pages.length}</span>
                      <span>{pageSiswa.length} Kartu</span>
                    </div>

                    {/* Lembar A4 (Digunakan untuk Preview dan Dicetak Langsung) */}
                    <div className="a4-sheet-card">
                      {pageSiswa.map((s) => (
                        <div 
                          key={s.id} 
                          className="card-unit"
                        >
                          {/* Kop Kartu */}
                          <div>
                            <div className="flex items-center gap-2 border-b-2 border-slate-800 pb-1 mb-1.5">
                              {/* Logo Persegi aspect-square */}
                              <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-white rounded border border-slate-200 overflow-hidden p-0.5">
                                <img
                                  src={effectiveLogo}
                                  alt="Logo"
                                  className="w-full h-full object-contain aspect-square"
                                  onError={(e) => { (e.target as any).src = '/logo.png'; }}
                                />
                              </div>
                              <div className="flex-1 min-w-0 text-center pr-0.5">
                                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-900 truncate leading-tight">
                                  {kartuConfig.namaSekolah}
                                </h4>
                                <h5 className="text-[9px] font-extrabold uppercase text-indigo-700 tracking-wide leading-tight">
                                  {kartuConfig.judulUjian}
                                </h5>
                                <p className="text-[7.5px] font-semibold text-slate-500 leading-tight">
                                  {kartuConfig.subJudul}
                                </p>
                              </div>
                            </div>

                            {/* Badan Data Siswa */}
                            <div className="flex gap-2 items-start mt-0.5">
                              {/* Kotak Pas Foto 2x3 (Dengan Foto Asli jika Diupload) */}
                              <div className="w-12 h-16 flex-shrink-0 border border-slate-300 rounded bg-slate-50 flex flex-col items-center justify-center overflow-hidden shadow-inner">
                                {fotoSiswaMap[s.id] ? (
                                  <img
                                    src={fotoSiswaMap[s.id]}
                                    alt={`Foto ${s.nama}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-[7px] font-bold text-slate-400 p-0.5 text-center">
                                    <ImageIcon size={13} className="mb-0.5 text-slate-300" />
                                    <span>FOTO</span>
                                    <span>2x3</span>
                                  </div>
                                )}
                              </div>

                              {/* Tabel Info Siswa */}
                              <div className="flex-1 min-w-0 text-[8.5px] space-y-0.5 leading-snug">
                                <div className="flex items-baseline">
                                  <span className="w-16 font-semibold text-slate-500 flex-shrink-0">Nama</span>
                                  <span className="font-bold text-slate-400 mr-1">:</span>
                                  <span className="font-black text-slate-900 truncate uppercase">{s.nama}</span>
                                </div>
                                <div className="flex items-baseline">
                                  <span className="w-16 font-semibold text-slate-500 flex-shrink-0">No. Peserta</span>
                                  <span className="font-bold text-slate-400 mr-1">:</span>
                                  <span className="font-mono font-bold text-indigo-800">{s.username}</span>
                                </div>
                                <div className="flex items-center">
                                  <span className="w-16 font-semibold text-slate-500 flex-shrink-0">Password</span>
                                  <span className="font-bold text-slate-400 mr-1">:</span>
                                  <span className="font-mono font-black text-slate-800 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                                    {kartuConfig.tampilkanPassword ? s.password : '••••••••'}
                                  </span>
                                </div>
                                <div className="flex items-baseline">
                                  <span className="w-16 font-semibold text-slate-500 flex-shrink-0">Kelas</span>
                                  <span className="font-bold text-slate-400 mr-1">:</span>
                                  <span className="font-bold text-slate-700 uppercase">{s.kelas?.nama_kelas || '-'}</span>
                                </div>
                                <div className="flex items-baseline">
                                  <span className="w-16 font-semibold text-slate-500 flex-shrink-0">Ruang/Sesi</span>
                                  <span className="font-bold text-slate-400 mr-1">:</span>
                                  <span className="font-semibold text-slate-600">{kartuConfig.ruangSesi}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Footer Kartu & Tanda Tangan */}
                          <div className="mt-1.5 pt-1 border-t border-slate-200 flex justify-between items-end text-[7px]">
                            <div className="text-slate-400 italic max-w-[50%] leading-tight text-[6.5px]">
                              {kartuConfig.catatanBawah}
                            </div>
                            <div className="text-right leading-tight">
                              <p className="text-slate-500">{kartuConfig.kotaTanggal}</p>
                              <p className="font-bold text-slate-700">{kartuConfig.namaPenandatangan}</p>
                              <div className="h-3.5"></div>
                              <p className="font-bold text-slate-800">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CSS KHUSUS PRINT A4 (PREVIEW & CETAK IDENTIK 100%) */}
      {/* ========================================================================= */}
      <style dangerouslySetInnerHTML={{__html: `
        /* Screen Style Lembar A4 */
        .a4-sheet-card {
          background: white;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 16px;
          width: 100%;
          max-width: 210mm;
          min-height: 297mm;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          grid-template-rows: repeat(4, 1fr);
          gap: 12px;
          box-sizing: border-box;
        }

        .card-unit {
          border: 1px dashed #94a3b8;
          border-radius: 8px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: white;
          position: relative;
          color: #1e293b;
          min-height: 66mm;
          box-sizing: border-box;
        }

        @media (max-width: 640px) {
          .a4-sheet-card {
            grid-template-columns: 1fr;
            grid-template-rows: auto;
          }
        }

        /* PRINT STYLE PERSIS SESUAI PREVIEW */
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, aside, nav, .no-print, button, input {
            display: none !important;
          }
          .print-modal-container {
            position: static !important;
            inset: auto !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .print-modal-box {
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            background: transparent !important;
          }
          .print-preview-scroll {
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            display: block !important;
          }
          .page-wrapper-print {
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          .page-wrapper-print:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .a4-sheet-card {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 6mm 7mm !important;
            margin: 0 auto !important;
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            grid-template-rows: repeat(4, 1fr) !important;
            gap: 3.5mm !important;
            box-sizing: border-box !important;
            background: white !important;
          }
          .card-unit {
            border: 1px dashed #64748b !important;
            border-radius: 4px !important;
            padding: 2.2mm 2.5mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            height: 100% !important;
            min-height: auto !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            overflow: hidden !important;
          }
        }
      `}} />
    </div>
  );
}
