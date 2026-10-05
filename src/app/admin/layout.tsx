'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, Users, Package, Archive, 
  FileText, PlusCircle, Trophy, PieChart, 
  Settings, Server, Menu, X, LogOut, ChevronRight, MonitorPlay, Bell
} from 'lucide-react';
import clsx from 'clsx';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [appName, setAppName] = useState('CBT B-TEK');
  const [appLogo, setAppLogo] = useState('/logo.png');

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

  useEffect(() => {
    const cachedName = localStorage.getItem('cbt_app_name');
    if (cachedName) setAppName(cachedName);

    const cachedLogo = localStorage.getItem('cbt_app_logo');
    if (cachedLogo) {
      setAppLogo(cachedLogo);
      updateFavicon(cachedLogo);
    }

    const fetchConfig = async () => {
      const { data } = await supabase.from('pengaturan').select('*');
      if (data) {
        const nameItem = data.find((d: any) => d.kunci === 'nama_aplikasi');
        if (nameItem?.nilai) {
          setAppName(nameItem.nilai);
          localStorage.setItem('cbt_app_name', nameItem.nilai);
        }
        const logoItem = data.find((d: any) => d.kunci === 'logo_aplikasi');
        if (logoItem?.nilai) {
          setAppLogo(logoItem.nilai);
          localStorage.setItem('cbt_app_logo', logoItem.nilai);
          updateFavicon(logoItem.nilai);
        }
      }
    };
    fetchConfig();

    const handleUpdate = () => {
      const updatedName = localStorage.getItem('cbt_app_name');
      if (updatedName) setAppName(updatedName);
      const updatedLogo = localStorage.getItem('cbt_app_logo');
      if (updatedLogo) {
        setAppLogo(updatedLogo);
        updateFavicon(updatedLogo);
      }
    };
    window.addEventListener('cbt_settings_updated', handleUpdate);
    return () => window.removeEventListener('cbt_settings_updated', handleUpdate);
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('cbt_user');
    if (!savedUser) {
      router.push('/');
      return;
    }
    
    const parsedUser = JSON.parse(savedUser);
    if (parsedUser.role.toLowerCase() !== 'admin') {
      router.push('/token');
      return;
    }
    
    setUser(parsedUser);
  }, [router]);

  const handleLogout = async () => {
    if (user) {
      await supabase.from('users').update({ status_login: '0' }).eq('id', user.id);
      localStorage.removeItem('cbt_user');
      router.push('/');
    }
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const resetTimer = () => {
      clearTimeout(timeout);
      // Auto logout after 30 minutes of inactivity
      timeout = setTimeout(() => {
        handleLogout();
        alert('Anda telah logout otomatis karena tidak ada aktivitas selama 30 menit.');
      }, 30 * 60 * 1000); 
    };

    resetTimer();

    // Listen to user activity events
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [user]);

  const isDemoMode = user?.username?.startsWith('demo_admin_');

  // Sinkronisasi Pengumuman dari Developer
  useEffect(() => {
    const syncNotifikasi = async () => {
      try {
        const res = await fetch('/pengumuman.json?t=' + Date.now());
        if (!res.ok) return;
        const pengumumans = await res.json();
        
        const { data: dbNotifs, error: dbErr } = await supabase.from('notifikasi').select('id');
        if (dbErr) return; // Tabel mungkin belum ada
        
        const dbIds = new Set(dbNotifs.map((n: any) => n.id));
        const newNotifs = pengumumans.filter((p: any) => !dbIds.has(p.id));
        
        if (newNotifs.length > 0) {
          const insertPayload = newNotifs.map((p: any) => ({
            id: p.id,
            judul: p.judul,
            pesan: p.pesan,
            tanggal: p.tanggal,
            dibaca: false
          }));
          await supabase.from('notifikasi').insert(insertPayload);
        }
        
        // Auto-delete lebih dari 6 bulan
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        await supabase.from('notifikasi').delete().lt('created_at', sixMonthsAgo.toISOString());

        // Hitung unread
        const { count } = await supabase
          .from('notifikasi')
          .select('*', { count: 'exact', head: true })
          .eq('dibaca', false);
          
        setUnreadCount(count || 0);
      } catch (err) {
        console.error('Gagal sync notifikasi:', err);
      }
    };

    if (user && !isDemoMode) {
      syncNotifikasi();
    }
  }, [user]);

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Pantau Ujian', path: '/admin/pantau', icon: MonitorPlay },
    { name: 'Kelola Siswa & Kelas', path: '/admin/siswa', icon: Users },
    { name: 'Kelola Paket', path: '/admin/paket', icon: Package },
    { name: 'Bank Soal', path: '/admin/bank-soal', icon: Archive },
    { name: 'Kelola Soal', path: '/admin/soal', icon: FileText },
    { name: 'Tambah Soal', path: '/admin/tambah-soal', icon: PlusCircle },
    { name: 'Hasil Ujian', path: '/admin/hasil', icon: Trophy },
    { name: 'Analisis Soal', path: '/admin/analisis', icon: PieChart },
    { name: 'Pengaturan', path: '/admin/pengaturan', icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-800 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Modern Sidebar Tema Biru & Merah Sesuai Logo */}
      <aside 
        className={clsx(
          "w-[280px] bg-gradient-to-b from-slate-900 via-blue-950 to-slate-950 text-slate-200 flex flex-col shadow-2xl z-50 fixed inset-y-0 left-0 transform transition-transform duration-300 ease-out md:relative md:translate-x-0 border-r border-blue-900/40",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button 
          onClick={() => setIsSidebarOpen(false)} 
          className="absolute top-4 right-4 text-slate-400 hover:text-white md:hidden hover:bg-white/10 p-1 rounded-lg transition-all"
        >
          <X size={24} />
        </button>

        {/* Kop Sidebar dengan Brand Logo */}
        <div className="p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl overflow-hidden bg-white p-1.5 flex items-center justify-center shadow-lg shadow-blue-500/25 border border-white/20 flex-shrink-0">
            <img 
              src={appLogo} 
              alt="Logo" 
              className="w-full h-full object-contain aspect-square" 
              onError={(e) => { (e.target as any).src = '/logo.png'; }} 
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-white tracking-wide truncate" title={appName}>{appName}</h1>
            <p className="text-[11px] text-blue-200 font-semibold tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              Admin Control Panel
            </p>
          </div>
        </div>

        {/* Accent Bar Biru-Merah */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-red-500 opacity-90 shadow-sm"></div>

        {/* Navigasi Menu */}
        <nav className="flex-1 overflow-y-auto py-5 space-y-1.5 px-3.5 custom-scrollbar">
          <p className="text-[11px] font-bold text-blue-300/80 uppercase tracking-wider mb-3 px-2.5">Menu Utama</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <Link 
                key={item.path} 
                href={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={clsx(
                  "flex items-center justify-between px-3.5 py-3 rounded-xl font-bold transition-all duration-200 group text-sm",
                  isActive 
                    ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-red-600 text-white shadow-lg shadow-blue-900/50 ring-1 ring-white/20 scale-[1.02]" 
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon 
                    size={19} 
                    className={clsx(
                      "transition-transform group-hover:scale-110",
                      isActive ? "text-white" : "text-blue-300 group-hover:text-red-300"
                    )} 
                  />
                  <span>{item.name}</span>
                </div>
                {isActive && <ChevronRight size={16} className="text-white/90" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className="p-3.5 border-t border-blue-900/40 bg-black/20">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 w-full text-left rounded-xl font-bold text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-all group text-sm">
            <LogOut size={19} className="group-hover:-translate-x-1 transition-transform" /> 
            <span>Logout Admin</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden w-full relative">
        {/* Top Navbar dengan Aksen Biru-Merah */}
        <header className="bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200 p-4 flex justify-between items-center z-10 sticky top-0 relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-red-600"></div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="text-slate-600 md:hidden hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-all"
            >
              <Menu size={24} />
            </button>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                {navItems.find(i => i.path === pathname)?.name || 'Admin Panel'}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isDemoMode && (
              <span className="hidden md:inline-flex bg-red-500/10 text-red-600 border border-red-500/20 px-3 py-1 rounded-full text-xs font-bold tracking-widest animate-pulse">
                DEMO MODE
              </span>
            )}
            
            <Link href="/admin/notifikasi" className="relative p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors mr-2 sm:mr-4">
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
              )}
            </Link>

            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-sm font-bold text-slate-800">{user?.nama || 'Administrator'}</span>
              <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold border-2 border-indigo-200">
              {user?.nama ? user.nama.substring(0, 2).toUpperCase() : 'AD'}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar bg-slate-50" id="mainContent">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
