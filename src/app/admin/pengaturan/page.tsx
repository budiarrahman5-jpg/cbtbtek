'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save } from 'lucide-react';

export default function PengaturanPage() {
  const [settings, setSettings] = useState<Record<string, string>>({
    nama_aplikasi: '',
    tampil_nilai: 'ON',
    acak_soal: 'ON',
    acak_opsi: 'ON',
    nilai_kkm: '75',
    proteksi_layar: 'ON',
    kode_buka_blokir: 'BUKA123',
  });
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

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
      alert('Pengaturan berhasil disimpan!');
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) return <div className="p-8 text-center font-bold text-gray-500">Memuat pengaturan...</div>;

  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-sm border-t-4 border-gray-600 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 border-b pb-4">
        <Settings className="text-gray-600 w-8 h-8" />
        <h2 className="text-2xl font-bold text-gray-800">Pengaturan CBT B-TEK</h2>
      </div>

      <div className="space-y-5">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
          <div>
            <label className="block font-bold text-sm mb-1 text-gray-700">Proteksi Layar / Fullscreen</label>
            <select 
              value={settings.proteksi_layar} onChange={e=>handleChange('proteksi_layar', e.target.value)}
              className="w-full border-2 p-3 rounded-md bg-red-50 focus:ring-red-500 outline-none font-bold text-red-800 border-red-200"
            >
              <option value="ON">ON (Aktif - Blokir jika keluar layar)</option>
              <option value="OFF">OFF (Tidak Aktif)</option>
            </select>
          </div>
          <div>
            <label className="block font-bold text-sm mb-1 text-gray-700">Kode Buka Blokir Peserta</label>
            <input 
              type="text" 
              value={settings.kode_buka_blokir} onChange={e=>handleChange('kode_buka_blokir', e.target.value)}
              className="w-full border-2 p-3 rounded-md focus:ring-red-500 focus:border-red-500 outline-none font-bold text-red-800 bg-red-50" 
            />
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
