import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import { getProject } from '@/lib/db';
import fs from 'fs';
import path from 'path';

function loadApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (match) { process.env.ANTHROPIC_API_KEY = match[1].trim(); return match[1].trim(); }
  } catch {}
  throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
}

// 학습된 이메일 샘플 로드 (유형별 2개씩)
function loadEmailSamples(deliveryType: string): string {
  try {
    const samplesPath = path.join(process.cwd(), 'data', 'email-samples.json');
    if (!fs.existsSync(samplesPath)) return '';
    const samples = JSON.parse(fs.readFileSync(samplesPath, 'utf-8'));

    // 유형별 키워드 매핑
    const typeKeywords: Record<string, string[]> = {
      '브리프 전달': ['기획', '브리프', '초안'],
      '기획안 전달': ['기획', '초안', '수정안'],
      '촬영 콘티 전달': ['콘티', '촬영', '소품'],
      '디자인 전달': ['디자인', '초안', '수정', '송부'],
      '견적서 전달': ['견적', '전달'],
      '보고서 전달': ['보고서', '결과'],
      '일정 공유': ['일정', '확정', '공유'],
      '최종 데이터 전달': ['최종', '데이터', '이관'],
    };

    const keywords = typeKeywords[deliveryType] || ['송부', '전달'];

    // 디옵트 발신 이메일 중 관련 유형 필터
    const relevant = samples.filter((e: any) => {
      const subject = e.subject || '';
      if (!subject.includes('디옵트')) return false;
      return keywords.some((kw: string) => subject.includes(kw) || (e.body || '').substring(0, 300).includes(kw));
    });

    const selected = relevant.slice(0, 3);
    if (selected.length === 0) return '';

    return selected.map((e: any, i: number) =>
      `--- 참고 이메일 ${i + 1} ---\n제목: ${e.subject}\n본문:\n${(e.body || '').substring(0, 800)}`
    ).join('\n\n');
  } catch { return ''; }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectId, deliveryType, briefContent } = await req.json();
  const project = getProject(projectId);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const plannerName = session.user.name || '기획자';
  const emailSamples = loadEmailSamples(deliveryType);

  const client = new Anthropic({ apiKey: loadApiKey() });

  const systemPrompt = `당신은 디옵트(DIOPT) 광고기획사의 이메일 작성 전문가입니다.
클라이언트에게 전달하는 업무 이메일을 작성해야 합니다.

## 디옵트 이메일 작성 규칙 (실제 이메일 패턴 기반)

### 제목 형식
- 반드시 "[디옵트]" 접두어로 시작
- 형식: "[디옵트] {클라이언트/브랜드명} {제품명} {전달물 유형} 송부의 건"
- 예: "[디옵트] 매일유업 상하목장 유아식 3종 디자인 초안 송부의 건"
- 예: "[디옵트] 린트 린도 T5 촬영 콘티 송부의 건"
- 예: "[디옵트] 동국제약 마데카 견적서 전달의 건"
- 일정 관련: "[디옵트] {브랜드명} 촬영 일정 확정 (날짜) 및 진행사항 안내"

### 인사말
- "안녕하세요, {직급}님. 디옵트 {이름} {직급}입니다." (공식적)
- "안녕하세요, {직급}님.\n디옵트 {이름} {직급}입니다." (줄바꿈 버전)
- 촬영팀: "안녕하세요,\n디옵트 촬영팀 {이름} ST입니다."
- 클라이언트 담당자 호칭: 실장님, 부장님, 과장님, 대리님, 매니저님, 담당자님

### 본문 구조
1. 인사말
2. 전달 목적 한 문장 ("금일 {제품} {유형} 송부드립니다.")
3. 상세 안내사항 (번호 매기기 또는 불릿 포인트)
4. 피드백/검토 요청 문장
5. 마무리 인사

### 자주 쓰는 표현
- "금일 {내용} 송부드립니다."
- "첨부파일을 통해 확인 부탁드립니다."
- "유첨드린 파일은 현재까지 전달주신 내용을 바탕으로 정리한 초안입니다."
- "검토 부탁드리며, 보완 또는 조정이 필요한 사항은 가급적 한 번에 문서화하여 전달주시면 후속 작업에 반영하여 디벨롭해나가겠습니다."
- "참고하시어 피드백 전달 부탁드립니다."
- "검토 후 궁금하신 사항이나 추가로 논의가 필요한 부분 있으시면 편하게 말씀 부탁드립니다."
- "천천히 검토해보신 후 추가문의사항은 편하게 회신 부탁드립니다."
- "일정 내 피드백 회신이 지연될 경우, 전체 일정은 부득이하게 조정될 수 있는 점 사전에 안내드립니다."

### 마무리
- "감사합니다.\n\n{이름} 드림."
- 촬영 콘티의 경우: 소품 비용 안내, 촬영 일정 포함

### 전달 유형별 특이사항
- 기획 초안: 수정 요청 시 문서화해달라고 안내, 자료 보완 필요 시 전달 일정 요청
- 촬영 콘티: 연출 방향 설명, 소품리스트 및 비용, 촬영 일정 명시
- 디자인: 워터마크 버전 공유, 구글드라이브 링크 활용
- 견적서: 충전금/비용 현황, 문의 편하게 해달라는 문구
- 보고서: 성과/인사이트 중심 정리, 세부 내용은 첨부파일 참조
- 일정 공유: R&R 표, 작업 스케줄 표 형태

### 주의사항
- 서명(D-opt. | 디옵트...)은 본문에 포함하지 않음 (시스템에서 자동 추가)
- [CAUTION] 푸터도 본문에 포함하지 않음 (시스템에서 자동 추가)
- 과도한 이모지 사용 금지
- "드립니다", "부탁드립니다" 등 겸양어 사용

응답 형식 (반드시 JSON만 반환):
{
  "subject": "이메일 제목",
  "body": "이메일 본문 (HTML 태그 없이 plain text, 줄바꿈은 \\n)"
}`;

  const userMessage = `다음 정보로 클라이언트 전달 이메일을 작성해주세요:

프로젝트: ${project.title}
제품명: ${project.product_name || ''}
클라이언트: ${project.client_name || ''}
담당자: ${project.client_contact || '담당자'}
기획자: ${plannerName}
전달 유형: ${deliveryType}

${briefContent ? `전달할 내용 요약:\n${briefContent.substring(0, 2000)}` : ''}

${emailSamples ? `\n\n## 참고: 디옵트 실제 이메일 샘플 (톤, 형식, 표현 참고)\n${emailSamples}` : ''}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content.filter(b => b.type === 'text').map(b => (b as any).text).join('');
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });

  const result = JSON.parse(jsonMatch[0]);
  return NextResponse.json({
    subject: result.subject,
    body: result.body,
    to: project.client_email || '',
    clientContact: project.client_contact || '',
    plannerName,
  });
}
