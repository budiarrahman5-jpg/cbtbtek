'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save, ShieldAlert, ShieldCheck, Smartphone, Users, Info, Search } from 'lucide-react';
import clsx from 'clsx';

export default function PengaturanPage() {
  const [settings, setSettings] = useState<Record<string, string>>({
    nama_aplikasi: '',
    tampil_nilai: 'ON',
    mode_review: 'OFF',
    acak_soal: 'ON',
    acak_opsi: 'ON',
    nilai_kkm: '75',
    proteksi_layar: 'ON',
    kode_buka_blokir: 'BUKA123',
    proteksi_siswa_list: '[]',
    exambro_keywords: 'exambro, exam, seb, safeexambrowser, flyexam, kiosk, cbt',
    groq_api_key: '',
    gemini_api_key: '',
    ai_provider: 'auto',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isDemo, setIsDemo] = useState(false);

  // Data Siswa & Kelas untuk Proteksi Layar Khusus
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [searchSiswa, setSearchSiswa] = useState('');
  const [filterKelas, setFilterKelas] = useState('');

  useEffect(() => {
    const checkAdmin = async () => {
      const savedUser = localStorage.getItem('cbt_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        setIsDemo(u?.username?.startsWith('demo_'));
        setAdminUser(u);
        
        // Fetch current password from DB
        const { data } = await supabase.from('users').select('username, password').eq('id', u.id).single();
        if (data) {
          setNewUsername(data.username);
          setNewPassword(data.password);
        }
      }
    };

    fetchSettings();
    checkAdmin();
    fetchSiswaDanKelas();
  }, []);

  const fetchSiswaDanKelas = async () => {
    try {
      const { data: kData } = await supabase.from('kelas').select('*').order('nama_kelas');
      if (kData) setKelasList(kData);

      const { data: sData } = await supabase
        .from('users')
        .select('id, nama, username, kelas_id, kelas(nama_kelas)')
        .eq('role', 'siswa')
        .order('nama');
      if (sData) setSiswaList(sData);
    } catch (err) {
      console.error('Gagal mengambil data siswa/kelas:', err);
    }
  };

  const fetchSettings = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('pengaturan').select('*');
    if (data) {
      const parsed: Record<string, string> = {};
      data.forEach(item => { parsed[item.kunci] = item.nilai; });
      setSettings(prev => ({ ...prev, ...parsed }));
    }
    setIsLoading(false);
  };

  const simpanAkunAdmin = async () => {
    if (isDemo) {
      alert('Fitur Ubah Username & Password dinonaktifkan untuk Akun Demo!');
      return;
    }
    if (!newUsername || !newPassword) {
      alert('Username dan Password tidak boleh kosong!');
      return;
    }
    if (!adminUser) return;

    if (!confirm('Apakah Anda yakin ingin mengubah kredensial Admin?')) return;

    const { error } = await supabase
      .from('users')
      .update({ username: newUsername, password: newPassword })
      .eq('id', adminUser.id);

    if (error) {
      alert('Gagal mengubah data akun admin!');
    } else {
      alert('Berhasil mengubah Username & Password Admin! Silakan login kembali dengan data baru saat sesi berakhir.');
      const updatedUser = { ...adminUser, username: newUsername };
      localStorage.setItem('cbt_user', JSON.stringify(updatedUser));
      setAdminUser(updatedUser);
    }
  };

  const simpanPengaturan = async () => {
    // Upsert pengaturan (jika menggunakan kunci = primary key di Supabase)
    const upsertData = Object.keys(settings).map(kunci => ({
      kunci,
      nilai: settings[kunci]
    }));

    const { error } = await supabase.from('pengaturan').upsert(upsertData, { onConflict: 'kunci' });
    
    if (error) {
      alert('Gagal menyimpan pengaturan.');
    } else {
      const appName = settings.nama_aplikasi?.trim() || 'CBT B-TEK';
      localStorage.setItem('cbt_app_name', appName);
      window.dispatchEvent(new Event('cbt_settings_updated'));
      alert('Pengaturan berhasil disimpan!');
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Helper untuk Memilih Siswa pada Proteksi Layar Khusus
  const selectedStudentIds: string[] = useMemo(() => {
    try {
      return JSON.parse(settings.proteksi_siswa_list || '[]');
    } catch (e) {
      return [];
    }
  }, [settings.proteksi_siswa_list]);

  const filteredSiswa = useMemo(() => {
    return siswaList.filter(s => {
      const matchSearch = s.nama?.toLowerCase().includes(searchSiswa.toLowerCase()) || 
                          s.username?.toLowerCase().includes(searchSiswa.toLowerCase());
      const matchKelas = !filterKelas || s.kelas_id === filterKelas;
      return matchSearch && matchKelas;
    });
  }, [siswaList, searchSiswa, filterKelas]);

  const toggleStudent = (id: string) => {
    const set = new Set(selectedStudentIds);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    handleChange('proteksi_siswa_list', JSON.stringify(Array.from(set)));
  };

  const selectAllFiltered = () => {
    const set = new Set(selectedStudentIds);
    filteredSiswa.forEach(s => set.add(s.id));
    handleChange('proteksi_siswa_list', JSON.stringify(Array.from(set)));
  };

  const unselectAllFiltered = () => {
    const set = new Set(selectedStudentIds);
    filteredSiswa.forEach(s => set.delete(s.id));
    handleChange('proteksi_siswa_list', JSON.stringify(Array.from(set)));
  };

  if (isLoading) return <div className="p-8 text-center font-bold text-gray-500">Memuat pengaturan...</div>;

  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-sm border-t-4 border-gray-600 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 border-b pb-4">
        <Settings className="text-gray-600 w-8 h-8" />
        <h2 className="text-2xl font-bold text-gray-800">
          Pengaturan {settings.nama_aplikasi?.trim() || 'CBT B-TEK'}
        </h2>
      </div>

      {/* Pengaturan Akun Admin */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Settings size={18} /> Pengaturan Akun Admin
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Username Admin</label>
            <input 
              type="text" 
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              disabled={isDemo}
              className="w-full border-2 border-slate-200 p-3 rounded-md focus:border-indigo-500 outline-none font-bold text-slate-700 disabled:bg-slate-100 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password Admin</label>
            <input 
              type="text" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isDemo}
              className="w-full border-2 border-slate-200 p-3 rounded-md focus:border-indigo-500 outline-none font-bold text-slate-700 disabled:bg-slate-100 transition-all"
            />
          </div>
        </div>
        <button 
          onClick={simpanAkunAdmin}
          disabled={isDemo}
          className="mt-4 bg-slate-800 hover:bg-slate-900 text-white disabled:opacity-50 px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 transition-all shadow-sm"
        >
          <Save size={16} /> Update Kredensial
        </button>
        {isDemo && (
          <p className="text-rose-500 text-xs font-bold mt-2">*Fitur ini dinonaktifkan untuk Akun Demo.</p>
        )}
      </div>

      <div className="space-y-5 pt-2">
        <div>
          <label className="block font-bold text-sm mb-1 text-gray-700">Nama Aplikasi Ujian</label>
          <input 
            type="text" 
            value={settings.nama_aplikasi} onChange={e=>handleChange('nama_aplikasi', e.target.value)}
            className="w-full border-2 p-3 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none font-semibold text-gray-800" 
          />
        </div>
        
        <div>
          <label className="block font-bold text-sm mb-1 text-gray-700">Tampilkan Nilai ke Peserta (Setelah Ujian)</label>
          <select 
            value={settings.tampil_nilai} onChange={e=>handleChange('tampil_nilai', e.target.value)}
            className="w-full border-2 p-3 rounded-md bg-gray-50 focus:ring-blue-500 outline-none font-bold"
          >
            <option value="ON">ON (Peserta dapat melihat nilai)</option>
            <option value="OFF">OFF (Sembunyikan nilai akhir)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Gunakan OFF jika ada soal Essay/Isian yang butuh koreksi manual.</p>
        </div>

        <div>
          <label className="block font-bold text-sm mb-1 text-gray-700">Mode Review / Pembahasan Soal (Untuk Siswa)</label>
          <select 
            value={settings.mode_review || 'OFF'} onChange={e=>handleChange('mode_review', e.target.value)}
            className="w-full border-2 p-3 rounded-md bg-gray-50 focus:ring-blue-500 outline-none font-bold"
          >
            <option value="OFF">OFF (Kunci Jawaban & Pembahasan Disembunyikan)</option>
            <option value="ON">ON (Izinkan Siswa Meninjau Nomor Benar/Salah & Pembahasan)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Aktifkan setelah periode ujian berakhir agar siswa dapat melihat nomor mana saja yang salah dan belajar dari pembahasannya.</p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <label className="block font-bold text-sm mb-1 text-gray-700">Nilai KKM (Kriteria Ketuntasan Minimal)</label>
          <input 
            type="number" 
            value={settings.nilai_kkm} onChange={e=>handleChange('nilai_kkm', e.target.value)}
            className="w-full border-2 p-3 rounded-md focus:ring-blue-500 focus:border-blue-500 outline-none font-black text-blue-800 bg-blue-50" 
            min="0" max="100" 
          />
          <p className="text-xs text-gray-500 mt-1">Digunakan untuk menghitung rentang batas nilai pada grafik & Filter Remedial.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
          <div>
            <label className="block font-bold text-sm mb-1 text-gray-700">Acak Urutan Soal</label>
            <select 
              value={settings.acak_soal} onChange={e=>handleChange('acak_soal', e.target.value)}
              className="w-full border-2 p-3 rounded-md bg-blue-50 focus:ring-blue-500 outline-none font-bold text-blue-800"
            >
              <option value="ON">ON (Diacak per Peserta)</option>
              <option value="OFF">OFF (Berurutan)</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-sm mb-1 text-gray-700">Acak Pilihan Jawaban (PG)</label>
            <select 
              value={settings.acak_opsi} onChange={e=>handleChange('acak_opsi', e.target.value)}
              className="w-full border-2 p-3 rounded-md bg-blue-50 focus:ring-blue-500 outline-none font-bold text-blue-800"
            >
              <option value="ON">ON (Opsi A,B,C,D diacak)</option>
              <option value="OFF">OFF (Berurutan)</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-sm mb-1 text-gray-700">Proteksi Layar / Fullscreen</label>
              <select 
                value={settings.proteksi_layar || 'ON'} 
                onChange={e => handleChange('proteksi_layar', e.target.value)}
                className="w-full border-2 p-3 rounded-md bg-red-50 focus:ring-red-500 outline-none font-bold text-red-800 border-red-200"
              >
                <option value="ON">ON (Wajib Semua Siswa)</option>
                <option value="NON_EXAMBRO">ON Khusus Siswa Non-Exambro (Deteksi Otomatis)</option>
                <option value="KHUSUS">ON Khusus Siswa Tertentu (Pilih Siswa Manual)</option>
                <option value="OFF">OFF (Tidak Aktif / Bebas)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-sm mb-1 text-gray-700">Kode Buka Blokir Peserta</label>
              <input 
                type="text" 
                value={settings.kode_buka_blokir} 
                onChange={e => handleChange('kode_buka_blokir', e.target.value)}
                placeholder="BUKA123"
                className="w-full border-2 p-3 rounded-md focus:ring-red-500 focus:border-red-500 outline-none font-bold text-red-800 bg-red-50" 
              />
              <p className="text-[11px] text-gray-500 mt-1">Kode rahasia pengawas untuk membuka layar siswa yang terkunci karena melanggar aturan.</p>
            </div>
          </div>

          {/* Panel Panduan & Penjelasan Mode Proteksi */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <Info size={18} className="text-indigo-600" />
              <span>Panduan & Penjelasan Pilihan Mode Proteksi Layar</span>
            </div>
            
            <div className="grid grid-cols-1 gap-2.5 text-xs text-slate-600">
              <div className={clsx("p-3 rounded-lg border transition-all", (settings.proteksi_layar === 'ON' || !settings.proteksi_layar) ? "bg-red-50 border-red-300 text-red-950 font-medium ring-1 ring-red-400" : "bg-white border-slate-200")}>
                <div className="flex items-center gap-1.5 font-bold mb-1 text-slate-800">
                  <ShieldAlert size={14} className="text-red-600" />
                  <span className="text-red-700">1. Mode ON (Semua Siswa):</span>
                </div>
                <p>Wajib untuk <strong>seluruh peserta</strong> tanpa kecuali. Semua peserta wajib mode fullscreen. Jika peserta meminimalkan browser, berpindah aplikasi, membuka tab lain, atau keluar fullscreen, layar ujian <strong>langsung terkunci otomatis</strong> dan wajib dibuka oleh pengawas menggunakan Kode Buka Blokir.</p>
              </div>

              <div className={clsx("p-3 rounded-lg border transition-all", settings.proteksi_layar === 'NON_EXAMBRO' ? "bg-amber-50 border-amber-300 text-amber-950 font-medium ring-1 ring-amber-400" : "bg-white border-slate-200")}>
                <div className="flex items-center gap-1.5 font-bold mb-1 text-slate-800">
                  <Smartphone size={14} className="text-amber-600" />
                  <span className="text-amber-800">2. Mode ON Khusus Non-Exambro (Deteksi Otomatis) ⭐ Sangat Disarankan:</span>
                </div>
                <p>Solusi terbaik jika sebagian siswa memiliki kendala gawai (tidak bisa instal Exambro karena HP iPhone/iOS, Android lama, atau laptop tertentu). Sistem membaca identitas peramban (User-Agent):</p>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li><strong>Siswa yang menggunakan Exambro resmi:</strong> Ujian berjalan normal tanpa blokir web ganda karena aplikasi Exambro sudah mengunci HP secara fisik.</li>
                  <li><strong>Siswa yang menggunakan Browser Biasa (Chrome, Safari, Edge, dll.):</strong> Sistem CBT web <strong>secara otomatis mengaktifkan Fullscreen paksa & Blokir Layar</strong> jika keluar aplikasi, sehingga mereka tetap terproteksi penuh dari membuka contekan/Google.</li>
                </ul>
              </div>

              <div className={clsx("p-3 rounded-lg border transition-all", settings.proteksi_layar === 'KHUSUS' ? "bg-indigo-50 border-indigo-300 text-indigo-950 font-medium ring-1 ring-indigo-400" : "bg-white border-slate-200")}>
                <div className="flex items-center gap-1.5 font-bold mb-1 text-slate-800">
                  <Users size={14} className="text-indigo-600" />
                  <span className="text-indigo-700">3. Mode ON Khusus Siswa Tertentu (Pilih Siswa Manual):</span>
                </div>
                <p>Proteksi Fullscreen & Blokir Layar hanya diberlakukan untuk <strong>daftar siswa yang Anda centang</strong> di panel pemilih di bawah ini. Siswa yang tidak dicentang tidak akan terkunci layarnya saat ujian.</p>
              </div>

              <div className={clsx("p-3 rounded-lg border transition-all", settings.proteksi_layar === 'OFF' ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-medium ring-1 ring-emerald-400" : "bg-white border-slate-200")}>
                <div className="flex items-center gap-1.5 font-bold mb-1 text-slate-800">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span className="text-emerald-700">4. Mode OFF (Tidak Aktif / Bebas):</span>
                </div>
                <p>Fitur Fullscreen paksa dan Blokir Layar dinonaktifkan sepenuhnya untuk semua peserta. Siswa bebas keluar-masuk layar tanpa terkunci.</p>
              </div>
            </div>
          </div>

          {/* Opsi Tambahan Jika Mode NON_EXAMBRO Dipilih */}
          {settings.proteksi_layar === 'NON_EXAMBRO' && (
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 animate-in fade-in duration-200">
              <label className="block font-bold text-xs uppercase tracking-wider text-amber-900">
                Kata Kunci Deteksi Exambro (User-Agent Filter)
              </label>
              <input 
                type="text" 
                value={settings.exambro_keywords || 'exambro, exam, seb, safeexambrowser, flyexam, kiosk, cbt'}
                onChange={e => handleChange('exambro_keywords', e.target.value)}
                className="w-full border-2 border-amber-200 p-2.5 rounded-lg bg-white text-xs font-mono font-bold text-amber-950 focus:border-amber-500 outline-none"
                placeholder="exambro, exam, seb, safeexambrowser, flyexam, kiosk, cbt"
              />
              <p className="text-[11px] text-amber-700">
                *Pisahkan dengan koma. Jika browser siswa <strong>tidak</strong> mengandung salah satu kata kunci di atas, siswa otomatis dianggap menggunakan browser biasa dan langsung dikenakan proteksi fullscreen & blokir layar.
              </p>
            </div>
          )}

          {/* Panel Pemilihan Siswa Jika Mode KHUSUS Dipilih */}
          {settings.proteksi_layar === 'KHUSUS' && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-indigo-950 flex items-center gap-1.5">
                    <Users size={16} className="text-indigo-600" />
                    Pilih Siswa yang Dikenakan Proteksi Layar
                  </h4>
                  <p className="text-xs text-indigo-700">
                    Centang siswa yang wajib diproteksi layarnya (Total: <strong>{selectedStudentIds.length}</strong> siswa dipilih)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition shadow-sm"
                  >
                    Pilih Semua Filter ({filteredSiswa.length})
                  </button>
                  <button
                    type="button"
                    onClick={unselectAllFiltered}
                    className="text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg transition"
                  >
                    Batal Pilih Filter
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama atau username siswa..."
                    value={searchSiswa}
                    onChange={e => setSearchSiswa(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs border border-indigo-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <select
                  value={filterKelas}
                  onChange={e => setFilterKelas(e.target.value)}
                  className="w-full py-2 px-3 text-xs border border-indigo-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                >
                  <option value="">-- Semua Kelas ({siswaList.length} Siswa) --</option>
                  {kelasList.map(k => (
                    <option key={k.id} value={k.id}>{k.nama_kelas}</option>
                  ))}
                </select>
              </div>

              {/* Student List Box */}
              <div className="max-h-60 overflow-y-auto border border-indigo-200 rounded-lg bg-white p-2 divide-y divide-slate-100 custom-scrollbar">
                {filteredSiswa.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">Tidak ada siswa yang cocok dengan pencarian</div>
                ) : (
                  filteredSiswa.map(s => {
                    const isSelected = selectedStudentIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className={clsx(
                          "flex items-center justify-between p-2 rounded-md hover:bg-slate-50 cursor-pointer transition text-xs",
                          isSelected && "bg-indigo-50/70"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudent(s.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <span className="font-bold text-slate-800">{s.nama}</span>
                            <span className="text-slate-400 ml-2">(@{s.username})</span>
                          </div>
                        </div>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                          {s.kelas?.nama_kelas || 'Tanpa Kelas'}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* MULTI-PROVIDER AI CONFIGURATION (GROQ + GOOGLE GEMINI) */}
        <div className="pt-4 border-t border-gray-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-base text-purple-900 flex items-center gap-2">
                ✨ Konfigurasi Kecerdasan Buatan (Groq AI & Google Gemini)
              </h3>
              <p className="text-xs text-slate-500">
                Gabungkan dua mesin AI sekaligus untuk kecepatan maksimal, kuota ganda, dan pencadangan otomatis (anti-macet).
              </p>
            </div>
            <span className="self-start sm:self-auto bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800 text-[11px] font-bold px-3 py-1 rounded-full border border-purple-200">
              Multi-Provider Ready
            </span>
          </div>

          <div>
            <label className="block font-bold text-xs uppercase tracking-wider text-slate-700 mb-1.5">
              Mode Penyedia AI (AI Engine Priority)
            </label>
            <select
              value={settings.ai_provider || 'auto'}
              onChange={e => handleChange('ai_provider', e.target.value)}
              className="w-full border-2 border-purple-200 p-3 rounded-lg bg-purple-50/60 focus:border-purple-600 outline-none font-bold text-sm text-purple-950"
            >
              <option value="auto">⚡ Otomatis (Rekomendasi: Groq Kilat + Cadangan Google Gemini)</option>
              <option value="groq">🚀 Prioritaskan Groq AI</option>
              <option value="gemini">🌟 Prioritaskan Google Gemini</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Dalam mode <strong>Otomatis</strong>, sistem akan menggunakan Groq karena super cepat (~1-2 detik). Jika Groq sibuk atau kuota habis, sistem otomatis beralih ke Gemini tanpa error.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Groq API Key */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>🚀 Groq API Key</span>
                </label>
                {settings.groq_api_key ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                    Tersimpan
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                    Belum Diisi
                  </span>
                )}
              </div>
              <input 
                type="password" 
                placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={settings.groq_api_key || ''} 
                onChange={e => handleChange('groq_api_key', e.target.value)}
                className="w-full border-2 p-2.5 rounded-lg focus:border-purple-500 outline-none font-mono text-xs bg-white border-slate-200 placeholder:text-slate-300" 
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Super cepat untuk buat soal massal. Dapatkan gratis di <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-purple-600 font-bold underline">Groq Console</a>.
              </p>
            </div>

            {/* Google Gemini API Key */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span>🌟 Google Gemini API Key</span>
                </label>
                {settings.gemini_api_key ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                    Tersimpan
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                    Belum Diisi
                  </span>
                )}
              </div>
              <input 
                type="password" 
                placeholder="AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={settings.gemini_api_key || ''} 
                onChange={e => handleChange('gemini_api_key', e.target.value)}
                className="w-full border-2 p-2.5 rounded-lg focus:border-indigo-500 outline-none font-mono text-xs bg-white border-slate-200 placeholder:text-slate-300" 
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Didukung Google AI (Gemini Flash). Dapatkan gratis di <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline">Google AI Studio</a>.
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={simpanPengaturan}
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-4 rounded-lg shadow-lg text-lg flex justify-center items-center gap-2 mt-6 transition-transform active:scale-95"
        >
          <Save size={24} /> SIMPAN PENGATURAN
        </button>
      </div>
    </div>
  );
}
