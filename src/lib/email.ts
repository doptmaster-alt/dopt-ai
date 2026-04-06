import nodemailer from 'nodemailer';

// Hiworks SMTP 설정
function getTransporter() {
  const host = process.env.HIWORKS_SMTP_HOST || 'smtps.hiworks.com';
  const port = parseInt(process.env.HIWORKS_SMTP_PORT || '465');
  const user = process.env.HIWORKS_SMTP_USER || '';
  const pass = process.env.HIWORKS_SMTP_PASS || '';

  if (!user || !pass) {
    throw new Error('Hiworks SMTP 설정이 없습니다. .env.local에 HIWORKS_SMTP_USER, HIWORKS_SMTP_PASS를 설정하세요.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  cc?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = getTransporter();
    const fromName = process.env.HIWORKS_FROM_NAME || '디옵트';
    const fromEmail = process.env.HIWORKS_SMTP_USER || '';

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: options.to,
      cc: options.cc,
      subject: options.subject,
      html: options.html,
    });

    console.log('[Email] Sent:', info.messageId, 'to:', options.to);
    return { success: true, messageId: info.messageId };
  } catch (e: any) {
    console.error('[Email] Failed:', e.message);
    return { success: false, error: e.message };
  }
}

// 디옵트 이메일 서명 생성 (실제 Hiworks 패턴 기반)
export function generateDoptSignature(params: {
  name: string;
  title?: string;       // 직급 (선임 AE, 마케터, ST 등)
  team?: string;        // 팀 (기획팀, 촬영팀, 경영지원팀 등)
  email?: string;
  tel?: string;
  extension?: string;   // 내선번호
}): string {
  const name = params.name;
  const title = params.title || 'AE';
  const team = params.team || '기획팀';
  const email = params.email || process.env.HIWORKS_SMTP_USER || 'dopt@doptstudio.com';
  const tel = params.tel || '02-533-8858';
  const extension = params.extension || '';

  return `
<div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #555; line-height: 1.6;">
  <p style="margin: 0 0 8px 0;">
    <strong style="color: #333;">D-opt. | 디옵트</strong>
  </p>
  <p style="margin: 0 0 4px 0;">${team} | ${name} ${title}</p>
  <p style="margin: 0 0 4px 0;">E-mail | ${email}</p>
  <p style="margin: 0 0 4px 0;">Tel | ${tel}${extension ? ` / 내선번호 ${extension}` : ''}</p>
  <p style="margin: 0 0 12px 0;">Adress | 서울특별시 강남구 도산대로96길 15, 청담동 파크힐 2층</p>

  <p style="margin: 0 0 4px 0; font-size: 12px; color: #888;">[사업분야 및 제작 기획분야]</p>
  <p style="margin: 0 0 2px 0; font-size: 11px; color: #999;">-사진촬영 기획제작 [광고/패션/엔터테인먼트/인물/셀러브리티/라이프/리빙/인테리어]</p>
  <p style="margin: 0 0 2px 0; font-size: 11px; color: #999;">-디자인 [상세페이지 디자인/웹사이트 제작/브랜딩 디자인/인테리어 디자인]</p>
  <p style="margin: 0 0 2px 0; font-size: 11px; color: #999;">-영상촬영 기획제작 [광고/패션/엔터테인먼트/인물/셀러브리티/라이프/리빙]</p>
  <p style="margin: 0 0 8px 0; font-size: 11px; color: #999;">
    -Website: <a href="https://doptstudio.com/" style="color: #999;">https://doptstudio.com/</a>
  </p>
  <p style="margin: 0; font-size: 11px; color: #bbb;">ⓒ2026. D:opt studio all rights reserved.</p>
</div>`;
}

// CAUTION 푸터 (저작권 안내)
export function generateCautionFooter(): string {
  return `
<div style="margin-top: 24px; padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 11px; color: #999; line-height: 1.6;">
  <p style="margin: 0; font-weight: 600; color: #777;">[CAUTION]</p>
  <p style="margin: 4px 0 0 0;">본 이메일의 모든 내용과 이미지의 저작권은 디옵트에게 있습니다.<br>
  사전에 합의되지 않은 곳에서 무단으로 캡쳐, 도용, 불법 복제를 하는 경우<br>
  경고없이 민/형사상 법적조치 등 저작권법에 의한 처벌을 받을 수 있습니다.</p>
</div>`;
}

// 클라이언트 전달 이메일 HTML 생성 (디옵트 실제 패턴 반영)
export function generateDeliveryHtml(params: {
  body: string;           // AI가 작성한 본문 (plain text)
  plannerName: string;
  plannerTitle?: string;
  plannerTeam?: string;
  plannerEmail?: string;
  plannerTel?: string;
  plannerExtension?: string;
  includeCaution?: boolean;
}): string {
  // plain text를 HTML로 변환 (줄바꿈 처리)
  const bodyHtml = params.body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n\n/g, '</p><p style="margin: 0 0 12px 0;">')
    .replace(/\n/g, '<br>');

  const signature = generateDoptSignature({
    name: params.plannerName,
    title: params.plannerTitle,
    team: params.plannerTeam,
    email: params.plannerEmail,
    tel: params.plannerTel,
    extension: params.plannerExtension,
  });

  const caution = params.includeCaution !== false ? generateCautionFooter() : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', '맑은 고딕', sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.8; font-size: 14px;">
  <div style="padding: 0;">
    <p style="margin: 0 0 12px 0;">${bodyHtml}</p>
  </div>
  ${signature}
  ${caution}
</body>
</html>`;
}

// 스케줄 리마인더 이메일 HTML 생성
export function generateReminderHtml(params: {
  plannerName: string;
  projectTitle: string;
  clientName: string;
  dueName: string;
  dueDate: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #1e40af; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 18px;">D:OPT AI - 일정 알림</h1>
  </div>
  <div style="background: white; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
    <p style="font-size: 15px; margin-bottom: 16px;">${params.plannerName}님, 안녕하세요.</p>
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 16px;">
      <p style="margin: 0; font-size: 14px; font-weight: 600; color: #92400e;">
        내일 (${params.dueDate}) <strong>${params.dueName}</strong> 마감입니다.
      </p>
    </div>
    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
      <tr><td style="padding: 8px 0; color: #6b7280;">프로젝트</td><td style="padding: 8px 0; font-weight: 600;">${params.projectTitle}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">클라이언트</td><td style="padding: 8px 0;">${params.clientName}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">마감 항목</td><td style="padding: 8px 0; font-weight: 600; color: #dc2626;">${params.dueName}</td></tr>
      <tr><td style="padding: 8px 0; color: #6b7280;">마감일</td><td style="padding: 8px 0; font-weight: 600;">${params.dueDate}</td></tr>
    </table>
    <p style="font-size: 13px; color: #9ca3af; margin-top: 20px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
      이 알림은 D:OPT AI 기획 어시스턴트에서 자동 발송되었습니다.
    </p>
  </div>
</body>
</html>`;
}
