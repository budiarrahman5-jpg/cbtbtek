'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Users, Package, Archive, 
  FileText, PlusCircle, Trophy, PieChart, 
  Settings, Server, Menu, X 
} from 'lucide-react';
import clsx from 'clsx';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
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
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-800 font-sans">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={clsx(
          "w-64 bg-blue-900 text-white flex flex-col shadow-xl z-30 fixed inset-y-0 left-0 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button 
          onClick={() => setIsSidebarOpen(false)} 
          className="absolute top-4 right-4 text-white md:hidden hover:text-red-400 transition"
        >
          <X size={24} />
        </button>

        <div className="p-6 text-center border-b border-blue-800 flex flex-col items-center">
          <Server size={36} className="mb-2 text-blue-200" />
          <h1 className="text-lg font-bold">Admin Panel CBT</h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;

            return (
              <Link 
                key={item.path} 
                href={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={clsx(
                  "flex items-center px-4 py-3 rounded font-semibold transition-all duration-300",
                  isActive ? "bg-blue-700 text-white" : "hover:bg-blue-800 text-blue-100"
                )}
              >
                <Icon size={20} className="mr-3" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 text-center text-xs text-blue-300 border-t border-blue-800">
          CBT B-Tek dibuat oleh<br/>@budhii12 &copy; 2026
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden w-full relative">
        <header className="bg-white shadow p-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="text-blue-900 md:hidden hover:text-blue-700 transition"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-bold text-gray-800">
              {navItems.find(i => i.path === pathname)?.name || 'Admin Panel'}
            </h2>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6" id="mainContent">
          {children}
        </div>
      </main>
    </div>
  );
}
