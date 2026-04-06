import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProjectFiles } from '@/lib/db';
import { parseFile } from '@/lib/file-parser';

/**
 * GET /api/projects/[id]/files/analyze
 * STEP 0의 작업의뢰서 파일을 파싱하여 텍스트 내용 반환
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const projectId = parseInt(id);

  // STEP 0 파일 가져오기
  const files = getProjectFiles(projectId, 0) as any[];
  if (!files || files.length === 0) {
    return NextResponse.json({ error: '업로드된 작업의뢰서가 없습니다.' }, { status: 404 });
  }

  const results: { fileName: string; textContent: string | null; fileType: string }[] = [];

  for (const file of files) {
    try {
      const parsed = await parseFile(file.file_path, file.file_name);
      results.push({
        fileName: file.file_name,
        textContent: parsed.textContent,
        fileType: parsed.fileType,
      });
    } catch (e: any) {
      results.push({
        fileName: file.file_name,
        textContent: `[파싱 오류: ${e.message}]`,
        fileType: 'error',
      });
    }
  }

  // 전체 텍스트 합치기
  const combinedText = results
    .map(r => `=== ${r.fileName} ===\n${r.textContent || '(내용 없음)'}`)
    .join('\n\n');

  return NextResponse.json({
    files: results,
    combinedText,
    fileCount: files.length,
  });
}
