import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createFeedback, getFeedbackList, getFeedbackStats, updateFeedback } from '@/lib/db';

// POST - 피드백 제출 (기획자)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    if (!body.title || !body.description) {
      return NextResponse.json({ error: 'Title and description required' }, { status: 400 });
    }

    createFeedback({
      userId: Number((session.user as any).id),
      userName: (session.user.name as string) || '',
      category: body.category || 'general',
      priority: body.priority || 'normal',
      title: body.title,
      description: body.description,
      screenshotUrl: body.screenshotUrl || '',
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET - 피드백 목록 (관리자) 또는 내 피드백 (기획자)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const stats = searchParams.get('stats');
    const status = searchParams.get('status') || undefined;

    if (stats === 'true') {
      return NextResponse.json(getFeedbackStats());
    }

    const list = getFeedbackList({ status, limit: 100 });
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH - 피드백 상태/응답 업데이트 (관리자)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    updateFeedback(body.id, {
      status: body.status,
      adminResponse: body.adminResponse,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
