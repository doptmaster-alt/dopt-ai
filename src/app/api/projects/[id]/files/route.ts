import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addProjectFile, getProjectFiles, getProjectFilesByType, deleteProjectFile } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

/**
 * GET /api/projects/[id]/files?step=0&fileType=work_order
 * 프로젝트 파일 목록 조회
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const projectId = parseInt(id);
  const step = req.nextUrl.searchParams.get('step');
  const fileType = req.nextUrl.searchParams.get('fileType');

  let files;
  if (fileType) {
    files = getProjectFilesByType(projectId, fileType);
  } else if (step !== null) {
    files = getProjectFiles(projectId, parseInt(step));
  } else {
    files = getProjectFiles(projectId);
  }

  return NextResponse.json(files);
}

/**
 * POST /api/projects/[id]/files
 * 프로젝트에 파일 업로드
 * FormData: file, step, fileType
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const projectId = parseInt(id);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const step = parseInt(formData.get('step') as string || '0');
    const fileType = (formData.get('fileType') as string) || 'general';

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: '파일 크기는 50MB 이하여야 합니다.' }, { status: 400 });
    }

    // 프로젝트별 폴더 생성
    const projectDir = path.join(UPLOAD_DIR, `project_${projectId}`);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // 파일 저장
    const timestamp = Date.now();
    const safeFileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')}`;
    const filePath = path.join(projectDir, safeFileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // DB 기록
    addProjectFile(projectId, step, fileType, filePath, file.name, file.size, file.type || '');

    console.log(`[Files API] Uploaded ${file.name} for project ${projectId} step ${step} type ${fileType}`);

    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        path: filePath,
        fileType,
        step,
      },
    });

  } catch (error: any) {
    console.error('[Files API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/files?fileId=123
 * 프로젝트 파일 삭제
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fileId = req.nextUrl.searchParams.get('fileId');
  if (!fileId) {
    return NextResponse.json({ error: 'fileId required' }, { status: 400 });
  }

  deleteProjectFile(parseInt(fileId));
  return NextResponse.json({ success: true });
}
