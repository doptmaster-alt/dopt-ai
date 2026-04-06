import { NextRequest, NextResponse } from 'next/server';
import { addLearning } from '@/lib/db';
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
  return '';
}

const LEARNING_DIR = path.resolve(process.cwd(), 'learning/pinterest-references');
const COMPLETED_DIR = path.join(LEARNING_DIR, '학습완료');

function moveToCompleted(file: string) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const destDir = path.join(COMPLETED_DIR, today);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const src = path.join(LEARNING_DIR, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.renameSync(src, dest);
  }
}

const ANALYSIS_PROMPT = `당신은 상세페이지(Product Detail Page) 디자인 전문 분석가입니다.

이 이미지는 상세페이지 디자인 레퍼런스입니다. 다음 관점에서 철저하게 분석해주세요:

## 분석 항목

1. **페이지 유형**: 어떤 종류의 페이지인가? (PDP, 랜딩페이지, 브랜드 메인, 카테고리 등)
2. **섹션 구조**: 위에서 아래로 섹션 순서와 각 섹션의 역할
3. **와이어프레임 패턴**:
   - 컬럼 구조 (1-column, 2-column, grid 등)
   - 이미지:텍스트 비율
   - 여백 활용도
4. **타이포그래피**:
   - 헤드라인/서브카피/본문 위계
   - 폰트 스타일 (볼드, 라이트 등)
   - 텍스트 정렬 방식
5. **색상 팔레트**: 주요 색상, 배경색, 강조색
6. **촬영물 분석**:
   - 사진 유형 (누끼컷, 착장컷, 라이프스타일, 디테일 등)
   - 조명 스타일
   - 배경 처리
   - 구도와 앵글
7. **전환 요소**: CTA 버튼, 가격 표시, 리뷰 등
8. **특별히 인상적인 디자인 요소**: 차별화되거나 배울 만한 포인트

## 응답 형식

반드시 아래 JSON 형식으로 응답해주세요:
{
  "pageType": "PDP | Landing | Brand | Category | Other",
  "industry": "패션 | 뷰티 | 식품 | 가전 | 가구 | 아웃도어 | 기타",
  "overallStyle": "미니멀 | 프리미엄 | 캐주얼 | 모던 | 빈티지 | 기타",
  "sections": [
    { "order": 1, "name": "섹션명", "type": "hero|feature|spec|review|cta|gallery|etc", "layout": "레이아웃 설명" }
  ],
  "wireframePatterns": ["패턴1", "패턴2"],
  "typography": { "headline": "설명", "subCopy": "설명", "body": "설명", "alignment": "좌정렬|중앙|혼합" },
  "colorPalette": { "primary": "#hex", "secondary": "#hex", "background": "#hex", "accent": "#hex" },
  "photography": {
    "types": ["누끼컷", "착장컷", "라이프스타일", "디테일"],
    "lighting": "자연광|스튜디오|혼합",
    "background": "화이트|컬러|자연환경|스튜디오세트",
    "composition": "구도 설명"
  },
  "conversionElements": ["요소1", "요소2"],
  "keyInsights": ["핵심 인사이트1", "핵심 인사이트2", "핵심 인사이트3"],
  "applicableToBlocks": ["적용 가능한 WireframeBlock 타입 제안"],
  "qualityScore": 85
}`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = loadApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Ensure learning directory exists
    if (!fs.existsSync(LEARNING_DIR)) {
      fs.mkdirSync(LEARNING_DIR, { recursive: true });
    }

    // Find unprocessed images (only files in root, not in 학습완료 subfolder)
    const allFiles = fs.readdirSync(LEARNING_DIR)
      .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
    const newFiles = allFiles; // All images in root folder are unprocessed

    if (newFiles.length === 0) {
      return NextResponse.json({ message: '새로운 이미지가 없습니다.', processed: 0 });
    }

    const client = new Anthropic({ apiKey });
    const results: any[] = [];

    // Process up to 5 images per batch
    const batch = newFiles.slice(0, 5);

    for (const file of batch) {
      const filePath = path.join(LEARNING_DIR, file);
      const imageData = fs.readFileSync(filePath);
      const base64 = imageData.toString('base64');
      const ext = path.extname(file).toLowerCase();
      const mediaType = ext === '.png' ? 'image/png' :
                        ext === '.webp' ? 'image/webp' :
                        ext === '.gif' ? 'image/gif' : 'image/jpeg';

      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: ANALYSIS_PROMPT }
            ]
          }]
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);

          // Save to DB
          addLearning({
            category: 'pinterest_reference',
            subcategory: analysis.pageType || 'unknown',
            content: JSON.stringify(analysis),
            context: `Pinterest 레퍼런스 학습 - ${file} | ${analysis.industry} | ${analysis.overallStyle}`,
            qualityScore: analysis.qualityScore || 80,
          });

          // Also save specific insights by category
          if (analysis.wireframePatterns?.length > 0) {
            addLearning({
              category: 'wireframe',
              subcategory: 'pinterest_pattern',
              content: JSON.stringify({
                title: `Pinterest 와이어프레임 패턴 - ${analysis.industry}/${analysis.overallStyle}`,
                patterns: analysis.wireframePatterns,
                sections: analysis.sections,
                source: file
              }),
              context: `Pinterest 자동학습 ${new Date().toISOString().split('T')[0]}`,
              qualityScore: analysis.qualityScore || 80,
            });
          }

          if (analysis.photography) {
            addLearning({
              category: 'photography',
              subcategory: 'pinterest_reference',
              content: JSON.stringify({
                title: `Pinterest 촬영 레퍼런스 - ${analysis.industry}`,
                ...analysis.photography,
                colorPalette: analysis.colorPalette,
                source: file
              }),
              context: `Pinterest 자동학습 ${new Date().toISOString().split('T')[0]}`,
              qualityScore: analysis.qualityScore || 80,
            });
          }

          results.push({ file, success: true, pageType: analysis.pageType, industry: analysis.industry });
        }
      } catch (err: any) {
        results.push({ file, success: false, error: err.message });
      }
    }

    // Move successfully processed files to 학습완료/YYYY-MM-DD/ folder
    batch.forEach((file, i) => {
      if (results[i]?.success) {
        moveToCompleted(file);
      }
    });

    return NextResponse.json({
      message: `${results.filter(r => r.success).length}/${batch.length}개 이미지 분석 완료 → 학습완료 폴더로 이동됨`,
      total: allFiles.length,
      newProcessed: results.filter(r => r.success).length,
      remaining: newFiles.length - batch.length,
      results
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: 학습 현황 조회
export async function GET() {
  if (!fs.existsSync(LEARNING_DIR)) {
    return NextResponse.json({ total: 0, processed: 0, pending: 0 });
  }

  // Pending = images in root folder
  const pending = fs.readdirSync(LEARNING_DIR)
    .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));

  // Processed = count images in 학습완료 subfolders
  let processedCount = 0;
  const completedDir = path.join(LEARNING_DIR, '학습완료');
  if (fs.existsSync(completedDir)) {
    const dateFolders = fs.readdirSync(completedDir).filter(f =>
      fs.statSync(path.join(completedDir, f)).isDirectory()
    );
    dateFolders.forEach(folder => {
      const files = fs.readdirSync(path.join(completedDir, folder))
        .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f));
      processedCount += files.length;
    });
  }

  return NextResponse.json({
    total: pending.length + processedCount,
    processed: processedCount,
    pending: pending.length,
    pendingFiles: pending,
    folder: LEARNING_DIR
  });
}
