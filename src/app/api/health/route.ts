import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {

    // DB connectivity check
    const dbCheck = getDb().prepare('SELECT 1 as ok').get() as any;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.APP_ENV || 'development',
      uptime: process.uptime(),
      db: dbCheck?.ok === 1 ? 'connected' : 'error',
    });
  } catch (e: any) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: e.message,
    }, { status: 503 });
  }
}
