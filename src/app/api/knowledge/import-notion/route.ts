import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notionReadPage } from '@/lib/notion';
import { addKnowledge, KnowledgeCategory } from '@/lib/knowledge-base';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { pageId, category, tags } = body;

    if (!pageId) {
      return NextResponse.json({ error: 'pageId가 필요합니다.' }, { status: 400 });
    }

    const validCategories: KnowledgeCategory[] = ['brief', 'plan', 'conti', 'final', 'process', 'reference'];
    const cat: KnowledgeCategory = validCategories.includes(category) ? category : 'reference';

    // Read the Notion page content
    const content = await notionReadPage(pageId);

    if (content.startsWith('노션 페이지 읽기 오류')) {
      return NextResponse.json({ error: content }, { status: 400 });
    }

    // Extract title from content (first line starting with #)
    const titleMatch = content.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1] : `Notion Page ${pageId}`;

    const cleanPageId = pageId.replace(/-/g, '');
    const sourceUrl = `https://www.notion.so/${cleanPageId}`;

    const entry = addKnowledge({
      category: cat,
      title,
      content,
      source: 'notion',
      sourceUrl,
      tags: tags || [],
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Notion 페이지 가져오기 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
