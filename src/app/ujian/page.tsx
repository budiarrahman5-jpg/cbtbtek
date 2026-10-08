'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Laptop, Clock, Grid, ChevronLeft, ChevronRight, ChevronDown, HelpCircle, CheckCircle2, Link2, Lock, Maximize2, ShieldAlert, ShieldCheck, Trophy, Award, Sparkles, AlertTriangle, AlertCircle, Home, Check, ArrowRight, BookOpen, Eye, X, XCircle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import 'katex/dist/katex.min.css';

// --- Komponen Interaktif Tarik Garis (Menjodohkan) ---
const PAIR_PALETTE = [
  { stroke: '#4f46e5', dotBg: 'bg-indigo-600', dotBorder: 'border-indigo-300 ring-indigo-100', cardActive: 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/40', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { stroke: '#059669', dotBg: 'bg-emerald-600', dotBorder: 'border-emerald-300 ring-emerald-100', cardActive: 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50/40', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { stroke: '#d97706', dotBg: 'bg-amber-600', dotBorder: 'border-amber-300 ring-amber-100', cardActive: 'ring-2 ring-amber-500 border-amber-400 bg-amber-50/40', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  { stroke: '#e11d48', dotBg: 'bg-rose-600', dotBorder: 'border-rose-300 ring-rose-100', cardActive: 'ring-2 ring-rose-500 border-rose-400 bg-rose-50/40', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
  { stroke: '#7c3aed', dotBg: 'bg-purple-600', dotBorder: 'border-purple-300 ring-purple-100', cardActive: 'ring-2 ring-purple-500 border-purple-400 bg-purple-50/40', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
  { stroke: '#0891b2', dotBg: 'bg-cyan-600', dotBorder: 'border-cyan-300 ring-cyan-100', cardActive: 'ring-2 ring-cyan-500 border-cyan-400 bg-cyan-50/40', badge: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  { stroke: '#ea580c', dotBg: 'bg-orange-600', dotBorder: 'border-orange-300 ring-orange-100', cardActive: 'ring-2 ring-orange-500 border-orange-400 bg-orange-50/40', badge: 'bg-orange-100 text-orange-700 border-orange-200' },
  { stroke: '#475569', dotBg: 'bg-slate-600', dotBorder: 'border-slate-300 ring-slate-100', cardActive: 'ring-2 ring-slate-500 border-slate-400 bg-slate-50/40', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
];

const JodohkanInteractive = ({ 
  soal, 
  jawabanData, 
  onChange,
  fontSize = 'base' 
}: {
  soal: any;
  jawabanData: any;
  onChange: (data: any) => void;
  fontSize?: 'sm' | 'base' | 'lg';
}) => {
  const [premis, setPremis] = useState<any[]>([]);
  const [respons, setRespons] = useState<any[]>([]);
  const [connections, setConnections] = useState<{premisId: string, responsId: string}[]>(Array.isArray(jawabanData) ? jawabanData : []);
  const [drawing, setDrawing] = useState<{premisId: string, startX: number, startY: number, curX: number, curY: number} | null>(null);
  const [selectedPremisId, setSelectedPremisId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'garis' | 'pilihan'>('garis');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dots, setDots] = useState<Record<string, {x: number, y: number}>>({});

  // Parse Opsi Premis & Respons
  useEffect(() => {
    try {
      let pData = typeof soal.opsi_a === 'string' ? JSON.parse(soal.opsi_a || '[]') : (soal.opsi_a || []);
      let rData = typeof soal.opsi_b === 'string' ? JSON.parse(soal.opsi_b || '[]') : (soal.opsi_b || []);
      
      pData = (Array.isArray(pData) ? pData : []).filter((p: any) => p && typeof p.id !== 'undefined' && typeof p.text !== 'undefined');
      rData = (Array.isArray(rData) ? rData : []).filter((r: any) => r && typeof r.id !== 'undefined' && typeof r.text !== 'undefined');

      setPremis(pData);
      setRespons([...rData].sort(() => Math.random() - 0.5));
    } catch(e) {
      console.error("Gagal parse opsi menjodohkan, mencoba mode teks fallback:", e);
      let legacyP = String(soal.opsi_a || '').split('|').map((t, i) => ({ id: `legacy-p-${i}`, text: t.trim() })).filter(p => p.text);
      let legacyR = String(soal.opsi_b || '').split('|').map((t, i) => ({ id: `legacy-r-${i}`, text: t.trim() })).filter(r => r.text);
      
      setPremis(legacyP);
      setRespons(legacyR.sort(() => Math.random() - 0.5));
    }
  }, [soal]);

  // Sync initial connections saat ganti soal
  useEffect(() => {
    setConnections(Array.isArray(jawabanData) ? jawabanData : []);
    setSelectedPremisId(null);
  }, [soal]);

  // Notifikasi perubahan jawaban ke parent
  useEffect(() => {
    onChange(connections);
  }, [connections]);

  // Kalkulasi posisi titik koneksi SVG
  const updateDots = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const newDots: Record<string, {x: number, y: number}> = {};
    
    premis.forEach(p => {
      const el = document.getElementById(`dot-premis-${p.id}`);
      if (el) {
        const elRect = el.getBoundingClientRect();
        newDots[`premis-${p.id}`] = { 
          x: elRect.left - rect.left + elRect.width / 2, 
          y: elRect.top - rect.top + elRect.height / 2 
        };
      }
    });
    
    respons.forEach(r => {
      const el = document.getElementById(`dot-respons-${r.id}`);
      if (el) {
        const elRect = el.getBoundingClientRect();
        newDots[`respons-${r.id}`] = { 
          x: elRect.left - rect.left + elRect.width / 2, 
          y: elRect.top - rect.top + elRect.height / 2 
        };
      }
    });
    setDots(newDots);
  };

  useEffect(() => {
    updateDots();
    const timer1 = setTimeout(updateDots, 150);
    const timer2 = setTimeout(updateDots, 600);

    const handleResizeOrScroll = () => updateDots();
    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => updateDots());
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [premis, respons, connections, viewMode, fontSize]);

  // Interaksi Drag-to-pair dengan Pointer
  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    if (!containerRef.current) return;
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    
    setDrawing({ premisId: id, startX, startY, curX: startX, curY: startY });
    setSelectedPremisId(id);
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
    
    const svgEl = document.getElementById('svg-overlay');
    if (svgEl) svgEl.style.display = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (svgEl) svgEl.style.display = 'block';

    const dropZone = target?.closest('[data-respons-id]');
    if (dropZone) {
      const responsId = dropZone.getAttribute('data-respons-id');
      if (responsId) {
        connectPair(drawing.premisId, responsId);
      }
    }
    setDrawing(null);
  };

  // Logika Menjodohkan
  const connectPair = (premisId: string, responsId: string) => {
    setConnections(prev => {
      const filtered = prev.filter(c => c.premisId !== premisId && c.responsId !== responsId);
      return [...filtered, { premisId, responsId }];
    });
    setSelectedPremisId(null);
  };

  const removeConnection = (premisId: string, responsId?: string) => {
    setConnections(prev => prev.filter(c => {
      if (responsId) return c.premisId !== premisId || c.responsId !== responsId;
      return c.premisId !== premisId;
    }));
  };

  const resetAllConnections = () => {
    setConnections([]);
    setSelectedPremisId(null);
  };

  // Helper Warna Palette Pasangan
  const getPairPalette = (pId: string, rId?: string) => {
    const idx = connections.findIndex(c => c.premisId === pId || (rId && c.responsId === rId));
    if (idx === -1) return null;
    return {
      ...PAIR_PALETTE[idx % PAIR_PALETTE.length],
      num: idx + 1
    };
  };

  // Skala Ukuran Font & Styling Responsif
  const cardFontClass = fontSize === 'sm'
    ? 'text-[11px] sm:text-xs md:text-sm'
    : fontSize === 'lg'
      ? 'text-sm sm:text-base md:text-lg'
      : 'text-xs sm:text-sm md:text-base';

  const proseClass = clsx(
    cardFontClass,
    "jodohkan-text max-w-none break-normal leading-snug sm:leading-relaxed select-text",
    "text-slate-950 font-bold",
    "[&_*]:text-slate-950 [&_p]:text-slate-950 [&_span]:text-slate-950 [&_strong]:text-slate-950 [&_div]:text-slate-950",
    "[&_img]:max-h-16 sm:[&_img]:max-h-24 md:[&_img]:max-h-32 [&_img]:w-auto [&_img]:mx-auto [&_img]:object-contain [&_img]:rounded-md [&_img]:shadow-sm",
    "[&_p]:m-0 [&_p+p]:mt-1"
  );

  return (
    <div className="w-full space-y-3">
      {/* Bar Navigasi & Info Bantuan Menjodohkan */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl text-xs">
        <div className="flex items-center gap-1.5 text-indigo-900 font-medium">
          <HelpCircle size={15} className="text-indigo-600 flex-shrink-0" />
          <span className="hidden sm:inline">
            {selectedPremisId 
              ? "Sekarang ketuk kotak Respons di kanan untuk menjodohkan."
              : "Ketuk/tarik dari Premis ke Respons. Ketuk pasangan untuk melepas."}
          </span>
          <span className="sm:hidden">
            {selectedPremisId ? "Ketuk Respons pasangannya" : "Ketuk Premis lalu Respons"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Toggle Mode Tampilan (Garis vs Pilihan Dropdown) */}
          <div className="flex items-center bg-white p-0.5 rounded-lg border border-indigo-200 shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('garis')}
              className={clsx(
                "px-2 py-1 rounded text-[11px] font-bold transition flex items-center gap-1",
                viewMode === 'garis' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-indigo-600"
              )}
              title="Tampilan Visual Tarik Garis (Side by Side)"
            >
              <Link2 size={12} />
              <span className="hidden xs:inline">Garis</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pilihan')}
              className={clsx(
                "px-2 py-1 rounded text-[11px] font-bold transition flex items-center gap-1",
                viewMode === 'pilihan' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-indigo-600"
              )}
              title="Tampilan Daftar Pilihan (Sangat nyaman di layar HP kecil)"
            >
              <Grid size={12} />
              <span className="hidden xs:inline">Pilihan</span>
            </button>
          </div>

          {/* Tombol Reset Jodohan */}
          {connections.length > 0 && (
            <button
              type="button"
              onClick={resetAllConnections}
              className="px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition flex items-center gap-1"
              title="Reset semua pasangan pada soal ini"
            >
              <RotateCcw size={12} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* MODE 1: VISUAL TARIK GARIS (2 Kolom Berdampingan Responsif) */}
      {viewMode === 'garis' && (
        <div 
          ref={containerRef}
          className="relative w-full select-none min-h-[300px] p-2 sm:p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* SVG Overlay Garis Penghubung */}
          <svg id="svg-overlay" className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
            {connections.map(conn => {
              const pDot = dots[`premis-${conn.premisId}`];
              const rDot = dots[`respons-${conn.responsId}`];
              if (!pDot || !rDot) return null;
              
              const palette = getPairPalette(conn.premisId, conn.responsId);
              const strokeColor = palette ? palette.stroke : '#4f46e5';
              const dx = Math.max(16, (rDot.x - pDot.x) * 0.45);
              const pathData = `M ${pDot.x} ${pDot.y} C ${pDot.x + dx} ${pDot.y}, ${rDot.x - dx} ${rDot.y}, ${rDot.x} ${rDot.y}`;

              return (
                <g key={`${conn.premisId}-${conn.responsId}`}>
                  {/* Garis bayangan transparan lebar agar mudah diklik/ditekan di HP */}
                  <path 
                    d={pathData}
                    stroke="transparent"
                    strokeWidth="20"
                    fill="none"
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => removeConnection(conn.premisId, conn.responsId)}
                  />
                  {/* Garis visual utama */}
                  <path 
                    d={pathData}
                    stroke={strokeColor}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    fill="none"
                    className="pointer-events-auto cursor-pointer hover:stroke-rose-500 transition-colors"
                    onClick={() => removeConnection(conn.premisId, conn.responsId)}
                  />
                </g>
              );
            })}

            {/* Garis Saat Sedang Menarik */}
            {drawing && (
              <path 
                d={`M ${drawing.startX} ${drawing.startY} C ${drawing.startX + Math.max(16, Math.abs(drawing.curX - drawing.startX) * 0.45)} ${drawing.startY}, ${drawing.curX - Math.max(16, Math.abs(drawing.curX - drawing.startX) * 0.45)} ${drawing.curY}, ${drawing.curX} ${drawing.curY}`}
                stroke="#6366f1"
                strokeWidth="3.5"
                strokeDasharray="6,4"
                strokeLinecap="round"
                fill="none"
              />
            )}
          </svg>

          {/* Layout Grid 2 Kolom (Premis Kiri, Respons Kanan) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-6 md:gap-16 items-start relative z-20">
            {/* Kolom Kiri: Premis */}
            <div className="flex flex-col gap-2.5 sm:gap-3.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-indigo-200">
                <span className="font-black text-indigo-950 text-xs sm:text-sm tracking-wider uppercase flex items-center gap-1.5">
                  <Link2 size={14} className="text-indigo-600" /> PREMIS (KIRI)
                </span>
                <span className="text-xs text-indigo-900 font-black bg-indigo-100/80 border border-indigo-300 px-2 py-0.5 rounded-md">{premis.length} Butir</span>
              </div>

              {premis.map((p, idx) => {
                const isSelected = selectedPremisId === p.id;
                const palette = getPairPalette(p.id);
                const isPaired = !!palette;

                return (
                  <div 
                    key={p.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedPremisId(null);
                      } else {
                        setSelectedPremisId(p.id);
                      }
                    }}
                    className={clsx(
                      "jodohkan-card relative p-3 sm:p-4 rounded-xl border-2 transition-all cursor-pointer group flex flex-col justify-between min-h-[64px] sm:min-h-[76px]",
                      isSelected
                        ? "border-indigo-600 ring-2 ring-indigo-500 bg-indigo-50/90 shadow-md shadow-indigo-100"
                        : isPaired
                          ? `${palette.cardActive} shadow-xs`
                          : "bg-white border-slate-300 hover:border-indigo-400 hover:bg-slate-50/80 shadow-xs"
                    )}
                  >
                    {/* Header Item: Nomor Urut & Badge Pasangan */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-xs font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 flex items-center gap-1">
                        #{idx + 1}
                      </span>
                      {palette && (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeConnection(p.id);
                          }}
                          className={clsx(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border transition hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300",
                            palette.badge
                          )}
                          title="Klik untuk memutuskan hubungan"
                        >
                          P{palette.num}
                          <X size={10} />
                        </span>
                      )}
                    </div>

                    {/* Konten Soal */}
                    <div 
                      dangerouslySetInnerHTML={{ __html: p.text }} 
                      className={clsx(proseClass, "flex-1 mr-2 sm:mr-3 text-slate-950 font-bold")} 
                    />

                    {/* Titik Koneksi Kanan (Drag Dot) */}
                    <div 
                      id={`dot-premis-${p.id}`}
                      onPointerDown={(e) => handlePointerDown(e, p.id)}
                      className={clsx(
                        "absolute -right-2 sm:-right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 sm:border-3 cursor-crosshair touch-none transition-transform z-30 flex items-center justify-center",
                        palette 
                          ? `${palette.dotBg} border-white ring-2 ring-indigo-200` 
                          : isSelected
                            ? "bg-indigo-600 border-white ring-4 ring-indigo-300 scale-125"
                            : "bg-white border-slate-400 hover:border-indigo-500 hover:scale-110"
                      )}
                      title="Tarik titik ini ke kotak Respons"
                    />
                  </div>
                );
              })}
            </div>

            {/* Kolom Kanan: Respons */}
            <div className="flex flex-col gap-2.5 sm:gap-3.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200">
                <span className="font-black text-emerald-950 text-xs sm:text-sm tracking-wider uppercase text-right w-full">
                  RESPONS (KANAN)
                </span>
              </div>

              {respons.map((r, idx) => {
                const palette = getPairPalette('', r.id);
                const isPaired = !!palette;

                return (
                  <div 
                    key={r.id} 
                    data-respons-id={r.id}
                    onClick={() => {
                      if (selectedPremisId) {
                        connectPair(selectedPremisId, r.id);
                      } else if (isPaired) {
                        // Jika sudah ada pasangan dan diklik langsung, lepas pasangan
                        const match = connections.find(c => c.responsId === r.id);
                        if (match) removeConnection(match.premisId, r.id);
                      }
                    }}
                    className={clsx(
                      "jodohkan-card relative p-3 sm:p-4 rounded-xl border-2 transition-all cursor-pointer group flex flex-col justify-between min-h-[64px] sm:min-h-[76px]",
                      selectedPremisId
                        ? "border-dashed border-indigo-500 bg-indigo-50/40 hover:border-indigo-600 hover:bg-indigo-100/70 ring-1 ring-indigo-300 shadow-xs"
                        : isPaired
                          ? `${palette.cardActive} shadow-xs`
                          : "bg-white border-slate-300 hover:border-indigo-400 hover:bg-slate-50/80 shadow-xs"
                    )}
                  >
                    {/* Header Item Respons: Badge Pasangan & Nomor */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      {palette ? (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            const match = connections.find(c => c.responsId === r.id);
                            if (match) removeConnection(match.premisId, r.id);
                          }}
                          className={clsx(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border transition hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300",
                            palette.badge
                          )}
                          title="Klik untuk memutuskan hubungan"
                        >
                          P{palette.num}
                          <X size={10} />
                        </span>
                      ) : <span />}
                      <span className="text-xs font-black text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {String.fromCharCode(65 + idx)}
                      </span>
                    </div>

                    {/* Titik Koneksi Kiri (Drop Dot) */}
                    <div 
                      id={`dot-respons-${r.id}`}
                      className={clsx(
                        "absolute -left-2 sm:-left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 sm:border-3 pointer-events-none transition-all z-30",
                        palette 
                          ? `${palette.dotBg} border-white ring-2 ring-indigo-200` 
                          : selectedPremisId
                            ? "bg-indigo-200 border-indigo-400 animate-pulse"
                            : "bg-white border-slate-400"
                      )}
                    />

                    {/* Konten Teks Respons */}
                    <div 
                      dangerouslySetInnerHTML={{ __html: r.text }} 
                      className={clsx(proseClass, "flex-1 ml-2 sm:ml-3 text-slate-950 font-bold")} 
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: DAFTAR PILIHAN (Dropdown Mode - Sangat Nyaman di HP Layar Sempit) */}
      {viewMode === 'pilihan' && (
        <div className="space-y-3 p-3 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <p className="text-xs text-slate-700 font-bold pb-2 border-b border-slate-200">
            Pilih pasangan respons yang sesuai untuk setiap butir premis di bawah ini:
          </p>

          <div className="space-y-3">
            {premis.map((p, idx) => {
              const currentConn = connections.find(c => c.premisId === p.id);
              const palette = getPairPalette(p.id);

              return (
                <div 
                  key={p.id}
                  className={clsx(
                    "jodohkan-card p-3.5 rounded-xl border-2 bg-white shadow-xs transition space-y-2.5",
                    palette ? palette.cardActive : "border-slate-300"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      {idx + 1}
                    </span>
                    <div dangerouslySetInnerHTML={{ __html: p.text }} className={clsx(proseClass, "flex-1 text-slate-950 font-bold")} />
                  </div>

                  {/* Dropdown Pemilihan Respons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <span className="text-xs font-black text-slate-900 whitespace-nowrap">
                      Pasangan:
                    </span>
                    <select
                      value={currentConn?.responsId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          removeConnection(p.id);
                        } else {
                          connectPair(p.id, val);
                        }
                      }}
                      className="flex-1 py-1.5 px-3 rounded-lg border-2 border-slate-300 bg-white text-slate-950 text-xs sm:text-sm font-bold focus:outline-none focus:border-indigo-600 transition"
                    >
                      <option value="" className="text-slate-500 font-normal">-- Belum Dipasangkan --</option>
                      {respons.map((r, rIdx) => {
                        const plainText = r.text.replace(/<[^>]*>?/gm, '').trim();
                        return (
                          <option key={r.id} value={r.id} className="text-slate-950 font-bold">
                            ({String.fromCharCode(65 + rIdx)}) {plainText.slice(0, 45)}{plainText.length > 45 ? '...' : ''}
                          </option>
                        );
                      })}
                    </select>

                    {currentConn && (
                      <button
                        type="button"
                        onClick={() => removeConnection(p.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                        title="Hapus pasangan"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
  const [proteksiSiswaList, setProteksiSiswaList] = useState<string[]>([]);
  const [exambroKeywords, setExambroKeywords] = useState('exambro, exam, seb, safeexambrowser, flyexam, kiosk, cbt');
  const [namaAplikasi, setNamaAplikasi] = useState('');
  const [appLogo, setAppLogo] = useState('/logo.png');
  const [isBlocked, setIsBlocked] = useState(false);

  const updateFavicon = (url: string) => {
    if (typeof document === 'undefined') return;
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url || '/logo.png';
  };
  const [blockReason, setBlockReason] = useState('');
  const [inputKodeBlokir, setInputKodeBlokir] = useState('');
  const [blokirError, setBlokirError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(true);

  // Fitur ANBK: Pengatur Ukuran Font Soal (A- / A / A+)
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  // Fitur Proctor: Pesan Teguran Langsung & Broadcast Pengawas
  const [pesanPengawas, setPesanPengawas] = useState<{
    isOpen: boolean;
    pesan: string;
    pengirim: string;
    waktu: string;
  } | null>(null);
  const lastCheckedMessageTime = useRef<string>(new Date().toISOString());
  const lastBroadcastId = useRef<number>(0);

  // Fitur Proctor: Notifikasi Perubahan / Penambahan / Pengurangan Waktu Ujian
  const [notifWaktu, setNotifWaktu] = useState<{
    isOpen: boolean;
    tipe: 'tambah' | 'kurang';
    menit: number;
    pesan: string;
    waktuBaru?: number;
  } | null>(null);
  const lastMassTimeId = useRef<number>(0);

  // Pengaturan Tampil Nilai & Mode Review Jawaban
  const [tampilNilai, setTampilNilai] = useState('ON');
  const [modeReview, setModeReview] = useState('OFF');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [warningIncomplete, setWarningIncomplete] = useState<{
    isOpen: boolean;
    belumDijawab: number[];
    masihRagu: number[];
  } | null>(null);
  const [hasilSelesai, setHasilSelesai] = useState<{
    isOpen: boolean;
    skorAkhir: number;
    waktuPakai: string;
    pesanKhusus?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Ref dan State untuk Scroll Tampilan Soal & Opsi Jawaban
  const questionScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  // Fitur Zoom / Perbesar Gambar Soal (Lightbox Modal)
  const [zoomImageSrc, setZoomImageSrc] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [zoomPosition, setZoomPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingZoom, setIsDraggingZoom] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({ startX: 0, startY: 0, posX: 0, posY: 0 });

  const openImageZoom = (src: string) => {
    setZoomImageSrc(src);
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
    setIsDraggingZoom(false);
  };

  const closeImageZoom = () => {
    setZoomImageSrc(null);
    setZoomScale(1);
    setZoomPosition({ x: 0, y: 0 });
    setIsDraggingZoom(false);
  };

  // Keyboard shortcut listener untuk Zoom Modal
  useEffect(() => {
    if (!zoomImageSrc) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeImageZoom();
      } else if (e.key === '+' || e.key === '=') {
        setZoomScale(prev => Math.min(4, Number((prev + 0.25).toFixed(2))));
      } else if (e.key === '-' || e.key === '_') {
        setZoomScale(prev => Math.max(0.5, Number((prev - 0.25).toFixed(2))));
      } else if (e.key === '0') {
        setZoomScale(1);
        setZoomPosition({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomImageSrc]);

  // Pasang tombol kaca pembesar & efek zoom pada semua gambar di area soal
  useEffect(() => {
    const container = questionScrollRef.current;
    if (!container) return;

    const setupZoomableImages = () => {
      const imgs = container.querySelectorAll('img');
      imgs.forEach((img) => {
        if (img.getAttribute('data-cbt-zoom-ready') === 'true') return;
        img.setAttribute('data-cbt-zoom-ready', 'true');

        img.classList.add('cursor-zoom-in', 'hover:opacity-95', 'transition-all', 'rounded-lg');
        img.title = 'Klik untuk memperbesar gambar';

        let parent = img.parentElement;
        if (!parent?.classList.contains('cbt-img-zoom-container')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'cbt-img-zoom-container relative inline-block max-w-full my-2 group select-none';
          img.parentNode?.insertBefore(wrapper, img);
          wrapper.appendChild(img);
          parent = wrapper;
        }

        if (!parent.querySelector('.cbt-magnifier-btn')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cbt-magnifier-btn absolute top-2 right-2 bg-slate-900/80 hover:bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-lg backdrop-blur-sm flex items-center gap-1.5 transition-all opacity-85 group-hover:opacity-100 cursor-pointer select-none border border-white/20 active:scale-95 z-10';
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg><span class="text-[11px] font-sans font-bold">Perbesar</span>`;
          btn.title = 'Perbesar Gambar';

          const handleTrigger = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            openImageZoom(img.currentSrc || img.src);
          };

          btn.addEventListener('click', handleTrigger);
          img.addEventListener('click', handleTrigger);

          parent.appendChild(btn);
        }
      });
    };

    setupZoomableImages();
    const timer = setTimeout(setupZoomableImages, 250);
    return () => clearTimeout(timer);
  }, [soalList, indexSoal, fontSize]);

  const handleQuestionContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const zoomBtn = target.closest('.cbt-magnifier-btn');
    if (zoomBtn) {
      e.preventDefault();
      e.stopPropagation();
      const img = zoomBtn.parentElement?.querySelector('img');
      if (img?.src) {
        openImageZoom(img.currentSrc || img.src);
      }
      return;
    }
    if (target.tagName.toLowerCase() === 'img') {
      const img = target as HTMLImageElement;
      if (img.src) {
        e.preventDefault();
        e.stopPropagation();
        openImageZoom(img.currentSrc || img.src);
      }
    }
  };

  const checkScrollPosition = () => {
    const el = questionScrollRef.current;
    if (!el) return;
    const hasMore = el.scrollHeight - el.scrollTop - el.clientHeight > 30;
    setCanScrollDown(hasMore);
  };

  const handleScrollDown = () => {
    if (questionScrollRef.current) {
      questionScrollRef.current.scrollBy({ top: 300, behavior: 'smooth' });
    }
  };

  const router = useRouter();

  // Reset scroll ke atas dan periksa kembali tombol scroll saat ganti soal / font
  useEffect(() => {
    if (questionScrollRef.current) {
      questionScrollRef.current.scrollTop = 0;
    }
    const timer = setTimeout(checkScrollPosition, 150);
    return () => clearTimeout(timer);
  }, [indexSoal, fontSize, soalList]);

  useEffect(() => {
    // Muat ukuran font tersimpan
    const savedFont = localStorage.getItem('cbt_font_size');
    if (savedFont === 'sm' || savedFont === 'base' || savedFont === 'lg') {
      setFontSize(savedFont);
    }

    const fetchConfig = async () => {
      const { data } = await supabase.from('pengaturan').select('*');
      if (data) {
        const pl = data.find((d: any) => d.kunci === 'proteksi_layar');
        if (pl) setProteksiLayar(pl.nilai);
        const kb = data.find((d: any) => d.kunci === 'kode_buka_blokir');
        if (kb) setKodeBukaBlokir(kb.nilai);
        const tn = data.find((d: any) => d.kunci === 'tampil_nilai');
        if (tn) setTampilNilai(tn.nilai);
        const mr = data.find((d: any) => d.kunci === 'mode_review');
        if (mr) setModeReview(mr.nilai);
        const psl = data.find((d: any) => d.kunci === 'proteksi_siswa_list');
        if (psl && psl.nilai) {
          try {
            setProteksiSiswaList(JSON.parse(psl.nilai));
          } catch (e) {
            setProteksiSiswaList([]);
          }
        }
        const ek = data.find((d: any) => d.kunci === 'exambro_keywords');
        if (ek && ek.nilai) setExambroKeywords(ek.nilai);
        const na = data.find((d: any) => d.kunci === 'nama_aplikasi');
        if (na && na.nilai) {
          setNamaAplikasi(na.nilai);
          localStorage.setItem('cbt_app_name', na.nilai);
        }
        const la = data.find((d: any) => d.kunci === 'logo_aplikasi');
        if (la && la.nilai) {
          setAppLogo(la.nilai);
          localStorage.setItem('cbt_app_logo', la.nilai);
          updateFavicon(la.nilai);
        }
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
    if (savedJwb) {
      setJawaban(JSON.parse(savedJwb));
    } else if (u.jawaban_sementara && Object.keys(u.jawaban_sementara).length > 0) {
      setJawaban(u.jawaban_sementara);
      try {
        localStorage.setItem(jwbKey, JSON.stringify(u.jawaban_sementara));
      } catch (e) {}
    }

    // Ambil jawaban sementara & sisa waktu terbaru dari database server jika ada
    supabase
      .from('users')
      .select('jawaban_sementara, sisa_waktu')
      .eq('id', u.id)
      .maybeSingle()
      .then(({ data: dbUser }) => {
        if (dbUser?.jawaban_sementara && Object.keys(dbUser.jawaban_sementara).length > 0) {
          setJawaban(prev => {
            const merged = { ...dbUser.jawaban_sementara, ...prev };
            try {
              localStorage.setItem(jwbKey, JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
        }
        // Jika siswa pindah komputer setelah lowbatt/kendala, pulihkan sisa waktu dari database
        if (dbUser?.sisa_waktu && dbUser.sisa_waktu > 0 && !localStorage.getItem(timerKey)) {
          setSisaWaktu(dbUser.sisa_waktu);
          localStorage.setItem(timerKey, dbUser.sisa_waktu.toString());
        }
      });
    
    const rguKey = `cbt_ragu_${u.id}_${p.id}`;
    const savedRgu = localStorage.getItem(rguKey);
    if (savedRgu) setRagu(JSON.parse(savedRgu));
    
    const timerKey = `cbt_timer_${u.id}_${p.id}`;
    const savedTimer = localStorage.getItem(timerKey);
    if (savedTimer) {
      setSisaWaktu(parseInt(savedTimer, 10));
    } else if (u.sisa_waktu && u.sisa_waktu > 0) {
      // JEDA KENDALA / LOWBATT: Menggunakan sisa waktu tersimpan di akun siswa
      setSisaWaktu(u.sisa_waktu);
      localStorage.setItem(timerKey, u.sisa_waktu.toString());
    } else {
      setSisaWaktu((p.durasi_menit || 60) * 60);
    }

    // Cek jika dibuka dalam mode review (?review=1)
    if (typeof window !== 'undefined' && window.location.search.includes('review=1')) {
      setIsReviewOpen(true);
      setHasilSelesai({
        isOpen: true,
        skorAkhir: 0,
        waktuPakai: 'Selesai'
      });
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
      let soalArr = data.map((r: any) => r.soal).filter(Boolean);
      if (isAcak) {
        soalArr = soalArr.sort(() => Math.random() - 0.5);
      }
      setSoalList(soalArr);

      // Purge jawaban dari ID soal yang bukan milik paket ujian ini
      const paketSoalIdSet = new Set(soalArr.map((s: any) => s.id));
      setJawaban(prev => {
        const cleaned: Record<string, any> = {};
        let hasForeign = false;
        Object.keys(prev).forEach(k => {
          if (paketSoalIdSet.has(k)) {
            cleaned[k] = prev[k];
          } else {
            hasForeign = true;
          }
        });
        if (hasForeign) {
          const uStr = localStorage.getItem('cbt_user');
          if (uStr) {
            try {
              const curU = JSON.parse(uStr);
              const jKey = `cbt_jawaban_${curU.id}_${paketId}`;
              localStorage.setItem(jKey, JSON.stringify(cleaned));
              supabase.from('users').update({ jawaban_sementara: cleaned, paket_aktif_id: paketId }).eq('id', curU.id);
            } catch (e) {}
          }
        }
        return hasForeign ? cleaned : prev;
      });
    }
  };

  // Helper Nada Peringatan Web Audio API
  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {}
  };

  // Listener Pesan Real-time dari Pengawas (Log Individual & Pengaturan Broadcast)
  useEffect(() => {
    if (!user) return;

    const checkProctorMessages = async () => {
      try {
        // 0. Cek apakah ujian dihentikan paksa oleh pengawas
        const { data: uStatus } = await supabase
          .from('users')
          .select('status_ujian')
          .eq('id', user.id)
          .maybeSingle();

        if (uStatus?.status_ujian === 'Selesai' && !isReviewOpen) {
          localStorage.removeItem('cbt_paket');
          localStorage.removeItem(`cbt_timer_${user.id}_${paket.id}`);
          localStorage.removeItem(`cbt_cheat_${user.id}_${paket.id}`);
          localStorage.removeItem(`cbt_jawaban_${user.id}_${paket.id}`);
          localStorage.removeItem(`cbt_ragu_${user.id}_${paket.id}`);

          const { data: hasilRow } = await supabase
            .from('hasil')
            .select('skor_akhir')
            .eq('user_id', user.id)
            .eq('paket_id', paket.id)
            .maybeSingle();

          try {
            if (document.fullscreenElement && document.exitFullscreen) {
              await document.exitFullscreen();
            }
          } catch (e) {}

          playAlertSound();
          setHasilSelesai({
            isOpen: true,
            skorAkhir: hasilRow?.skor_akhir ?? 0,
            waktuPakai: 'Dihentikan oleh Pengawas',
            pesanKhusus: 'Ujian Anda telah dihentikan paksa oleh Proktor/Pengawas. Seluruh jawaban Anda telah disimpan ke Hasil Ujian.'
          });
          return;
        }

        // 1. Cek pesan & perubahan waktu individual dari tabel log
        const { data: logs } = await supabase
          .from('log')
          .select('*')
          .eq('user_id', user.id)
          .gt('created_at', lastCheckedMessageTime.current)
          .order('created_at', { ascending: false })
          .limit(3);

        if (logs && logs.length > 0) {
          lastCheckedMessageTime.current = logs[0].created_at;
          for (const logItem of logs) {
            if (logItem.aktivitas && logItem.aktivitas.startsWith('UBAH_WAKTU:::')) {
              const parts = logItem.aktivitas.split(':::');
              const deltaDetik = parseInt(parts[1], 10) || 0;
              const alasan = parts[2] || 'Penyesuaian oleh Proktor';
              if (deltaDetik !== 0) {
                setSisaWaktu(prev => {
                  const nextVal = Math.max(10, prev + deltaDetik);
                  localStorage.setItem(`cbt_timer_${user.id}_${paket.id}`, nextVal.toString());
                  return nextVal;
                });
                playAlertSound();
                const mVal = Math.abs(Math.round(deltaDetik / 60));
                setNotifWaktu({
                  isOpen: true,
                  tipe: deltaDetik > 0 ? 'tambah' : 'kurang',
                  menit: mVal,
                  pesan: deltaDetik > 0 
                    ? `Waktu ujian Anda telah DITAMBAHKAN ${mVal} MENIT oleh Pengawas/Proktor. (${alasan})`
                    : `Waktu ujian Anda telah DIKURANGI ${mVal} MENIT oleh Pengawas/Proktor. (${alasan})`
                });
              }
            } else if (logItem.aktivitas && logItem.aktivitas.startsWith('PESAN_PENGAWAS:::')) {
              const msg = logItem.aktivitas.replace('PESAN_PENGAWAS:::', '');
              playAlertSound();
              setPesanPengawas({
                isOpen: true,
                pesan: msg,
                pengirim: 'Pengawas Ujian (Teguran Khusus)',
                waktu: new Date(logItem.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
              });
            }
          }
        }

        // 2. Cek pesan broadcast dari pengaturan
        const { data: bData } = await supabase
          .from('pengaturan')
          .select('nilai')
          .eq('kunci', 'pesan_broadcast')
          .maybeSingle();

        if (bData?.nilai) {
          try {
            const parsed = JSON.parse(bData.nilai);
            if (parsed.id && parsed.id > lastBroadcastId.current) {
              lastBroadcastId.current = parsed.id;
              const diffMs = Date.now() - (new Date(parsed.waktu).getTime() || 0);
              // Hanya tampilkan jika dikirim kurang dari 5 menit lalu
              if (diffMs < 5 * 60 * 1000) {
                playAlertSound();
                setPesanPengawas({
                  isOpen: true,
                  pesan: parsed.pesan,
                  pengirim: 'Pengumuman Pengawas (Semua Peserta)',
                  waktu: new Date(parsed.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                });
              }
            }
          } catch (e) {}
        }

        // 3. Cek penambahan/pengurangan waktu massal dari pengaturan
        const { data: massData } = await supabase
          .from('pengaturan')
          .select('nilai')
          .eq('kunci', 'tambah_waktu_massal')
          .maybeSingle();

        if (massData?.nilai) {
          try {
            const parsed = JSON.parse(massData.nilai);
            if (parsed.id && parsed.id > lastMassTimeId.current) {
              lastMassTimeId.current = parsed.id;
              if (!parsed.paket_id || parsed.paket_id === 'SEMUA' || parsed.paket_id === paket.id) {
                const diffMs = Date.now() - (new Date(parsed.waktu).getTime() || 0);
                if (diffMs < 5 * 60 * 1000) {
                  const deltaDetik = parseInt(parsed.delta_detik, 10) || 0;
                  if (deltaDetik !== 0) {
                    setSisaWaktu(prev => {
                      const nextVal = Math.max(10, prev + deltaDetik);
                      localStorage.setItem(`cbt_timer_${user.id}_${paket.id}`, nextVal.toString());
                      return nextVal;
                    });
                    playAlertSound();
                    const mVal = Math.abs(Math.round(deltaDetik / 60));
                    setNotifWaktu({
                      isOpen: true,
                      tipe: deltaDetik > 0 ? 'tambah' : 'kurang',
                      menit: mVal,
                      pesan: deltaDetik > 0
                        ? `Waktu ujian serentak DITAMBAHKAN ${mVal} MENIT oleh Pengawas/Proktor. (${parsed.alasan || 'Kompensasi Kendala Bersama'})`
                        : `Waktu ujian serentak DIKURANGI ${mVal} MENIT oleh Pengawas/Proktor. (${parsed.alasan || 'Penyesuaian Waktu'})`
                    });
                  }
                }
              }
            }
          } catch (e) {}
        }
      } catch (err) {}
    };

    const interval = setInterval(checkProctorMessages, 5000);
    return () => clearInterval(interval);
  }, [user, paket, isReviewOpen]);

  const jawabanRef = useRef<Record<string, any>>(jawaban);
  const sisaWaktuRef = useRef<number>(sisaWaktu);

  useEffect(() => {
    jawabanRef.current = jawaban;
  }, [jawaban]);

  useEffect(() => {
    sisaWaktuRef.current = sisaWaktu;
  }, [sisaWaktu]);

  const syncJawabanKeServer = async (latestJawaban: Record<string, any>) => {
    if (!user || !paket || Object.keys(latestJawaban).length === 0) return;
    try {
      await supabase
        .from('users')
        .update({
          jawaban_sementara: latestJawaban,
          sisa_waktu: sisaWaktuRef.current,
          paket_aktif_id: paket.id
        })
        .eq('id', user.id);
    } catch (err) {
      console.error('Gagal sinkron jawaban sementara:', err);
    }
  };

  // Sinkronisasi otomatis jawaban sementara ke Supabase saat ada perubahan jawaban (Debounced 1 detik)
  useEffect(() => {
    if (!user || !paket || Object.keys(jawaban).length === 0) return;

    const timer = setTimeout(() => {
      syncJawabanKeServer(jawaban);
    }, 1000);

    return () => clearTimeout(timer);
  }, [jawaban, user, paket]);

  // Langsung sinkron ke server saat berpindah nomor soal
  useEffect(() => {
    if (!user || !paket || Object.keys(jawabanRef.current).length === 0) return;
    syncJawabanKeServer(jawabanRef.current);
  }, [indexSoal]);

  // Sinkronisasi berkala sisa waktu & jawaban setiap 15 detik (tidak terganggu oleh detik sisa waktu)
  useEffect(() => {
    if (!user || !paket) return;
    const interval = setInterval(() => {
      syncJawabanKeServer(jawabanRef.current);
    }, 15000);
    return () => clearInterval(interval);
  }, [user, paket]);

  // Sinkronisasi saat user menutup tab/browser atau reload
  useEffect(() => {
    if (!user || !paket) return;
    const handleBeforeUnload = () => {
      syncJawabanKeServer(jawabanRef.current);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, paket]);

  const handleChangeFontSize = (size: 'sm' | 'base' | 'lg') => {
    setFontSize(size);
    localStorage.setItem('cbt_font_size', size);
  };

  const isJawabanBenar = (soal: any, jwb: any) => {
    if (jwb === undefined || jwb === null || jwb === '') return false;
    if (soal.tipe === 'PG') {
      return typeof jwb === 'string' && jwb.toUpperCase() === soal.kunci?.toUpperCase();
    }
    if (soal.tipe === 'PG Kompleks') {
      const kunciArr = (soal.kunci || '').split(',').map((k: string) => k.trim().toUpperCase());
      if (!Array.isArray(jwb) || jwb.length === 0) return false;
      return kunciArr.length === jwb.length && jwb.every((x: string) => kunciArr.includes(x.toUpperCase()));
    }
    if (soal.tipe === 'Menjodohkan') {
      try {
        const kunciAsli = JSON.parse(soal.kunci || '[]');
        if (!Array.isArray(jwb) || jwb.length === 0) return false;
        return kunciAsli.every((k: any) => jwb.some((j: any) => j.premisId === k.premisId && j.responsId === k.responsId));
      } catch (e) {
        return false;
      }
    }
    if (soal.tipe === 'Isian') {
      return !!soal.kunci && String(jwb).toLowerCase().trim() === soal.kunci.toLowerCase().trim();
    }
    return false;
  };

  // Evaluasi apakah proteksi layar aktif untuk siswa saat ini berdasarkan mode pengaturan
  const isProteksiAktif = useMemo(() => {
    if (proteksiLayar === 'OFF') return false;
    if (proteksiLayar === 'ON') return true;

    if (proteksiLayar === 'NON_EXAMBRO') {
      if (typeof window === 'undefined') return false;
      const ua = (navigator.userAgent || navigator.vendor || (window as any).opera || '').toLowerCase();
      const hasExambroProp = !!(window as any).isExamBro || !!(window as any).isExambrowser;
      const rawKeywords = exambroKeywords || 'exambro, exam, seb, safeexambrowser, flyexam, kiosk, cbt';
      const keywords = rawKeywords.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
      const isExambro = hasExambroProp || keywords.some((k: string) => ua.includes(k));
      // Siswa non-Exambro (misal Chrome / Safari biasa) WAJIB terproteksi web
      return !isExambro;
    }

    if (proteksiLayar === 'KHUSUS') {
      if (!user) return false;
      return proteksiSiswaList.includes(user.id) || proteksiSiswaList.includes(user.username);
    }

    return true;
  }, [proteksiLayar, proteksiSiswaList, exambroKeywords, user]);

  const aktivasiFullscreen = async () => {
    if (!isProteksiAktif) return;
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

  useEffect(() => {
    if (isProteksiAktif && !isBlocked) {
      aktivasiFullscreen();
    }
  }, [isProteksiAktif, isBlocked]);

  useEffect(() => {
    if (namaAplikasi && paket) {
      document.title = `${namaAplikasi} - ${paket.nama_paket}`;
    }
  }, [namaAplikasi, paket]);

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
      if (document.hidden && isProteksiAktif) {
        trgViolation('Terdeteksi keluar dari tab ujian atau berpindah aplikasi.');
      }
    };

    const handleFullscreenChange = () => {
      const inFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(inFs);
      if (!inFs && isProteksiAktif) {
        trgViolation('Terdeteksi keluar dari mode layar penuh (Fullscreen).');
      }
    };

    const handleContextMenu = (e: Event) => {
      if (isProteksiAktif) e.preventDefault();
    };

    const handleSilentFullscreen = () => {
      if (isProteksiAktif && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', handleSilentFullscreen);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('click', handleSilentFullscreen);
    };
  }, [user, paket, isProteksiAktif, isBlocked]);

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
      jawabanRef.current = next;
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

    // Cek apakah paket ini mengandung soal yang butuh koreksi manual (Essay atau Isian tanpa kunci otomatis)
    const butuhKoreksiManual = soalList.some((s: any) => s.tipe === 'Essay' || (s.tipe === 'Isian' && !s.kunci));
    const statusKoreksiAwal = butuhKoreksiManual ? 'Menunggu Koreksi' : 'Selesai';

    try {
      // Cek apakah sudah ada data hasil sebelumnya untuk user & paket ini
      const { data: cekHasil } = await supabase
        .from('hasil')
        .select('id')
        .eq('user_id', user.id)
        .eq('paket_id', paket.id)
        .maybeSingle();

      let errHasil = null;
      if (cekHasil) {
        const { error } = await supabase.from('hasil').update({
          waktu_sisa: sisaWaktu,
          detail_jawaban: jawaban,
          status_koreksi: statusKoreksiAwal,
          skor_akhir: skorAkhir,
          cheat_count: cheatCount
        }).eq('id', cekHasil.id);
        errHasil = error;
      } else {
        const { error } = await supabase.from('hasil').insert({
          user_id: user.id,
          paket_id: paket.id,
          waktu_sisa: sisaWaktu,
          detail_jawaban: jawaban,
          status_koreksi: statusKoreksiAwal,
          skor_akhir: skorAkhir,
          cheat_count: cheatCount
        });
        errHasil = error;
      }

      if (errHasil) {
        console.error('Error simpan hasil ujian:', errHasil);
        throw errHasil;
      }

      await supabase.from('users').update({ status_ujian: 'Selesai', status_login: '0', jawaban_sementara: {} }).eq('id', user.id);
      
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

    } catch (err: any) {
      console.error(err);
      alert('Terjadi kesalahan saat menyimpan ujian: ' + (err?.message || 'Pastikan koneksi internet stabil.'));
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
    .prose img { max-width: 100%; border-radius: 8px; cursor: zoom-in; transition: transform 0.2s, filter 0.2s; }
    .prose img:hover { filter: brightness(0.96); }
    .prose p { margin-top: 0; margin-bottom: 1em; }
    .prose p:last-child { margin-bottom: 0; }
    .prose, .prose * {
      word-break: normal;
      overflow-wrap: anywhere;
      hyphens: none;
    }
    /* Pastikan seluruh teks di kartu soal menjodohkan selalu hitam pekat & berbobot jelas */
    .jodohkan-card,
    .jodohkan-card *,
    .jodohkan-text,
    .jodohkan-text * {
      color: #0f172a !important;
      font-weight: 600 !important;
    }
    .jodohkan-card p,
    .jodohkan-text p {
      margin: 0 !important;
      color: #0f172a !important;
    }
    .jodohkan-text span,
    .jodohkan-text strong,
    .jodohkan-text em {
      color: #0f172a !important;
    }
  `;

  const fontQuestionClass = fontSize === 'sm' 
    ? 'text-sm md:text-base leading-relaxed prose-sm' 
    : fontSize === 'lg' 
      ? 'text-xl md:text-2xl leading-relaxed prose-lg' 
      : 'text-base md:text-lg leading-relaxed prose-base';

  const fontOptionClass = fontSize === 'sm'
    ? 'text-xs md:text-sm'
    : fontSize === 'lg'
      ? 'text-lg md:text-xl'
      : 'text-sm md:text-base';

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <style dangerouslySetInnerHTML={{__html: richTextGlobalStyles}} />

      {/* Premium Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 p-3 md:p-4 shadow-sm flex justify-between items-center z-10 flex-shrink-0 sticky top-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-white p-1 hidden sm:flex items-center justify-center border border-slate-200 flex-shrink-0 shadow-sm">
            <img 
              src={appLogo || '/logo.png'} 
              alt="Logo" 
              className="w-full h-full object-contain aspect-square" 
              onError={(e) => { (e.target as any).src = '/logo.png'; }} 
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-lg font-bold tracking-tight text-slate-800 truncate">{paket.nama_paket}</h1>
              {isProteksiAktif && (
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full" title="Proteksi Layar & Fullscreen Aktif">
                  <ShieldCheck size={12} /> Terproteksi
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">Peserta: {user.nama} • {namaAplikasi || 'CBT B-TEK'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 text-xs md:text-base flex-shrink-0">
          {/* ANBK Font Resizer Control */}
          <div className="flex items-center bg-slate-100 p-0.5 md:p-1 rounded-full border border-slate-200 text-xs font-bold text-slate-700 shadow-inner">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 px-2 hidden sm:inline">Font:</span>
            <button 
              type="button"
              onClick={() => handleChangeFontSize('sm')} 
              className={clsx("px-2 py-0.5 md:px-2.5 md:py-1 rounded-full transition text-[11px] md:text-xs", fontSize === 'sm' ? "bg-white text-indigo-600 shadow-sm font-black" : "text-slate-500 hover:text-slate-800")}
              title="Ukuran Font Kecil (A-)"
            >
              A-
            </button>
            <button 
              type="button"
              onClick={() => handleChangeFontSize('base')} 
              className={clsx("px-2 py-0.5 md:px-2.5 md:py-1 rounded-full transition text-[11px] md:text-xs", fontSize === 'base' ? "bg-white text-indigo-600 shadow-sm font-black" : "text-slate-500 hover:text-slate-800")}
              title="Ukuran Font Standar (A)"
            >
              A
            </button>
            <button 
              type="button"
              onClick={() => handleChangeFontSize('lg')} 
              className={clsx("px-2 py-0.5 md:px-2.5 md:py-1 rounded-full transition text-[11px] md:text-xs", fontSize === 'lg' ? "bg-white text-indigo-600 shadow-sm font-black" : "text-slate-500 hover:text-slate-800")}
              title="Ukuran Font Besar (A+)"
            >
              A+
            </button>
          </div>

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
      <main className="flex-1 flex flex-col relative overflow-hidden max-w-7xl mx-auto w-full px-3 py-2 md:px-6 md:py-4 min-h-0">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 flex-1 relative flex flex-col min-h-0 overflow-hidden transition-all duration-300">
          <div className="flex justify-between items-center border-b border-slate-100 p-4 md:px-8 md:py-4 bg-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-full bg-indigo-600 text-white font-black text-base md:text-lg shadow-md shadow-indigo-600/30">
                {indexSoal + 1}
              </span>
              <h2 className="text-xs md:text-sm font-bold text-slate-400 tracking-widest uppercase">Soal Ujian</h2>
            </div>
            <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">
              {soalAktif.tipe}
            </span>
          </div>
          
          <div 
            ref={questionScrollRef}
            onScroll={checkScrollPosition}
            onClick={handleQuestionContainerClick}
            className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth custom-scrollbar"
          >
            <div 
              className={`${fontQuestionClass} text-slate-800 font-medium prose prose-slate max-w-none break-normal leading-relaxed prose-p:my-2`}
              dangerouslySetInnerHTML={{ __html: soalAktif.pertanyaan }} 
            />
            
            {/* Pilihan Ganda */}
            {(soalAktif.tipe === 'PG' || soalAktif.tipe === 'PG Kompleks') && (
              <div className="space-y-3.5 pt-2">
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
                        "group flex items-start gap-3.5 md:gap-4 p-4 md:p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ease-in-out w-full",
                        isSelected ? "border-indigo-500 bg-indigo-50/50 shadow-md shadow-indigo-100" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                      )}
                    >
                      <div className="relative flex items-center justify-center pt-0.5 flex-shrink-0">
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
                      <div className="flex-1 flex items-start gap-3 min-w-0">
                        <span className={clsx("font-black text-base md:text-lg flex-shrink-0 pt-0.5", isSelected ? "text-indigo-700" : "text-slate-400 group-hover:text-indigo-500")}>
                          {opt.toUpperCase()}.
                        </span>
                        <div 
                          dangerouslySetInnerHTML={{ __html: soalAktif[key] }} 
                          className={clsx(
                            fontOptionClass,
                            "flex-1 prose prose-slate max-w-none break-normal min-w-0 leading-relaxed",
                            isSelected ? "text-indigo-900 font-bold" : "text-slate-700"
                          )} 
                        />
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
                fontSize={fontSize}
              />
            )}

            {/* Essay */}
            {(soalAktif.tipe === 'Isian' || soalAktif.tipe === 'Essay') && (
              <div className="relative group mt-4">
                <textarea 
                  className="w-full border-2 border-slate-200 p-5 rounded-xl text-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all min-h-[200px] resize-y text-base md:text-lg"
                  placeholder="Ketik jawaban lengkap Anda di sini..."
                  value={jawaban[soalAktif.id] || ''}
                  onChange={(e) => handleJawaban(soalAktif.id, e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Floating "Scroll ke Bawah" button */}
          {canScrollDown && (
            <button
              type="button"
              onClick={handleScrollDown}
              className="absolute bottom-4 right-6 z-20 bg-indigo-600/95 hover:bg-indigo-700 text-white text-xs md:text-sm font-bold px-4 py-2.5 rounded-full shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95 animate-bounce border border-indigo-400"
              title="Scroll ke Bawah untuk melihat kelanjutan narasi / opsi jawaban"
            >
              <span>Scroll ke Bawah</span>
              <ChevronDown size={16} />
            </button>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-between mt-3 md:mt-4 gap-3 md:gap-4 flex-shrink-0">
          <button 
            onClick={() => setIndexSoal(Math.max(0, indexSoal - 1))}
            disabled={indexSoal === 0}
            className="bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 disabled:opacity-50 disabled:hover:bg-white disabled:cursor-not-allowed px-4 py-3 md:px-6 rounded-xl shadow-sm flex items-center justify-center gap-2 font-bold transition-all active:scale-95 text-sm md:text-base"
          >
            <ChevronLeft size={20} /> <span className="hidden sm:inline">Soal Sebelumnya</span>
          </button>

          <button 
            onClick={() => toggleRagu(soalAktif.id)}
            className={clsx(
              "px-4 py-3 md:px-8 rounded-xl shadow-sm flex items-center justify-center gap-2 font-bold transition-all active:scale-95 text-sm md:text-base",
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
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 md:px-6 rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 font-bold transition-all active:scale-95 disabled:opacity-50 text-sm md:text-base"
            >
              <span className="hidden sm:inline">{isSubmitting ? 'Menyimpan...' : 'Selesai Ujian'}</span> <CheckCircle2 size={20} />
            </button>
          ) : (
            <button 
              onClick={() => setIndexSoal(Math.min(soalList.length - 1, indexSoal + 1))}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 md:px-6 rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 font-bold transition-all active:scale-95 text-sm md:text-base"
            >
              <span className="hidden sm:inline">Soal Berikutnya</span> <ChevronRight size={20} />
            </button>
          )}
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
            
            {hasilSelesai.pesanKhusus && (
              <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 rounded-2xl p-4 mb-6 text-xs md:text-sm font-bold flex items-center gap-3 text-left shadow-sm">
                <div className="p-2.5 bg-amber-500 text-white rounded-xl shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <div className="font-black text-amber-950 uppercase text-[11px] tracking-wider mb-0.5">Pemberitahuan Pengawas:</div>
                  <div className="font-semibold text-amber-900 leading-snug">{hasilSelesai.pesanKhusus}</div>
                </div>
              </div>
            )}

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
                  Seluruh lembar jawaban Anda telah berhasil disimpan dan dinilai oleh sistem {namaAplikasi || 'CBT B-TEK'}.
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

            {/* Tombol Review & Pembahasan Jawaban (Jika Mode Review ON) */}
            {modeReview === 'ON' && (
              <button
                type="button"
                onClick={() => setIsReviewOpen(true)}
                className="w-full mb-3 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-indigo-600/30 transition active:scale-95 flex items-center justify-center gap-2 text-sm md:text-base tracking-wide border border-indigo-400/30"
              >
                <BookOpen size={18} />
                <span>LIHAT REVIEW & PEMBAHASAN SOAL</span>
              </button>
            )}

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

      {/* Modal Pesan Teguran / Broadcast dari Pengawas */}
      {pesanPengawas && pesanPengawas.isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[2000] animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-2 border-amber-300">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                <AlertTriangle size={36} className="text-white animate-bounce" />
              </div>
              <h3 className="font-black text-xl tracking-tight">Pemberitahuan Pengawas</h3>
              <p className="text-xs text-amber-100 mt-1 font-semibold uppercase tracking-wider">{pesanPengawas.pengirim}</p>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-left">
                <p className="text-slate-800 font-bold text-base md:text-lg leading-relaxed">
                  "{pesanPengawas.pesan}"
                </p>
                <span className="text-[11px] text-slate-400 font-semibold block mt-2">Diterima pukul {pesanPengawas.waktu}</span>
              </div>

              <button
                type="button"
                onClick={() => setPesanPengawas(null)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-amber-500/30 transition active:scale-95 text-sm uppercase tracking-wider"
              >
                Saya Mengerti & Lanjutkan Ujian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Notifikasi Perubahan Waktu Ujian dari Pengawas */}
      {notifWaktu && notifWaktu.isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[2050] animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-2 border-indigo-200">
            <div className={clsx(
              "p-6 text-white text-center",
              notifWaktu.tipe === 'tambah' ? "bg-gradient-to-r from-emerald-600 to-teal-600" : "bg-gradient-to-r from-rose-600 to-amber-600"
            )}>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Clock size={36} className="text-white animate-pulse" />
              </div>
              <h3 className="font-black text-xl tracking-tight">
                {notifWaktu.tipe === 'tambah' ? 'Waktu Ujian Ditambahkan! 🎉' : 'Waktu Ujian Disesuaikan ⏱️'}
              </h3>
              <p className="text-xs text-white/90 mt-1 font-semibold uppercase tracking-wider">
                Instruksi Pengawas / Proktor
              </p>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className={clsx(
                "rounded-2xl p-4 border text-left",
                notifWaktu.tipe === 'tambah' ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
              )}>
                <div className="flex items-center gap-2 mb-2 font-black text-sm">
                  <span className={clsx(
                    "px-2.5 py-1 rounded-lg text-white text-xs font-bold shadow-xs",
                    notifWaktu.tipe === 'tambah' ? "bg-emerald-600" : "bg-rose-600"
                  )}>
                    {notifWaktu.tipe === 'tambah' ? `+${notifWaktu.menit} Menit` : `-${notifWaktu.menit} Menit`}
                  </span>
                  <span className="text-slate-700">Penyesuaian Durasi</span>
                </div>
                <p className="text-slate-800 font-bold text-sm md:text-base leading-relaxed">
                  "{notifWaktu.pesan}"
                </p>
              </div>

              <button
                type="button"
                onClick={() => setNotifWaktu(null)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3.5 rounded-2xl shadow-lg transition active:scale-95 text-sm uppercase tracking-wider cursor-pointer"
              >
                Saya Mengerti & Lanjutkan Ujian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Review Lembar Jawaban & Pembahasan (Mode Review) */}
      {isReviewOpen && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-[2100] flex items-center justify-center p-2 md:p-6 overflow-hidden animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
            {/* Review Header */}
            <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
                  <BookOpen size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800">Review Jawaban & Pembahasan Soal</h3>
                  <p className="text-xs text-slate-500 font-medium">Paket: {paket?.nama_paket} | Peserta: {user?.nama}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsReviewOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Ringkasan Skor & Statistik Review */}
            <div className="grid grid-cols-3 gap-2 md:gap-4 p-4 md:p-5 bg-indigo-50/50 border-b border-indigo-100 text-center text-xs md:text-sm font-bold">
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                <span className="text-slate-400 text-xs block mb-0.5">Total Soal</span>
                <span className="text-slate-800 font-black text-lg md:text-xl">{soalList.length} Butir</span>
              </div>
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-emerald-100">
                <span className="text-emerald-500 text-xs block mb-0.5 flex items-center justify-center gap-1"><CheckCircle2 size={13}/> Jawaban Benar</span>
                <span className="text-emerald-700 font-black text-lg md:text-xl">
                  {soalList.filter(s => isJawabanBenar(s, jawaban[s.id])).length}
                </span>
              </div>
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-rose-100">
                <span className="text-rose-500 text-xs block mb-0.5 flex items-center justify-center gap-1"><XCircle size={13}/> Belum Tepat</span>
                <span className="text-rose-700 font-black text-lg md:text-xl">
                  {soalList.filter(s => !isJawabanBenar(s, jawaban[s.id]) && s.tipe !== 'Essay').length}
                </span>
              </div>
            </div>

            {/* List Review Soal */}
            <div className="p-4 md:p-6 overflow-y-auto flex-grow space-y-6 bg-slate-50/50 custom-scrollbar">
              {soalList.map((soal, i) => {
                const jwbSiswa = jawaban[soal.id];
                const isBenar = isJawabanBenar(soal, jwbSiswa);
                const isEssay = soal.tipe === 'Essay' || (soal.tipe === 'Isian' && !soal.kunci);

                return (
                  <div key={soal.id} className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-800 font-black px-3 py-1 rounded-xl text-sm">
                          No. {i + 1}
                        </span>
                        <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider">
                          {soal.tipe}
                        </span>
                      </div>
                      
                      {isEssay ? (
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                          Koreksi Manual
                        </span>
                      ) : isBenar ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 size={14} className="text-emerald-600" /> Benar (+{soal.skor_maks || 10})
                        </span>
                      ) : (
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                          <XCircle size={14} className="text-rose-600" /> Belum Tepat (0)
                        </span>
                      )}
                    </div>

                    {/* Pertanyaan */}
                    <div 
                      className="text-slate-800 font-semibold text-sm md:text-base mb-4 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: soal.pertanyaan }} 
                    />

                    {/* Jawaban Siswa */}
                    <div className={clsx(
                      "p-3.5 rounded-xl border mb-3 text-xs md:text-sm font-medium",
                      isEssay ? "bg-slate-50 border-slate-200 text-slate-800" :
                      isBenar ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"
                    )}>
                      <span className="font-bold block uppercase text-[10px] tracking-wider mb-1 text-slate-500">
                        Jawaban Anda:
                      </span>
                      {jwbSiswa === undefined || jwbSiswa === null || jwbSiswa === '' ? (
                        <span className="italic text-slate-400">Tidak Dijawab</span>
                      ) : Array.isArray(jwbSiswa) ? (
                        soal.tipe === 'Menjodohkan' ? (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {jwbSiswa.map((conn: any, cIdx: number) => (
                              <span key={cIdx} className="bg-white border px-2 py-0.5 rounded text-xs font-bold">
                                {conn.premisId} ➔ {conn.responsId}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="font-bold">{jwbSiswa.join(', ')}</span>
                        )
                      ) : (
                        <span className="font-bold">{String(jwbSiswa)}</span>
                      )}
                    </div>

                    {/* Kunci Jawaban Resmi / Indikator */}
                    {soal.kunci && (
                      <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs md:text-sm font-medium text-emerald-950">
                        <span className="font-bold block uppercase text-[10px] tracking-wider mb-1 text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Kunci Jawaban / Indikator Penilaian:
                        </span>
                        <div className="font-bold" dangerouslySetInnerHTML={{
                          __html: typeof soal.kunci === 'object' ? JSON.stringify(soal.kunci) : soal.kunci
                        }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
              <button 
                type="button"
                onClick={() => setIsReviewOpen(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition active:scale-95"
              >
                Tutup Pembahasan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL ZOOM / PERBESAR GAMBAR SOAL (LIGHTBOX) */}
      {/* ========================================================================= */}
      {zoomImageSrc && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-between p-2 sm:p-4 select-none animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeImageZoom();
            }
          }}
        >
          {/* Top Control Bar */}
          <div className="w-full max-w-4xl bg-slate-900/90 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-white flex items-center justify-between shadow-2xl backdrop-blur-md flex-shrink-0 z-10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-md">
                <ZoomIn size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-wide">Pratinjau Gambar Soal</h3>
                <p className="text-[11px] text-slate-400 hidden sm:block">Perbesar gambar untuk melihat detail soal & grafik</p>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Zoom Out */}
              <button
                type="button"
                onClick={() => setZoomScale(prev => Math.max(0.5, Number((prev - 0.25).toFixed(2))))}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
                title="Perkecil (-)"
              >
                <ZoomOut size={18} />
              </button>

              {/* Scale Badge */}
              <span className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-blue-400 min-w-[56px] text-center">
                {Math.round(zoomScale * 100)}%
              </span>

              {/* Zoom In */}
              <button
                type="button"
                onClick={() => setZoomScale(prev => Math.min(4, Number((prev + 0.25).toFixed(2))))}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
                title="Perbesar (+)"
              >
                <ZoomIn size={18} />
              </button>

              {/* Reset */}
              <button
                type="button"
                onClick={() => { setZoomScale(1); setZoomPosition({ x: 0, y: 0 }); }}
                className="px-2.5 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors text-xs font-medium flex items-center gap-1 active:scale-95"
                title="Reset Ukuran (100%)"
              >
                <RotateCcw size={15} />
                <span className="hidden md:inline text-[11px]">Reset</span>
              </button>

              <div className="h-5 w-[1px] bg-slate-700 mx-1" />

              {/* Close Button */}
              <button
                type="button"
                onClick={closeImageZoom}
                className="px-3 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                title="Tutup (ESC)"
              >
                <X size={16} />
                <span>Tutup</span>
              </button>
            </div>
          </div>

          {/* Canvas / Image Display Area */}
          <div 
            className="flex-1 w-full max-w-5xl flex items-center justify-center overflow-hidden my-2 sm:my-3 relative cursor-grab active:cursor-grabbing touch-none"
            onWheel={(e) => {
              e.preventDefault();
              if (e.deltaY < 0) {
                setZoomScale(prev => Math.min(4, Number((prev + 0.2).toFixed(2))));
              } else {
                setZoomScale(prev => Math.max(0.5, Number((prev - 0.2).toFixed(2))));
              }
            }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              setIsDraggingZoom(true);
              dragStartRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                posX: zoomPosition.x,
                posY: zoomPosition.y
              };
            }}
            onMouseMove={(e) => {
              if (!isDraggingZoom) return;
              const dx = e.clientX - dragStartRef.current.startX;
              const dy = e.clientY - dragStartRef.current.startY;
              setZoomPosition({
                x: dragStartRef.current.posX + dx,
                y: dragStartRef.current.posY + dy
              });
            }}
            onMouseUp={() => setIsDraggingZoom(false)}
            onMouseLeave={() => setIsDraggingZoom(false)}
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                const touch = e.touches[0];
                setIsDraggingZoom(true);
                dragStartRef.current = {
                  startX: touch.clientX,
                  startY: touch.clientY,
                  posX: zoomPosition.x,
                  posY: zoomPosition.y
                };
              }
            }}
            onTouchMove={(e) => {
              if (!isDraggingZoom || e.touches.length !== 1) return;
              const touch = e.touches[0];
              const dx = touch.clientX - dragStartRef.current.startX;
              const dy = touch.clientY - dragStartRef.current.startY;
              setZoomPosition({
                x: dragStartRef.current.posX + dx,
                y: dragStartRef.current.posY + dy
              });
            }}
            onTouchEnd={() => setIsDraggingZoom(false)}
          >
            <div 
              className="transition-transform duration-75 select-none max-h-full max-w-full flex items-center justify-center"
              style={{
                transform: `translate3d(${zoomPosition.x}px, ${zoomPosition.y}px, 0px) scale(${zoomScale})`,
                transformOrigin: 'center center'
              }}
            >
              <img
                src={zoomImageSrc}
                alt="Gambar Soal Ujian"
                className="max-h-[72vh] max-w-[88vw] object-contain rounded-2xl shadow-2xl pointer-events-none select-none bg-white/5 border border-white/10 ring-1 ring-white/10"
                draggable={false}
              />
            </div>
          </div>

          {/* Bottom Hint Banner */}
          <div className="bg-slate-900/85 border border-slate-700/60 rounded-full px-4 py-1.5 text-slate-300 text-[11px] sm:text-xs flex items-center gap-2 shadow-lg backdrop-blur-md text-center">
            <span>💡 <b>Geser mouse / sentuh layar</b> untuk menggeser gambar • <b>Scroll roda mouse</b> atau tombol <b>(+ / -)</b> untuk zoom • Tekan <b>ESC</b> atau tombol <b>Tutup</b> untuk keluar</span>
          </div>
        </div>
      )}

    </div>
  );
}
