'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserPlus, Search, Edit, Trash2, Plus, Users, BookOpen } from 'lucide-react';

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch Kelas
    const { data: dataKelas } = await supabase.from('kelas').select('*').order('nama_kelas');
    if (dataKelas) setKelas(dataKelas);
    
    // Fetch Siswa
    const { data: dataSiswa } = await supabase
      .from('users')
      .select('*, kelas(nama_kelas)')
      .eq('role', 'siswa')
      .order('nama');
    if (dataSiswa) setSiswa(dataSiswa);
      
    setIsLoading(false);
  };

  const simpanKelas = async () => {
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
    if (!confirm('Hapus kelas ini? Siswa yang terhubung akan kehilangan data kelas.')) return;
    await supabase.from('kelas').delete().eq('id', id);
    fetchData();
  };

  const simpanSiswaSingle = async () => {
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
    if (!confirm('Hapus siswa ini? Semua hasil ujiannya juga akan terhapus.')) return;
    await supabase.from('users').delete().eq('id', id);
    fetchData();
  };

  const handleResetLogin = async (id: string) => {
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Kolom Kelola Kelas */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-col">
          <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2 border-b pb-2">
             <BookOpen size={20} className="text-blue-600"/> Kelola Kelas
          </h3>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input 
              type="text" 
              value={namaKelas}
              onChange={(e) => setNamaKelas(e.target.value)}
              className="flex-1 border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none uppercase" 
              placeholder="Ketik Nama Kelas Baru..." 
            />
            <button onClick={simpanKelas} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-bold transition flex justify-center items-center gap-2">
              <Plus size={18} /> Simpan
            </button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-64 border rounded">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 sticky top-0">
                <tr><th className="p-2 border-b">Nama Kelas</th><th className="p-2 border-b w-12 text-center">Aksi</th></tr>
              </thead>
              <tbody>
                {kelas.map(k => (
                  <tr key={k.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-bold text-gray-700">{k.nama_kelas}</td>
                    <td className="p-2 text-center">
                       <button onClick={() => hapusKelas(k.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
                {kelas.length === 0 && <tr><td colSpan={2} className="p-4 text-center text-gray-400">Belum ada kelas</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolom Tambah Siswa */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 lg:col-span-2">
          <div className="flex justify-between items-center border-b pb-2 mb-4">
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <UserPlus size={20} className="text-green-600"/> Tambah Siswa
            </h3>
            <select 
              className="border p-1.5 rounded text-sm font-bold bg-gray-50 focus:ring-2 focus:ring-blue-500"
              value={inputMode}
              onChange={(e) => setInputMode(e.target.value)}
            >
              <option value="single">Input Satu Per Satu</option>
              <option value="bulk">Input Massal (CSV)</option>
            </select>
          </div>

          {inputMode === 'single' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Username</label>
                  <input type="text" value={sUsername} onChange={e=>setSUsername(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Username" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Password</label>
                  <input type="text" value={sPassword} onChange={e=>setSPassword(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Password" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Nama Lengkap</label>
                <input type="text" value={sNama} onChange={e=>setSNama(e.target.value)} className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nama Lengkap" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Kelas</label>
                <select value={sKelasId} onChange={e=>setSKelasId(e.target.value)} className="w-full border p-2 rounded bg-yellow-50 focus:ring-2 focus:ring-blue-500 font-bold outline-none">
                  <option value="">- Pilih Kelas -</option>
                  {kelas.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                </select>
              </div>
              <button onClick={simpanSiswaSingle} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded shadow transition-colors">
                Simpan Siswa
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-blue-800 bg-blue-50 p-3 rounded border border-blue-200 leading-relaxed">
                <b>Format per baris (Pisahkan dengan koma):</b> username,password,Nama Lengkap,Nama Kelas<br/>
                <b>Contoh:</b> <i>siswa01,1234,Andi Purnomo,XII IPA 1</i> <br/>
                <i>Jika "Nama Kelas" belum ada, sistem akan otomatis membuatkannya.</i>
              </p>
              <textarea 
                rows={5} 
                className="w-full border p-3 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed" 
                placeholder="siswa01,12345,Budi,XII IPA 1&#10;siswa02,12345,Siti,XII IPA 1"
                value={bulkData}
                onChange={e=>setBulkData(e.target.value)}
              />
              <button onClick={simpanSiswaBulk} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded shadow transition-colors">
                Proses Input Massal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* BAGIAN BAWAH: TABEL DAFTAR SISWA */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 md:p-5 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Users size={20} className="text-indigo-600"/> Daftar Seluruh Siswa
          </h2>
          <div className="relative flex-1 sm:w-72 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari nama atau username..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-50 text-gray-700 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-3 border-b font-bold w-12 text-center">No</th>
                <th className="p-3 border-b font-bold">Username</th>
                <th className="p-3 border-b font-bold">Password</th>
                <th className="p-3 border-b font-bold">Nama Lengkap</th>
                <th className="p-3 border-b font-bold">Kelas</th>
                <th className="p-3 border-b font-bold text-center">Status</th>
                <th className="p-3 border-b font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500 font-bold">Memuat data...</td></tr>
              ) : filteredSiswa.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Tidak ada data siswa ditemukan.</td></tr>
              ) : (
                filteredSiswa.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-blue-50 transition-colors border-b last:border-0">
                    <td className="p-3 text-center">{idx + 1}</td>
                    <td className="p-3 font-semibold text-gray-600">{s.username}</td>
                    <td className="p-3 font-mono text-xs text-gray-500">{s.password}</td>
                    <td className="p-3 font-bold text-gray-800">{s.nama}</td>
                    <td className="p-3">
                      <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold border">
                        {s.kelas?.nama_kelas || '-'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {s.status_login === '1' ? (
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold inline-block">Online</span>
                      ) : (
                        <span className="text-gray-400 text-xs font-semibold">Offline</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2 justify-center">
                        {s.status_login === '1' && (
                          <button 
                            onClick={() => handleResetLogin(s.id)}
                            className="text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-200 px-2 py-1 rounded font-bold border border-yellow-300"
                            title="Reset Login"
                          >
                            Reset
                          </button>
                        )}
                        <button onClick={() => hapusSiswa(s.id)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded" title="Hapus Siswa">
                          <Trash2 size={16} />
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
    </div>
  );
}
