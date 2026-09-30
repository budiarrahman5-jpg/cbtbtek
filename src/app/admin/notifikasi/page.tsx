'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Bell, Trash2, CheckCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotifikasiPage() {
  const [notifikasi, setNotifikasi] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchAndMarkAsRead();
  }, []);

  const fetchAndMarkAsRead = async () => {
    setIsLoading(true);
    
    // Ambil data
    const { data, error } = await supabase
      .from('notifikasi')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setNotifikasi(data);
      
      // Update semua unread menjadi read
      const unreadIds = data.filter(n => !n.dibaca).map(n => n.id);
      if (unreadIds.length > 0) {
        await supabase.from('notifikasi').update({ dibaca: true }).in('id', unreadIds);
        // Dispatch custom event to trigger layout update if needed (optional)
      }
    }
    
    setIsLoading(false);
  };

  const hapusNotifikasi = async (id: string) => {
    if (!confirm('Yakin ingin menghapus pesan ini?')) return;
    await supabase.from('notifikasi').delete().eq('id', id);
    fetchAndMarkAsRead();
  };

  const hapusSemua = async () => {
    if (!confirm('Yakin ingin menghapus SEMUA pesan notifikasi?')) return;
    await supabase.from('notifikasi').delete().neq('id', 'dummy');
    fetchAndMarkAsRead();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
            <Bell className="text-indigo-600" /> Pusat Notifikasi
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">
            Pengumuman dan pesan otomatis dari Developer Sistem CBT.
          </p>
        </div>
        {notifikasi.length > 0 && (
          <button 
            onClick={hapusSemua}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-bold flex items-center gap-2 transition-colors border border-red-200"
          >
            <Trash2 size={18} /> Bersihkan Semua
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-slate-500 font-medium animate-pulse">Memuat pesan...</div>
        ) : notifikasi.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={40} className="text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Semua Beres!</h3>
            <p className="text-slate-500 max-w-md">Anda belum memiliki pesan atau pengumuman baru dari sistem. Pantau terus halaman ini secara berkala.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifikasi.map((item) => {
              const tgl = new Date(item.tanggal || item.created_at);
              const formattedDate = new Intl.DateTimeFormat('id-ID', {
                dateStyle: 'full',
                timeStyle: 'short'
              }).format(tgl);

              return (
                <div key={item.id} className={`p-6 transition-colors hover:bg-slate-50 ${!item.dibaca ? 'bg-indigo-50/30' : ''}`}>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {!item.dibaca && (
                          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
                        )}
                        <h3 className="text-lg font-bold text-slate-800">{item.judul || 'Pengumuman Sistem'}</h3>
                      </div>
                      <div className="text-slate-700 text-sm md:text-[15px] leading-relaxed mb-4 whitespace-pre-line">
                        {item.pesan}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                        <Clock size={14} />
                        {formattedDate}
                      </div>
                    </div>
                    <button 
                      onClick={() => hapusNotifikasi(item.id)}
                      className="shrink-0 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Hapus Pesan"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
