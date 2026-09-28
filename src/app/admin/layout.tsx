'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  LayoutDashboard, Users, Package, Archive, 
  FileText, PlusCircle, Trophy, PieChart, 
  Settings, Server, Menu, X, LogOut, ChevronRight, MonitorPlay
} from 'lucide-react';
import clsx from 'clsx';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();

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

  const isDemoMode = user?.username?.startsWith('demo_admin_');

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Pantau Ujian', path: '/admin/pantau', icon: MonitorPlay },
    { name: 'Kelola Siswa & Kelas', path: '/admin/siswa', icon: Users },
    { name: 'Kelola Paket', path: '/admin/paket', icon: Package },
    { name: 'Bank Soal', path: '/admin/soal', icon: Archive },
    { name: 'Tambah Soal', path: '/admin/tambah-soal', icon: PlusCircle },
    { name: 'Hasil Ujian', path: '/admin/hasil', icon: Trophy },
    { name: 'Analisis Soal', path: '/admin/analisis', icon: PieChart },
    { name: 'Pengaturan', path: '/admin/pengaturan', icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Modern Sidebar */}
      <aside 
        className={clsx(
          "w-[280px] bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-50 fixed inset-y-0 left-0 transform transition-transform duration-300 ease-out md:relative md:translate-x-0 border-r border-slate-800",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button 
          onClick={() => setIsSidebarOpen(false)} 
          className="absolute top-4 right-4 text-slate-400 hover:text-white md:hidden hover:bg-slate-800 p-1 rounded-lg transition-all"
        >
          <X size={24} />
        </button>

        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-teal-400 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <Server size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">CBT Admin</h1>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Control Panel</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 space-y-1.5 px-4 custom-scrollbar">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Main Menu</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <Link 
                key={item.path} 
                href={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={clsx(
                  "flex items-center justify-between px-3 py-3 rounded-xl font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                    : "hover:bg-slate-800 hover:text-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon size={20} className={isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-400"} />
                  {item.name}
                </div>
                {isActive && <ChevronRight size={16} className="text-indigo-300" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-3 w-full text-left rounded-xl font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all group">
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" /> 
            <span>Logout Admin</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden w-full relative">
        {/* Top Navbar */}
        <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200 p-4 flex justify-between items-center z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="text-slate-500 md:hidden hover:text-indigo-600 hover:bg-slate-100 p-1.5 rounded-lg transition-all"
            >
              <Menu size={24} />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">
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
