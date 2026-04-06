import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPendingUsers, approveUser, rejectUser } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pending = getPendingUsers();
  return NextResponse.json(pending);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, action } = await req.json();
  if (!id || !action) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (action === 'approve') {
    approveUser(id);
    return NextResponse.json({ success: true, message: '승인되었습니다.' });
  } else if (action === 'reject') {
    rejectUser(id);
    return NextResponse.json({ success: true, message: '거절되었습니다.' });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
