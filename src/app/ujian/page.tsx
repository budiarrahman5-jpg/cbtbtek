'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Laptop, Clock, Grid, ChevronLeft, ChevronRight, HelpCircle, AlertTriangle } from 'lucide-react';
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
  const [showCheatModal, setShowCheatModal] = useState(false);
  
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
    
    // Fetch soal
    fetchSoal(p.id);

    // Lock Fullscreen (Omitted for development ease, but can be added back for production)
  }, [router]);

  const fetchSoal = async (paketId: string) => {
    const { data, error } = await supabase
      .from('soal')
      .select('*')
      .eq('paket_id', paketId);

    if (data) {
      // Todo: Randomize soal based on settings
      setSoalList(data);
    }
  };

  // Timer logic
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
      // Simpan jawaban ke tabel hasil (Skor akan dihitung di Edge Function atau Backend Route, untuk sekarang kita simpan detailnya)
      await supabase.from('hasil').insert({
        user_id: user.id,
        paket_id: paket.id,
        waktu_sisa: sisaWaktu,
        detail_jawaban: jawaban,
        status_koreksi: 'Selesai'
      });

      // Update status user
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
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center font-bold">Memuat Soal...</div>;
  }

  const soalAktif = soalList[indexSoal];

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      {/* Header Ujian */}
      <header className="bg-blue-800 text-white p-3 md:p-4 shadow-md flex justify-between items-center z-10 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
          <Laptop className="w-6 h-6 md:w-7 md:h-7 flex-shrink-0" />
          <h1 className="text-sm md:text-xl font-bold tracking-wider truncate">Paket: {paket.nama_paket}</h1>
        </div>
        <div className="flex items-center gap-2 md:gap-4 text-xs md:text-base flex-shrink-0">
          <div className="hidden sm:flex items-center gap-2 font-semibold bg-blue-900 px-3 py-1 rounded">
            <span className="uppercase">{user.nama}</span>
          </div>
          
          <div className="bg-red-600 px-3 py-1.5 rounded-full font-bold shadow-inner flex items-center gap-1.5">
            <Clock size={16} /> <span>{formatTime(sisaWaktu)}</span>
          </div>
          <button 
            onClick={() => setIsNavOpen(!isNavOpen)} 
            className="text-white hover:text-gray-300 transition-colors"
          >
            <Grid size={24} />
          </button>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        
        {/* Area Soal */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col pb-24 md:pb-6">
          <div className="bg-white p-5 md:p-8 rounded-lg shadow-sm border border-gray-200 flex-1 relative flex flex-col">
            <div className="flex justify-between items-center border-b pb-3 mb-6">
              <h2 className="text-lg md:text-xl font-bold text-gray-800">SOAL NO. <span>{indexSoal + 1}</span></h2>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold uppercase">{soalAktif.tipe}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2">
              <div 
                className="text-base md:text-lg mb-6 leading-relaxed font-medium"
                dangerouslySetInnerHTML={{ __html: soalAktif.pertanyaan }} 
              />
              
              {/* Opsi Jawaban PG */}
              {soalAktif.tipe === 'PG' && (
                <div className="space-y-3">
                  {['a', 'b', 'c', 'd', 'e'].map((opt) => {
                    const key = `opsi_${opt}` as keyof typeof soalAktif;
                    if (!soalAktif[key]) return null;
                    const isSelected = jawaban[soalAktif.id] === opt.toUpperCase();

                    return (
                      <label 
                        key={opt}
                        className={clsx(
                          "flex items-center gap-4 p-3 md:p-4 rounded-lg border-2 cursor-pointer transition-all",
                          isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                        )}
                      >
                        <input 
                          type="radio" 
                          name={`soal_${soalAktif.id}`}
                          value={opt.toUpperCase()}
                          checked={isSelected}
                          onChange={(e) => handleJawaban(soalAktif.id, e.target.value)}
                          className="w-5 h-5 text-blue-600"
                        />
                        <span className="font-bold text-gray-700">{opt.toUpperCase()}.</span>
                        <div dangerouslySetInnerHTML={{ __html: soalAktif[key] }} className="flex-1 text-gray-800" />
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Isian/Essay */}
              {(soalAktif.tipe === 'Isian' || soalAktif.tipe === 'Essay') && (
                <div>
                  <textarea 
                    className="w-full border-2 border-gray-300 p-4 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all min-h-[150px]"
                    placeholder="Ketik jawaban Anda di sini..."
                    value={jawaban[soalAktif.id] || ''}
                    onChange={(e) => handleJawaban(soalAktif.id, e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Tombol Navigasi Bawah */}
          <div className="flex justify-between mt-4 gap-2 flex-shrink-0">
            <button 
              onClick={() => setIndexSoal(Math.max(0, indexSoal - 1))}
              disabled={indexSoal === 0}
              className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-3 md:px-5 rounded shadow flex-1 flex items-center justify-center gap-2 font-bold transition-colors"
            >
              <ChevronLeft size={18} /> <span className="hidden sm:inline">SEBELUMNYA</span>
            </button>
            <button 
              onClick={() => toggleRagu(soalAktif.id)}
              className={clsx(
                "px-3 py-3 md:px-5 rounded shadow flex-1 flex items-center justify-center gap-2 font-bold transition-colors",
                ragu[soalAktif.id] ? "bg-yellow-600 text-white" : "bg-yellow-500 hover:bg-yellow-600 text-white"
              )}
            >
              <HelpCircle size={18} /> <span className="hidden sm:inline">RAGU</span>
            </button>
            <button 
              onClick={() => setIndexSoal(Math.min(soalList.length - 1, indexSoal + 1))}
              disabled={indexSoal === soalList.length - 1}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-3 md:px-5 rounded shadow flex-1 flex items-center justify-center gap-2 font-bold transition-colors"
            >
              <span className="hidden sm:inline">BERIKUTNYA</span> <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Sidebar Navigasi Soal (Desktop & Mobile) */}
        {isNavOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" 
            onClick={() => setIsNavOpen(false)} 
          />
        )}
        <div className={clsx(
          "fixed md:relative right-0 top-0 h-full w-72 md:w-80 bg-white border-l border-gray-200 p-4 flex flex-col shadow-2xl z-50 transition-transform duration-300 ease-in-out transform",
          isNavOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
        )}>
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h3 className="font-bold text-gray-700">NAVIGASI SOAL</h3>
            <button onClick={() => setIsNavOpen(false)} className="text-gray-500 hover:text-red-600 md:hidden">
              <Grid size={24} />
            </button>
          </div>
          
          <div className="grid grid-cols-5 gap-2 md:gap-3 flex-grow overflow-y-auto content-start pb-4">
            {soalList.map((soal, i) => {
              const isCurrent = i === indexSoal;
              const hasAnswer = jawaban[soal.id] && jawaban[soal.id].trim() !== '';
              const isRagu = ragu[soal.id];

              return (
                <button
                  key={soal.id}
                  onClick={() => { setIndexSoal(i); if (window.innerWidth < 768) setIsNavOpen(false); }}
                  className={clsx(
                    "aspect-square rounded border font-bold text-sm md:text-base flex items-center justify-center transition-all",
                    isCurrent ? "ring-2 ring-gray-400 scale-105" : "",
                    isRagu ? "bg-yellow-500 text-white border-yellow-600" :
                    hasAnswer ? "bg-blue-600 text-white border-blue-700" :
                    "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-gray-200 mt-auto">
            <button 
              onClick={handleSelesai}
              className={clsx(
                "w-full py-3 rounded font-bold shadow transition-all",
                Object.keys(jawaban).length === soalList.length 
                  ? "bg-green-600 hover:bg-green-700 text-white" 
                  : "bg-red-600 hover:bg-red-700 text-white opacity-90"
              )}
            >
              SELESAI UJIAN
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
