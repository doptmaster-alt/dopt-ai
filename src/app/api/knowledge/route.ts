import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllKnowledge, addKnowledge, deleteKnowledge, KnowledgeCategory, KnowledgeSource } from '@/lib/knowledge-base';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entries = getAllKnowledge();
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { category, title, content, source, sourceUrl, tags } = body;

    if (!category || !title || !content || !source) {
      return NextResponse.json(
        { error: 'category, title, content, source 필드가 필요합니다.' },
        { status: 400 },
      );
    }

    const validCategories: KnowledgeCategory[] = ['brief', 'plan', 'conti', 'final', 'process', 'reference'];
    const validSources: KnowledgeSource[] = ['notion', 'gdrive', 'figma', 'upload'];

    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: `유효하지 않은 category: ${category}` }, { status: 400 });
    }
    if (!validSources.includes(source)) {
      return NextResponse.json({ error: `유효하지 않은 source: ${source}` }, { status: 400 });
    }

    const entry = addKnowledge({
      category,
      title,
      content,
      source,
      sourceUrl: sourceUrl || '',
      tags: tags || [],
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '지식 추가 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id 파라미터가 필요합니다.' }, { status: 400 });
  }

  const deleted = deleteKnowledge(id);
  if (!deleted) {
    return NextResponse.json({ error: '해당 항목을 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
