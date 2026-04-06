import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Client } from '@notionhq/client';
import { addKnowledge, getAllKnowledge, KnowledgeCategory } from '@/lib/knowledge-base';
import fs from 'fs';
import path from 'path';

// Notion 클라이언트 생성
function getNotionClient(): Client {
  let apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/^NOTION_API_KEY=(.+)$/m);
      if (match) {
        apiKey = match[1].trim();
        process.env.NOTION_API_KEY = apiKey;
      }
    } catch {}
  }
  if (!apiKey) throw new Error('NOTION_API_KEY가 설정되지 않았습니다.');
  return new Client({ auth: apiKey });
}

// 카테고리 자동 판별
function detectCategory(title: string, content: string): KnowledgeCategory {
  const text = `${title} ${content}`.toLowerCase();

  // 작업의뢰서 / 브리프
  if (text.includes('작업의뢰서') || text.includes('작업 의뢰서') || text.includes('의뢰서')) return 'brief';
  if (text.includes('브리프') || text.includes('brief') || text.includes('요청서')) return 'brief';
  if (text.includes('제품 정보') || text.includes('클라이언트 정보') || text.includes('광고주')) return 'brief';

  // 기획안
  if (text.includes('기획안') || text.includes('기획서') || text.includes('플랜')) return 'plan';
  if (text.includes('스토리보드') || text.includes('컨셉') || text.includes('concept')) return 'plan';
  if (text.includes('구성안') || text.includes('레이아웃') || text.includes('layout')) return 'plan';
  if (text.includes('섹션 구성') || text.includes('페이지 구성')) return 'plan';

  // 촬영 콘티
  if (text.includes('촬영') || text.includes('콘티') || text.includes('conti')) return 'conti';
  if (text.includes('스튜디오') || text.includes('모델') || text.includes('소품')) return 'conti';
  if (text.includes('촬영 리스트') || text.includes('shot list') || text.includes('앵글')) return 'conti';

  // 최종 결과물 / 상세페이지
  if (text.includes('최종') || text.includes('완성') || text.includes('final')) return 'final';
  if (text.includes('상세페이지') || text.includes('상세 페이지') || text.includes('detail page')) return 'final';
  if (text.includes('디자인 가이드') || text.includes('디자인가이드')) return 'final';
  if (text.includes('납품') || text.includes('완료')) return 'final';

  // 프로세스
  if (text.includes('프로세스') || text.includes('워크플로우') || text.includes('workflow')) return 'process';
  if (text.includes('가이드라인') || text.includes('매뉴얼') || text.includes('템플릿')) return 'process';
  if (text.includes('sop') || text.includes('절차') || text.includes('규칙')) return 'process';

  return 'reference';
}

// 태그 자동 추출
function extractTags(title: string, content: string): string[] {
  const tags: string[] = [];
  const text = `${title} ${content}`;

  // 업종/카테고리 태그
  const industries = [
    '건기식', '건강기능식품', '뷰티', '화장품', '스킨케어', '식품', '패션',
    '가전', '가구', '인테리어', '반려동물', '육아', '유아', '피트니스',
    '다이어트', '서플리먼트', '영양제', '헤어', '바디', '클렌저',
  ];
  for (const tag of industries) {
    if (text.includes(tag)) tags.push(tag);
  }

  // 문서 유형 태그
  if (text.includes('작업의뢰서') || text.includes('의뢰서')) tags.push('작업의뢰서');
  if (text.includes('브리프')) tags.push('브리프');
  if (text.includes('기획안')) tags.push('기획안');
  if (text.includes('촬영') || text.includes('콘티')) tags.push('촬영콘티');
  if (text.includes('상세페이지')) tags.push('상세페이지');
  if (text.includes('디자인')) tags.push('디자인');

  return [...new Set(tags)]; // 중복 제거
}

// 블록을 텍스트로 변환
function blockToText(block: any): string {
  const type = block.type;
  const data = block[type];
  if (!data) return '';

  const richText = data.rich_text || data.text || [];
  const text = richText.map((t: any) => t.plain_text || '').join('');

  switch (type) {
    case 'paragraph': return text;
    case 'heading_1': return `# ${text}`;
    case 'heading_2': return `## ${text}`;
    case 'heading_3': return `### ${text}`;
    case 'bulleted_list_item': return `- ${text}`;
    case 'numbered_list_item': return `1. ${text}`;
    case 'to_do': return `${data.checked ? '[x]' : '[ ]'} ${text}`;
    case 'toggle': return `> ${text}`;
    case 'quote': return `> ${text}`;
    case 'callout': return `> ${text}`;
    case 'divider': return '---';
    case 'table_row': {
      const cells = data.cells?.map((cell: any[]) =>
        cell.map((t: any) => t.plain_text || '').join('')
      ) || [];
      return `| ${cells.join(' | ')} |`;
    }
    default: return text;
  }
}

// 프로퍼티 값 추출
function extractPropertyValue(prop: any): string {
  if (!prop) return '';
  switch (prop.type) {
    case 'title': return prop.title?.map((t: any) => t.plain_text).join('') || '';
    case 'rich_text': return prop.rich_text?.map((t: any) => t.plain_text).join('') || '';
    case 'number': return prop.number?.toString() || '';
    case 'select': return prop.select?.name || '';
    case 'multi_select': return prop.multi_select?.map((s: any) => s.name).join(', ') || '';
    case 'date': return prop.date?.start || '';
    case 'checkbox': return prop.checkbox ? 'Yes' : 'No';
    case 'url': return prop.url || '';
    case 'email': return prop.email || '';
    case 'phone_number': return prop.phone_number || '';
    case 'status': return prop.status?.name || '';
    default: return '';
  }
}

// 페이지 제목 추출
function getPageTitle(page: any): string {
  if (page.object === 'database') {
    return page.title?.[0]?.plain_text || '(제목 없음)';
  }
  const props = page.properties || {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop.type === 'title' && prop.title?.[0]?.plain_text) {
      return prop.title[0].plain_text;
    }
  }
  return '(제목 없음)';
}

// 상세페이지 관련 키워드 목록
const SCAN_KEYWORDS = [
  '상세페이지', '상세 페이지', 'detail page',
  '작업의뢰서', '작업 의뢰서', '의뢰서',
  '브리프', 'brief',
  '기획안', '기획서',
  '촬영콘티', '촬영 콘티', '콘티',
  '디자인가이드', '디자인 가이드',
  '스토리보드',
  '랜딩페이지', '랜딩 페이지',
];

// 관련성 점수 계산
function relevanceScore(title: string, content: string): number {
  const text = `${title} ${content}`.toLowerCase();
  let score = 0;
  for (const keyword of SCAN_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      score += 10;
    }
  }
  // 프로젝트명, 클라이언트명 등도 가산점
  if (text.includes('프로젝트')) score += 3;
  if (text.includes('클라이언트')) score += 3;
  if (text.includes('제품')) score += 2;
  if (text.includes('납품')) score += 5;
  if (text.includes('기획')) score += 5;
  if (text.includes('촬영')) score += 5;
  return score;
}

interface ScanProgress {
  phase: string;
  found: number;
  imported: number;
  total: number;
  errors: string[];
  items: Array<{
    title: string;
    category: string;
    pageId: string;
    url: string;
    imported: boolean;
  }>;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const notion = getNotionClient();
    const existingEntries = getAllKnowledge();
    const existingUrls = new Set(existingEntries.map(e => e.sourceUrl));

    const progress: ScanProgress = {
      phase: '검색 중...',
      found: 0,
      imported: 0,
      total: 0,
      errors: [],
      items: [],
    };

    // ====== Phase 1: 키워드 검색으로 관련 페이지 찾기 ======
    const allFoundPages: Map<string, any> = new Map();

    for (const keyword of SCAN_KEYWORDS) {
      try {
        const response = await notion.search({
          query: keyword,
          page_size: 100,
        });

        for (const item of response.results) {
          if (!allFoundPages.has(item.id)) {
            allFoundPages.set(item.id, item);
          }
        }
      } catch (e: any) {
        progress.errors.push(`검색 오류 (${keyword}): ${e.message}`);
      }

      // Rate limit 방지
      await new Promise(r => setTimeout(r, 350));
    }

    // ====== Phase 2: 전체 검색 (키워드 없이) - 모든 접근 가능한 페이지 ======
    try {
      let hasMore = true;
      let startCursor: string | undefined;
      let pageCount = 0;

      while (hasMore && pageCount < 500) { // 최대 500개
        const response: any = await notion.search({
          page_size: 100,
          start_cursor: startCursor,
        });

        for (const item of response.results) {
          if (!allFoundPages.has(item.id)) {
            allFoundPages.set(item.id, item);
          }
        }

        hasMore = response.has_more;
        startCursor = response.next_cursor;
        pageCount += response.results.length;

        // Rate limit 방지
        await new Promise(r => setTimeout(r, 350));
      }
    } catch (e: any) {
      progress.errors.push(`전체 검색 오류: ${e.message}`);
    }

    progress.phase = '페이지 분석 중...';
    progress.total = allFoundPages.size;

    // ====== Phase 3: 각 페이지/데이터베이스 분석 및 가져오기 ======
    const pagesToImport: Array<{
      id: string;
      title: string;
      type: string;
      url: string;
      score: number;
    }> = [];

    // 먼저 모든 페이지의 제목과 관련성 점수 계산
    for (const [id, item] of allFoundPages) {
      const title = getPageTitle(item);
      const url = item.url || `https://www.notion.so/${id.replace(/-/g, '')}`;
      const score = relevanceScore(title, '');

      pagesToImport.push({
        id,
        title,
        type: item.object, // 'page' or 'database'
        url,
        score,
      });
    }

    // 관련성 높은 것부터 정렬
    pagesToImport.sort((a, b) => b.score - a.score);

    // ====== Phase 4: 관련 페이지 내용 읽기 및 KB에 저장 ======
    let imported = 0;
    let skipped = 0;

    for (const pageInfo of pagesToImport) {
      const cleanId = pageInfo.id.replace(/-/g, '');
      const sourceUrl = `https://www.notion.so/${cleanId}`;

      // 이미 가져온 페이지 건너뛰기
      if (existingUrls.has(sourceUrl)) {
        skipped++;
        progress.items.push({
          title: pageInfo.title,
          category: 'skip',
          pageId: pageInfo.id,
          url: sourceUrl,
          imported: false,
        });
        continue;
      }

      try {
        let content = '';
        let fullTitle = pageInfo.title;

        if (pageInfo.type === 'database') {
          // 데이터베이스: 항목들을 읽기
          const dbResponse = await (notion.databases as any).query({
            database_id: pageInfo.id,
            page_size: 50,
          });

          const rows: string[] = [];
          for (const row of dbResponse.results as any[]) {
            const props = row.properties || {};
            const fields: string[] = [];
            for (const [key, val] of Object.entries(props) as any[]) {
              const text = extractPropertyValue(val);
              if (text) fields.push(`${key}: ${text}`);
            }
            if (fields.length > 0) {
              rows.push(fields.join(' | '));
            }
          }
          content = rows.join('\n');

          if (!content.trim()) {
            continue; // 빈 데이터베이스 건너뛰기
          }
        } else {
          // 페이지: 블록 내용 읽기
          try {
            const page = await notion.pages.retrieve({ page_id: pageInfo.id }) as any;
            const titleProp = page.properties?.title || page.properties?.Name || page.properties?.['이름'];
            if (titleProp?.title?.[0]?.plain_text) {
              fullTitle = titleProp.title[0].plain_text;
            }
          } catch {}

          try {
            const blocks = await notion.blocks.children.list({
              block_id: pageInfo.id,
              page_size: 100,
            });
            content = blocks.results.map((block: any) => blockToText(block)).filter(Boolean).join('\n');
          } catch (e: any) {
            // 블록 읽기 실패 시 제목만으로 처리
            content = `(블록 내용 읽기 실패: ${e.message})`;
          }
        }

        // 관련성 재평가 (내용 포함)
        const finalScore = relevanceScore(fullTitle, content);

        // 관련성 점수가 0이면 스킵 (상세페이지 관련 키워드가 하나도 없음)
        if (finalScore === 0) {
          progress.items.push({
            title: fullTitle,
            category: 'skip',
            pageId: pageInfo.id,
            url: sourceUrl,
            imported: false,
          });
          continue;
        }

        // 카테고리 자동 판별
        const category = detectCategory(fullTitle, content);
        const tags = extractTags(fullTitle, content);

        // KB에 저장
        const entry = addKnowledge({
          category,
          title: fullTitle,
          content: content.slice(0, 50000), // 최대 50KB
          source: 'notion',
          sourceUrl,
          tags,
        });

        imported++;
        existingUrls.add(sourceUrl); // 중복 방지

        progress.items.push({
          title: fullTitle,
          category,
          pageId: pageInfo.id,
          url: sourceUrl,
          imported: true,
        });

      } catch (e: any) {
        progress.errors.push(`${pageInfo.title}: ${e.message}`);
        progress.items.push({
          title: pageInfo.title,
          category: 'error',
          pageId: pageInfo.id,
          url: `https://www.notion.so/${pageInfo.id.replace(/-/g, '')}`,
          imported: false,
        });
      }

      // Rate limit 방지 (Notion API 3 req/s 제한)
      await new Promise(r => setTimeout(r, 400));
    }

    progress.phase = '완료';
    progress.found = pagesToImport.length;
    progress.imported = imported;

    return NextResponse.json({
      success: true,
      message: `Notion 스캔 완료! 총 ${pagesToImport.length}개 페이지 발견, ${imported}개 가져옴, ${skipped}개 이미 존재`,
      stats: {
        totalFound: pagesToImport.length,
        imported,
        skipped,
        errors: progress.errors.length,
      },
      items: progress.items.filter(i => i.imported).map(i => ({
        title: i.title,
        category: i.category,
        url: i.url,
      })),
      errors: progress.errors.slice(0, 20), // 최대 20개 에러만 반환
    });

  } catch (error: any) {
    console.error('[NotionScan] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Notion 스캔 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

// GET: 스캔 상태 확인 (향후 SSE로 확장 가능)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ status: 'ready' });
}
