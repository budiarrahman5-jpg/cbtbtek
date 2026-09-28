export function filterDemoData(data: any[] | null, tableName: string) {
  if (!data || !Array.isArray(data) || typeof window === 'undefined') return data;
  
  try {
    const savedUser = localStorage.getItem('cbt_user');
    if (!savedUser) return data;
    
    const user = JSON.parse(savedUser);
    const isDemo = user?.username?.startsWith('demo_');
    const demoId = isDemo ? user.username.split('_').pop() : '';

    if (isDemo) {
      if (tableName === 'users' || tableName === 'siswa') {
        return data.filter(item => item.username?.includes(demoId));
      }
      if (tableName === 'kelas') {
        return data.filter(item => item.nama_kelas?.includes(demoId));
      }
      if (tableName === 'paket') {
        return data.filter(item => item.nama_paket?.includes(demoId) || item.paket?.nama_paket?.includes(demoId));
      }
      if (tableName === 'soal') {
        return data.filter(item => {
           if (item.paket_soal && item.paket_soal.length > 0) {
             return item.paket_soal.some((ps: any) => ps.paket?.nama_paket?.includes(demoId));
           }
           return false;
        });
      }
      if (tableName === 'hasil') {
        return data.filter(item => item.users?.username?.includes(demoId));
      }
    } else {
      // Main Admin - Hide all demo data
      if (tableName === 'users' || tableName === 'siswa') {
        return data.filter(item => !item.username?.startsWith('demo_'));
      }
      if (tableName === 'kelas') {
        return data.filter(item => !item.nama_kelas?.startsWith('Kelas Demo'));
      }
      if (tableName === 'paket') {
        return data.filter(item => !item.nama_paket?.startsWith('Paket Ujian Demo') && !item.paket?.nama_paket?.startsWith('Paket Ujian Demo'));
      }
      if (tableName === 'soal') {
        return data.filter(item => {
           if (item.paket_soal && item.paket_soal.length > 0) {
             return !item.paket_soal.some((ps: any) => ps.paket?.nama_paket?.startsWith('Paket Ujian Demo'));
           }
           return true;
        });
      }
      if (tableName === 'hasil') {
        return data.filter(item => !item.users?.username?.startsWith('demo_'));
      }
    }
  } catch (e) {
    console.error("Error applying demo filter", e);
  }
  
  return data;
}
