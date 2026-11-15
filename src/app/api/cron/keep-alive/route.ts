import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const startTime = Date.now();
    
    // Ping query ringan ke tabel pengaturan agar database Supabase tetap aktif
    const { data, error } = await supabase
      .from('pengaturan')
      .select('kunci, nilai')
      .eq('kunci', 'nama_aplikasi')
      .maybeSingle();

    const durationMs = Date.now() - startTime;

    if (error) {
      console.error('Keep-alive ping Supabase error:', error);
      return NextResponse.json({
        status: 'error',
        message: 'Gagal melakukan ping ke database Supabase',
        error: error.message,
        timestamp: new Date().toISOString(),
        duration_ms: durationMs
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'ok',
      message: 'Supabase keep-alive ping sukses. Database tetap aktif dan bebas auto-pause!',
      app_name: data?.nilai || 'CBT B-TEK',
      timestamp: new Date().toISOString(),
      duration_ms: durationMs
    }, { status: 200 });

  } catch (err: any) {
    console.error('Unhandled keep-alive error:', err);
    return NextResponse.json({
      status: 'error',
      message: err?.message || 'Terjadi kesalahan sistem keep-alive',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
