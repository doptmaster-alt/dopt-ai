import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addLearning, getLearnings, getLearningStats, setClientPreference, getClientPreferences } from '@/lib/db';

// 학습 데이터 조회
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || undefined;
  const stats = searchParams.get('stats');
  const clientName = searchParams.get('client');

  if (stats === 'true') {
    return NextResponse.json(getLearningStats());
  }

  if (clientName) {
    return NextResponse.json(getClientPreferences(clientName));
  }

  return NextResponse.json(getLearnings(category, 50));
}

// 학습 데이터 저장
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  if (body.type === 'client_preference') {
    setClientPreference(body.clientName, body.key, body.value, body.source);
    return NextResponse.json({ success: true });
  }

  addLearning({
    projectId: body.projectId,
    category: body.category,
    subcategory: body.subcategory,
    content: body.content,
    context: body.context,
    qualityScore: body.qualityScore,
  });

  return NextResponse.json({ success: true });
}
