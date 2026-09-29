'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Laptop, Clock, Grid, ChevronLeft, ChevronRight, HelpCircle, CheckCircle2, Link2, Lock, Maximize2, ShieldAlert, Trophy, Award, Sparkles, AlertTriangle, AlertCircle, Home, Check, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import 'katex/dist/katex.min.css';

// --- Komponen Interaktif Tarik Garis (Menjodohkan) ---
const JodohkanInteractive = ({ soal, jawabanData, onChange }: any) => {
  const [premis, setPremis] = useState<any[]>([]);
  const [respons, setRespons] = useState<any[]>([]);
  const [connections, setConnections] = useState<{premisId: string, responsId: string}[]>(jawabanData || []);
  const [drawing, setDrawing] = useState<{premisId: string, startX: number, startY: number, curX: number, curY: number} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [dots, setDots] = useState<Record<string, {x: number, y: number}>>({});

  useEffect(() => {
    try {
      let pData = typeof soal.opsi_a === 'string' ? JSON.parse(soal.opsi_a || '[]') : (soal.opsi_a || []);
      let rData = typeof soal.opsi_b === 'string' ? JSON.parse(soal.opsi_b || '[]') : (soal.opsi_b || []);
      
      // Enforce array type to prevent crash on .map or spread, and filter invalid items
      pData = (Array.isArray(pData) ? pData : []).filter((p: any) => p && typeof p.id !== 'undefined' && typeof p.text !== 'undefined');
      rData = (Array.isArray(rData) ? rData : []).filter((r: any) => r && typeof r.id !== 'undefined' && typeof r.text !== 'undefined');

      setPremis(pData);
      // Acak urutan respons agar ujian menantang
      setRespons([...rData].sort(() => Math.random() - 0.5));
    } catch(e) {
      console.error("Gagal parse opsi menjodohkan, mencoba mode teks fallback:", e);
      // Fallback untuk format data lama yang bukan JSON (misalnya "Indonesia|Jepang")
      let legacyP = String(soal.opsi_a || '').split('|').map((t, i) => ({ id: `legacy-p-${i}`, text: t.trim() })).filter(p => p.text);
      let legacyR = String(soal.opsi_b || '').split('|').map((t, i) => ({ id: `legacy-r-${i}`, text: t.trim() })).filter(r => r.text);
      
      setPremis(legacyP);
      setRespons(legacyR.sort(() => Math.random() - 0.5));
    }
  }, [soal]);

  // Sync initial connections when switching questions
  useEffect(() => {
    setConnections(Array.isArray(jawabanData) ? jawabanData : []);
  }, [soal]);

  useEffect(() => {
    onChange(connections);
  }, [connections]);

  const updateDots = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newDots: Record<string, {x: number, y: number}> = {};
    
    premis.forEach(p => {
      const el = document.getElementById(`dot-premis-${p.id}`);
      if (el) {
        const elRect = el.getBoundingClientRect();
        newDots[`premis-${p.id}`] = { x: elRect.left - rect.left + elRect.width / 2, y: elRect.top - rect.top + elRect.height / 2 };
      }
    });
    
    respons.forEach(r => {
      const el = document.getElementById(`dot-respons-${r.id}`);
      if (el) {
        const elRect = el.getBoundingClientRect();
        newDots[`respons-${r.id}`] = { x: elRect.left - rect.left + elRect.width / 2, y: elRect.top - rect.top + elRect.height / 2 };
      }
    });
    setDots(newDots);
  };

  useEffect(() => {
    updateDots();
    window.addEventListener('resize', updateDots);
    const timer = setTimeout(updateDots, 800); // Tunggu render rich-text images
    return () => {
      window.removeEventListener('resize', updateDots);
      clearTimeout(timer);
    };
  }, [premis, respons]);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    
    // Hapus koneksi lama dari premis ini jika ada
    setConnections(prev => prev.filter(c => c.premisId !== id));
    setDrawing({ premisId: id, startX, startY, curX: startX, curY: startY });
    
    // Tangkap pointer agar pergerakan cepat tetap terdeteksi
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drawing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDrawing({
      ...drawing,
      curX: e.clientX - rect.left,
      curY: e.clientY - rect.top
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!drawing) return;
    
    // Sembunyikan SVG sementara untuk mendeteksi elemen di bawah kursor
    const svgEl = document.getElementById('svg-overlay');
    if (svgEl) svgEl.style.display = 'none';
    
    const target = document.elementFromPoint(e.clientX, e.clientY);
    
    if (svgEl) svgEl.style.display = 'block';

    const dropZone = target?.closest('[data-respons-id]');
    
    if (dropZone) {
      const responsId = dropZone.getAttribute('data-respons-id');
      if (responsId) {
        setConnections(prev => {
          // Hanya izinkan 1 koneksi per respons juga
          const filtered = prev.filter(c => c.responsId !== responsId && c.premisId !== drawing.premisId);
          return [...filtered, { premisId: drawing.premisId, responsId }];
        });
      }
    }
    setDrawing(null);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full flex flex-col md:flex-row gap-8 md:gap-24 select-none touch-none min-h-[400px] p-4 bg-slate-50/50 rounded-2xl border border-slate-100"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="absolute inset-x-0 top-0 text-center -mt-3 text-xs font-bold text-slate-400 bg-white inline-block px-4 border rounded-full mx-auto w-max shadow-sm">
        Tarik titik dari kotak Kiri ke kotak Kanan (Klik garis untuk menghapus)
      </div>

      <svg id="svg-overlay" className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
        {connections.map(conn => {
          const pDot = dots[`premis-${conn.premisId}`];
          const rDot = dots[`respons-${conn.responsId}`];
          if (!pDot || !rDot) return null;
          return (
            <line 
              key={`${conn.premisId}-${conn.responsId}`}
              x1={pDot.x} y1={pDot.y} x2={rDot.x} y2={rDot.y}
              stroke="#4f46e5" strokeWidth="4" strokeLinecap="round"
              className="pointer-events-auto cursor-pointer hover:stroke-rose-500 transition-colors"
              onClick={() => setConnections(prev => prev.filter(c => c !== conn))}
            />
          );
        })}
        {drawing && (
          <line 
            x1={drawing.startX} y1={drawing.startY} x2={drawing.curX} y2={drawing.curY}
            stroke="#818cf8" strokeWidth="4" strokeDasharray="5,5" strokeLinecap="round"
          />
        )}
      </svg>

      {/* Kolom Kiri: Premis */}
      <div className="flex-1 flex flex-col gap-4 z-20 relative">
        <h3 className="font-bold text-slate-500 text-sm tracking-wider uppercase mb-2 flex items-center gap-2"><Link2 size={16}/> PREMIS</h3>
        {premis.map(p => (
          <div key={p.id} className="relative bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center group">
            <div dangerouslySetInnerHTML={{ __html: p.text }} className="flex-1 prose prose-slate prose-sm mr-4" />
            <div 
              id={`dot-premis-${p.id}`}
              onPointerDown={(e) => handlePointerDown(e, p.id)}
              className={clsx(
                "w-6 h-6 rounded-full cursor-grab active:cursor-grabbing border-4 flex-shrink-0 transition-all",
                connections.some(c => c.premisId === p.id) ? "bg-indigo-600 border-indigo-200 ring-4 ring-indigo-100" : "bg-white border-slate-300 hover:border-indigo-400 hover:scale-110"
              )}
            />
          </div>
        ))}
      </div>

      {/* Kolom Kanan: Respons */}
      <div className="flex-1 flex flex-col gap-4 z-20 relative">
        <h3 className="font-bold text-slate-500 text-sm tracking-wider uppercase mb-2 text-right">RESPONS</h3>
        {respons.map(r => (
          <div 
            key={r.id} 
            data-respons-id={r.id}
            className="relative bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center group transition-colors hover:border-indigo-300"
          >
            <div 
              id={`dot-respons-${r.id}`}
              className={clsx(
                "w-6 h-6 rounded-full border-4 flex-shrink-0 ml-1 mr-4 transition-all",
                connections.some(c => c.responsId === r.id) ? "bg-indigo-600 border-indigo-200 ring-4 ring-indigo-100" : "bg-white border-slate-300"
              )}
            />
            <div dangerouslySetInnerHTML={{ __html: r.text }} className="flex-1 prose prose-slate prose-sm" />
          </div>
        ))}
      </div>
    </div>
  );
};
// -----------------------------------------------------------

export default function UjianPage() {
  const [user, setUser] = useState<any>(null);
  const [paket, setPaket] = useState<any>(null);
  const [soalList, setSoalList] = useState<any[]>([]);
  const [indexSoal, setIndexSoal] = useState(0);
  const [jawaban, setJawaban] = useState<Record<string, any>>({});
  const [ragu, setRagu] = useState<Record<string, boolean>>({});
  const [sisaWaktu, setSisaWaktu] = useState(3600);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [cheatCount, setCheatCount] = useState(0);

  // Proteksi Layar & Kode Buka Blokir
  const [proteksiLayar, setProteksiLayar] = useState('ON');
  const [kodeBukaBlokir, setKodeBukaBlokir] = useState('BUKA123');
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [inputKodeBlokir, setInputKodeBlokir] = useState('');
  const [blokirError, setBlokirError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(true);

  // Pengaturan Tampil Nilai & Dialog Penyelesaian
  const [tampilNilai, setTampilNilai] = useState('ON');
  const [warningIncomplete, setWarningIncomplete] = useState<{
    isOpen: boolean;
    belumDijawab: number[];
    masihRagu: number[];
  } | null>(null);
  const [hasilSelesai, setHasilSelesai] = useState<{
    isOpen: boolean;
    skorAkhir: number;
    waktuPakai: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('pengaturan').select('*');
      if (data) {
        const pl = data.find((d: any) => d.kunci === 'proteksi_layar');
        if (pl) setProteksiLayar(pl.nilai);
        const kb = data.find((d: any) => d.kunci === 'kode_buka_blokir');
        if (kb) setKodeBukaBlokir(kb.nilai);
        const tn = data.find((d: any) => d.kunci === 'tampil_nilai');
        if (tn) setTampilNilai(tn.nilai);
      }
    };
    fetchConfig();
  }, []);

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
    
    const cheatKey = `cbt_cheat_${u.id}_${p.id}`;
    const savedCheat = localStorage.getItem(cheatKey);
    if (savedCheat) {
      setCheatCount(parseInt(savedCheat, 10));
    }
    
    const jwbKey = `cbt_jawaban_${u.id}_${p.id}`;
    const savedJwb = localStorage.getItem(jwbKey);
    if (savedJwb) setJawaban(JSON.parse(savedJwb));
    
    const rguKey = `cbt_ragu_${u.id}_${p.id}`;
    const savedRgu = localStorage.getItem(rguKey);
    if (savedRgu) setRagu(JSON.parse(savedRgu));
    
    const timerKey = `cbt_timer_${u.id}_${p.id}`;
    const savedTimer = localStorage.getItem(timerKey);
    if (savedTimer) {
      setSisaWaktu(parseInt(savedTimer, 10));
    } else {
      setSisaWaktu((p.durasi_menit || 60) * 60);
    }

    fetchSoal(p.id);

    // Coba aktifkan fullscreen
    aktivasiFullscreen();
  }, [router]);

  const fetchSoal = async (paketId: string) => {
    const { data: pengData } = await supabase.from('pengaturan').select('nilai').eq('kunci', 'acak_soal').maybeSingle();
    const isAcak = pengData?.nilai === 'ON';
    
    const { data } = await supabase.from('paket_soal').select('soal(*)').eq('paket_id', paketId);
    if (data) {
      let soalArr = data.map((r: any) => r.soal);
      if (isAcak) {
        soalArr = soalArr.sort(() => Math.random() - 0.5);
      }
      setSoalList(soalArr);
    }
  };

  const aktivasiFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (e) {
      setIsFullscreen(false);
      console.log('Fullscreen error:', e);
    }
  };

  const trgViolation = (alasan: string) => {
    if (isBlocked) return;
    setIsBlocked(true);
    setBlockReason(alasan);
    setInputKodeBlokir('');
    setBlokirError('');

    setCheatCount(prev => {
      const newCount = prev + 1;
      if (user && paket) {
        localStorage.setItem(`cbt_cheat_${user.id}_${paket.id}`, newCount.toString());
      }
      return newCount;
    });
  };

  useEffect(() => {
    if (!user || !paket) return;

    const handleVisibilityChange = () => {
      if (document.hidden && proteksiLayar !== 'OFF') {
        trgViolation('Terdeteksi keluar dari tab ujian atau berpindah aplikasi.');
      }
    };

    const handleFullscreenChange = () => {
      const inFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(inFs);
      if (!inFs && proteksiLayar !== 'OFF') {
        trgViolation('Terdeteksi keluar dari mode layar penuh (Fullscreen).');
      }
    };

    const handleContextMenu = (e: Event) => e.preventDefault();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [user, paket, proteksiLayar, isBlocked]);

  const handleBukaBlokir = async () => {
    const entered = inputKodeBlokir.trim().toUpperCase();
    const target = (kodeBukaBlokir || 'BUKA123').trim().toUpperCase();

    if (entered === target) {
      setIsBlocked(false);
      setBlokirError('');
      setInputKodeBlokir('');
      await aktivasiFullscreen();
    } else {
      setBlokirError('Kode buka blokir salah! Silakan minta kode yang valid kepada pengawas.');
    }
  };

  useEffect(() => {
    if (!paket || !user) return;
    const timerKey = `cbt_timer_${user.id}_${paket.id}`;
    
    const interval = setInterval(() => {
      // Jeda hitungan waktu jika ujian sedang diblokir
      if (isBlocked) return;

      setSisaWaktu((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          localStorage.removeItem(timerKey);
          handleSelesai(true);
          return 0;
        }
        const nextVal = prev - 1;
        localStorage.setItem(timerKey, nextVal.toString());
        return nextVal;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [paket, user, isBlocked]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleJawaban = (idSoal: string, answer: any) => {
    setJawaban(prev => {
      const next = { ...prev, [idSoal]: answer };
      localStorage.setItem(`cbt_jawaban_${user.id}_${paket.id}`, JSON.stringify(next));
      return next;
    });
  };

  const toggleRagu = (idSoal: string) => {
    setRagu(prev => {
      const next = { ...prev, [idSoal]: !prev[idSoal] };
      localStorage.setItem(`cbt_ragu_${user.id}_${paket.id}`, JSON.stringify(next));
      return next;
    });
  };

  const checkJawabanLengkap = () => {
    const belumDijawab: number[] = [];
    const masihRagu: number[] = [];

    soalList.forEach((soal, idx) => {
      const no = idx + 1;
      const jwb = jawaban[soal.id];
      let terisi = false;

      if (soal.tipe === 'Menjodohkan') {
        terisi = Array.isArray(jwb) && jwb.length > 0;
      } else if (soal.tipe === 'PG Kompleks') {
        terisi = Array.isArray(jwb) && jwb.length > 0;
      } else {
        terisi = jwb !== undefined && jwb !== null && String(jwb).trim() !== '';
      }

      if (!terisi) {
        belumDijawab.push(no);
      } else if (ragu[soal.id]) {
        masihRagu.push(no);
      }
    });

    return {
      isLengkap: belumDijawab.length === 0 && masihRagu.length === 0,
      belumDijawab,
      masihRagu
    };
  };

  const handleSelesai = async (isAutoSubmit = false) => {
    if (!isAutoSubmit) {
      const status = checkJawabanLengkap();
      if (!status.isLengkap) {
        setWarningIncomplete({
          isOpen: true,
          belumDijawab: status.belumDijawab,
          masihRagu: status.masihRagu
        });
        return;
      }

      if (!confirm('Apakah Anda yakin ingin menyelesaikan ujian? Seluruh soal telah dijawab. Nilai Anda akan segera diproses.')) {
        return;
      }
    }

    setIsSubmitting(true);
    
    // --- Kalkulasi Skor ---
    let totalSkorBenar = 0;
    let totalSkorMaks = 0;

    soalList.forEach(soal => {
      const bobot = soal.skor_maks || 10;
      totalSkorMaks += bobot;
      
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
           // Skor proporsional
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
         if (soal.kunci && jwbSiswa.toLowerCase().trim() === soal.kunci.toLowerCase().trim()) {
            totalSkorBenar += bobot;
         }
      }
    });

    // Skala 100
    const skorAkhir = totalSkorMaks > 0 ? Math.round((totalSkorBenar / totalSkorMaks) * 100) : 0;
    const durasiAwal = (paket.durasi_menit || 60) * 60;
    const waktuDigunakan = Math.max(0, durasiAwal - sisaWaktu);
    const mPakai = Math.floor(waktuDigunakan / 60);
    const sPakai = waktuDigunakan % 60;
    const formatWaktuPakai = `${mPakai} menit ${sPakai} detik`;

    try {
      await supabase.from('hasil').insert({
        user_id: user.id,
        paket_id: paket.id,
        waktu_sisa: sisaWaktu,
        detail_jawaban: jawaban,
        status_koreksi: 'Selesai',
        skor_akhir: skorAkhir,
        cheat_count: cheatCount
      });

      await supabase.from('users').update({ status_ujian: 'Selesai', status_login: '0' }).eq('id', user.id);
      
      localStorage.removeItem('cbt_paket');
      localStorage.removeItem(`cbt_timer_${user.id}_${paket.id}`);
      localStorage.removeItem(`cbt_cheat_${user.id}_${paket.id}`);
      localStorage.removeItem(`cbt_jawaban_${user.id}_${paket.id}`);
      localStorage.removeItem(`cbt_ragu_${user.id}_${paket.id}`);

      // Buka Layar Hasil Selesai Ujian & Skor Beranimasi
      setHasilSelesai({
        isOpen: true,
        skorAkhir,
        waktuPakai: formatWaktuPakai
      });

      // Lepaskan mode fullscreen jika aktif
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch (e) {}

    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menyimpan ujian. Pastikan koneksi internet stabil.');
    } finally {
      setIsSubmitting(false);
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
  const isTimeCritical = sisaWaktu < 300; 

  // Global styles for rich text
  const richTextGlobalStyles = `
    .prose img { max-width: 100%; border-radius: 8px; }
    .prose p { margin-top: 0; margin-bottom: 1em; }
    .prose p:last-child { margin-bottom: 0; }
  `;

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <style dangerouslySetInnerHTML={{__html: richTextGlobalStyles}} />
      
      {/* Banner Peringatan Fullscreen */}
      {!isFullscreen && proteksiLayar !== 'OFF' && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center text-xs md:text-sm font-bold flex items-center justify-center gap-3 z-30 shadow-md">
          <ShieldAlert size={18} className="animate-bounce" />
          <span>Ujian ini wajib dalam mode Layar Penuh (Fullscreen).</span>
          <button 
            onClick={aktivasiFullscreen} 
            className="bg-white text-amber-900 px-3 py-1 rounded-full text-xs font-black shadow-sm hover:bg-amber-50 transition active:scale-95 flex items-center gap-1"
          >
            <Maximize2 size={14} /> Aktifkan Fullscreen
          </button>
        </div>
      )}

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
          <div className={clsx(
            "px-4 py-2 rounded-full font-black shadow-sm flex items-center gap-2 border transition-colors duration-500",
            isTimeCritical ? "bg-red-50 text-red-600 border-red-200 animate-pulse" : "bg-indigo-50 text-indigo-700 border-indigo-100"
          )}>
            <Clock size={18} className={isTimeCritical ? "animate-bounce" : ""} />
            <span className="tracking-wider">{formatTime(sisaWaktu)}</span>
          </div>
          
          <button 
            onClick={() => setIsNavOpen(!isNavOpen)} 
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 md:px-5 py-2 md:py-2.5 rounded-full font-bold shadow-md shadow-indigo-600/20 transition-all active:scale-95 border border-indigo-500"
          >
            <Grid size={18} className={isNavOpen ? "opacity-50" : ""} />
            <span className="hidden sm:inline tracking-wider">{isNavOpen ? 'Tutup Daftar' : 'Daftar Soal'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row relative overflow-hidden max-w-7xl mx-auto w-full">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex flex-col pb-24 md:pb-8 scroll-smooth">
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
                className="text-base md:text-lg text-slate-800 mb-8 leading-relaxed font-medium prose prose-slate max-w-none prose-p:my-1"
                dangerouslySetInnerHTML={{ __html: soalAktif.pertanyaan }} 
              />
              
              {/* Pilihan Ganda */}
              {(soalAktif.tipe === 'PG' || soalAktif.tipe === 'PG Kompleks') && (
                <div className="space-y-4">
                  {['a', 'b', 'c', 'd', 'e'].map((opt) => {
                    const key = `opsi_${opt}` as keyof typeof soalAktif;
                    if (!soalAktif[key] || soalAktif[key].trim() === '<p><br></p>') return null;
                    const isSelected = soalAktif.tipe === 'PG Kompleks' 
                      ? (jawaban[soalAktif.id] || []).includes(opt.toUpperCase())
                      : jawaban[soalAktif.id] === opt.toUpperCase();

                    const handleCheck = () => {
                      if (soalAktif.tipe === 'PG Kompleks') {
                        const currentArr = jawaban[soalAktif.id] || [];
                        if (isSelected) {
                          handleJawaban(soalAktif.id, currentArr.filter((a:string) => a !== opt.toUpperCase()));
                        } else {
                          handleJawaban(soalAktif.id, [...currentArr, opt.toUpperCase()]);
                        }
                      } else {
                        handleJawaban(soalAktif.id, opt.toUpperCase());
                      }
                    };

                    return (
                      <label 
                        key={opt}
                        className={clsx(
                          "group flex items-start gap-4 p-4 md:p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ease-in-out",
                          isSelected ? "border-indigo-500 bg-indigo-50/50 shadow-md shadow-indigo-100" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                        )}
                      >
                        <div className="relative flex items-center justify-center pt-1">
                          <input 
                            type={soalAktif.tipe === 'PG Kompleks' ? "checkbox" : "radio"} 
                            name={`soal_${soalAktif.id}`}
                            checked={isSelected}
                            onChange={handleCheck}
                            className="sr-only"
                          />
                          <div className={clsx(
                            "w-6 h-6 border-2 flex items-center justify-center transition-all",
                            soalAktif.tipe === 'PG Kompleks' ? "rounded-md" : "rounded-full",
                            isSelected ? "border-indigo-600 bg-indigo-600" : "border-slate-300 group-hover:border-indigo-400"
                          )}>
                            {isSelected && (
                              soalAktif.tipe === 'PG Kompleks' 
                                ? <CheckCircle2 size={16} className="text-white"/>
                                : <div className="w-2.5 h-2.5 bg-white rounded-full scale-100 transition-transform"></div>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 flex gap-3 overflow-hidden">
                          <span className={clsx("font-black text-lg", isSelected ? "text-indigo-700" : "text-slate-400 group-hover:text-indigo-500")}>
                            {opt.toUpperCase()}.
                          </span>
                          <div dangerouslySetInnerHTML={{ __html: soalAktif[key] }} className={clsx(
                            "flex-1 prose prose-slate prose-sm overflow-hidden",
                            isSelected ? "text-indigo-900 font-medium" : "text-slate-700"
                          )} />
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Menjodohkan */}
              {soalAktif.tipe === 'Menjodohkan' && (
                <JodohkanInteractive 
                  soal={soalAktif} 
                  jawabanData={jawaban[soalAktif.id]} 
                  onChange={(data: any) => handleJawaban(soalAktif.id, data)}
                />
              )}

              {/* Essay */}
              {(soalAktif.tipe === 'Isian' || soalAktif.tipe === 'Essay') && (
                <div className="relative group mt-4">
                  <textarea 
                    className="w-full border-2 border-slate-200 p-5 rounded-xl text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all min-h-[200px] resize-y text-lg"
                    placeholder="Ketik jawaban lengkap Anda di sini..."
                    value={jawaban[soalAktif.id] || ''}
                    onChange={(e) => handleJawaban(soalAktif.id, e.target.value)}
                  />
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
                ragu[soalAktif.id] ? "bg-amber-500 text-white shadow-amber-500/30 hover:bg-amber-600" : "bg-white border border-amber-200 text-amber-600 hover:bg-amber-50"
              )}
            >
              <HelpCircle size={20} className={ragu[soalAktif.id] ? "fill-amber-600/20" : ""} /> 
              <span className="hidden sm:inline">Ragu-ragu</span>
            </button>

            {indexSoal === soalList.length - 1 ? (
              <button 
                onClick={() => handleSelesai(false)}
                disabled={isSubmitting}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3.5 md:px-6 rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 font-bold transition-all active:scale-95 disabled:opacity-50"
              >
                <span className="hidden sm:inline">{isSubmitting ? 'Menyimpan...' : 'Selesai Ujian'}</span> <CheckCircle2 size={20} />
              </button>
            ) : (
              <button 
                onClick={() => setIndexSoal(Math.min(soalList.length - 1, indexSoal + 1))}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3.5 md:px-6 rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 font-bold transition-all active:scale-95"
              >
                <span className="hidden sm:inline">Soal Berikutnya</span> <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Sidebar Nav */}
        {isNavOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsNavOpen(false)} />
        )}
        <div className={clsx(
          "fixed right-0 top-0 h-full w-[280px] md:w-[320px] bg-white border-l border-slate-200 p-5 flex flex-col shadow-2xl z-50 transition-transform duration-300 ease-out transform",
          isNavOpen ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-5">
            <h3 className="font-extrabold text-slate-800 tracking-wide flex items-center gap-2">
              <Grid size={18} className="text-indigo-500" /> NAVIGASI SOAL
            </h3>
            <button onClick={() => setIsNavOpen(false)} className="text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-5 gap-2.5 flex-grow overflow-y-auto content-start pb-4 pr-1 custom-scrollbar">
            {soalList.map((soal, i) => {
              const isCurrent = i === indexSoal;
              let hasAnswer = false;
              if (soal.tipe === 'Menjodohkan') {
                hasAnswer = jawaban[soal.id] && jawaban[soal.id].length > 0;
              } else if (soal.tipe === 'PG Kompleks') {
                hasAnswer = jawaban[soal.id] && jawaban[soal.id].length > 0;
              } else {
                hasAnswer = jawaban[soal.id] && jawaban[soal.id].trim() !== '';
              }
              const isRagu = ragu[soal.id];

              return (
                <button
                  key={soal.id}
                  onClick={() => { setIndexSoal(i); if (window.innerWidth < 768) setIsNavOpen(false); }}
                  className={clsx(
                    "aspect-square rounded-xl font-bold text-sm flex items-center justify-center transition-all duration-200",
                    isCurrent ? "ring-4 ring-indigo-500/30 scale-110 z-10" : "hover:scale-105",
                    isRagu ? "bg-amber-400 text-amber-900 shadow-sm shadow-amber-400/40" 
                      : hasAnswer ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/40" 
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-5 border-t border-slate-100 mt-auto space-y-4">
            <button 
              onClick={() => handleSelesai(false)}
              disabled={isSubmitting}
              className={clsx(
                "w-full py-4 rounded-xl font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50",
                Object.keys(jawaban).length === soalList.length && !Object.values(ragu).some(Boolean)
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30" 
                  : "bg-slate-800 hover:bg-slate-900 text-white shadow-lg shadow-slate-800/20"
              )}
            >
              <CheckCircle2 size={18} /> {isSubmitting ? 'MENYIMPAN...' : 'SELESAI UJIAN'}
            </button>
          </div>
        </div>
      </main>

      {/* Modal Buka Blokir Pelanggaran */}
      {isBlocked && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[999] flex items-center justify-center p-4 select-none">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full text-center shadow-2xl border-4 border-rose-500 animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-rose-200">
              <Lock size={32} />
            </div>
            
            <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">UJIAN DIHENTIKAN SEMENTARA</h2>
            
            <div className="text-xs md:text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 my-3">
              {blockReason || 'Terdeteksi aktivitas yang melanggar aturan ujian.'}
            </div>
            
            <p className="text-xs md:text-sm text-slate-600 font-medium mb-6 leading-relaxed">
              Anda terdeteksi keluar dari mode layar penuh atau berpindah aplikasi/tab. Silakan panggil <b>Pengawas Ujian</b> untuk memasukkan kode verifikasi guna membuka kembali lembar ujian.
            </p>
            
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="KODE PENGAWAS" 
                value={inputKodeBlokir} 
                onChange={e => { setInputKodeBlokir(e.target.value); setBlokirError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleBukaBlokir(); }}
                autoFocus
                className="w-full text-center text-xl md:text-2xl font-black uppercase tracking-[0.25em] px-4 py-3.5 border-2 border-slate-300 rounded-2xl outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/20 text-slate-800 placeholder:text-slate-300 placeholder:tracking-normal placeholder:font-bold placeholder:text-sm"
              />
              
              {blokirError && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-lg">{blokirError}</p>
              )}
              
              <button 
                onClick={handleBukaBlokir} 
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-rose-600/30 transition-all active:scale-[0.98] text-sm tracking-wider"
              >
                BUKA BLOKIR SEKARANG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Peringatan Jawaban Belum Lengkap */}
      {warningIncomplete?.isOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in select-none">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full text-center shadow-2xl border border-amber-200">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200 animate-bounce">
              <AlertTriangle size={32} />
            </div>

            <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">UJIAN BELUM DAPAT DISELESAIKAN!</h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium mt-1 mb-4 leading-relaxed">
              Sesuai aturan, Anda <b>wajib menjawab semua soal</b> dan memastikan tidak ada soal yang masih ditandai ragu-ragu sebelum dapat mengakhiri ujian.
            </p>

            <div className="space-y-3 mb-6 text-left">
              {warningIncomplete.belumDijawab.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider mb-1.5">
                    <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
                    <span>{warningIncomplete.belumDijawab.length} Soal Belum Dijawab:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2 max-h-36 overflow-y-auto pr-1">
                    {warningIncomplete.belumDijawab.map(no => (
                      <button
                        key={no}
                        onClick={() => {
                          setIndexSoal(no - 1);
                          setWarningIncomplete(null);
                        }}
                        className="bg-white border border-rose-300 hover:bg-rose-600 hover:text-white text-rose-700 font-black text-xs px-2.5 py-1 rounded-lg transition shadow-sm active:scale-95"
                        title={`Klik untuk langsung ke soal nomor ${no}`}
                      >
                        No. {no}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {warningIncomplete.masihRagu.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider mb-1.5">
                    <HelpCircle size={16} className="text-amber-600 flex-shrink-0" />
                    <span>{warningIncomplete.masihRagu.length} Soal Masih Bertanda Ragu-Ragu:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2 max-h-36 overflow-y-auto pr-1">
                    {warningIncomplete.masihRagu.map(no => (
                      <button
                        key={no}
                        onClick={() => {
                          setIndexSoal(no - 1);
                          setWarningIncomplete(null);
                        }}
                        className="bg-white border border-amber-300 hover:bg-amber-500 hover:text-white text-amber-800 font-black text-xs px-2.5 py-1 rounded-lg transition shadow-sm active:scale-95"
                        title={`Klik untuk memeriksa soal nomor ${no}`}
                      >
                        No. {no}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                const targetNo = warningIncomplete.belumDijawab[0] || warningIncomplete.masihRagu[0] || 1;
                setIndexSoal(targetNo - 1);
                setWarningIncomplete(null);
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-600/30 transition active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Lanjutkan Mengerjakan</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Layar Penyelesaian Ujian & Skor (Hasil Akhir) */}
      {hasilSelesai?.isOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[1000] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-500 select-none">
          {/* Efek Latar Belakang Beranimasi */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/30 rounded-full blur-3xl animate-pulse pointer-events-none"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse delay-1000 pointer-events-none"></div>

          <div className="relative bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-10 max-w-xl w-full text-center shadow-2xl border border-slate-100 my-8">
            
            {tampilNilai === 'ON' ? (
              <>
                {/* Tampilan Dengan Nilai (ON) */}
                <div className="relative mx-auto w-24 h-24 mb-6">
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-yellow-200 rounded-full blur-xl opacity-70 animate-pulse"></div>
                  <div className="relative w-24 h-24 bg-gradient-to-tr from-amber-500 to-yellow-400 text-white rounded-full flex items-center justify-center shadow-xl shadow-amber-500/40 border-4 border-white">
                    <Trophy size={48} className="animate-bounce" />
                  </div>
                  <div className="absolute -top-1 -right-1 bg-indigo-600 text-white p-1.5 rounded-full shadow">
                    <Sparkles size={16} />
                  </div>
                </div>

                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                  SELAMAT, UJIAN SELESAI!
                </h1>
                <p className="text-xs md:text-sm text-slate-500 font-medium mt-1 mb-6">
                  Seluruh lembar jawaban Anda telah berhasil disimpan dan dinilai oleh sistem CBT B-TEK.
                </p>

                {/* Kartu Skor Besar Bergradasi */}
                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white rounded-3xl p-6 md:p-8 shadow-xl shadow-indigo-600/30 mb-6">
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                  
                  <span className="text-xs font-black uppercase tracking-[0.25em] text-indigo-200 block mb-2">
                    SKOR AKHIR ANDA
                  </span>
                  
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-6xl md:text-7xl font-black tracking-tight drop-shadow-md">
                      {hasilSelesai.skorAkhir}
                    </span>
                    <span className="text-xl md:text-2xl text-indigo-200 font-bold">/ 100</span>
                  </div>

                  <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold tracking-wide">
                    <Award size={14} className="text-yellow-300" />
                    <span>
                      {hasilSelesai.skorAkhir >= 85 ? 'Sangat Memuaskan! 🌟' :
                       hasilSelesai.skorAkhir >= 75 ? 'Kompeten / Tuntas 👍' :
                       hasilSelesai.skorAkhir >= 60 ? 'Cukup Baik 📝' : 'Perlu Peningkatan Belajar 💪'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Tampilan Tanpa Nilai (OFF) */}
                <div className="relative mx-auto w-24 h-24 mb-6">
                  <div className="absolute inset-0 bg-emerald-400/30 rounded-full blur-xl animate-pulse"></div>
                  <div className="relative w-24 h-24 bg-gradient-to-tr from-emerald-500 to-teal-400 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/40 border-4 border-white">
                    <CheckCircle2 size={48} className="animate-bounce" />
                  </div>
                </div>

                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
                  UJIAN TELAH SELESAI!
                </h1>
                
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 my-5 text-emerald-900 text-xs md:text-sm font-medium leading-relaxed">
                  Jawaban Anda telah berhasil tersimpan dengan aman ke server. Pengumuman nilai akhir akan disampaikan oleh Guru / Pengawas Ujian.
                </div>
              </>
            )}

            {/* Info Rincian */}
            <div className="grid grid-cols-2 gap-3 mb-6 text-left text-xs">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 font-bold block uppercase text-[10px] tracking-wider mb-1">PESERTA</span>
                <span className="font-bold text-slate-800 truncate block text-sm">{user?.nama}</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-400 font-bold block uppercase text-[10px] tracking-wider mb-1">PAKET UJIAN</span>
                <span className="font-bold text-slate-800 truncate block text-sm">{paket?.nama_paket}</span>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 font-bold block uppercase text-[10px] tracking-wider mb-0.5">WAKTU PENGERJAAN</span>
                  <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <Clock size={13} className="text-indigo-500" /> {hasilSelesai.waktuPakai}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-bold block uppercase text-[10px] tracking-wider mb-0.5">STATUS</span>
                  <span className="font-black text-emerald-600 text-xs flex items-center gap-1">
                    <Check size={14} /> Berhasil Terkirim
                  </span>
                </div>
              </div>
            </div>

            {/* Tombol Keluar */}
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-lg shadow-slate-800/20 transition active:scale-95 flex items-center justify-center gap-2 text-sm md:text-base tracking-wide"
            >
              <Home size={18} />
              <span>KEMBALI KE BERANDA</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
