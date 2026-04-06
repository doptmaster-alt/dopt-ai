import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addKnowledge, getAllKnowledge, KnowledgeCategory } from '@/lib/knowledge-base';
import {
  listAllFiles,
  readFileContent,
  isReadableFile,
  DriveFile,
  mimeTypeLabel,
} from '@/lib/gdrive';

// 카테고리 자동 판별
function detectCategory(title: string, content: string): KnowledgeCategory {
  const text = `${title} ${content}`.toLowerCase();
  if (text.includes('작업의뢰서') || text.includes('작업 의뢰서') || text.includes('의뢰서')) return 'brief';
  if (text.includes('브리프') || text.includes('brief') || text.includes('요청서')) return 'brief';
  if (text.includes('기획안') || text.includes('기획서') || text.includes('플랜')) return 'plan';
  if (text.includes('스토리보드') || text.includes('컨셉') || text.includes('구성안')) return 'plan';
  if (text.includes('레이아웃') || text.includes('섹션 구성') || text.includes('페이지 구성')) return 'plan';
  if (text.includes('촬영') || text.includes('콘티') || text.includes('conti')) return 'conti';
  if (text.includes('스튜디오') || text.includes('소품') || text.includes('앵글')) return 'conti';
  if (text.includes('최종') || text.includes('완성') || text.includes('final')) return 'final';
  if (text.includes('상세페이지') || text.includes('상세 페이지')) return 'final';
  if (text.includes('디자인 가이드') || text.includes('디자인가이드')) return 'final';
  if (text.includes('프로세스') || text.includes('워크플로우') || text.includes('가이드라인')) return 'process';
  if (text.includes('매뉴얼') || text.includes('템플릿')) return 'process';
  return 'reference';
}

// 태그 자동 추출
function extractTags(title: string, content: string): string[] {
  const tags = new Set<string>();
  const text = `${title} ${content}`;
  const keywords = ['건기식', '뷰티', '화장품', '스킨케어', '식품', '패션', '가전', '가구', '인테리어', '다이어트', '영양제'];
  for (const tag of keywords) { if (text.includes(tag)) tags.add(tag); }
  if (text.includes('작업의뢰서') || text.includes('의뢰서')) tags.add('작업의뢰서');
  if (text.includes('브리프')) tags.add('브리프');
  if (text.includes('기획안')) tags.add('기획안');
  if (text.includes('촬영') || text.includes('콘티')) tags.add('촬영콘티');
  if (text.includes('상세페이지')) tags.add('상세페이지');
  if (text.includes('디자인')) tags.add('디자인');
  return [...tags];
}

// 관련성 키워드
const SCAN_KEYWORDS = [
  '상세페이지', '작업의뢰서', '의뢰서', '브리프', 'brief',
  '기획안', '기획서', '촬영콘티', '콘티', '디자인가이드',
  '스토리보드', '랜딩페이지', '기획', '촬영', '디자인',
];

function relevanceScore(title: string, content: string): number {
  const text = `${title} ${content}`.toLowerCase();
  let score = 0;
  for (const kw of SCAN_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) score += 10;
  }
  if (text.includes('프로젝트')) score += 3;
  if (text.includes('클라이언트')) score += 3;
  if (text.includes('제품')) score += 2;
  return score;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { folderId, keywords } = body as { folderId?: string; keywords?: string[] };

    const existingEntries = getAllKnowledge();
    const existingUrls = new Set(existingEntries.map(e => e.sourceUrl));

    const allFiles: DriveFile[] = [];
    const errors: string[] = [];

    // 키워드 검색으로 파일 찾기
    const searchTerms = keywords && keywords.length > 0
      ? keywords
      : ['상세페이지', '작업의뢰서', '브리프', '기획안', '촬영콘티', '디자인가이드'];

    for (const term of searchTerms) {
      try {
        const files = await listAllFiles({
          query: term,
          folderId: folderId,
          maxFiles: 200,
        });
        for (const file of files) {
          if (!allFiles.find(f => f.id === file.id)) {
            allFiles.push(file);
          }
        }
      } catch (e: any) {
        errors.push(`검색 오류 (${term}): ${e.message}`);
      }
    }

    // 특정 폴더가 지정된 경우 전체 파일도 가져오기
    if (folderId) {
      try {
        const folderFiles = await listAllFiles({ folderId, maxFiles: 500 });
        for (const file of folderFiles) {
          if (!allFiles.find(f => f.id === file.id)) {
            allFiles.push(file);
          }
        }
      } catch (e: any) {
        errors.push(`폴더 스캔 오류: ${e.message}`);
      }
    }

    // 읽기 가능한 파일만 필터링
    const readableFiles = allFiles.filter(f => isReadableFile(f.mimeType));

    let imported = 0;
    let skipped = 0;
    const importedItems: Array<{ title: string; category: string; url: string; type: string }> = [];

    for (const file of readableFiles) {
      const fileUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}`;

      // 이미 가져온 파일 건너뛰기
      if (existingUrls.has(fileUrl)) {
        skipped++;
        continue;
      }

      try {
        // 파일 내용 읽기
        const content = await readFileContent(file.id, file.mimeType);
        if (!content || content.startsWith('[') || content.length < 10) continue;

        // 관련성 평가
        const score = relevanceScore(file.name, content);
        if (score === 0) continue;

        // 카테고리 & 태그
        const category = detectCategory(file.name, content);
        const tags = extractTags(file.name, content);

        // KB에 저장
        addKnowledge({
          category,
          title: file.name,
          content: content.slice(0, 50000),
          source: 'gdrive',
          sourceUrl: fileUrl,
          tags,
        });

        imported++;
        existingUrls.add(fileUrl);
        importedItems.push({
          title: file.name,
          category,
          url: fileUrl,
          type: mimeTypeLabel(file.mimeType),
        });
      } catch (e: any) {
        errors.push(`${file.name}: ${e.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Google Drive 스캔 완료! 총 ${allFiles.length}개 파일 발견, ${readableFiles.length}개 읽기 가능, ${imported}개 가져옴`,
      stats: {
        totalFound: allFiles.length,
        readable: readableFiles.length,
        imported,
        skipped,
        errors: errors.length,
      },
      items: importedItems,
      errors: errors.slice(0, 20),
    });
  } catch (error: any) {
    console.error('[GDriveScan] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Google Drive 스캔 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
