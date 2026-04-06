import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createErrorLog, getErrorLogs, getErrorLogStats, updateErrorLog } from '@/lib/db';

// POST - 에러 로그 기록 (클라이언트에서 자동 전송)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();

    createErrorLog({
      type: body.type || 'error',
      severity: body.severity || 'medium',
      title: body.title || 'Unknown Error',
      message: body.message || '',
      stackTrace: body.stackTrace || '',
      url: body.url || '',
      userId: (session?.user as any)?.id ? Number((session.user as any).id) : undefined,
      userName: (session?.user?.name as string) || '',
      projectId: body.projectId ? Number(body.projectId) : undefined,
      browserInfo: body.browserInfo || '',
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET - 에러 로그 목록 (관리자용)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const stats = searchParams.get('stats');

    if (stats === 'true') {
      return NextResponse.json(getErrorLogStats());
    }

    const logs = getErrorLogs({ status, limit: 100 });
    return NextResponse.json(logs);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH - 에러 상태 업데이트 (관리자용)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    updateErrorLog(body.id, {
      status: body.status,
      notes: body.notes,
      resolvedBy: (session.user.name as string) || 'admin',
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
