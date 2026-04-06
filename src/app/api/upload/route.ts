import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseFile } from '@/lib/file-parser';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });
    }

    // 파일 크기 제한 (20MB)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: '파일 크기는 20MB 이하여야 합니다.' }, { status: 400 });
    }

    // uploads 디렉토리 생성
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    // 파일 저장
    const timestamp = Date.now();
    const safeFileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')}`;
    const filePath = path.join(UPLOAD_DIR, safeFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // 파일 파싱
    const parsed = await parseFile(filePath, file.name);

    return NextResponse.json({
      success: true,
      file: {
        name: file.name,
        size: file.size,
        type: parsed.fileType,
        textContent: parsed.textContent,
        base64Image: parsed.base64Image,
        mimeType: parsed.mimeType,
        // 이미지인 경우 Figma에서 접근 가능한 URL 제공
        fileUrl: parsed.fileType === 'image' ? `/api/uploads/${safeFileName}` : undefined,
      },
    });
  } catch (error: any) {
    console.error('[Upload API] Error:', error);
    return NextResponse.json(
      { error: error.message || '파일 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
