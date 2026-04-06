import { NextRequest, NextResponse } from 'next/server';
import { getProjectsDueTomorrow, addEmailLog } from '@/lib/db';
import { sendEmail, generateReminderHtml } from '@/lib/email';

// 매일 실행 (cron 또는 외부 호출) — 내일 마감인 프로젝트 리마인더 발송
export async function GET(req: NextRequest) {
  // 간단한 API key 인증 (cron에서 호출 시)
  const authKey = req.nextUrl.searchParams.get('key');
  const expectedKey = process.env.CRON_SECRET || 'diopt-reminder-2024';
  if (authKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projects = getProjectsDueTomorrow();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const results: any[] = [];

  const dueMappings: Record<string, string> = {
    brief_due: '브리프 전달',
    plan_due: '기획안 전달',
    shoot_date: '촬영 진행',
    design_due: '디자인 완료',
    final_due: '최종 전달',
  };

  for (const project of projects) {
    const plannerEmail = project.planner_email;
    if (!plannerEmail) continue;

    for (const [field, label] of Object.entries(dueMappings)) {
      // shoot_date는 쉼표 구분 다중 날짜 지원
      const matches = field === 'shoot_date'
        ? (project[field] || '').split(',').includes(dateStr)
        : project[field] === dateStr;
      if (matches) {
        const html = generateReminderHtml({
          plannerName: project.user_name,
          projectTitle: project.title,
          clientName: project.client_name,
          dueName: label,
          dueDate: dateStr,
        });

        const result = await sendEmail({
          to: plannerEmail,
          subject: `[D:OPT] 내일 마감: ${project.title} - ${label}`,
          html,
        });

        if (result.success) {
          addEmailLog(project.id, 'reminder', plannerEmail, `[리마인더] ${label}`);
        }

        results.push({ project: project.title, due: label, email: plannerEmail, ...result });
      }
    }
  }

  return NextResponse.json({ sent: results.length, results });
}
