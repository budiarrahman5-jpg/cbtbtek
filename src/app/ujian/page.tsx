'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Laptop, Clock, Grid, ChevronLeft, ChevronRight, HelpCircle, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

export default function UjianPage() {
  const [user, setUser] = useState<any>(null);
  const [paket, setPaket] = useState<any>(null);
  const [soalList, setSoalList] = useState<any[]>([]);
  const [indexSoal, setIndexSoal] = useState(0);
  const [jawaban, setJawaban] = useState<Record<string, any>>({});
  const [ragu, setRagu] = useState<Record<string, boolean>>({});
  const [sisaWaktu, setSisaWaktu] = useState(3600);
  const [isNavOpen, setIsNavOpen] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    const savedUser = localStorage.getItem('cbt_user');
    const savedPaket = localStorage.getItem('cbt_paket');
    
    if (!savedUser || !savedPaket) {
      router.push('/');
      return;
    }

    const u = JSON.parse(savedUser);
    const p = JSON.parse(savedPaket);
    
    setUser(u);
    setPaket(p);
    fetchSoal(p.id);
  }, [router]);

  const fetchSoal = async (paketId: string) => {
    const { data } = await supabase.from('soal').select('*').eq('paket_id', paketId);
    if (data) setSoalList(data);
  };

  useEffect(() => {
    if (!paket) return;
    const interval = setInterval(() => {
      setSisaWaktu((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSelesai();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [paket]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleJawaban = (idSoal: string, answer: any) => {
    setJawaban(prev => ({ ...prev, [idSoal]: answer }));
  };

  const toggleRagu = (idSoal: string) => {
    setRagu(prev => ({ ...prev, [idSoal]: !prev[idSoal] }));
  };

  const handleSelesai = async () => {
    if (!confirm('Apakah Anda yakin ingin menyelesaikan ujian? Anda tidak bisa mengulangi ujian ini lagi.')) return;
    
    try {
      await supabase.from('hasil').insert({
        user_id: user.id,
        paket_id: paket.id,
        waktu_sisa: sisaWaktu,
        detail_jawaban: jawaban,
        status_koreksi: 'Selesai'
      });

      await supabase.from('users').update({ status_ujian: 'Selesai', status_login: '0' }).eq('id', user.id);
      
      localStorage.removeItem('cbt_paket');
      alert('Ujian berhasil diselesaikan!');
      router.push('/');
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menyimpan ujian.');
    }
  };

  if (!user || !paket || soalList.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-indigo-700 animate-pulse">Menyiapkan Lembar Ujian...</p>
      </div>
    );
  }

  const soalAktif = soalList[indexSoal];
  const isTimeCritical = sisaWaktu < 300; // Kurang dari 5 menit

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Premium Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 p-3 md:p-4 shadow-sm flex justify-between items-center z-10 flex-shrink-0 sticky top-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-md shadow-indigo-600/20 hidden sm:block">
            <Laptop className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-bold tracking-tight text-slate-800 truncate">{paket.nama_paket}</h1>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">Peserta: {user.nama}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:gap-5 text-xs md:text-base flex-shrink-0">
          {/* Timer */}
          <div className={clsx(
            "px-4 py-2 rounded-full font-black shadow-sm flex items-center gap-2 border transition-colors duration-500",
            isTimeCritical 
              ? "bg-red-50 text-red-600 border-red-200 animate-pulse" 
              : "bg-indigo-50 text-indigo-700 border-indigo-100"
          )}>
            <Clock size={18} className={isTimeCritical ? "animate-bounce" : ""} />
            <span className="tracking-wider">{formatTime(sisaWaktu)}</span>
          </div>
          
          <button 
            onClick={() => setIsNavOpen(!isNavOpen)} 
            className="text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 p-2 rounded-lg border border-slate-200 transition-all active:scale-95"
            title="Navigasi Soal"
          >
            <Grid size={22} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row relative overflow-hidden max-w-7xl mx-auto w-full">
        
        {/* Area Soal */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex flex-col pb-24 md:pb-8 scroll-smooth">
          {/* Question Card */}
          <div className="bg-white p-6 md:p-10 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 flex-1 relative flex flex-col transition-all duration-300">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white font-black text-lg shadow-md shadow-indigo-600/30">
                  {indexSoal + 1}
                </span>
                <h2 className="text-sm font-bold text-slate-400 tracking-widest uppercase">Soal Ujian</h2>
              </div>
              <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">
                {soalAktif.tipe}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div 
                className="text-base md:text-xl text-slate-800 mb-8 leading-relaxed font-medium prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: soalAktif.pertanyaan }} 
              />
              
              {/* Pilihan Ganda */}
              {soalAktif.tipe === 'PG' && (
                <div className="space-y-4">
                  {['a', 'b', 'c', 'd', 'e'].map((opt) => {
                    const key = `opsi_${opt}` as keyof typeof soalAktif;
                    if (!soalAktif[key]) return null;
                    const isSelected = jawaban[soalAktif.id] === opt.toUpperCase();

                    return (
                      <label 
                        key={opt}
                        className={clsx(
                          "group flex items-start gap-4 p-4 md:p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ease-in-out",
                          isSelected 
                            ? "border-indigo-500 bg-indigo-50/50 shadow-md shadow-indigo-100" 
                            : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                        )}
                      >
                        <div className="relative flex items-center justify-center pt-1">
                          <input 
                            type="radio" 
                            name={`soal_${soalAktif.id}`}
                            value={opt.toUpperCase()}
                            checked={isSelected}
                            onChange={(e) => handleJawaban(soalAktif.id, e.target.value)}
                            className="sr-only"
                          />
                          <div className={clsx(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                            isSelected ? "border-indigo-600 bg-indigo-600" : "border-slate-300 group-hover:border-indigo-400"
                          )}>
                            {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full scale-100 transition-transform"></div>}
                          </div>
                        </div>
                        <div className="flex-1 flex gap-3">
                          <span className={clsx(
                            "font-black text-lg",
                            isSelected ? "text-indigo-700" : "text-slate-400 group-hover:text-indigo-500"
                          )}>
                            {opt.toUpperCase()}.
                          </span>
                          <div dangerouslySetInnerHTML={{ __html: soalAktif[key] }} className={clsx(
                            "flex-1 pt-1",
                            isSelected ? "text-indigo-900 font-medium" : "text-slate-700"
                          )} />
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Essay */}
              {(soalAktif.tipe === 'Isian' || soalAktif.tipe === 'Essay') && (
                <div className="relative group">
                  <textarea 
                    className="w-full border-2 border-slate-200 p-5 rounded-xl text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all min-h-[200px] resize-y text-lg"
                    placeholder="Ketik jawaban lengkap Anda di sini..."
                    value={jawaban[soalAktif.id] || ''}
                    onChange={(e) => handleJawaban(soalAktif.id, e.target.value)}
                  />
                  <div className="absolute bottom-4 right-4 text-xs font-bold text-slate-300 group-focus-within:text-indigo-300 transition-colors">
                    {jawaban[soalAktif.id]?.length || 0} karakter
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-between mt-6 gap-3 md:gap-4 flex-shrink-0">
            <button 
              onClick={() => setIndexSoal(Math.max(0, indexSoal - 1))}
              disabled={indexSoal === 0}
              className="bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 disabled:opacity-50 disabled:hover:bg-white disabled:cursor-not-allowed px-4 py-3.5 md:px-6 rounded-xl shadow-sm flex items-center justify-center gap-2 font-bold transition-all active:scale-95"
            >
              <ChevronLeft size={20} /> <span className="hidden sm:inline">Soal Sebelumnya</span>
            </button>

            <button 
              onClick={() => toggleRagu(soalAktif.id)}
              className={clsx(
                "px-4 py-3.5 md:px-8 rounded-xl shadow-sm flex items-center justify-center gap-2 font-bold transition-all active:scale-95",
                ragu[soalAktif.id] 
                  ? "bg-amber-500 text-white shadow-amber-500/30 hover:bg-amber-600" 
                  : "bg-white border border-amber-200 text-amber-600 hover:bg-amber-50"
              )}
            >
              <HelpCircle size={20} className={ragu[soalAktif.id] ? "fill-amber-600/20" : ""} /> 
              <span className="hidden sm:inline">Ragu-ragu</span>
            </button>

            <button 
              onClick={() => setIndexSoal(Math.min(soalList.length - 1, indexSoal + 1))}
              disabled={indexSoal === soalList.length - 1}
              className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3.5 md:px-6 rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 font-bold transition-all active:scale-95"
            >
              <span className="hidden sm:inline">Soal Berikutnya</span> <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Sidebar */}
        {isNavOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity" 
            onClick={() => setIsNavOpen(false)} 
          />
        )}
        <div className={clsx(
          "fixed md:relative right-0 top-0 h-full w-[280px] md:w-[320px] bg-white border-l border-slate-200 p-5 flex flex-col shadow-2xl md:shadow-none z-50 transition-transform duration-300 ease-out transform",
          isNavOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        )}>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
            <h3 className="font-extrabold text-slate-800 tracking-wide flex items-center gap-2">
              <Grid size={18} className="text-indigo-500" /> NAVIGASI SOAL
            </h3>
            <button onClick={() => setIsNavOpen(false)} className="text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 p-1.5 rounded-lg transition-colors md:hidden">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-5 gap-2.5 flex-grow overflow-y-auto content-start pb-4 pr-1 custom-scrollbar">
            {soalList.map((soal, i) => {
              const isCurrent = i === indexSoal;
              const hasAnswer = jawaban[soal.id] && jawaban[soal.id].trim() !== '';
              const isRagu = ragu[soal.id];

              return (
                <button
                  key={soal.id}
                  onClick={() => { setIndexSoal(i); if (window.innerWidth < 768) setIsNavOpen(false); }}
                  className={clsx(
                    "aspect-square rounded-xl font-bold text-sm flex items-center justify-center transition-all duration-200",
                    isCurrent ? "ring-4 ring-indigo-500/30 scale-110 z-10" : "hover:scale-105",
                    isRagu 
                      ? "bg-amber-400 text-amber-900 shadow-sm shadow-amber-400/40" 
                      : hasAnswer 
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/40" 
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-5 border-t border-slate-100 mt-auto space-y-4">
            {/* Status Legend */}
            <div className="flex justify-center gap-4 text-xs font-semibold text-slate-500">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-indigo-600"></div> Dijawab</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-400"></div> Ragu</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-200 border border-slate-300"></div> Kosong</div>
            </div>
            
            <button 
              onClick={handleSelesai}
              className={clsx(
                "w-full py-4 rounded-xl font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
                Object.keys(jawaban).length === soalList.length && !Object.values(ragu).some(Boolean)
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30" 
                  : "bg-slate-800 hover:bg-slate-900 text-white shadow-lg shadow-slate-800/20"
              )}
            >
              <CheckCircle2 size={18} /> SELESAI UJIAN
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
