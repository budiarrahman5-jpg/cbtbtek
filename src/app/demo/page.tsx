'use client';

import { useState } from 'react';
import { Monitor, Key, Copy, CheckCircle, ArrowRight, PlayCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DemoPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [demoData, setDemoData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedField, setCopiedField] = useState('');
  const router = useRouter();

  const handleGenerate = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch('/api/generate-demo', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setDemoData(data.data);
      } else {
        setErrorMsg(data.message || 'Gagal membuat lingkungan demo.');
      }
    } catch (err) {
      setErrorMsg('Terjadi kesalahan pada server.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(''), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-hidden bg-slate-900">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-50 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-teal-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-40 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] bg-blue-700 rounded-full mix-blend-multiply filter blur-[120px] opacity-40 animate-blob animation-delay-4000"></div>

      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-lg border-b border-white/10 text-white p-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-500 to-teal-400 p-2 rounded-lg shadow-lg">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-wider leading-tight">CBT B-TEK DEMO</h1>
            <p className="text-xs text-blue-200 opacity-80">Sandbox Environment</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-lg">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
            
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Generator Akun Demo</h2>
              <p className="text-indigo-200 text-sm">Buat akun admin dan siswa dalam satu klik untuk mencoba fitur secara penuh. Akun berlaku selama 1 minggu.</p>
            </div>
            
            {!demoData ? (
              <div className="flex flex-col items-center">
                {errorMsg && (
                  <div className="w-full bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm font-medium mb-6 text-center">
                    {errorMsg}
                  </div>
                )}
                
                <button 
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-teal-400 hover:from-indigo-400 hover:to-teal-300 text-white py-4 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_25px_rgba(45,212,191,0.6)] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                >
                  {isLoading ? 'Membuat Lingkungan Demo...' : (
                    <>
                      <PlayCircle className="w-6 h-6" />
                      BUAT AKUN DEMO SEKARANG
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                <div className="bg-indigo-900/40 border border-indigo-500/30 rounded-xl p-5">
                  <h3 className="text-teal-400 font-bold mb-3 flex items-center gap-2">
                    <Key className="w-4 h-4" /> Akses Admin
                  </h3>
                  <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center text-sm mb-2">
                    <span className="text-indigo-200">Username:</span>
                    <span className="text-white font-mono bg-black/20 px-2 py-1 rounded truncate">{demoData.admin.username}</span>
                    <button onClick={() => copyToClipboard(demoData.admin.username, 'admin-user')} className="p-1.5 text-indigo-300 hover:text-white bg-white/5 rounded-md transition-colors" title="Salin Username Admin">
                      {copiedField === 'admin-user' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center text-sm">
                    <span className="text-indigo-200">Password:</span>
                    <span className="text-white font-mono bg-black/20 px-2 py-1 rounded truncate">{demoData.admin.password}</span>
                    <button onClick={() => copyToClipboard(demoData.admin.password, 'admin-pass')} className="p-1.5 text-indigo-300 hover:text-white bg-white/5 rounded-md transition-colors" title="Salin Password Admin">
                      {copiedField === 'admin-pass' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="bg-teal-900/40 border border-teal-500/30 rounded-xl p-5">
                  <h3 className="text-indigo-400 font-bold mb-3 flex items-center gap-2">
                    <Key className="w-4 h-4" /> Akses Siswa
                  </h3>
                  <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center text-sm mb-2">
                    <span className="text-teal-200">Username:</span>
                    <span className="text-white font-mono bg-black/20 px-2 py-1 rounded truncate">{demoData.siswa.username}</span>
                    <button onClick={() => copyToClipboard(demoData.siswa.username, 'siswa-user')} className="p-1.5 text-teal-300 hover:text-white bg-white/5 rounded-md transition-colors" title="Salin Username Siswa">
                      {copiedField === 'siswa-user' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center text-sm mb-2">
                    <span className="text-teal-200">Password:</span>
                    <span className="text-white font-mono bg-black/20 px-2 py-1 rounded truncate">{demoData.siswa.password}</span>
                    <button onClick={() => copyToClipboard(demoData.siswa.password, 'siswa-pass')} className="p-1.5 text-teal-300 hover:text-white bg-white/5 rounded-md transition-colors" title="Salin Password Siswa">
                      {copiedField === 'siswa-pass' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center text-sm mt-3 pt-3 border-t border-teal-500/20">
                    <span className="text-teal-200">Token Ujian:</span>
                    <span className="text-yellow-400 font-mono font-bold bg-black/20 px-2 py-1 rounded truncate">{demoData.token}</span>
                    <button onClick={() => copyToClipboard(demoData.token, 'token')} className="p-1.5 text-teal-300 hover:text-white bg-white/5 rounded-md transition-colors" title="Salin Token">
                      {copiedField === 'token' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => router.push('/')}
                  className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 group mt-6"
                >
                  KE HALAMAN LOGIN
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            )}
            
          </div>
          
          <div className="text-center mt-8">
            <p className="text-xs text-white/40 font-medium tracking-wide">
              &copy; 2026 CBT B-TEK by @budhii12
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
