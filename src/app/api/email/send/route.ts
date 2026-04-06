import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendEmail, generateDeliveryHtml } from '@/lib/email';
import { addEmailLog, getProject } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectId, to, cc, subject, bodyText, html, emailType } = await req.json();

  if (!to || !subject) {
    return NextResponse.json({ error: '수신자, 제목은 필수입니다.' }, { status: 400 });
  }

  // bodyText가 있으면 디옵트 서명 포함 HTML 생성, 없으면 기존 html 사용
  let finalHtml: string;
  if (bodyText) {
    const plannerName = session.user.name || '기획자';
    finalHtml = generateDeliveryHtml({
      body: bodyText,
      plannerName,
      plannerEmail: process.env.HIWORKS_SMTP_USER,
    });
  } else if (html) {
    finalHtml = html;
  } else {
    return NextResponse.json({ error: '이메일 내용이 필요합니다.' }, { status: 400 });
  }

  const result = await sendEmail({ to, cc, subject, html: finalHtml });

  if (result.success && projectId) {
    addEmailLog(projectId, emailType || 'delivery', to, subject);
  }

  return NextResponse.json(result);
}
