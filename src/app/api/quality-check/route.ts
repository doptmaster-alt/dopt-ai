import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStepData, getProject, getProjectSettings } from '@/lib/db';
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
  throw new Error('ANTHROPIC_API_KEY not set');
}

type QCType = 'plan' | 'conti' | 'design-guide';

/**
 * POST /api/quality-check
 * 기획안 / 촬영콘티 / 디자인가이드 종합 QC
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { type, projectId }: { type: QCType; projectId: number } = await req.json();

  if (!type || !projectId) {
    return NextResponse.json({ error: 'type과 projectId가 필요합니다.' }, { status: 400 });
  }

  // ═══ 프로젝트 컨텍스트 로드 ═══
  const project = getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
  }

  const settings = getProjectSettings(projectId);
  const contractInfo = settings ? {
    sectionCount: settings.section_count || 0,
    shootingCutCount: settings.shooting_cut_count || 0,
    budget: settings.budget || '',
    useModels: settings.use_models === 1,
  } : null;

  // 브리프 로드 (모든 QC에서 기준으로 활용)
  let briefData: any = null;
  for (const step of [2, 3]) {
    const sd = getStepData(projectId, step);
    if (sd?.form_data) {
      const parsed = JSON.parse(sd.form_data);
      if (parsed.productName || parsed.usp || parsed.target) {
        briefData = parsed;
        break;
      }
    }
  }

  // 기획안 로드 (V2: step 3, fallback to old 4/5)
  let planData: any = null;
  for (const step of [3, 4, 5]) {
    const sd = getStepData(projectId, step);
    if (sd?.form_data) {
      const parsed = JSON.parse(sd.form_data);
      if (parsed.sections?.length) {
        const hasBlocks = parsed.sections.some((s: any) => s.copyBlocks?.length > 0);
        if (!planData || hasBlocks) { planData = parsed; if (hasBlocks) break; }
      }
    }
  }

  // 촬영콘티 로드 (V2: step 4, fallback to old 6/8)
  let contiData: any = null;
  for (const step of [4, 6, 8]) {
    const sd = getStepData(projectId, step);
    if (sd?.form_data) {
      const parsed = JSON.parse(sd.form_data);
      if (parsed.cutPages?.length) { contiData = parsed; break; }
    }
  }

  // 디자인 가이드 메타 로드 (V2: step 6, fallback to old 8/10)
  let designMeta: any = null;
  for (const step of [6, 8, 10]) {
    const sd = getStepData(projectId, step);
    if (sd?.form_data) {
      const parsed = JSON.parse(sd.form_data);
      if (parsed.toneAndManner || parsed.typography) { designMeta = parsed; break; }
    }
  }

  // 채팅 이력에서 클라이언트 피드백 추출
  let clientFeedback = '';
  try {
    const { getMessages } = await import('@/lib/db');
    const messages = getMessages(projectId);
    const feedbackMsgs = messages
      .filter((m: any) => m.role === 'user')
      .map((m: any) => m.content)
      .filter((c: string) => c.includes('수정') || c.includes('변경') || c.includes('피드백') || c.includes('다시') || c.includes('바꿔'));
    if (feedbackMsgs.length > 0) {
      clientFeedback = feedbackMsgs.slice(-5).join('\n');
    }
  } catch {}

  // ═══ QC 타입별 시스템 프롬프트 ═══
  const systemPrompt = buildSystemPrompt(type, project, contractInfo, briefData, clientFeedback);
  const userContent = buildUserContent(type, planData, contiData, designMeta, briefData);

  if (!userContent) {
    return NextResponse.json({ error: `${getTypeLabel(type)} 데이터가 없습니다.` }, { status: 404 });
  }

  const client = new Anthropic({ apiKey: loadApiKey() });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);

    // 학습 저장
    try {
      const { addLearning } = await import('@/lib/db');
      if (result.totalScore >= 80) {
        addLearning({
          projectId,
          category: 'successful_output',
          subcategory: type,
          content: userContent.substring(0, 3000),
          context: `QC Score: ${result.totalScore}/100. ${result.summary}`,
          qualityScore: result.totalScore,
        });
      }
      if (result.improvements?.length > 0) {
        addLearning({
          projectId,
          category: 'correction',
          subcategory: `${type}_qc`,
          content: JSON.stringify(result.improvements),
          context: `Score: ${result.totalScore}`,
          qualityScore: result.totalScore,
        });
      }
    } catch {}

    return NextResponse.json(result);
  } catch (e: any) {
    console.error(`[QC-${type}] Error:`, e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function getTypeLabel(type: QCType): string {
  return { plan: '기획안', conti: '촬영콘티', 'design-guide': '디자인 가이드' }[type];
}

function buildSystemPrompt(type: QCType, project: any, contract: any, brief: any, feedback: string): string {
  const projectContext = `
## 프로젝트 정보
- 프로젝트: ${project.title || ''}
- 클라이언트: ${project.client_name || ''}
- 제품: ${project.product_name || ''}
- 업종: ${project.industry || ''}
${contract ? `
## 계약 조건
- 섹션 수량: ${contract.sectionCount || '미정'}개
- 촬영 컷수: ${contract.shootingCutCount || '미정'}컷
- 예산: ${contract.budget || '미정'}
- 모델 사용: ${contract.useModels ? '예' : '아니오'}` : ''}
${brief ? `
## 브리프 핵심 (기획 기준)
- 제품명: ${brief.productName || ''}
- USP: ${brief.usp || ''}
- 타겟: ${brief.target || ''}
- 기획방향: ${brief.planDirection || brief.planningDirection || ''}` : ''}
${feedback ? `
## 클라이언트/기획자 피드백 이력 (최근)
${feedback}` : ''}`;

  if (type === 'plan') {
    return `당신은 상세페이지 기획 전문가이자 QC 담당자입니다.
디옵트(DIOPT) 광고기획사에서 기획안의 품질을 객관적이고 면밀하게 평가합니다.

${projectContext}

## 평가 항목 (각 항목 점수 + 총 100점)

### 1. 전략적 논리성 (20점)
- 브리프의 USP/타겟이 기획안 섹션 구조에 반영되었는가?
- 섹션 순서가 설득 구조(훅→공감→신뢰→전환)를 따르는가?
- 각 섹션의 기획의도가 명확하고 마케팅적으로 타당한가?
- 전체적인 스토리텔링 흐름이 자연스러운가?

### 2. 카피라이팅 (20점)
- 메인 카피가 시선을 끌고 USP를 명확히 전달하는가?
- 서브 카피가 메인을 보충하며 구체적 설명을 제공하는가?
- 카피 톤앤매너가 타겟과 브랜드에 일관적인가?
- 광고심의 규정(과장, 허위, 의료표현, 비교광고)을 준수하는가?
- CTA가 명확하고 행동을 유도하는가?

### 3. 디자인 구조 (20점)
- 와이어프레임 블록 구조가 시각적으로 효과적인가?
- 이미지/텍스트 배치 비율이 적절한가?
- 모바일 최적화가 고려되었는가?
- 각 섹션의 비주얼 방향이 구체적이고 실행 가능한가?

### 4. 클라이언트 니즈 충족 (20점)
- 계약 조건(섹션 수, 모델 사용 등)이 반영되었는가?
- 브리프에서 요구한 내용이 모두 포함되었는가?
- 클라이언트 피드백이 적절히 반영되었는가?
- 업종 특성에 맞는 구성인가?

### 5. 완성도 & 실행성 (20점)
- 모든 섹션에 카피블록/와이어프레임 블록이 있는가?
- 디자이너/촬영팀이 바로 실행 가능한 수준인가?
- 레퍼런스/비주얼 방향이 구체적인가?
- 오탈자, 문법 오류가 없는가?

## 응답 형식 (반드시 이 JSON으로만 응답)
{
  "totalScore": 85,
  "grades": {
    "strategy": { "score": 17, "max": 20, "comment": "상세 평가" },
    "copywriting": { "score": 16, "max": 20, "comment": "상세 평가" },
    "designStructure": { "score": 18, "max": 20, "comment": "상세 평가" },
    "clientNeeds": { "score": 17, "max": 20, "comment": "상세 평가" },
    "completeness": { "score": 17, "max": 20, "comment": "상세 평가" }
  },
  "sectionFeedback": [
    { "sectionNum": 1, "sectionName": "섹션명", "score": "A|B|C|D", "issues": ["이슈1"], "suggestions": ["제안1"] }
  ],
  "typos": [
    { "original": "원문", "corrected": "수정", "location": "위치" }
  ],
  "improvements": [
    { "section": "영역", "priority": "높음|중간|낮음", "suggestion": "구체적 개선 제안" }
  ],
  "strengths": ["강점1", "강점2"],
  "summary": "종합 평가 (3-5문장)"
}

JSON만 응답하세요.`;
  }

  if (type === 'conti') {
    return `당신은 광고 촬영 전문가이자 촬영콘티 QC 담당자입니다.
디옵트(DIOPT) 광고기획사에서 촬영콘티의 품질을 객관적이고 면밀하게 평가합니다.

${projectContext}

## 평가 항목 (각 항목 점수 + 총 100점)

### 1. 기획안 연계성 (20점)
- 기획안의 섹션/비주얼 방향이 촬영컷에 정확히 반영되었는가?
- 각 촬영컷이 기획안의 어느 섹션에 매핑되는지 명확한가?
- 기획안의 카피/메시지에 맞는 촬영 구도인가?
- 빠진 섹션이 없는가?

### 2. 촬영 실행력 (20점)
- 구도(composition)가 구체적이고 촬영팀이 바로 실행 가능한가?
- 소품(props) 리스트가 완전하고 구체적인가?
- 조명(lighting) 지시가 명확한가?
- 배경 설명이 실현 가능하고 비용 효율적인가?

### 3. 컨셉 일관성 (20점)
- 전체 컨셉이 통일되어 있는가?
- 컬러 팔레트, 무드, 톤앤매너가 브랜드에 맞는가?
- 촬영 스타일(플랫레이, 라이프스타일 등)이 타겟에 적합한가?
- 시각적 스토리텔링이 연결되는가?

### 4. 계약 조건 충족 (20점)
- 촬영 컷수가 계약 조건에 맞는가?
- 모델 사용 여부가 계약에 맞게 반영되었는가?
- 누끼/GIF/AI 컷 구분이 명확한가?
- 컷 리스트가 체계적으로 정리되었는가?

### 5. 품질 & 디테일 (20점)
- 이미지 프롬프트(AI 촬영용)가 충분히 상세한가?
- 레퍼런스 노트가 구체적인가?
- 각 컷의 목적이 명확한가?
- 오탈자, 누락 정보가 없는가?

## 응답 형식 (반드시 이 JSON으로만 응답)
{
  "totalScore": 82,
  "grades": {
    "planAlignment": { "score": 16, "max": 20, "comment": "상세 평가" },
    "executability": { "score": 17, "max": 20, "comment": "상세 평가" },
    "conceptConsistency": { "score": 15, "max": 20, "comment": "상세 평가" },
    "contractCompliance": { "score": 18, "max": 20, "comment": "상세 평가" },
    "qualityDetail": { "score": 16, "max": 20, "comment": "상세 평가" }
  },
  "cutFeedback": [
    { "cutNum": 1, "score": "A|B|C|D", "issues": ["이슈"], "suggestions": ["제안"] }
  ],
  "typos": [{ "original": "원문", "corrected": "수정", "location": "위치" }],
  "improvements": [{ "section": "영역", "priority": "높음|중간|낮음", "suggestion": "제안" }],
  "strengths": ["강점"],
  "summary": "종합 평가"
}

JSON만 응답하세요.`;
  }

  // design-guide
  return `당신은 상세페이지 디자인 전문가이자 디자인 가이드 QC 담당자입니다.
디옵트(DIOPT) 광고기획사에서 종합 디자인 가이드의 품질을 객관적이고 면밀하게 평가합니다.

${projectContext}

## 평가 항목 (각 항목 점수 + 총 100점)

### 1. 기획-디자인 정합성 (20점)
- 기획안의 모든 섹션이 디자인 가이드에 반영되었는가?
- 카피 구조와 와이어프레임이 디자인에 적합하게 설계되었는가?
- 각 섹션의 비주얼 방향과 실제 디자인 구조가 일치하는가?

### 2. 촬영콘티 연계 (20점)
- 촬영 컷이 디자인 섹션에 정확히 매핑되었는가?
- 촬영 이미지의 활용 방안이 디자인에 명확히 제시되었는가?
- 이미지 크기, 배치, 크롭 가이드가 있는가?

### 3. 디자인 시스템 완성도 (20점)
- 컬러 팔레트가 정의되고 브랜드에 맞는가?
- 타이포그래피(폰트, 크기, 계층) 가이드가 있는가?
- 레이아웃 그리드/여백 시스템이 정의되었는가?
- 톤앤매너가 일관적이고 타겟에 적합한가?

### 4. 실행 가능성 (20점)
- 디자이너가 바로 작업 가능한 수준의 가이드인가?
- 모호한 부분 없이 모든 지시가 구체적인가?
- 각 섹션별 레이아웃/블록 구조가 명확한가?
- SVG/Figma로 내보내기에 적합한 구조인가?

### 5. 마케팅 효과 (20점)
- 전체 디자인이 전환율 극대화에 기여하는가?
- CTA 배치와 디자인이 효과적인가?
- 스크롤 흐름(설득 구조)이 디자인에 잘 반영되었는가?
- 모바일 최적화가 고려되었는가?

## 응답 형식 (반드시 이 JSON으로만 응답)
{
  "totalScore": 78,
  "grades": {
    "planDesignFit": { "score": 16, "max": 20, "comment": "상세 평가" },
    "contiAlignment": { "score": 14, "max": 20, "comment": "상세 평가" },
    "designSystem": { "score": 15, "max": 20, "comment": "상세 평가" },
    "executability": { "score": 17, "max": 20, "comment": "상세 평가" },
    "marketingEffect": { "score": 16, "max": 20, "comment": "상세 평가" }
  },
  "sectionFeedback": [
    { "sectionNum": 1, "sectionName": "섹션명", "score": "A|B|C|D", "issues": ["이슈"], "suggestions": ["제안"] }
  ],
  "typos": [{ "original": "원문", "corrected": "수정", "location": "위치" }],
  "improvements": [{ "section": "영역", "priority": "높음|중간|낮음", "suggestion": "제안" }],
  "strengths": ["강점"],
  "summary": "종합 평가"
}

JSON만 응답하세요.`;
}

function buildUserContent(type: QCType, plan: any, conti: any, design: any, brief: any): string | null {
  if (type === 'plan') {
    if (!plan?.sections?.length) return null;
    let md = `# 기획안 QC 요청\n\n`;
    md += `## 기본 정보\n- 브랜드: ${plan.brandName || plan.productName || ''}\n- 디자인 톤: ${plan.designTone || ''}\n- 컬러: ${plan.colorScheme || ''}\n`;
    if (plan.overallNote) md += `- 전체 노트: ${plan.overallNote}\n`;
    md += `\n## 섹션 (${plan.sections.length}개)\n\n`;

    for (const sec of plan.sections) {
      md += `### 섹션 ${sec.num}. ${sec.name}\n`;
      if (sec.planningIntent) md += `- 기획의도: ${sec.planningIntent}\n`;
      if (sec.visualDirection) md += `- 비주얼 방향: ${sec.visualDirection}\n`;
      if (sec.layout) md += `- 레이아웃: ${sec.layout}\n`;
      if (sec.mainCopy) md += `- 메인카피: ${sec.mainCopy}\n`;
      if (sec.subCopy) md += `- 서브카피: ${sec.subCopy}\n`;

      if (sec.copyBlocks?.length) {
        md += `\n**카피블록 (${sec.copyBlocks.length}개):**\n`;
        for (const cb of sec.copyBlocks) {
          md += `  - [${cb.type}] ${cb.text || cb.label || ''}${cb.desc ? ` (${cb.desc})` : ''}\n`;
        }
      }
      if (sec.wireframeBlocks?.length) {
        md += `**와이어프레임 (${sec.wireframeBlocks.length}개):**\n`;
        for (const wb of sec.wireframeBlocks) {
          md += `  - [${wb.type}] ${wb.text || wb.label || ''}${wb.desc ? ` (${wb.desc})` : ''}\n`;
        }
      }
      md += '\n';
    }
    return md;
  }

  if (type === 'conti') {
    if (!conti?.cutPages?.length) return null;
    let md = `# 촬영콘티 QC 요청\n\n`;
    if (conti.projectTitle) md += `## 프로젝트: ${conti.projectTitle}\n`;
    if (conti.conceptSummary) {
      md += `## 컨셉 요약\n- 컨셉: ${conti.conceptSummary.concept || ''}\n`;
      if (conti.conceptSummary.keywords?.length) md += `- 키워드: ${conti.conceptSummary.keywords.join(', ')}\n`;
      if (conti.conceptSummary.mood) md += `- 무드: ${conti.conceptSummary.mood}\n`;
    }
    if (conti.cutList) {
      md += `## 컷 리스트: 총 ${conti.cutList.total || conti.cutPages.length}컷 (스타일: ${conti.cutList.styled || 0}, GIF: ${conti.cutList.gif || 0}, 누끼: ${conti.cutList.nukki || 0}, AI: ${conti.cutList.ai || 0})\n`;
    }

    md += `\n## 촬영컷 (${conti.cutPages.length}개)\n\n`;
    for (const cut of conti.cutPages) {
      md += `### CUT ${cut.cutNum}${cut.type ? ` (${cut.type})` : ''}\n`;
      if (cut.sectionMapping) md += `- 섹션 매핑: ${cut.sectionMapping}\n`;
      if (cut.composition) md += `- 구도: ${cut.composition}\n`;
      if (cut.background?.description) md += `- 배경: ${cut.background.description}${cut.background.color ? ` (${cut.background.color})` : ''}\n`;
      if (cut.props?.length) md += `- 소품: ${cut.props.join(', ')}\n`;
      if (cut.moodLighting) md += `- 조명/무드: ${cut.moodLighting}\n`;
      if (cut.referenceNote) md += `- 레퍼런스: ${cut.referenceNote}\n`;
      if (cut.note) md += `- 비고: ${cut.note}\n`;
      md += '\n';
    }

    // 기획안 섹션 정보도 첨부 (연계성 평가용)
    if (plan?.sections?.length) {
      md += `\n## 참고: 기획안 섹션 구조\n`;
      for (const sec of plan.sections) {
        md += `- 섹션 ${sec.num}. ${sec.name}${sec.visualDirection ? ` — ${sec.visualDirection}` : ''}\n`;
      }
    }
    return md;
  }

  // design-guide
  if (!plan?.sections?.length) return null;
  let md = `# 디자인 가이드 QC 요청\n\n`;
  md += `## 기본 정보\n- 브랜드: ${plan.brandName || plan.productName || ''}\n- 디자인 톤: ${plan.designTone || ''}\n- 컬러: ${plan.colorScheme || ''}\n\n`;

  if (design?.toneAndManner) {
    md += `## 톤앤매너\n- 메인 컬러: ${design.toneAndManner.mainColor || ''}\n- 서브 컬러: ${JSON.stringify(design.toneAndManner.subColors || [])}\n- 무드: ${design.toneAndManner.mood || ''}\n`;
  }
  if (design?.typography) {
    md += `## 타이포그래피\n- 주 폰트: ${design.typography.primaryFont || ''}\n- 보조 폰트: ${design.typography.secondaryFont || ''}\n`;
  }
  if (design?.layoutGuide) {
    md += `## 레이아웃\n- 최대폭: ${design.layoutGuide.maxWidth || ''}\n- 그리드: ${design.layoutGuide.gridSystem || ''}\n`;
  }

  md += `\n## 기획안 섹션 (${plan.sections.length}개)\n\n`;
  for (const sec of plan.sections) {
    md += `### 섹션 ${sec.num}. ${sec.name}\n`;
    if (sec.copyBlocks?.length) md += `  카피블록: ${sec.copyBlocks.length}개\n`;
    if (sec.wireframeBlocks?.length) md += `  와이어프레임: ${sec.wireframeBlocks.length}개\n`;
    if (sec.visualDirection) md += `  비주얼: ${sec.visualDirection}\n`;
  }

  if (conti?.cutPages?.length) {
    md += `\n## 촬영콘티 (${conti.cutPages.length}컷)\n`;
    for (const cut of conti.cutPages) {
      md += `- CUT ${cut.cutNum}: ${cut.composition || ''}${cut.sectionMapping ? ` → ${cut.sectionMapping}` : ''}\n`;
    }
  }

  return md;
}
