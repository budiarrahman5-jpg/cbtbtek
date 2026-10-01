'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Bell, Trash2, CheckCircle2, Clock, Sparkles, 
  ExternalLink, AlertCircle, Info, ChevronRight, Check
} from 'lucide-react';
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
      }
    }
    setIsLoading(false);
  };

  const hapusNotifikasi = async (id: string) => {
    if (!confirm('Yakin ingin menghapus pesan pengumuman ini?')) return;
    await supabase.from('notifikasi').delete().eq('id', id);
    setNotifikasi(prev => prev.filter(n => n.id !== id));
  };

  const hapusSemua = async () => {
    if (!confirm('Yakin ingin menghapus SEMUA pesan pengumuman?')) return;
    await supabase.from('notifikasi').delete().neq('id', 'dummy');
    setNotifikasi([]);
  };

  // Helper untuk memformat pesan menjadi tampilan yang cantik, rapi, dan terstruktur
  const renderFormattedContent = (pesan: string) => {
    if (!pesan) return null;

    // Pisahkan teks berdasarkan paragraf utama
    const blocks = pesan.split('\n\n').map(b => b.trim()).filter(Boolean);

    return (
      <div className="space-y-4 text-slate-700 text-sm md:text-[15px] leading-relaxed">
        {blocks.map((block, idx) => {
          // 1. Box Catatan Uji Coba / Warning
          if (block.includes('⚠️') || block.toUpperCase().includes('CATATAN TAHAP UJI COBA')) {
            const cleanText = block.replace(/📢\s*CATATAN TAHAP UJI COBA[^\n]*\n?/i, '').replace(/⚠️\s*Penting:\s*/i, '');
            return (
              <div key={idx} className="bg-amber-50/90 border-2 border-amber-200/90 rounded-2xl p-4 sm:p-5 text-amber-900 shadow-sm flex items-start gap-3 my-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                  <AlertCircle size={20} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-amber-950 text-sm flex items-center gap-1.5 uppercase tracking-wider">
                    Catatan Tahap Uji Coba & Masukan
                  </h4>
                  <p className="text-sm font-medium text-amber-900/90 leading-relaxed">
                    {cleanText}
                  </p>
                </div>
              </div>
            );
          }

          // 2. Card Tutorial Groq AI
          if (block.includes('🔑') || block.toUpperCase().includes('CARA MUDAH MENGAKTIFKAN GROQ AI')) {
            const lines = block.split('\n').filter(Boolean);
            const title = lines[0].replace(/🔑/g, '').trim();
            const steps = lines.slice(1);

            return (
              <div key={idx} className="bg-gradient-to-br from-purple-50/80 via-indigo-50/50 to-white border-2 border-purple-200/80 rounded-2xl p-5 sm:p-6 shadow-sm my-3 space-y-4">
                <div className="flex items-center gap-2.5 text-purple-900 font-extrabold text-base border-b border-purple-100 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    🔑
                  </div>
                  <span>{title}</span>
                </div>
                <div className="space-y-2.5">
                  {steps.map((st, sIdx) => {
                    const matchNumber = st.match(/^\d+\.\s*/);
                    const cleanStep = matchNumber ? st.replace(/^\d+\.\s*/, '') : st;
                    
                    // Render link & code gsk_
                    const renderInlineFormatting = (text: string) => {
                      const urlRegex = /(https?:\/\/[^\s]+)/g;
                      const parts = text.split(urlRegex);
                      return parts.map((part, pIdx) => {
                        if (part.match(urlRegex)) {
                          return (
                            <a 
                              key={pIdx} 
                              href={part} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-900 font-bold underline underline-offset-2 ml-1 mr-1"
                            >
                              {part} <ExternalLink size={12} />
                            </a>
                          );
                        }
                        if (part.includes('"gsk_..."') || part.includes('gsk_...')) {
                          return (
                            <code key={pIdx} className="bg-purple-100 text-purple-800 font-mono text-xs px-2 py-0.5 rounded font-bold border border-purple-200">
                              gsk_...
                            </code>
                          );
                        }
                        return part;
                      });
                    };

                    return (
                      <div key={sIdx} className="flex items-start gap-3 bg-white/80 p-2.5 sm:p-3 rounded-xl border border-purple-100/60 shadow-xs">
                        <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {sIdx + 1}
                        </span>
                        <div className="text-slate-800 font-medium text-sm leading-relaxed flex-1">
                          {renderInlineFormatting(cleanStep)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          // 3. Card Fitur Utama (🌟 atau 📌)
          if (block.includes('🌟') || block.includes('📌')) {
            const lines = block.split('\n').filter(Boolean);
            const title = lines[0].replace(/^[🌟📌]\s*/, '').trim();
            const bullets = lines.slice(1);

            return (
              <div key={idx} className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs my-3 space-y-2.5 hover:border-indigo-200 transition-colors">
                <h4 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                  <span className="text-indigo-600 font-black">✦</span> {title}
                </h4>
                {bullets.length > 0 && (
                  <ul className="space-y-1.5 pl-2 sm:pl-4">
                    {bullets.map((b, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2 text-slate-600 text-sm">
                        <span className="text-indigo-500 font-bold mt-1 text-xs">•</span>
                        <span className="flex-1 leading-relaxed">{b.replace(/^[•\-]\s*/, '')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }

          // 4. Salam Pembuka
          if (block.startsWith('Yth.') || block.startsWith('Halo')) {
            return (
              <p key={idx} className="font-bold text-slate-900 text-base border-l-4 border-indigo-600 pl-3 py-0.5">
                {block}
              </p>
            );
          }

          // 5. Salam Penutup
          if (block.includes('Salam hangat') || block.includes('Tim Pengembang')) {
            return (
              <div key={idx} className="pt-2 text-slate-600 font-medium italic text-sm">
                {block.split('\n').map((line, lIdx) => (
                  <div key={lIdx} className={lIdx > 0 ? "font-bold text-indigo-700 not-italic mt-0.5" : ""}>
                    {line}
                  </div>
                ))}
              </div>
            );
          }

          // Paragraf Teks Biasa
          return (
            <p key={idx} className="text-slate-700 leading-relaxed font-normal">
              {block}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 shrink-0">
            <Bell size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Pusat Informasi & Notifikasi</h1>
              <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-indigo-200">
                {notifikasi.length} Pesan
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium">
              Pengumuman resmi, rilis pembaruan versi, dan petunjuk sistem dari Developer CBT B-TEK.
            </p>
          </div>
        </div>

        {notifikasi.length > 0 && (
          <button 
            onClick={hapusSemua}
            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors border border-rose-200 self-start sm:self-center shadow-xs"
          >
            <Trash2 size={16} /> Bersihkan Semua
          </button>
        )}
      </div>

      {/* Daftar Pengumuman */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="bg-white rounded-2xl p-16 text-center text-slate-400 font-bold border border-slate-200 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="animate-pulse">Memuat pengumuman terbaru...</p>
          </div>
        ) : notifikasi.length === 0 ? (
          <div className="bg-white rounded-2xl p-16 text-center border border-slate-200 flex flex-col items-center justify-center shadow-sm">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4 text-emerald-500 border border-emerald-100">
              <CheckCircle2 size={44} />
            </div>
            <h3 className="text-xl font-extrabold text-slate-800 mb-1">Semua Pesan Telah Dibaca!</h3>
            <p className="text-slate-500 max-w-md text-sm font-medium">
              Tidak ada pengumuman baru saat ini. Anda akan mendapatkan notifikasi otomatis saat pembaruan fitur dirilis.
            </p>
          </div>
        ) : (
          notifikasi.map((item) => {
            const tgl = new Date(item.tanggal || item.created_at);
            const formattedDate = new Intl.DateTimeFormat('id-ID', {
              dateStyle: 'full',
              timeStyle: 'short'
            }).format(tgl);

            const isV41 = item.id.includes('v4-1') || item.judul?.includes('v4.1');
            const isV40 = item.id.includes('v4-0') || item.judul?.includes('v4.0');

            return (
              <div 
                key={item.id} 
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden ${
                  isV41 
                    ? 'border-purple-300 ring-2 ring-purple-100' 
                    : 'border-slate-200'
                }`}
              >
                {/* Header Card */}
                <div className={`p-5 sm:p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isV41 
                    ? 'bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-white border-purple-100' 
                    : isV40 
                    ? 'bg-indigo-50/50 border-indigo-100' 
                    : 'bg-slate-50 border-slate-100'
                }`}>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isV41 && (
                        <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-[11px] uppercase tracking-wider px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                          <Sparkles size={12} /> Rilis Resmi v4.1 (AI Enabled)
                        </span>
                      )}
                      {isV40 && (
                        <span className="bg-indigo-600 text-white font-black text-[11px] uppercase tracking-wider px-3 py-1 rounded-full shadow-xs">
                          Rilis Resmi v4.0
                        </span>
                      )}
                      {!item.dibaca && (
                        <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                          Baru
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {item.judul || 'Pengumuman Sistem'}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-2xs">
                      <Clock size={13} className="text-indigo-500" />
                      <span>{formattedDate}</span>
                    </div>
                    <button 
                      onClick={() => hapusNotifikasi(item.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100"
                      title="Hapus Pengumuman Ini"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-6 sm:p-8">
                  {renderFormattedContent(item.pesan)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
