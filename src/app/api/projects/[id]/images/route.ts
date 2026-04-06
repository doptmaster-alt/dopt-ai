import { NextRequest, NextResponse } from 'next/server';
import { getGeneratedImage, getProjectImages, saveGeneratedImage, confirmGeneratedImage, deleteGeneratedImage } from '@/lib/db';

/**
 * GET /api/projects/[id]/images?key=section-1
 * 프로젝트의 저장된 AI 생성 이미지 조회
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = parseInt(id);
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');

  if (key) {
    const image = getGeneratedImage(projectId, key);
    if (!image) return NextResponse.json({ image: null });
    return NextResponse.json({
      image: {
        imageKey: image.image_key,
        imageData: image.image_data,
        prompt: image.prompt,
        feedbackHistory: JSON.parse(image.feedback_history || '[]'),
        status: image.status,
        updatedAt: image.updated_at,
      }
    });
  }

  const images = getProjectImages(projectId);
  return NextResponse.json({
    images: images.map((img: any) => ({
      imageKey: img.image_key,
      imageData: img.image_data,
      prompt: img.prompt,
      feedbackHistory: JSON.parse(img.feedback_history || '[]'),
      status: img.status,
      updatedAt: img.updated_at,
    }))
  });
}

/**
 * POST /api/projects/[id]/images
 * AI 생성 이미지 저장/업데이트
 *
 * body: { imageKey, imageData, prompt, feedbackHistory?, status? }
 * action: 'confirm' — 컨펌 처리
 * action: 'delete' — 삭제
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = parseInt(id);
  const body = await req.json();

  if (body.action === 'confirm') {
    confirmGeneratedImage(projectId, body.imageKey);
    return NextResponse.json({ success: true, status: 'confirmed' });
  }

  if (body.action === 'delete') {
    deleteGeneratedImage(projectId, body.imageKey);
    return NextResponse.json({ success: true });
  }

  const { imageKey, imageData, prompt, feedbackHistory, status } = body;
  if (!imageKey || !imageData) {
    return NextResponse.json({ error: 'imageKey and imageData required' }, { status: 400 });
  }

  saveGeneratedImage(
    projectId,
    imageKey,
    imageData,
    prompt || '',
    JSON.stringify(feedbackHistory || []),
    status || 'generated'
  );

  return NextResponse.json({ success: true, imageKey, status: status || 'generated' });
}
