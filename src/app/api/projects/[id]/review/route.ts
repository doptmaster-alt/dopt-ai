import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  saveAiReview,
  getAiReview,
  updateAiReviewEmail,
  updateAiReviewGdrive,
  getAllConfirmedData,
  getProjectFiles,
} from '@/lib/db';

/**
 * GET /api/projects/[id]/review
 * AI 총평 조회
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const review = getAiReview(parseInt(id));

  if (!review) {
    return NextResponse.json({ review_content: null });
  }

  return NextResponse.json(review);
}

/**
 * POST /api/projects/[id]/review
 * AI 총평 생성 / 이메일 발송 / Google Drive 업로드
 * Body: { action: 'generate' | 'send_email' | 'upload_gdrive' }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const projectId = parseInt(id);
  const { action } = await req.json();

  if (action === 'generate') {
    return handleGenerate(projectId);
  } else if (action === 'send_email') {
    return handleSendEmail(projectId);
  } else if (action === 'upload_gdrive') {
    return handleGdriveUpload(projectId);
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

async function handleGenerate(projectId: number) {
  try {
    // 확정된 데이터 모두 수집
    const confirmedData = getAllConfirmedData(projectId);
    const allFiles = getProjectFiles(projectId);

    // 프로젝트 요약 텍스트 구성
    let projectSummary = '프로젝트 총평을 위한 데이터:\n\n';

    for (const cd of confirmedData) {
      const data = JSON.parse(cd.confirmed_data);
      projectSummary += `[${cd.data_type === 'brief' ? '브리프' : '기획안'} 확정 데이터]\n`;
      projectSummary += JSON.stringify(data, null, 2).substring(0, 3000) + '\n\n';
    }

    if (allFiles.length > 0) {
      projectSummary += `[업로드된 파일 목록]\n`;
      for (const f of allFiles) {
        projectSummary += `- ${f.file_name} (${f.file_type}, step ${f.step})\n`;
      }
    }

    // Claude API로 총평 생성
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: `당신은 DIOPT 광고기획사의 시니어 기획 디렉터입니다. 프로젝트 전체를 리뷰하고 총평을 작성해주세요.

총평에 포함할 내용:
1. 프로젝트 개요 및 성과 요약
2. 브리프 품질 평가 (타겟 설정, USP 선정, 메시지 전략)
3. 기획안 품질 평가 (섹션 구성, 카피, 레이아웃)
4. 촬영콘티/디자인 가이드 품질 평가
5. 강점 3가지
6. 개선점 3가지
7. 다음 프로젝트를 위한 제안사항
8. 종합 점수 (100점 만점)

한국어로 작성하며, 전문적이고 건설적인 피드백을 제공하세요.`,
      messages: [
        { role: 'user', content: projectSummary },
      ],
    });

    const reviewContent = response.content[0]?.type === 'text' ? response.content[0].text : '총평 생성 실패';

    saveAiReview(projectId, reviewContent);
    const review = getAiReview(projectId);

    return NextResponse.json(review);
  } catch (error: any) {
    console.error('[Review API] Generate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function handleSendEmail(projectId: number) {
  try {
    const review = getAiReview(projectId);
    if (!review?.review_content) {
      return NextResponse.json({ error: '먼저 총평을 생성해주세요.' }, { status: 400 });
    }

    // 내부 이메일 API 호출
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'diopt-ai@doptstudio.com',
      to: 'dopt@doptstudio.com',
      subject: `[DIOPT AI] 프로젝트 총평 리포트 #${projectId}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #1e3a5f, #2d5a87); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="font-size: 20px; margin: 0;">DIOPT AI 프로젝트 총평</h1>
            <p style="font-size: 12px; margin-top: 8px; opacity: 0.85;">프로젝트 #${projectId}</p>
          </div>
          <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <pre style="white-space: pre-wrap; font-family: -apple-system, sans-serif; font-size: 13px; line-height: 1.6; color: #374151;">${review.review_content}</pre>
          </div>
          <p style="text-align: center; font-size: 11px; color: #9ca3af; margin-top: 16px;">
            DIOPT AI 기획 어시스턴트 &copy; ${new Date().getFullYear()}
          </p>
        </div>
      `,
    });

    updateAiReviewEmail(projectId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Review API] Email error:', error);
    return NextResponse.json({ error: `이메일 발송 실패: ${error.message}` }, { status: 500 });
  }
}

async function handleGdriveUpload(projectId: number) {
  try {
    const review = getAiReview(projectId);
    if (!review?.review_content) {
      return NextResponse.json({ error: '먼저 총평을 생성해주세요.' }, { status: 400 });
    }

    // Google Drive 업로드
    const { google } = require('googleapis');

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });
    const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    // 프로젝트 폴더 생성
    const folderRes = await drive.files.create({
      requestBody: {
        name: `DIOPT_Project_${projectId}_${new Date().toISOString().slice(0, 10)}`,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined,
      },
      fields: 'id, webViewLink',
    });

    const folderId = folderRes.data.id;
    const folderUrl = folderRes.data.webViewLink;

    // 총평 파일 업로드
    const { Readable } = require('stream');
    const reviewStream = Readable.from([review.review_content]);

    await drive.files.create({
      requestBody: {
        name: `총평_Project_${projectId}.txt`,
        parents: [folderId],
      },
      media: {
        mimeType: 'text/plain',
        body: reviewStream,
      },
    });

    updateAiReviewGdrive(projectId, folderUrl);
    return NextResponse.json({ success: true, url: folderUrl });
  } catch (error: any) {
    console.error('[Review API] GDrive error:', error);
    return NextResponse.json({ error: `Google Drive 업로드 실패: ${error.message}` }, { status: 500 });
  }
}
