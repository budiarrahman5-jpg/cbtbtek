export default function UnderConstructionPage() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
      <svg className="w-20 h-20 text-blue-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Modul Sedang Dikembangkan</h2>
      <p className="text-gray-500 max-w-md">
        Halaman ini masih dalam tahap pengembangan. Silakan kembali lagi nanti setelah fitur ini selesai diintegrasikan dengan database Supabase.
      </p>
    </div>
  );
}
