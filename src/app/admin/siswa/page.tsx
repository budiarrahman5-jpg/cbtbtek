'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { filterDemoData } from '@/lib/demo-filter';
import { UserPlus, Search, Edit, Trash2, Plus, Users, BookOpen } from 'lucide-react';
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

  // State Input Bulk
  const [inputMode, setInputMode] = useState('single');
  const [bulkData, setBulkData] = useState('');

  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    fetchData();
    const savedUser = localStorage.getItem('cbt_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setIsDemo(user?.username?.startsWith('demo_admin_'));
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

    const { error } = await supabase.from('users').insert({
      username: sUsername,
      password: sPassword,
      nama: sNama,
      kelas_id: sKelasId,
      role: 'siswa'
    });

    if (error) {
      alert('Gagal menyimpan siswa. Pastikan username belum dipakai.');
    } else {
      alert('Siswa berhasil ditambahkan!');
      setSUsername(''); setSPassword(''); setSNama(''); setSKelasId('');
      fetchData();
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

  const filteredSiswa = siswa.filter(s => 
    s.nama?.toLowerCase().includes(search.toLowerCase()) || 
    s.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 mb-6 gap-4">
            <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><UserPlus size={20}/></div> 
              Registrasi Siswa
            </h3>
            <select 
              className="border-2 border-slate-200 p-2.5 rounded-xl text-sm font-bold bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none cursor-pointer transition-all w-full sm:w-auto"
              value={inputMode}
              onChange={(e) => setInputMode(e.target.value)}
            >
              <option value="single">Input Manual (Satu per Satu)</option>
              <option value="bulk">Input Massal Cepat (CSV)</option>
            </select>
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
              <button onClick={simpanSiswaSingle} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.98] uppercase tracking-wider mt-2">
                Simpan Data Siswa
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </div>
      )}
      
      {/* ... TABEL SISWA TETAP SEPERTI SEBELUMNYA ATAU BISA DI-UPGRADE ... */}
      {/* Memperbarui desain tabel bawah */}
      <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
          <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
            <Users size={20} className="text-indigo-600"/> Direktori Siswa
          </h2>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari berdasarkan nama atau username..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 pr-4 py-3 w-full border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-medium text-sm transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
            <thead className="bg-white text-slate-500 sticky top-0 z-10 shadow-sm uppercase text-xs tracking-wider font-bold">
              <tr>
                <th className="p-4 border-b border-slate-100 w-16 text-center">No</th>
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
                <tr><td colSpan={7} className="p-12 text-center text-indigo-500 font-bold animate-pulse">Memuat direktori siswa...</td></tr>
              ) : filteredSiswa.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-slate-400 font-medium">Tidak ada data siswa ditemukan.</td></tr>
              ) : (
                filteredSiswa.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-indigo-50/40 transition-colors border-b border-slate-50 last:border-0 group">
                    <td className="p-4 text-center font-bold text-slate-400">{idx + 1}</td>
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
    </div>
  );
}
