import Anthropic from '@anthropic-ai/sdk';
import { getSystemPrompt } from './system-prompt';
import { webSearch, fetchWebPage } from './web-search';
import { notionSearch, notionReadPage, notionQueryDatabase, notionCreatePage, notionAppendContent } from './notion';
import { figmaGetFile, figmaGetNode, figmaExportImage, figmaAddComment, figmaGetComments, figmaListTeamProjects, figmaListProjectFiles } from './figma';
import { addCommands, waitForResults, isPluginConnected } from './figma-queue';
import { takeScreenshot } from './screenshot';
import { searchKnowledge, addKnowledge } from './knowledge-base';
import { getStepData } from './db';
import fs from 'fs';
import path from 'path';

// 하이브리드 모델: 브리프/기획안 핵심 단계에서만 Opus 사용
const SONNET_MODEL = 'claude-sonnet-4-20250514';
const OPUS_MODEL = 'claude-opus-4-6';

function getModel(currentStep: number, isCriticalCreation: boolean): string {
  const useOpus = process.env.USE_OPUS_FOR_CRITICAL === 'true';
  if (useOpus && isCriticalCreation) {
    console.log(`[Claude] Using OPUS for critical step ${currentStep}`);
    return OPUS_MODEL;
  }
  return SONNET_MODEL;
}

function loadApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }
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

function getClient() {
  return new Anthropic({ apiKey: loadApiKey() });
}

// 잘못된 Unicode surrogate 문자 제거 (Claude API JSON 파싱 에러 방지)
function sanitizeUnicode(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
}

function sanitizeMessages(messages: any[]): any[] {
  return messages.map(m => {
    if (typeof m.content === 'string') {
      return { ...m, content: sanitizeUnicode(m.content) };
    }
    if (Array.isArray(m.content)) {
      return {
        ...m,
        content: m.content.map((block: any) => {
          if (block.type === 'text' && typeof block.text === 'string') {
            return { ...block, text: sanitizeUnicode(block.text) };
          }
          return block;
        }),
      };
    }
    return m;
  });
}

export interface FileAttachment {
  type: 'text' | 'image';
  textContent?: string;
  fileName?: string;
  base64Image?: string;
  mimeType?: string;
  fileUrl?: string;  // 이미지 파일의 서버 URL (Figma create_image에 사용)
}

// AI에게 제공하는 도구 정의
const tools: Anthropic.Tool[] = [
  {
    name: 'web_search',
    description: '웹에서 정보를 검색합니다. 시장조사, 경쟁사 분석, 트렌드 파악, 제품 정보 수집 등에 사용합니다. 한국어/영어 모두 검색 가능합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: '검색할 키워드나 질문 (예: "다이슨 에어랩 시장 점유율 2024")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'fetch_webpage',
    description: '특정 웹페이지의 내용을 가져옵니다. 검색 결과에서 찾은 URL의 상세 내용을 확인할 때 사용합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: '가져올 웹페이지 URL',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'notion_search',
    description: '노션 워크스페이스에서 페이지나 데이터베이스를 검색합니다. 기존 자료를 찾거나 참고할 때 사용합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: '검색할 키워드 (예: "브리프", "기획안", "다이슨")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'notion_read_page',
    description: '노션 페이지의 전체 내용을 읽어옵니다. 페이지 ID가 필요합니다 (notion_search로 먼저 찾으세요).',
    input_schema: {
      type: 'object' as const,
      properties: {
        page_id: {
          type: 'string',
          description: '읽을 노션 페이지 ID',
        },
      },
      required: ['page_id'],
    },
  },
  {
    name: 'notion_query_database',
    description: '노션 데이터베이스의 모든 항목을 조회합니다. 데이터베이스 ID가 필요합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        database_id: {
          type: 'string',
          description: '조회할 노션 데이터베이스 ID',
        },
      },
      required: ['database_id'],
    },
  },
  {
    name: 'notion_create_page',
    description: '노션에 새 페이지를 생성합니다. 브리프, 기획안, 시장조사 결과 등을 노션에 저장할 때 사용합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        parent_id: {
          type: 'string',
          description: '부모 페이지 또는 데이터베이스 ID (어디에 생성할지)',
        },
        title: {
          type: 'string',
          description: '페이지 제목',
        },
        content: {
          type: 'string',
          description: '페이지 내용 (마크다운 형식: #제목, ##소제목, - 목록, > 인용 등)',
        },
      },
      required: ['parent_id', 'title', 'content'],
    },
  },
  {
    name: 'notion_append_content',
    description: '기존 노션 페이지에 내용을 추가합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        page_id: {
          type: 'string',
          description: '내용을 추가할 노션 페이지 ID',
        },
        content: {
          type: 'string',
          description: '추가할 내용 (마크다운 형식)',
        },
      },
      required: ['page_id', 'content'],
    },
  },
  // === Figma 도구 ===
  {
    name: 'figma_get_file',
    description: 'Figma 파일의 전체 구조(페이지, 프레임 목록)를 가져옵니다. file_key는 Figma URL에서 추출합니다 (figma.com/design/{FILE_KEY}/...).',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_key: {
          type: 'string',
          description: 'Figma 파일 키 (URL에서 추출)',
        },
      },
      required: ['file_key'],
    },
  },
  {
    name: 'figma_get_node',
    description: 'Figma 파일의 특정 노드(프레임, 컴포넌트 등)의 상세 정보를 가져옵니다. 텍스트, 크기, 하위 요소 등을 확인할 수 있습니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_key: {
          type: 'string',
          description: 'Figma 파일 키',
        },
        node_id: {
          type: 'string',
          description: '조회할 노드 ID (figma_get_file에서 확인 가능)',
        },
      },
      required: ['file_key', 'node_id'],
    },
  },
  {
    name: 'figma_export_image',
    description: 'Figma 파일의 특정 노드를 이미지(PNG/SVG/PDF)로 내보냅니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_key: {
          type: 'string',
          description: 'Figma 파일 키',
        },
        node_id: {
          type: 'string',
          description: '내보낼 노드 ID',
        },
        format: {
          type: 'string',
          description: '이미지 형식 (png, svg, pdf). 기본값: png',
        },
      },
      required: ['file_key', 'node_id'],
    },
  },
  {
    name: 'figma_add_comment',
    description: 'Figma 파일에 댓글을 추가합니다. 기획 피드백이나 디자인 가이드를 전달할 때 사용합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_key: {
          type: 'string',
          description: 'Figma 파일 키',
        },
        message: {
          type: 'string',
          description: '댓글 내용',
        },
      },
      required: ['file_key', 'message'],
    },
  },
  {
    name: 'figma_get_comments',
    description: 'Figma 파일의 모든 댓글을 조회합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_key: {
          type: 'string',
          description: 'Figma 파일 키',
        },
      },
      required: ['file_key'],
    },
  },
  {
    name: 'figma_list_team_projects',
    description: 'Figma 팀의 프로젝트 목록을 가져옵니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        team_id: {
          type: 'string',
          description: 'Figma 팀 ID (URL에서 확인: figma.com/files/team/{TEAM_ID}/...)',
        },
      },
      required: ['team_id'],
    },
  },
  {
    name: 'figma_list_project_files',
    description: 'Figma 프로젝트 내 파일 목록을 가져옵니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        project_id: {
          type: 'string',
          description: 'Figma 프로젝트 ID',
        },
      },
      required: ['project_id'],
    },
  },
  // === 스크린샷 도구 ===
  {
    name: 'take_screenshot',
    description: `웹페이지의 스크린샷을 촬영합니다. 디자인 레퍼런스 수집, 경쟁사 상세페이지 분석, 벤치마킹 등에 사용합니다.
스크린샷은 서버에 저장되며 URL이 반환됩니다. 이 URL을 figma_design의 create_image 명령으로 Figma에 배치할 수 있습니다.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: '스크린샷을 찍을 웹페이지 URL',
        },
        full_page: {
          type: 'boolean',
          description: '전체 페이지 스크린샷 여부 (기본: false, 뷰포트 영역만 캡처)',
        },
        width: {
          type: 'number',
          description: '뷰포트 너비 (기본: 1440)',
        },
        height: {
          type: 'number',
          description: '뷰포트 높이 (기본: 900)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'screenshot_to_figma',
    description: `웹페이지 스크린샷을 찍고 바로 Figma에 이미지로 배치합니다. 디자인 레퍼런스를 Figma 캔버스에 직접 넣을 때 사용합니다.
Figma 플러그인(DIOPT AI Designer)이 연결되어 있어야 합니다.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: '스크린샷을 찍을 웹페이지 URL',
        },
        name: {
          type: 'string',
          description: 'Figma에서 이미지 이름 (예: "경쟁사A 상세페이지")',
        },
        full_page: {
          type: 'boolean',
          description: '전체 페이지 스크린샷 여부 (기본: false)',
        },
        width: {
          type: 'number',
          description: '뷰포트 너비 (기본: 1440)',
        },
        height: {
          type: 'number',
          description: '뷰포트 높이 (기본: 900)',
        },
        figma_x: {
          type: 'number',
          description: 'Figma 캔버스에서 X 좌표 (기본: 0)',
        },
        figma_y: {
          type: 'number',
          description: 'Figma 캔버스에서 Y 좌표 (기본: 0)',
        },
      },
      required: ['url'],
    },
  },
  // === Knowledge Base 도구 ===
  {
    name: 'search_knowledge',
    description: '디옵트 Knowledge Base에서 관련 레퍼런스, 과거 작업물, 프로세스 자료를 검색합니다. 브리프, 기획안, 촬영콘티 등 과거 사례를 참고할 때 사용합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: '검색할 키워드 (예: "건기식 브리프", "뷰티 상세페이지 기획안")',
        },
        category: {
          type: 'string',
          description: '카테고리 필터 (brief/plan/conti/final/process/reference). 선택사항.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'save_to_knowledge',
    description: '중요한 분석 결과, 리서치 인사이트, 작업 산출물을 Knowledge Base에 저장합니다. 나중에 다른 프로젝트에서도 참고할 수 있도록 저장합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: '저장할 자료의 제목',
        },
        content: {
          type: 'string',
          description: '저장할 내용',
        },
        category: {
          type: 'string',
          description: '카테고리 (brief/plan/conti/final/process/reference)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '관련 태그 (예: ["건기식", "다이슨", "시장조사"])',
        },
      },
      required: ['title', 'content', 'category'],
    },
  },
  // === 고급 리서치 도구 ===
  {
    name: 'deep_research',
    description: `시장조사·경쟁사 분석을 위한 심층 리서치 도구입니다. 하나의 주제에 대해 여러 검색어로 동시에 검색하고 결과를 종합합니다.
기획자가 직접 하나하나 찾아야 할 시장조사, 경쟁사 분석, 키워드 조사를 한 번에 수행합니다.

사용 시점:
- STEP 0 시장조사 시작할 때
- 경쟁사 상세페이지 구조를 파악할 때
- 업계 트렌드와 키워드를 조사할 때`,
    input_schema: {
      type: 'object' as const,
      properties: {
        topic: {
          type: 'string',
          description: '리서치 주제 (예: "다이슨 에어랩 상세페이지")',
        },
        queries: {
          type: 'array',
          items: { type: 'string' },
          description: '동시에 검색할 쿼리 목록 (3~5개 권장). 예: ["다이슨 에어랩 상세페이지", "다이슨 에어랩 쿠팡 상세페이지 구조", "헤어스타일러 상세페이지 디자인 트렌드 2026", "다이슨 경쟁사 비교"]',
        },
        focus: {
          type: 'string',
          description: '리서치 포커스 (market_analysis | competitor_pages | design_trends | keywords | all). 기본: all',
        },
      },
      required: ['topic', 'queries'],
    },
  },
  {
    name: 'analyze_page_structure',
    description: `상세페이지 URL을 입력하면 페이지의 섹션 구조, 디자인 패턴, 카피 구조를 자동 분석합니다.
경쟁사 상세페이지의 레이아웃, 섹션 순서, 카피 톤, 비주얼 방향을 분석하여 기획에 활용합니다.

분석 항목:
- 전체 섹션 수와 각 섹션의 역할 (KV, USP, 인증, 리뷰, CTA 등)
- 섹션별 레이아웃 패턴 (풀블리드, 좌우분할, 카드형 등)
- 카피 톤 & 무드 (전문적/감성적/심플/임팩트)
- 컬러 스킴과 시각적 톤`,
    input_schema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: '분석할 상세페이지 URL',
        },
        competitor_name: {
          type: 'string',
          description: '경쟁사/브랜드 이름 (결과 라벨링용)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'collect_design_refs',
    description: `특정 업종/카테고리의 상세페이지 디자인 레퍼런스를 자동으로 수집합니다.
검색 → 관련 페이지 선별 → 스크린샷 촬영 → 구조 분석까지 한 번에 수행합니다.
기획자가 하나하나 찾아야 할 디자인 레퍼런스 수집을 자동화합니다.

수집 대상: 공식 브랜드몰, 자사몰 상세페이지, 디자인 아카이브 등`,
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: '제품 카테고리 (예: "건기식", "뷰티", "가전", "식품")',
        },
        product_type: {
          type: 'string',
          description: '구체적 제품 유형 (예: "헤어드라이기", "프로바이오틱스", "선크림")',
        },
        style_preference: {
          type: 'string',
          description: '원하는 디자인 스타일 (예: "고급스러운", "깔끔한", "감성적인", "임팩트있는")',
        },
        count: {
          type: 'number',
          description: '수집할 레퍼런스 수 (기본: 3, 최대: 5)',
        },
      },
      required: ['category', 'product_type'],
    },
  },
  // === 폼 데이터 자동 채우기 ===
  {
    name: 'update_step_form',
    description: `현재 단계의 폼 데이터를 자동으로 채웁니다.

각 STEP별 필드:
- STEP 1 (시장조사):
  ★★★ 반드시 아래 정확한 필드명과 형식을 사용하세요 ★★★
  competitors: 배열 [{ name: "경쟁사명", url: "사이트URL", strengths: "강점 분석", pageStructure: "상세페이지 구조 분석" }]
  trends: 문자열 (시장 트렌드 — "marketTrends" 아님! "trends"!)
  keywords: 문자열 (주요 키워드 쉼표 구분 — 배열 아님! 문자열!)
  targetInsight: 문자열 (타겟 인사이트 — "targetAnalysis" 아님! "targetInsight"!)
  adRegulations: 문자열 (광고 규제 사항)
  researchSummary: 문자열 (리서치 요약)
- STEP 2 (브리프): productName, productComposition, slogan, mainTarget, massTarget, designSpec, planningPurpose, totalSections, totalSectionsDetail, uspTable(배열), uspGroups(배열), tocSections(배열), clientPreference, designRef, photoRef, photoRefBySections(배열), colorSuggestions(배열), overallToneAndManner, aiModelPersona, useModels, contractSections, contractCuts, suggestedSections, suggestedCuts, upsellReason, aeCommentary
- STEP 3 (기획안): designTone, colorScheme, overallNote, useModels, sections(배열 — 아래 상세 참조)
- STEP 4 (콘티가이드): projectTitle, shootDate, location, team, totalCuts, useModels, conceptSummary, shootNotice, propList, cutPages(배열), nukkiGuide
  ★★★ STEP 4 콘티 배치 전송 ★★★
  컷이 15개 이상이면 반드시 여러 번 나눠서 호출하세요!
  - 1차: 기본정보 + cutPages[1~15]
  - 2차: { cutPages: [16~30], cutPagesBatch: true }  ← cutPagesBatch: true 필수!
  - 3차: { cutPages: [31~끝], cutPagesBatch: true }
  cutPagesBatch: true가 있으면 기존 cutPages에 추가됩니다. 없으면 덮어씁니다!
- STEP 6 (디자인가이드): toneAndManner, typography, layoutGuide, cutSectionMapping, additionalNotes

★★★ STEP 3 기획안 sections 배열 — 각 섹션 필수 구조 ★★★

각 섹션 객체에 반드시 아래 필드를 모두 포함하세요:
{
  num: 1,
  name: "섹션명",
  mainCopy: "메인 카피 텍스트",
  subCopy: "서브 카피 텍스트",
  visualDirection: "촬영/디자인 방향 2문장 이상",
  layout: "구체적 레이아웃 구조",
  aeCommentary: "전략적 코멘트",
  copyBlocks: [  // ★ 최소 7개 이상! 아래 순서대로 구성
    { type: "section-title", text: "섹션 N  섹션명" },
    { type: "label", text: "메인 카피 (Xpt Bold)" },
    { type: "copy-main", text: "실제 메인 카피" },
    { type: "copy-sub", text: "실제 서브 카피" },
    { type: "label", text: "구성 요소 설명" },
    // 아래에서 섹션 특성에 맞게 2~4개 추가:
    // list: { type: "list", items: ["항목1", "항목2", "항목3"] }
    // info-box: { type: "info-box", label: "라벨", text: "내용" }
    // kv-pair: { type: "kv-pair", label: "키", value: "값" }
    // text: { type: "text", text: "상세 텍스트" }
    // image-placeholder: { type: "image-placeholder", text: "이미지 설명", desc: "구체적 디렉션" }
    // note: { type: "note", text: "참고 사항" }
    // promo-box: { type: "promo-box", text: "프로모션 메시지" }
    { type: "ae-comment", text: "AE 전략 코멘트 — 이 섹션의 전략적 의도" }
  ],
  wireframeBlocks: [  // ★ 최소 4개 이상! 디자이너가 바로 작업 가능한 수준
    { type: "wf-heading", text: "메인 카피" },
    { type: "wf-text", text: "서브 카피" },
    // 아래에서 섹션 특성에 맞게 2~4개 추가 (실제 데이터 포함!):
    // wf-card-grid: { type: "wf-card-grid", cols: 3, items: [{ label: "항목명", desc: "설명" }] }
    // wf-table: { type: "wf-table", text: "테이블명", items: [{ label: "행", value: "값" }] }
    // wf-checklist: { type: "wf-checklist", items: [{ label: "체크항목" }] }
    // wf-stats: { type: "wf-stats", items: [{ label: "라벨", value: "수치" }] }
    // wf-split: { type: "wf-split", text: "좌측 텍스트", label: "[우측 이미지]", desc: "설명" }
    // wf-image: { type: "wf-image", text: "이미지 레이블", desc: "구체적 설명", height: 300 }
    // wf-icon-list: { type: "wf-icon-list", items: [{ label: "항목", desc: "설명" }] }
    // wf-bar-chart: { type: "wf-bar-chart", text: "차트 제목", items: [{ label: "항목", percent: 80 }] }
    // wf-badge-row: { type: "wf-badge-row", items: [{ label: "뱃지1" }, { label: "뱃지2" }] }
    // wf-accordion: { type: "wf-accordion", items: [{ label: "질문", desc: "답변" }] }
    // wf-comparison-row: { type: "wf-comparison-row", items: [{ label: "항목", value: "일반", desc: "당사" }] }
    // wf-product-grid: { type: "wf-product-grid", cols: 3, items: [{ label: "제품명", desc: "설명", value: "가격" }] }
    { type: "wf-badge-row", items: [{ label: "뱃지1" }, { label: "뱃지2" }] }
  ]
}

❌ 금지: copyBlocks에 3개 이하, wireframeBlocks에 2개 이하로 넣는 것
❌ 금지: wireframeBlocks를 wf-heading + wf-text + wf-image 3개로만 구성 (너무 단순)
❌ 금지: items가 필요한 블록(card-grid, table, checklist, stats 등)에 items 없이 text만 넣는 것
✅ 필수: 모든 섹션이 동일한 상세도를 가져야 함 — 뒤쪽 섹션도 앞쪽과 같은 수준으로!`,
    input_schema: {
      type: 'object' as const,
      properties: {
        form_data: {
          type: 'object',
          description: '폼에 채울 데이터. 해당 STEP의 필드에 맞게 JSON 오브젝트로 전달합니다.',
        },
        status: {
          type: 'string',
          description: '폼 상태. draft(작성중), review(검토중), confirmed(확정). 기본: draft',
        },
      },
      required: ['form_data'],
    },
  },
  // === Figma 기획안/브리프/콘티/디자인가이드 내보내기 ===
  {
    name: 'export_to_figma',
    description: `Figma에 기획안/브리프/시장조사/촬영콘티/디자인가이드를 내보냅니다.
기본 2컬럼(문구 | 디자인 구조), 레퍼런스 이미지가 있는 섹션이 있으면 자동으로 3컬럼(문구 | 디자인 구조 | 레퍼런스 디자인)으로 생성됩니다.

★★★ 중요: 기획자가 "피그마에 작성해줘", "피그마에 내보내줘", "Figma에 만들어줘" 등을 요청하면 반드시 이 도구를 사용하세요! ★★★
★★★ 레퍼런스 이미지도 반드시 이 도구로! 섹션 데이터에 referenceImageUrl 필드를 넣으면 자동 배치됩니다. figma_design으로 별도 배치하지 마세요! ★★★

사용 시 반드시 먼저 update_step_form으로 데이터를 저장한 후 이 도구를 호출하세요.

step 파라미터 (V2):
- 1: 시장조사 리포트
- 2: 브리프
- 4: 기획안 (와이어프레임 + 레퍼런스 자동 생성)
- 6: 촬영콘티 가이드
- 8: 디자인가이드

레퍼런스 이미지가 있는 경우 form_data.sections 내 해당 섹션에:
- referenceImageUrl: "http://localhost:3100/api/uploads/파일명" (첨부 시 안내된 URL)
- referenceNote: "레퍼런스에 대한 설명"
을 포함하면 3번째 컬럼에 자동 배치됩니다.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        step: {
          type: 'number',
          description: '내보낼 단계 번호 (1, 2, 4, 6, 8)',
        },
        form_data: {
          type: 'object',
          description: '내보낼 폼 데이터 (update_step_form에 전달한 것과 동일한 데이터)',
        },
        project_title: {
          type: 'string',
          description: '프로젝트/브랜드 이름',
        },
      },
      required: ['step', 'form_data'],
    },
  },
  // === Figma 직접 디자인 (간단한 요소만) ===
  {
    name: 'figma_design',
    description: `Figma에서 간단한 요소를 직접 생성합니다.

⚠️⚠️⚠️ 절대 금지: 기획안, 브리프, 콘티, 디자인가이드를 이 도구로 작성하지 마세요!
⚠️⚠️⚠️ 절대 금지: 레퍼런스 이미지도 이 도구로 배치하지 마세요! → 섹션 데이터에 referenceImageUrl을 넣고 export_to_figma를 사용하세요!

이 도구는 기획안/레퍼런스와 무관한 극히 간단한 메모나 텍스트 보조 작업에만 사용하세요.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        commands: {
          type: 'array',
          description: '실행할 Figma 명령 배열',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string' },
            },
            required: ['action'],
          },
        },
      },
      required: ['commands'],
    },
    // Prompt Caching: 마지막 도구에 cache_control → 전체 도구 정의가 캐시됨
    cache_control: { type: 'ephemeral' },
  } as any,
];

// 도구 실행
async function executeTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'web_search': {
      try {
        const results = await webSearch(input.query);
        if (results.length === 0) {
          return `[검색 실패] 키워드 "${input.query}"로 검색했지만 결과가 없습니다. 원인: 검색 엔진(DuckDuckGo)이 일시적으로 요청을 제한했거나, 검색어가 너무 구체적일 수 있습니다. 다른 키워드로 재시도하거나, 기획자에게 URL을 직접 요청하세요.`;
        }
        return results
          .map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`)
          .join('\n\n');
      } catch (e: any) {
        return `[검색 에러] 웹 검색 중 오류 발생. 원인: ${e.message}. 기획자에게 URL을 직접 요청하세요.`;
      }
    }
    case 'fetch_webpage': {
      try {
        return await fetchWebPage(input.url);
      } catch (e: any) {
        return `[웹페이지 로드 에러] URL: ${input.url}. 원인: ${e.message}. 해당 사이트가 접근을 차단했거나 URL이 잘못되었을 수 있습니다.`;
      }
    }
    case 'notion_search': {
      return await notionSearch(input.query);
    }
    case 'notion_read_page': {
      return await notionReadPage(input.page_id);
    }
    case 'notion_query_database': {
      return await notionQueryDatabase(input.database_id);
    }
    case 'notion_create_page': {
      return await notionCreatePage(input.parent_id, input.title, input.content);
    }
    case 'notion_append_content': {
      return await notionAppendContent(input.page_id, input.content);
    }
    case 'figma_get_file': {
      return await figmaGetFile(input.file_key);
    }
    case 'figma_get_node': {
      return await figmaGetNode(input.file_key, input.node_id);
    }
    case 'figma_export_image': {
      return await figmaExportImage(input.file_key, input.node_id, input.format || 'png');
    }
    case 'figma_add_comment': {
      return await figmaAddComment(input.file_key, input.message);
    }
    case 'figma_get_comments': {
      return await figmaGetComments(input.file_key);
    }
    case 'figma_list_team_projects': {
      return await figmaListTeamProjects(input.team_id);
    }
    case 'figma_list_project_files': {
      return await figmaListProjectFiles(input.project_id);
    }
    case 'search_knowledge': {
      try {
        const results = searchKnowledge(input.query, input.category || undefined);
        if (results.length === 0) {
          return `Knowledge Base에서 "${input.query}" 관련 자료를 찾지 못했습니다.`;
        }
        return results
          .slice(0, 5)
          .map((r, i) => `[${i + 1}] [${r.category}] ${r.title}\n    출처: ${r.source}${r.sourceUrl ? ` (${r.sourceUrl})` : ''}\n    태그: ${r.tags.join(', ') || '없음'}\n    내용:\n${r.content.slice(0, 1500)}${r.content.length > 1500 ? '\n...(생략)' : ''}`)
          .join('\n\n---\n\n');
      } catch (e: any) {
        return `[Knowledge Base 검색 에러] ${e.message}`;
      }
    }
    case 'save_to_knowledge': {
      try {
        const validCategories = ['brief', 'plan', 'conti', 'final', 'process', 'reference'];
        const category = validCategories.includes(input.category) ? input.category : 'reference';
        const entry = addKnowledge({
          category,
          title: input.title,
          content: input.content,
          source: 'upload' as const,
          sourceUrl: '',
          tags: input.tags || [],
        });
        return `Knowledge Base에 저장 완료!\nID: ${entry.id}\n제목: ${entry.title}\n카테고리: ${entry.category}`;
      } catch (e: any) {
        return `[Knowledge Base 저장 에러] ${e.message}`;
      }
    }
    case 'deep_research': {
      try {
        const queries: string[] = input.queries || [input.topic];
        const allResults: string[] = [];

        // 모든 쿼리를 병렬로 검색
        const searchPromises = queries.slice(0, 5).map(async (query: string, idx: number) => {
          try {
            const results = await webSearch(query);
            return { query, results, idx };
          } catch (e: any) {
            return { query, results: [], idx, error: e.message };
          }
        });

        const searchResults = await Promise.all(searchPromises);

        for (const { query, results, idx } of searchResults) {
          const header = `\n### 검색 ${idx + 1}: "${query}" (${results.length}개 결과)`;
          const items = results.slice(0, 5).map((r: any, i: number) =>
            `  [${i + 1}] ${r.title}\n      URL: ${r.url}\n      ${r.snippet}`
          ).join('\n');
          allResults.push(header + '\n' + (items || '  결과 없음'));
        }

        // 주요 페이지 2~3개 자동 fetch (공식 사이트 우선)
        const allUrls = searchResults.flatMap(s => s.results.map((r: any) => r.url));
        const priorityUrls = allUrls.filter((url: string) =>
          !url.includes('coupang.com') && !url.includes('naver.com/shop') &&
          !url.includes('11st.co.kr') && !url.includes('gmarket.co.kr') &&
          (url.includes('.co.kr') || url.includes('.com'))
        ).slice(0, 3);

        const fetchResults: string[] = [];
        for (const url of priorityUrls) {
          try {
            const content = await fetchWebPage(url);
            if (content.length > 100) {
              fetchResults.push(`\n### 상세 분석: ${url}\n${content.substring(0, 2000)}`);
            }
          } catch {}
        }

        const summary = `## 🔍 심층 리서치 완료: "${input.topic}"\n\n검색 ${queries.length}개 쿼리 실행, ${allUrls.length}개 결과 발견, ${fetchResults.length}개 페이지 상세 분석\n\n---\n${allResults.join('\n\n')}${fetchResults.length > 0 ? '\n\n---\n' + fetchResults.join('\n\n') : ''}`;

        return summary;
      } catch (e: any) {
        return `[심층 리서치 에러] ${e.message}`;
      }
    }
    case 'analyze_page_structure': {
      try {
        const content = await fetchWebPage(input.url);
        const name = input.competitor_name || '분석 대상';

        // 스크린샷도 함께 촬영
        let screenshotInfo = '';
        try {
          const ss = await takeScreenshot(input.url, { fullPage: true, width: 1440, height: 900 });
          const serverUrl = process.env.NEXTAUTH_URL || 'http://localhost:3100';
          screenshotInfo = `\n📸 전체 페이지 스크린샷: ${serverUrl}${ss.url} (${ss.width}x${ss.height})`;
        } catch {}

        // 페이지 텍스트에서 섹션 구조 추출 힌트
        const lines = content.split('\n').filter((l: string) => l.trim().length > 0);
        const headings = lines.filter((l: string) =>
          l.length < 80 && (l.trim().length > 2) &&
          (l === l.toUpperCase() || /^[#\-●■▶▪◆★☆]/.test(l.trim()) || l.trim().endsWith(':'))
        ).slice(0, 30);

        const textLength = content.length;
        const imageHints = (content.match(/\.(jpg|jpeg|png|gif|webp|svg)/gi) || []).length;

        return `## 📊 상세페이지 구조 분석: ${name}\n\nURL: ${input.url}${screenshotInfo}\n\n### 기본 정보\n- 텍스트 길이: ${textLength}자\n- 이미지 참조: 약 ${imageHints}개\n- 감지된 헤딩/섹션 수: ${headings.length}개\n\n### 감지된 섹션 구조\n${headings.map((h: string, i: number) => `${i + 1}. ${h.trim()}`).join('\n')}\n\n### 페이지 텍스트 (구조 분석용)\n${content.substring(0, 4000)}\n\n⚠️ 위 텍스트와 스크린샷을 기반으로 상세페이지의 섹션 구성, 레이아웃 패턴, 카피 톤을 분석하여 기획에 활용하세요.`;
      } catch (e: any) {
        return `[페이지 구조 분석 에러] URL: ${input.url}. 원인: ${e.message}`;
      }
    }
    case 'collect_design_refs': {
      try {
        const category = input.category;
        const productType = input.product_type;
        const style = input.style_preference || '';
        const count = Math.min(input.count || 3, 5);

        // 다양한 검색어로 레퍼런스 수집
        const queries = [
          `${productType} 상세페이지 디자인 ${style}`.trim(),
          `${category} ${productType} 제품 상세페이지 레퍼런스`,
          `${productType} 공식몰 상세페이지`,
        ];

        const allUrls: { url: string; title: string; snippet: string }[] = [];

        for (const query of queries) {
          try {
            const results = await webSearch(query);
            for (const r of results) {
              // 이커머스 플랫폼 제외, 실제 상세페이지/브랜드몰 우선
              if (!r.url.includes('coupang.com') && !r.url.includes('naver.com/shop') &&
                  !r.url.includes('11st.co.kr') && !allUrls.some(u => u.url === r.url)) {
                allUrls.push(r);
              }
            }
          } catch {}
        }

        // 상위 N개 URL에 대해 스크린샷 촬영
        const collected: string[] = [];
        const targets = allUrls.slice(0, count);
        const serverUrl = process.env.NEXTAUTH_URL || 'http://localhost:3100';

        for (let i = 0; i < targets.length; i++) {
          const target = targets[i];
          try {
            const ss = await takeScreenshot(target.url, { fullPage: false, width: 1440, height: 900 });
            collected.push(`### 레퍼런스 ${i + 1}: ${target.title}\n- URL: ${target.url}\n- 스크린샷: ${serverUrl}${ss.url}\n- 설명: ${target.snippet}`);
          } catch {
            collected.push(`### 레퍼런스 ${i + 1}: ${target.title}\n- URL: ${target.url}\n- ⚠️ 스크린샷 실패 (사이트 접근 차단)\n- 설명: ${target.snippet}`);
          }
        }

        return `## 🎨 디자인 레퍼런스 수집 완료\n\n카테고리: ${category} > ${productType}${style ? ` (${style})` : ''}\n총 ${collected.length}개 수집\n\n${collected.join('\n\n')}\n\n💡 위 레퍼런스를 Figma에 배치하려면 screenshot_to_figma 도구를 사용하세요.`;
      } catch (e: any) {
        return `[레퍼런스 수집 에러] ${e.message}`;
      }
    }
    case 'take_screenshot': {
      try {
        const result = await takeScreenshot(input.url, {
          fullPage: input.full_page || false,
          width: input.width,
          height: input.height,
        });
        const serverUrl = process.env.NEXTAUTH_URL || 'http://localhost:3100';
        const imageUrl = `${serverUrl}${result.url}`;
        return `스크린샷 촬영 완료!\n- URL: ${imageUrl}\n- 크기: ${result.width}x${result.height}\n\n이 이미지를 Figma에 배치하려면 figma_design 도구의 create_image 명령을 사용하세요:\n{action: "create_image", url: "${imageUrl}", name: "스크린샷"}`;
      } catch (e: any) {
        return `[스크린샷 에러] URL: ${input.url}. 원인: ${e.message}. 가능한 이유: 해당 사이트가 자동 접근을 차단, URL 오류, 또는 사이트 로딩 시간 초과.`;
      }
    }
    case 'screenshot_to_figma': {
      if (!isPluginConnected()) {
        return '[Figma 연결 에러] Figma 플러그인이 연결되어 있지 않습니다. 원인: DIOPT AI Designer 플러그인이 Figma에서 실행되지 않았거나 "연결 시작" 버튼을 누르지 않았습니다. 해결: Figma를 열고 플러그인을 실행한 뒤 "연결 시작"을 클릭하세요.';
      }
      try {
        const result = await takeScreenshot(input.url, {
          fullPage: input.full_page || false,
          width: input.width,
          height: input.height,
        });
        const serverUrl = process.env.NEXTAUTH_URL || 'http://localhost:3100';
        const imageUrl = `${serverUrl}${result.url}`;

        // Figma에 이미지 배치 명령 전송
        const commands = [{
          action: 'create_image',
          name: input.name || `스크린샷: ${input.url.substring(0, 50)}`,
          url: imageUrl,
          width: Math.min(result.width, 860),
          height: Math.round(result.height * (Math.min(result.width, 860) / result.width)),
          x: input.figma_x || 0,
          y: input.figma_y || 0,
        }];
        addCommands(commands);
        const figmaResults = await waitForResults();
        const figmaStatus = figmaResults.map(r =>
          r.success ? `✓ ${r.result}` : `✗ ${r.error}`
        ).join('\n');
        return `스크린샷 촬영 및 Figma 배치 완료!\n- 원본 URL: ${input.url}\n- 이미지: ${imageUrl}\n- Figma 결과: ${figmaStatus}`;
      } catch (e: any) {
        return `[스크린샷→Figma 에러] URL: ${input.url}. 원인: ${e.message}. 가능한 이유: 사이트 접근 차단, 네트워크 오류, 또는 Figma 플러그인 응답 없음.`;
      }
    }
    case 'update_step_form': {
      const formData = input.form_data;

      // 기획안 섹션 데이터 자동 보강 — 전체 섹션을 한번에 분석하여 섹션 간 중복 방지
      if (formData?.sections?.length > 0) {
        // 전체 섹션에서 이미 사용된 "주요 블록 타입 조합"을 추적 (heading, text 같은 기본은 제외)
        const globalUsedCombos = new Set<string>();
        // 모든 복합 블록 타입 풀
        const allComplexTypes = [
          'wf-card-grid', 'wf-table', 'wf-split', 'wf-checklist', 'wf-stats',
          'wf-image', 'wf-icon-list', 'wf-bar-chart', 'wf-badge-row', 'wf-accordion',
          'wf-comparison-row', 'wf-product-grid'
        ];

        for (let i = 0; i < formData.sections.length; i++) {
          const sec = formData.sections[i];
          const sectionNum = sec.num || i + 1;
          const sectionName = sec.name || `섹션 ${sectionNum}`;
          const mainCopy = sec.mainCopy || '';
          const subCopy = sec.subCopy || '';
          const visualDirection = sec.visualDirection || '';
          const layout = sec.layout || '';
          const aeCommentary = sec.aeCommentary || '';

          // ═══ copyBlocks 보강 (최소 7개) ═══
          const existingCopy = sec.copyBlocks || [];
          if (existingCopy.length < 7) {
            const existingTypes = new Set(existingCopy.map((b: any) => b.type));
            const gen: any[] = [];
            if (!existingTypes.has('section-title')) gen.push({ type: 'section-title', text: `섹션 ${sectionNum}  ${sectionName}` });
            if (!existingTypes.has('copy-main') && mainCopy) { gen.push({ type: 'label', text: '메인 카피' }); gen.push({ type: 'copy-main', text: mainCopy }); }
            if (!existingTypes.has('copy-sub') && subCopy) gen.push({ type: 'copy-sub', text: subCopy });
            if (visualDirection) { gen.push({ type: 'label', text: '비주얼 디렉션' }); gen.push({ type: 'text', text: visualDirection }); }
            if (layout) gen.push({ type: 'info-box', label: '레이아웃', text: layout });
            if (aeCommentary) gen.push({ type: 'ae-comment', text: aeCommentary });
            else gen.push({ type: 'ae-comment', text: `${sectionName} — 이 섹션의 전략적 의도와 기대 효과` });
            if (!existingTypes.has('note')) gen.push({ type: 'note', text: `디자인 참고: ${visualDirection || layout || sectionName}` });

            const merged = [...existingCopy];
            for (const g of gen) { if (merged.length >= 9) break; if (!merged.some((m: any) => m.type === g.type && m.text === g.text)) merged.push(g); }
            while (merged.length < 7) merged.push({ type: 'text', text: `${sectionName} 상세 콘텐츠` });
            sec.copyBlocks = merged;
          }

          // ═══ wireframeBlocks 보강 (최소 5개, 섹션 간 조합 중복 없음) ═══
          const existingWf = sec.wireframeBlocks || [];
          if (existingWf.length < 4) {
            const allText = `${sectionName} ${mainCopy} ${subCopy} ${visualDirection} ${layout} ${aeCommentary}`.toLowerCase();

            // 이 섹션에 적합한 복합 블록 타입을 점수화
            const typeScores: Record<string, number> = {};
            allComplexTypes.forEach(t => { typeScores[t] = 0; });

            // 키워드 매칭으로 점수 부여
            const keywordMap: [RegExp, string, number][] = [
              [/히어로|메인.*비주얼|풀.*이미지|대표|커버|첫/, 'wf-image', 4],
              [/분할|좌우|좌측|우측|split|텍스트.*이미지/, 'wf-split', 3],
              [/통계|수치|데이터|%|증가|감소|매출|성장|효과|결과/, 'wf-stats', 4],
              [/통계|수치|데이터|%|효과|결과|실험/, 'wf-bar-chart', 3],
              [/비교|차별|차이|vs|대비|기존|경쟁|전후/, 'wf-comparison-row', 4],
              [/비교|스펙|사양|규격|성분표/, 'wf-table', 3],
              [/특징|기능|장점|포인트|핵심|강점/, 'wf-icon-list', 4],
              [/나열|종류|구성|라인업|카테고리/, 'wf-card-grid', 4],
              [/후기|리뷰|고객|만족|평점|추천|체험/, 'wf-bar-chart', 4],
              [/후기|리뷰|고객|인증|수상|신뢰/, 'wf-stats', 3],
              [/faq|질문|답변|궁금|문의|q&a/, 'wf-accordion', 5],
              [/구매|주문|가격|할인|프로모|혜택|cta/, 'wf-product-grid', 4],
              [/구매|배송|무료|보장|정품|당일/, 'wf-badge-row', 3],
              [/체크|확인|문제|고민|걱정|안전|위험|주의|pain/, 'wf-checklist', 4],
              [/인증|특허|수상|키워드|뱃지|iso|kc|ce/, 'wf-badge-row', 3],
              [/성분|원료|기술|원리|과학|메커니즘/, 'wf-table', 4],
              [/패키지|구성품|세트|옵션|용량/, 'wf-product-grid', 3],
              [/사용.*방법|how.*to|step|단계|절차/, 'wf-icon-list', 3],
              [/제품.*소개|overview|핵심.*제품/, 'wf-split', 3],
              [/이미지|사진|촬영|비주얼|무드/, 'wf-image', 2],
            ];

            for (const [regex, blockType, score] of keywordMap) {
              if (regex.test(allText)) {
                typeScores[blockType] = (typeScores[blockType] || 0) + score;
              }
            }

            // 점수순 정렬
            const ranked = Object.entries(typeScores)
              .filter(([, s]) => s > 0)
              .sort((a, b) => b[1] - a[1]);

            // 이 섹션의 복합 블록 2~3개 선택 (전체 섹션 간 같은 조합 방지)
            const selectedTypes: string[] = [];
            for (const [blockType] of ranked) {
              if (selectedTypes.length >= 3) break;
              // 같은 타입이 이미 다른 섹션에서 "주 블록"으로 쓰였으면 건너뜀
              const comboKey = `${blockType}`;
              if (globalUsedCombos.has(comboKey) && ranked.length > selectedTypes.length + 1) {
                continue; // 다른 후보가 있으면 스킵
              }
              selectedTypes.push(blockType);
            }

            // 선택된 타입이 2개 미만이면 아직 안 쓰인 타입에서 보충
            if (selectedTypes.length < 2) {
              for (const t of allComplexTypes) {
                if (selectedTypes.length >= 3) break;
                if (!selectedTypes.includes(t) && !globalUsedCombos.has(t)) {
                  selectedTypes.push(t);
                }
              }
            }

            // 이 섹션에서 사용한 조합 기록
            selectedTypes.forEach(t => globalUsedCombos.add(t));

            // 블록 인스턴스 생성 함수
            const createBlock = (type: string): any => {
              switch (type) {
                case 'wf-image': return { type, text: `${sectionName} 비주얼`, desc: visualDirection || mainCopy || sectionName, height: 300 + (sectionNum % 3) * 50 };
                case 'wf-split': return { type, text: mainCopy || sectionName, label: '[이미지]', desc: layout || subCopy || '구성' };
                case 'wf-stats': return { type, items: [{ label: '핵심 지표 1', value: '-' }, { label: '핵심 지표 2', value: '-' }, { label: '핵심 지표 3', value: '-' }] };
                case 'wf-bar-chart': return { type, text: `${sectionName} 지표`, items: [{ label: '항목 A', percent: 85 + (sectionNum * 3) % 15 }, { label: '항목 B', percent: 70 + (sectionNum * 7) % 25 }, { label: '항목 C', percent: 80 + (sectionNum * 5) % 18 }] };
                case 'wf-comparison-row': return { type, items: [{ label: '핵심 비교', value: '기존 제품', desc: '당사 제품' }, { label: '추가 비교', value: '일반', desc: '프리미엄' }] };
                case 'wf-table': return { type, text: `${sectionName} 상세`, items: [{ label: '항목 1', value: '상세 1' }, { label: '항목 2', value: '상세 2' }, { label: '항목 3', value: '상세 3' }] };
                case 'wf-icon-list': return { type, items: [{ label: '포인트 1', desc: mainCopy || '설명' }, { label: '포인트 2', desc: subCopy || '설명' }, { label: '포인트 3', desc: '추가 설명' }] };
                case 'wf-card-grid': return { type, cols: 3, items: [{ label: '항목 1', desc: '설명 1' }, { label: '항목 2', desc: '설명 2' }, { label: '항목 3', desc: '설명 3' }] };
                case 'wf-checklist': return { type, items: [{ label: '체크 포인트 1' }, { label: '체크 포인트 2' }, { label: '체크 포인트 3' }] };
                case 'wf-badge-row': return { type, items: [{ label: '뱃지 1' }, { label: '뱃지 2' }, { label: '뱃지 3' }] };
                case 'wf-accordion': return { type, items: [{ label: 'Q. 자주 묻는 질문 1', desc: '답변 1' }, { label: 'Q. 자주 묻는 질문 2', desc: '답변 2' }] };
                case 'wf-product-grid': return { type, cols: 2, items: [{ label: '옵션 A', desc: '구성', value: '가격' }, { label: '옵션 B', desc: '구성', value: '가격' }] };
                default: return { type: 'wf-text', text: `${sectionName} 구성` };
              }
            };

            // 최종 블록 조립: heading → text → 선택된 복합블록들
            const merged = [...existingWf];
            const usedTypes = new Set(existingWf.map((b: any) => b.type));
            if (!usedTypes.has('wf-heading')) { merged.push({ type: 'wf-heading', text: mainCopy || sectionName }); usedTypes.add('wf-heading'); }
            if (!usedTypes.has('wf-text') && subCopy) { merged.push({ type: 'wf-text', text: subCopy }); usedTypes.add('wf-text'); }
            for (const t of selectedTypes) {
              if (merged.length >= 6) break;
              if (!usedTypes.has(t)) { merged.push(createBlock(t)); usedTypes.add(t); }
            }
            while (merged.length < 5) {
              // 아직 안 쓰인 타입에서 하나 더 추가
              const unused = allComplexTypes.find(t => !usedTypes.has(t));
              if (unused) { merged.push(createBlock(unused)); usedTypes.add(unused); }
              else merged.push({ type: 'wf-text', text: `${sectionName} 추가 구성` });
            }

            sec.wireframeBlocks = merged;
            console.log(`[update_step_form] 섹션 ${sectionNum}(${sectionName}) wf 보강: ${existingWf.length}→${merged.length} [${selectedTypes.join(',')}]`);
          } else {
            // AI가 충분히 보냈어도 조합 추적
            const complexInSection = existingWf.map((b: any) => b.type).filter((t: string) => allComplexTypes.includes(t));
            complexInSection.forEach((t: string) => globalUsedCombos.add(t));
          }
        }
        console.log(`[update_step_form] 전체 ${formData.sections.length}섹션 보강 완료. 사용된 블록타입: [${[...globalUsedCombos].join(', ')}]`);
      }
      return JSON.stringify({ success: true, formData, status: input.status || 'draft' });
    }
    case 'export_to_figma': {
      if (!isPluginConnected()) {
        return '[Figma 연결 에러] Figma 플러그인이 연결되어 있지 않습니다. Figma에서 DIOPT AI Designer 플러그인을 실행하고 "연결 시작"을 클릭하세요.';
      }
      try {
        let formData = input.form_data || {};

        // DB에 저장된 섹션 데이터와 병합 (AI가 누락한 referenceImageUrl, wireframeBlocks 등 보완)
        if (input.step === 3 && formData.sections?.length > 0) {
          try {
            // projectId는 여기서 접근 불가하므로, DB의 최신 step 3 데이터와 비교하여 병합
            // AI가 전달한 sections에 referenceImageUrl이 없지만 DB에는 있는 경우 DB 값 사용
            const dbSections = (() => {
              // contextProjectId is set by the chat route before calling streamChatWithTools
              const pid = (globalThis as any).__dioptCurrentProjectId;
              if (!pid) return null;
              const row = getStepData(parseInt(pid), 3);
              if (!row?.form_data) return null;
              try { return JSON.parse(row.form_data)?.sections; } catch { return null; }
            })();

            if (dbSections?.length > 0) {
              for (let i = 0; i < formData.sections.length; i++) {
                const aiSec = formData.sections[i];
                const dbSec = dbSections[i];
                if (!dbSec) continue;

                // DB에 referenceImageUrl이 있지만 AI가 넘기지 않은 경우 → DB 값 사용
                if (dbSec.referenceImageUrl && !aiSec.referenceImageUrl) {
                  aiSec.referenceImageUrl = dbSec.referenceImageUrl;
                  aiSec.referenceNote = aiSec.referenceNote || dbSec.referenceNote;
                  console.log(`[export_to_figma] Merged referenceImageUrl from DB for section ${i + 1}`);
                }

                // DB에 wireframeBlocks가 있지만 AI가 넘기지 않은 경우 → DB 값 사용
                if (dbSec.wireframeBlocks?.length > 0 && !aiSec.wireframeBlocks?.length) {
                  aiSec.wireframeBlocks = dbSec.wireframeBlocks;
                  console.log(`[export_to_figma] Merged wireframeBlocks from DB for section ${i + 1}`);
                }

                // DB에 copyBlocks가 있지만 AI가 넘기지 않은 경우 → DB 값 사용
                if (dbSec.copyBlocks?.length > 0 && !aiSec.copyBlocks?.length) {
                  aiSec.copyBlocks = dbSec.copyBlocks;
                  console.log(`[export_to_figma] Merged copyBlocks from DB for section ${i + 1}`);
                }
              }
            }
          } catch (mergeErr: any) {
            console.error('[export_to_figma] DB merge warning:', mergeErr.message);
          }
        }

        // 내부적으로 figma-export API와 동일한 빌더 호출
        const { buildFigmaExport } = await import('@/app/api/figma-export/builder');
        const commands = buildFigmaExport(input.step, formData, input.project_title || '프로젝트');
        console.log('[export_to_figma] step:', input.step, 'commands:', commands.length);
        addCommands(commands);
        const results = await waitForResults();
        const ok = results.filter(r => r.success).length;
        const fail = results.filter(r => !r.success).length;
        return `✅ Figma에 디옵트 기획안 폼으로 내보내기 완료! (${ok}개 요소 생성${fail > 0 ? `, ${fail}개 실패` : ''})`;
      } catch (e: any) {
        console.error('[export_to_figma] Error:', e);
        return `[Figma 내보내기 에러] ${e.message}`;
      }
    }
    case 'figma_design': {
      if (!isPluginConnected()) {
        return '[Figma 연결 에러] Figma 플러그인이 연결되어 있지 않습니다. 원인: DIOPT AI Designer 플러그인이 Figma에서 실행되지 않았거나 "연결 시작" 버튼을 누르지 않았습니다. 해결: Figma를 열고 플러그인을 실행한 뒤 "연결 시작"을 클릭하세요.';
      }
      addCommands(input.commands);
      const results = await waitForResults();
      return results.map(r =>
        r.success ? `✓ ${r.result}` : `✗ ${r.command}: ${r.error}`
      ).join('\n');
    }
    default:
      return `알 수 없는 도구: ${name}`;
  }
}

// 스트리밍 + Tool Use 지원 채팅
export async function* streamChatWithTools(
  messages: { role: 'user' | 'assistant'; content: string }[],
  currentStep: number,
  fileAttachment?: FileAttachment,
  clientName?: string,
): AsyncGenerator<{ type: 'text' | 'tool_use' | 'done' | 'form_update'; text?: string; toolName?: string; toolInput?: string; formData?: any; formStatus?: string }> {
  const client = getClient();

  // 프로젝트 설정 & 확정 데이터 로드
  let projectSettings: any = undefined;
  let confirmedBriefStr: string | undefined;
  let confirmedPlanStr: string | undefined;
  try {
    const projectId = (globalThis as any).__dioptCurrentProjectId;
    if (projectId) {
      const { getProjectSettings, getConfirmedData } = require('./db');
      projectSettings = getProjectSettings(parseInt(projectId));
      const briefData = getConfirmedData(parseInt(projectId), 'brief');
      if (briefData?.confirmed_data) confirmedBriefStr = briefData.confirmed_data;
      const planData = getConfirmedData(parseInt(projectId), 'plan');
      if (planData?.confirmed_data) confirmedPlanStr = planData.confirmed_data;
    }
  } catch (e) {
    // Settings not available
  }

  const systemPromptText = sanitizeUnicode(getSystemPrompt(currentStep, clientName, projectSettings, confirmedBriefStr, confirmedPlanStr));
  // Prompt Caching: 시스템 프롬프트를 캐시하여 반복 호출 시 90% 비용 절감
  const systemPrompt: any[] = [
    {
      type: 'text',
      text: systemPromptText,
      cache_control: { type: 'ephemeral' },
    },
  ];

  // 메시지 변환
  const apiMessages: any[] = sanitizeMessages(messages.map((m, i) => {
    if (fileAttachment && i === messages.length - 1 && m.role === 'user') {
      const content: any[] = [];
      if (fileAttachment.type === 'image' && fileAttachment.base64Image) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: fileAttachment.mimeType,
            data: fileAttachment.base64Image,
          },
        });
        // 이미지 URL이 있으면 Figma 배치용으로 안내
        if (fileAttachment.fileUrl) {
          const serverUrl = process.env.NEXTAUTH_URL || 'http://localhost:3100';
          content.push({
            type: 'text',
            text: `[첨부 이미지 정보]\n파일명: ${fileAttachment.fileName}\nFigma 배치용 URL: ${serverUrl}${fileAttachment.fileUrl}\n→ 레퍼런스로 사용하려면 해당 섹션의 referenceImageUrl 필드에 이 URL을 넣고 export_to_figma를 호출하세요. figma_design으로 직접 배치하지 마세요!`,
          });
        }
      }
      if (fileAttachment.type === 'text' && fileAttachment.textContent) {
        content.push({
          type: 'text',
          text: `[업로드된 파일: ${fileAttachment.fileName}]\n\n${fileAttachment.textContent}`,
        });
      }
      content.push({ type: 'text', text: m.content });
      return { role: m.role, content };
    }
    return { role: m.role, content: m.content };
  }));

  // 마지막 사용자 메시지가 Figma 내보내기 요청인지 감지
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
  const isFigmaExportRequest = /피그마|figma/i.test(lastUserMsg) && /내보내|보내|작성|만들|출력|다시/i.test(lastUserMsg);
  if (isFigmaExportRequest) {
    // AI에게 도구 호출을 강제 지시
    apiMessages.push({
      role: 'user',
      content: '[시스템 지시] 기획자가 Figma 내보내기를 요청했습니다. 반드시 export_to_figma 도구를 실제로 호출하세요. 텍스트로만 답하지 마세요! 1) update_step_form으로 현재 데이터 저장 2) export_to_figma 도구 호출 — 이 두 단계를 반드시 수행하세요.',
    });
    // assistant 응답 추가하여 메시지 교대 유지
    apiMessages.push({
      role: 'assistant',
      content: '네, 바로 export_to_figma 도구를 호출하겠습니다.',
    });
  }

  // ═══ V2 파이프라인 스텝 감지 ═══
  // STEP 4: 기획안 생성/작성 요청
  const hasTarget = /기획안|초안|섹션|전체|나머지/i.test(lastUserMsg);
  const hasAction = /작성|생성|만들|해줘|해 줘|해봐|해 봐|보여|표시|작업|계속|이어서|수정|다시|업데이트|변경|고도화|시작/i.test(lastUserMsg);
  const hasSectionDirectRequest = /섹션.*해|섹션.*부터|섹션.*까지|\d+섹션/i.test(lastUserMsg);
  const isPlanCreationRequest = currentStep === 3 &&
    ((hasTarget && hasAction) || hasSectionDirectRequest) &&
    !isFigmaExportRequest;

  // STEP 2: 브리프 작성 감지
  const isBriefCreationRequest = currentStep === 2 &&
    /브리프|초안|작성|생성|만들|분석|정리/i.test(lastUserMsg);

  // STEP 1: 시장조사 감지
  const isResearchRequest = currentStep === 1 &&
    /시장조사|조사|분석|리서치|경쟁사|트렌드|시장/i.test(lastUserMsg);

  // STEP 6: 디자인 가이드 요청 감지
  const isDesignGuideRequest = /디자인\s*가이드/i.test(lastUserMsg);

  // STEP 4: 촬영콘티 가이드 작성 감지
  const isContiCreationRequest = currentStep === 4 &&
    /콘티|촬영|작성|생성|만들|해줘|해 줘|시작|가이드/i.test(lastUserMsg) &&
    !isFigmaExportRequest &&
    !isDesignGuideRequest;

  // STEP 9: AI 총평 감지
  const isReviewRequest = currentStep === 9 &&
    /총평|리포트|리포팅|마무리|평가|피드백/i.test(lastUserMsg);

  // 하이브리드 모델 선택: 브리프/기획안 핵심 작성 시에만 Opus 사용
  const isCriticalCreation = isPlanCreationRequest || isBriefCreationRequest;
  const activeModel = getModel(currentStep, isCriticalCreation);

  // 섹션 파싱을 시스템 지시보다 먼저 수행 (변수 초기화 선행 필요)
  let requestedSectionStart = 1;
  let requestedSectionMax = 20;
  let requestedSpecificSections: number[] = [];
  if (isPlanCreationRequest) {
    const allSectionNums: number[] = [];
    const sectionMatches = lastUserMsg.matchAll(/(\d+)\s*섹션/g);
    for (const m of sectionMatches) {
      allSectionNums.push(parseInt(m[1]));
    }
    const rangeMatch1 = lastUserMsg.match(/(\d+)\s*섹션.*?(?:부터|에서).*?(\d+)\s*섹션/);
    const rangeMatch2 = lastUserMsg.match(/(\d+)\s*[~\-]\s*(\d+)\s*섹션/);
    const untilMatch = lastUserMsg.match(/(\d+)\s*섹션.*?까지/);
    const fromMatch = lastUserMsg.match(/(\d+)\s*섹션.*?부터/);
    if (rangeMatch1) {
      requestedSectionStart = parseInt(rangeMatch1[1]);
      requestedSectionMax = parseInt(rangeMatch1[2]);
    } else if (rangeMatch2) {
      requestedSectionStart = parseInt(rangeMatch2[1]);
      requestedSectionMax = parseInt(rangeMatch2[2]);
    } else if (untilMatch) {
      requestedSectionMax = parseInt(untilMatch[1]);
    } else if (fromMatch) {
      requestedSectionStart = parseInt(fromMatch[1]);
    } else if (allSectionNums.length >= 2 && /하고|과|랑|,|그리고|이랑/.test(lastUserMsg)) {
      requestedSpecificSections = [...new Set(allSectionNums)].sort((a, b) => a - b);
      requestedSectionStart = requestedSpecificSections[0];
      requestedSectionMax = requestedSpecificSections[requestedSpecificSections.length - 1];
    } else if (allSectionNums.length === 1) {
      requestedSpecificSections = [allSectionNums[0]];
      requestedSectionStart = allSectionNums[0];
      requestedSectionMax = allSectionNums[0];
    }
    if (requestedSpecificSections.length > 0) {
      console.log(`[Claude] Requested SPECIFIC sections: [${requestedSpecificSections.join(', ')}]`);
    } else {
      console.log(`[Claude] Requested sections: ${requestedSectionStart} ~ ${requestedSectionMax}`);
    }
  }

  if (isPlanCreationRequest) {
    const isSpecific = requestedSpecificSections.length > 0;
    const sectionLabel = isSpecific
      ? `섹션 ${requestedSpecificSections.join(', ')}번`
      : `섹션 ${requestedSectionStart}~${requestedSectionMax}번`;

    // 배치 예시 생성
    let batchInstruction = '';
    if (isSpecific && requestedSpecificSections.length <= 4) {
      // 개별 섹션 4개 이하 → 한번에 호출
      batchInstruction = `1) 섹션 ${requestedSpecificSections.join(', ')}번을 모두 상세하게 작성 → update_step_form 1회 호출
(sections 배열에 ${requestedSpecificSections.map(n => `섹션 ${n}`).join(', ')}만 포함)`;
    } else if (isSpecific) {
      // 개별 섹션 5개 이상 → 배치 분할
      const batches: number[][] = [];
      for (let i = 0; i < requestedSpecificSections.length; i += 3) {
        batches.push(requestedSpecificSections.slice(i, i + 3));
      }
      batchInstruction = batches.map((batch, idx) =>
        `${idx + 1}) 섹션 ${batch.join(', ')}번을 상세하게 작성 → update_step_form 호출`
      ).join('\n');
    } else {
      // 연속 범위
      const examples: string[] = [];
      for (let s = requestedSectionStart; s <= requestedSectionMax; s += 3) {
        const end = Math.min(s + 2, requestedSectionMax);
        examples.push(`${examples.length + 1}) 섹션 ${s}~${end}을 상세하게 작성 → update_step_form 호출 (sections에 ${s}~${end}만)`);
      }
      batchInstruction = examples.join('\n');
    }

    apiMessages.push({
      role: 'user',
      content: `[시스템 지시 — 기획안 작성 필수 규칙]

★★★ 핵심: 사용자가 요청한 ${sectionLabel}만 작성하세요! ★★★
${!isSpecific || requestedSpecificSections.length > 4 ? '★★★ 3~4섹션씩 나눠서 update_step_form을 여러 번 호출하세요! ★★★' : ''}

${!isSpecific ? '한번에 전체 섹션을 보내면 내용이 빈약해집니다.\n반드시 아래 순서로 진행하세요:' : '아래 순서로 진행하세요:'}

${batchInstruction}

⚠️ 중요: ${sectionLabel}만 작성! 다른 섹션은 절대 작성하지 마세요!
서버가 자동으로 이전 섹션과 병합합니다. 요청된 섹션만 보내면 됩니다.

각 섹션의 copyBlocks와 wireframeBlocks를 반드시 상세하게 구성하세요:
- copyBlocks: 7개 이상 (section-title, label, copy-main, copy-sub, text/list/info-box/kv-pair 등, ae-comment)
- wireframeBlocks: 5개 이상 (wf-heading, wf-text, + 섹션 특성에 맞는 블록 3~4개)

★★★ wireframeBlocks 선택 기준 — 섹션 문구 내용을 분석하여 최적의 블록 선택! ★★★
반드시 해당 섹션의 mainCopy, subCopy, 콘텐츠 주제를 분석한 뒤 가장 적합한 블록을 골라야 합니다:
- 숫자/통계/수치가 있으면 → wf-stats 또는 wf-bar-chart
- 비교 내용(기존 vs 당사, 전후 비교)이면 → wf-comparison-row
- 기능/특징 나열이면 → wf-icon-list 또는 wf-card-grid
- 성분표/스펙 정보면 → wf-table
- 체크포인트/문제점이면 → wf-checklist
- FAQ/질문답변이면 → wf-accordion
- 인증/수상/뱃지면 → wf-badge-row
- 제품 옵션/가격이면 → wf-product-grid
- 좌우 분할(텍스트+이미지)이면 → wf-split
- 대표 비주얼/히어로면 → wf-image
섹션마다 반드시 다른 조합의 블록을 사용하세요!

❌ 절대 금지:
- 요청하지 않은 섹션을 작성하는 것 (${sectionLabel}만!)
- copyBlocks/wireframeBlocks 없이 mainCopy/subCopy만 보내는 것
- 모든 섹션에 wf-heading + wf-text + wf-image만 반복하는 것`,
    });

    apiMessages.push({
      role: 'assistant',
      content: isSpecific
        ? `네, ${sectionLabel}만 다시 작성하겠습니다. 각 섹션에 상세한 copyBlocks(7+)와 wireframeBlocks(5+)를 포함하겠습니다. 지금 바로 시작합니다.`
        : `네, ${sectionLabel}을 3~4섹션씩 나눠서 작성하겠습니다. 각 섹션에 상세한 copyBlocks(7+)와 wireframeBlocks(5+)를 포함하겠습니다.\n\n지금 바로 섹션 ${requestedSectionStart}~${Math.min(requestedSectionStart + 2, requestedSectionMax)}부터 시작합니다.`,
    });
  }

  // 레퍼런스 이미지 첨부 시 → update_step_form 강제 지시
  // AI가 이미지를 분석만 하고 DB에 저장하지 않는 문제 해결
  const hasImageAttachment = fileAttachment?.type === 'image' && fileAttachment?.base64Image;
  const isReferenceRequest = hasImageAttachment && /섹션|구조|참고|레퍼런스|이렇게|이 느낌|이 구조|반영|수정|변경|적용/i.test(lastUserMsg);
  if (isReferenceRequest) {
    apiMessages.push({
      role: 'user',
      content: `[시스템 지시] 기획자가 레퍼런스 이미지를 첨부하여 섹션 수정을 요청했습니다.
★★★ 필수 수행 순서 ★★★
1. 첨부된 이미지를 분석하여 레이아웃/구조를 파악하세요.
2. 분석 결과를 해당 섹션의 wireframeBlocks, copyBlocks로 변환하세요.
3. 반드시 update_step_form 도구를 호출하여 변경된 섹션 데이터를 DB에 저장하세요!
   - sections 배열에서 해당 섹션의 wireframeBlocks, copyBlocks를 업데이트
   - referenceImageUrl: "${fileAttachment?.fileUrl ? (process.env.NEXTAUTH_URL || 'http://localhost:3100') + fileAttachment.fileUrl : ''}"
   - referenceNote: 분석 메모
4. update_step_form 호출 없이 텍스트로만 답하는 것은 절대 금지!
   텍스트 설명만으로는 데이터가 저장되지 않아 Figma에 반영되지 않습니다.`,
    });
    apiMessages.push({
      role: 'assistant',
      content: '네, 이미지를 분석한 후 반드시 update_step_form 도구를 호출하여 섹션 데이터를 DB에 저장하겠습니다.',
    });
  }

  // 리서치 단계(STEP 0, 1)는 검색 제한 완화
  const isResearchStep = currentStep <= 1 || currentStep === 4 || currentStep === 6;
  const isPlanStep = currentStep === 3;
  const MAX_TOOL_ITERATIONS = isResearchStep ? 15 : 8;
  let webSearchCount = 0;
  let fetchPageCount = 0;
  const MAX_WEB_SEARCHES = isResearchStep ? 10 : 5;
  const MAX_FETCH_PAGES = isResearchStep ? 6 : 3;
  // 기획안 배치 생성 시 완료된 섹션 번호 추적
  const generatedSectionNums = new Set<number>();
  let planToolCallCount = 0;
  // 콘티 cutPages 배치 추적
  let contiCutCount = 0;
  let contiTotalTarget = 0;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {

    // 기획안 배치 생성: 스트리밍으로 실시간 텍스트 + 도구 호출 동시 처리 (속도 개선)
    const totalRequestedSections = requestedSpecificSections.length > 0
      ? requestedSpecificSections.length
      : requestedSectionMax - requestedSectionStart + 1;
    const expectedBatches = Math.ceil(totalRequestedSections / 3);
    const shouldForceToolUse = isPlanCreationRequest &&
      planToolCallCount < expectedBatches &&
      generatedSectionNums.size < totalRequestedSections &&
      iteration < MAX_TOOL_ITERATIONS - 2;

    // 촬영콘티 생성: update_step_form 강제 호출 (1회만)
    if (isContiCreationRequest && planToolCallCount === 0 && iteration === 0) {
      yield { type: 'text', text: `🎬 촬영콘티 생성 중...\n` };
    }

    if (isPlanCreationRequest && (shouldForceToolUse || planToolCallCount === 0)) {
      // 진행 상황 알림
      if (planToolCallCount > 0) {
        // 이전 배치에서 생성된 섹션 표시
        const prevSections = [...generatedSectionNums].sort((a, b) => a - b);
        yield { type: 'text', text: `\n✅ 섹션 ${prevSections.join(', ')} 완료\n\n` };
      }
      yield { type: 'text', text: `📝 기획안 생성 중... (배치 ${planToolCallCount + 1}/${expectedBatches})\n` };

      console.log(`[Claude] Plan streaming iteration ${iteration}, sections so far: ${generatedSectionNums.size}, tool calls: ${planToolCallCount}`);

      // ===== 컨텍스트 압축: 이전 배치의 tool_result를 요약으로 교체 (200k 한도 방지) =====
      if (planToolCallCount > 0) {
        for (let mi = 0; mi < apiMessages.length; mi++) {
          const msg = apiMessages[mi];
          if (msg.role === 'user' && Array.isArray(msg.content)) {
            const compressed = msg.content.map((item: any) => {
              if (item.type === 'tool_result' && typeof item.content === 'string' && item.content.length > 500) {
                // 긴 tool_result를 짧은 요약으로 교체
                const successMatch = item.content.match(/"success"\s*:\s*(true|false)/);
                const sectionsMatch = item.content.match(/"sections"\s*:\s*\[/);
                const summary = successMatch?.[1] === 'true'
                  ? `[저장 완료 - 섹션 데이터 DB 저장됨]`
                  : item.content.substring(0, 200) + '...(생략)';
                return { ...item, content: summary };
              }
              return item;
            });
            apiMessages[mi] = { ...msg, content: compressed };
          }
          // assistant의 tool_use input도 압축 (sections JSON이 매우 큼)
          if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            const compressed = msg.content.map((block: any) => {
              if (block.type === 'tool_use' && block.name === 'update_step_form') {
                const input = block.input as any;
                if (input?.sections?.length > 0) {
                  // 섹션 번호만 남기고 상세 데이터 제거
                  const sectionNums = input.sections.map((s: any) => s.num || s.title).join(', ');
                  return {
                    ...block,
                    input: {
                      ...input,
                      sections: input.sections.map((s: any) => ({
                        num: s.num,
                        title: s.title,
                        _compressed: `[섹션 ${s.num} 데이터 - DB에 저장됨]`,
                      })),
                    },
                  };
                }
              }
              return block;
            });
            apiMessages[mi] = { ...msg, content: compressed };
          }
        }
        console.log(`[Claude] Compressed previous tool results to save context`);
      }

      const streamOptions: any = {
        model: activeModel,
        max_tokens: 16384,
        system: systemPrompt,
        tools,
        messages: apiMessages,
      };
      if (shouldForceToolUse) {
        streamOptions.tool_choice = { type: 'tool', name: 'update_step_form' };
      }

      try {
        const planStream = client.messages.stream(streamOptions);

        // 스트리밍: 텍스트는 실시간 전송, tool_use JSON은 축적
        const streamToolUseBlocks: Array<{ id: string; name: string; inputJson: string }> = [];
        let currentStreamToolUse: { id: string; name: string; inputJson: string } | null = null;

        for await (const event of planStream) {
          if (event.type === 'content_block_start') {
            const cb = (event as any).content_block;
            if (cb?.type === 'tool_use') {
              currentStreamToolUse = { id: cb.id, name: cb.name, inputJson: '' };
            }
          } else if (event.type === 'content_block_delta') {
            const delta = (event as any).delta;
            if (delta?.type === 'text_delta' && delta.text) {
              yield { type: 'text', text: delta.text };
            } else if (delta?.type === 'input_json_delta' && delta.partial_json && currentStreamToolUse) {
              currentStreamToolUse.inputJson += delta.partial_json;
            }
          } else if (event.type === 'content_block_stop') {
            if (currentStreamToolUse) {
              streamToolUseBlocks.push(currentStreamToolUse);
              currentStreamToolUse = null;
            }
          }
        }

        const finalMsg = await planStream.finalMessage();

        // Prompt Caching 모니터링 (plan streaming)
        const planUsage = finalMsg.usage as any;
        if (planUsage) {
          console.log(`[Claude] Plan batch usage — input: ${planUsage.input_tokens}, output: ${planUsage.output_tokens}, cache_write: ${planUsage.cache_creation_input_tokens || 0}, cache_read: ${planUsage.cache_read_input_tokens || 0}`);
        }

        if (streamToolUseBlocks.length > 0) {
          // 도구 실행
          const toolResults: any[] = [];
          for (const stb of streamToolUseBlocks) {
            let toolInput: any = {};
            try { toolInput = JSON.parse(stb.inputJson); } catch {}

            yield { type: 'tool_use', toolName: stb.name, toolInput: '' };

            let result = await executeTool(stb.name, toolInput);

            if (stb.name === 'update_step_form') {
              planToolCallCount++;
              try {
                const parsed = JSON.parse(result);
                if (parsed.success && parsed.formData) {
                  yield { type: 'form_update', formData: parsed.formData, formStatus: parsed.status || 'draft' };
                  if (parsed.formData.sections) {
                    for (const sec of parsed.formData.sections) {
                      if (sec.num) generatedSectionNums.add(sec.num);
                    }
                    console.log(`[Claude] Sections generated so far: [${[...generatedSectionNums].sort().join(', ')}] (${generatedSectionNums.size} total)`);
                  }
                }
              } catch {}
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: stb.id,
              content: result,
            });
          }

          apiMessages.push({ role: 'assistant', content: finalMsg.content });
          apiMessages.push({ role: 'user', content: toolResults });

          // 섹션 완료 상태 확인 후 마무리 지시
          const nowShouldForce = planToolCallCount < expectedBatches &&
            generatedSectionNums.size < totalRequestedSections &&
            iteration + 1 < MAX_TOOL_ITERATIONS - 2;
          if (!nowShouldForce && generatedSectionNums.size > 0) {
            console.log(`[Claude] All requested sections generated (${generatedSectionNums.size}). Releasing tool_choice.`);
            apiMessages.push({
              role: 'user',
              content: `[시스템] 기획안 섹션 ${[...generatedSectionNums].sort().join(', ')}번이 모두 생성 완료되었습니다. 추가 update_step_form 호출 없이, 완료 메시지를 간단히 전달하세요.`,
            });
          }

          continue;
        }

        // tool_use 없이 텍스트만 온 경우 → 완료
        yield { type: 'done' };
        return;

      } catch (planError: any) {
        // 컨텍스트 한도 초과 등 에러 시 → 이미 생성된 섹션으로 마무리
        console.error(`[Claude] Plan streaming error:`, planError?.message || planError);
        if (generatedSectionNums.size > 0) {
          yield { type: 'text', text: `\n\n✅ 기획안 섹션 ${[...generatedSectionNums].sort().join(', ')}번이 완성되었습니다! 우측 패널에서 확인하세요.\n(나머지 섹션은 "나머지 섹션 작성해줘"로 이어서 생성 가능합니다)` };
          yield { type: 'done' };
          return;
        }
        // 섹션 하나도 못 만든 경우 에러 전달
        yield { type: 'text', text: `\n\n⚠️ 기획안 생성 중 오류가 발생했습니다. 다시 시도해주세요.` };
        yield { type: 'done' };
        return;
      }
    }

    // ===== 일반 요청: 기존 non-streaming probe 방식 =====
    const probeOptions: any = {
      model: activeModel,
      max_tokens: isPlanStep ? 16384 : 8192,
      system: systemPrompt,
      tools,
      messages: apiMessages,
    };
    // 촬영콘티 생성: 배치 방식으로 update_step_form 반복 호출
    if (isContiCreationRequest) {
      const needsMoreCuts = contiTotalTarget > 0 && contiCutCount < contiTotalTarget;
      if (iteration === 0 || needsMoreCuts) {
        probeOptions.tool_choice = { type: 'tool', name: 'update_step_form' };
        probeOptions.max_tokens = 16384;
        if (needsMoreCuts) {
          // 다음 배치 요청 메시지 추가
          yield { type: 'text', text: `\n📸 컷 ${contiCutCount}/${contiTotalTarget} 완료, 나머지 컷 생성 중...\n` };
          apiMessages.push({
            role: 'user',
            content: [{
              type: 'text',
              text: `[시스템] 현재 ${contiCutCount}/${contiTotalTarget}컷만 cutPages에 저장됨. 나머지 컷 ${contiCutCount + 1}~${contiTotalTarget}번의 cutPages를 추가로 생성하세요. 반드시 cutPagesBatch: true를 포함하여 update_step_form을 호출하세요. 기본정보는 이미 저장되어 있으므로 cutPages만 보내면 됩니다.`,
            }],
          });
          console.log(`[Claude] Conti batch request: need cuts ${contiCutCount + 1}~${contiTotalTarget}`);
        }
      }
    }
    const probe = await client.messages.create(probeOptions);

    // Prompt Caching 모니터링
    const usage = probe.usage as any;
    if (usage) {
      console.log(`[Claude] Token usage — input: ${usage.input_tokens}, output: ${usage.output_tokens}, cache_write: ${usage.cache_creation_input_tokens || 0}, cache_read: ${usage.cache_read_input_tokens || 0}`);
    }

    const toolBlocks = probe.content.filter(b => b.type === 'tool_use');
    const textBlocks = probe.content.filter(b => b.type === 'text');

    if (toolBlocks.length > 0) {
      for (const block of textBlocks) {
        if (block.type === 'text' && block.text) {
          const chunks = block.text.match(/[\s\S]{1,30}/g) || [];
          for (const chunk of chunks) {
            yield { type: 'text', text: chunk };
          }
        }
      }

      const toolResults: any[] = [];
      for (const block of toolBlocks) {
        if (block.type === 'tool_use') {
          const toolName = block.name;
          const toolInput = block.input as any;

          let skipped = false;
          if (toolName === 'web_search' && webSearchCount >= MAX_WEB_SEARCHES) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `[검색 제한] 이미 ${MAX_WEB_SEARCHES}회 검색을 완료했습니다. 지금까지 수집한 결과를 정리해서 사용자에게 전달하세요.`,
            });
            skipped = true;
          } else if (toolName === 'fetch_webpage' && fetchPageCount >= MAX_FETCH_PAGES) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `[페이지 로드 제한] 이미 ${MAX_FETCH_PAGES}개 페이지를 로드했습니다. 수집한 결과를 정리해서 사용자에게 전달하세요.`,
            });
            skipped = true;
          }

          if (!skipped) {
            yield {
              type: 'tool_use',
              toolName,
              toolInput: toolName === 'web_search' ? toolInput.query : toolInput.url,
            };

            let result = await executeTool(toolName, toolInput);

            if (toolName === 'web_search') {
              webSearchCount++;
              const lines = result.split('\n\n');
              const maxResults = isResearchStep ? 8 : 5;
              if (lines.length > maxResults) {
                result = lines.slice(0, maxResults).join('\n\n') + `\n\n(총 ${lines.length}개 결과 중 상위 ${maxResults}개 표시)`;
              }
            }

            if (toolName === 'fetch_webpage') {
              fetchPageCount++;
              const maxChars = isResearchStep ? 4000 : 2000;
              if (result.length > maxChars) {
                result = result.substring(0, maxChars) + '\n...(내용 생략)';
              }
            }

            if (toolName === 'update_step_form') {
              planToolCallCount++;
              try {
                const parsed = JSON.parse(result);
                if (parsed.success && parsed.formData) {
                  yield { type: 'form_update', formData: parsed.formData, formStatus: parsed.status || 'draft' };
                  if (parsed.formData.sections) {
                    for (const sec of parsed.formData.sections) {
                      if (sec.num) generatedSectionNums.add(sec.num);
                    }
                    console.log(`[Claude] Sections generated so far: [${[...generatedSectionNums].sort().join(', ')}] (${generatedSectionNums.size} total)`);
                  }
                  // 콘티 cutPages 배치 추적
                  if (parsed.formData.cutPages?.length > 0) {
                    contiCutCount += parsed.formData.cutPages.length;
                    console.log(`[Claude] Conti cuts so far: ${contiCutCount}, totalCuts target: ${contiTotalTarget}`);
                  }
                  if (parsed.formData.totalCuts && contiTotalTarget === 0) {
                    contiTotalTarget = parsed.formData.totalCuts;
                  }
                  if (parsed.formData.cutList?.total && contiTotalTarget === 0) {
                    contiTotalTarget = parsed.formData.cutList.total;
                  }
                }
              } catch {}
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          }
        }
      }

      apiMessages.push({ role: 'assistant', content: probe.content });
      apiMessages.push({ role: 'user', content: toolResults });
      continue;
    }

    // 도구 사용이 없으면 → 실시간 스트리밍으로 최종 응답 생성
    const stream = client.messages.stream({
      model: activeModel,
      max_tokens: isPlanStep ? 32000 : 8192,
      system: systemPrompt,
      messages: apiMessages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as any;
        if (delta.type === 'text_delta' && delta.text) {
          yield { type: 'text', text: delta.text };
        }
      }
    }

    yield { type: 'done' };
    return;
  }

  // 루프 한도 도달 → 도구 없이 최종 응답 강제 생성
  console.log('[Claude] Tool loop limit reached, forcing final response');
  // 수집한 결과를 정리하라는 명시적 지시 추가
  apiMessages.push({
    role: 'user',
    content: '[시스템] 도구 사용 한도에 도달했습니다. 지금까지 수집한 검색 결과와 정보를 바탕으로 사용자에게 깔끔하게 정리하여 응답하세요. 추가 도구 호출 없이 텍스트로 답변하세요.',
  });

  const finalStream = client.messages.stream({
    model: activeModel,
    max_tokens: 8192,
    system: systemPrompt,
    messages: apiMessages,
  });

  for await (const event of finalStream) {
    if (event.type === 'content_block_delta') {
      const delta = event.delta as any;
      if (delta.type === 'text_delta' && delta.text) {
        yield { type: 'text', text: delta.text };
      }
    }
  }

  yield { type: 'done' };
}
