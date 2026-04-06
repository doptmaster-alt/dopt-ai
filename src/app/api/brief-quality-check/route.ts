import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

function loadApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (match) {
      const key = match[1].trim();
      process.env.ANTHROPIC_API_KEY = key;
      return key;
    }
  } catch {}
  throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { briefMarkdown, projectId } = await req.json();
  if (!briefMarkdown || briefMarkdown.trim().length < 50) {
    return NextResponse.json({ error: '브리프 내용이 너무 짧습니다.' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: loadApiKey() });

  const systemPrompt = `당신은 광고 기획 전문가이자 브리프 품질 검수 담당자입니다.
디옵트(DIOPT) 광고기획사에서 클라이언트에게 전달하기 전 브리프의 품질을 평가합니다.

다음 기준으로 브리프를 평가하세요:

## 평가 항목 (각 20점, 총 100점)
1. **완성도** (20점): 필수 항목(제품명, USP, 타겟, 기획방향/목차)이 모두 채워져 있는가? 빈 항목이 없는가?
2. **구체성** (20점): 내용이 충분히 구체적인가? 모호한 표현 없이 실행 가능한 수준인가?
3. **논리성** (20점): USP → 타겟 → 기획방향의 흐름이 논리적인가? 일관성이 있는가?
4. **광고심의 준수** (20점): 과장/허위 표현, 의약품 표현, 비교광고 규제 등을 준수하는가?
5. **표현/가독성** (20점): 오타, 맞춤법 오류, 어색한 표현이 없는가? 전문적인 톤인가?

## 응답 형식 (반드시 이 JSON 형식으로만 응답)
{
  "totalScore": 85,
  "grades": {
    "completeness": { "score": 18, "max": 20, "comment": "제품명, USP 테이블 잘 작성됨. 촬영 레퍼런스 미작성." },
    "specificity": { "score": 16, "max": 20, "comment": "USP 상세 항목이 구체적이지만, 타겟 설명이 다소 모호함." },
    "logic": { "score": 19, "max": 20, "comment": "USP에서 타겟, 기획방향까지 논리적 흐름이 좋음." },
    "adCompliance": { "score": 17, "max": 20, "comment": "'최고' 표현이 비교광고 규제에 걸릴 수 있음." },
    "readability": { "score": 15, "max": 20, "comment": "2건의 오타 발견, 일부 문장이 길어 가독성 저하." }
  },
  "typos": [
    { "original": "오타가 있는 원문", "corrected": "수정된 텍스트", "location": "USP 테이블 3번째 행" }
  ],
  "improvements": [
    { "section": "타겟", "priority": "높음", "suggestion": "메인 타겟의 연령대와 구체적 페인포인트를 추가하세요." },
    { "section": "USP", "priority": "중간", "suggestion": "'업계 최고' 표현을 '업계 선도적' 수준으로 변경 권장" }
  ],
  "strengths": [
    "USP 테이블이 상세하고 경쟁사 비교가 명확함",
    "기획방향/목차 구성이 논리적이고 실행 가능한 수준"
  ],
  "summary": "전체적으로 완성도 높은 브리프이나, 타겟 구체성과 광고심의 표현 일부 수정이 필요합니다. 오타 2건 수정 후 클라이언트 전달 가능합니다."
}

JSON만 응답하세요. 다른 텍스트는 포함하지 마세요.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `다음 브리프의 품질을 검수해주세요:\n\n${briefMarkdown}`,
        },
      ],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('');

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);

    // QC 결과를 학습 데이터로 자동 저장
    try {
      const { addLearning } = await import('@/lib/db');

      // 높은 점수의 브리프는 성공 패턴으로 저장
      if (result.totalScore >= 80) {
        addLearning({
          projectId: projectId || undefined,
          category: 'successful_output',
          subcategory: 'brief',
          content: briefMarkdown.substring(0, 3000),
          context: `QC Score: ${result.totalScore}/100. ${result.summary}`,
          qualityScore: result.totalScore,
        });
      }

      // 개선사항은 correction으로 저장 (다음에 같은 실수 방지)
      if (result.improvements && result.improvements.length > 0) {
        addLearning({
          projectId: projectId || undefined,
          category: 'correction',
          subcategory: 'brief_qc',
          content: JSON.stringify(result.improvements),
          context: `Score: ${result.totalScore}. Typos: ${result.typos?.length || 0}`,
          qualityScore: result.totalScore,
        });
      }
    } catch (e) {
      console.error('[QC Learning] Save failed:', e);
    }

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[QualityCheck] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
