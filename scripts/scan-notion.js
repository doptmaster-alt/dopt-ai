#!/usr/bin/env node
/**
 * Notion 전체 스캔 & KB 가져오기 스크립트
 * 사용법: node scripts/scan-notion.js
 */

const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');

// .env.local에서 API 키 로드
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const notionMatch = envContent.match(/^NOTION_API_KEY=(.+)$/m);
if (!notionMatch) { console.error('NOTION_API_KEY not found'); process.exit(1); }

const notion = new Client({ auth: notionMatch[1].trim() });
const KB_PATH = path.resolve(process.cwd(), 'knowledge-base.json');

// KB 로드/저장
function loadKB() {
  try { return JSON.parse(fs.readFileSync(KB_PATH, 'utf-8')); } catch { return []; }
}
function saveKB(entries) {
  fs.writeFileSync(KB_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}
function generateId() {
  return `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// 카테고리 자동 판별
function detectCategory(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  if (text.includes('작업의뢰서') || text.includes('작업 의뢰서') || text.includes('의뢰서')) return 'brief';
  if (text.includes('브리프') || text.includes('brief') || text.includes('요청서')) return 'brief';
  if (text.includes('제품 정보') || text.includes('클라이언트 정보')) return 'brief';
  if (text.includes('기획안') || text.includes('기획서') || text.includes('플랜')) return 'plan';
  if (text.includes('스토리보드') || text.includes('컨셉') || text.includes('concept')) return 'plan';
  if (text.includes('구성안') || text.includes('레이아웃') || text.includes('섹션 구성')) return 'plan';
  if (text.includes('촬영') || text.includes('콘티') || text.includes('conti')) return 'conti';
  if (text.includes('스튜디오') || text.includes('소품') || text.includes('앵글')) return 'conti';
  if (text.includes('최종') || text.includes('완성') || text.includes('final')) return 'final';
  if (text.includes('상세페이지') || text.includes('상세 페이지')) return 'final';
  if (text.includes('디자인 가이드') || text.includes('디자인가이드')) return 'final';
  if (text.includes('납품') || text.includes('완료')) return 'final';
  if (text.includes('프로세스') || text.includes('워크플로우') || text.includes('가이드라인')) return 'process';
  if (text.includes('매뉴얼') || text.includes('템플릿') || text.includes('sop')) return 'process';
  return 'reference';
}

// 태그 추출
function extractTags(title, content) {
  const tags = new Set();
  const text = `${title} ${content}`;
  const industries = ['건기식', '건강기능식품', '뷰티', '화장품', '스킨케어', '식품', '패션', '가전', '가구', '인테리어', '반려동물', '육아', '다이어트', '영양제', '헤어', '바디'];
  for (const tag of industries) { if (text.includes(tag)) tags.add(tag); }
  if (text.includes('작업의뢰서') || text.includes('의뢰서')) tags.add('작업의뢰서');
  if (text.includes('브리프')) tags.add('브리프');
  if (text.includes('기획안')) tags.add('기획안');
  if (text.includes('촬영') || text.includes('콘티')) tags.add('촬영콘티');
  if (text.includes('상세페이지')) tags.add('상세페이지');
  if (text.includes('디자인')) tags.add('디자인');
  return [...tags];
}

// 블록 → 텍스트
function blockToText(block) {
  const type = block.type;
  const data = block[type];
  if (!data) return '';
  const richText = data.rich_text || data.text || [];
  const text = richText.map(t => t.plain_text || '').join('');
  switch (type) {
    case 'paragraph': return text;
    case 'heading_1': return `# ${text}`;
    case 'heading_2': return `## ${text}`;
    case 'heading_3': return `### ${text}`;
    case 'bulleted_list_item': return `- ${text}`;
    case 'numbered_list_item': return `1. ${text}`;
    case 'to_do': return `${data.checked ? '[x]' : '[ ]'} ${text}`;
    case 'toggle': return `> ${text}`;
    case 'quote': return `> ${text}`;
    case 'callout': return `> ${text}`;
    case 'divider': return '---';
    case 'table_row': {
      const cells = data.cells?.map(cell => cell.map(t => t.plain_text || '').join('')) || [];
      return `| ${cells.join(' | ')} |`;
    }
    default: return text;
  }
}

// 프로퍼티 값 추출
function extractPropertyValue(prop) {
  if (!prop) return '';
  switch (prop.type) {
    case 'title': return prop.title?.map(t => t.plain_text).join('') || '';
    case 'rich_text': return prop.rich_text?.map(t => t.plain_text).join('') || '';
    case 'number': return prop.number?.toString() || '';
    case 'select': return prop.select?.name || '';
    case 'multi_select': return prop.multi_select?.map(s => s.name).join(', ') || '';
    case 'date': return prop.date?.start || '';
    case 'checkbox': return prop.checkbox ? 'Yes' : 'No';
    case 'url': return prop.url || '';
    case 'email': return prop.email || '';
    case 'status': return prop.status?.name || '';
    default: return '';
  }
}

// 페이지 제목 추출
function getPageTitle(page) {
  if (page.object === 'database') return page.title?.[0]?.plain_text || '(제목 없음)';
  const props = page.properties || {};
  for (const key of Object.keys(props)) {
    if (props[key].type === 'title' && props[key].title?.[0]?.plain_text) {
      return props[key].title[0].plain_text;
    }
  }
  return '(제목 없음)';
}

// 관련성 키워드
const SCAN_KEYWORDS = [
  '상세페이지', '작업의뢰서', '의뢰서', '브리프', 'brief',
  '기획안', '기획서', '촬영콘티', '촬영 콘티', '콘티',
  '디자인가이드', '디자인 가이드', '스토리보드', '랜딩페이지',
];

function relevanceScore(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  let score = 0;
  for (const kw of SCAN_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) score += 10;
  }
  if (text.includes('프로젝트')) score += 3;
  if (text.includes('클라이언트')) score += 3;
  if (text.includes('제품')) score += 2;
  if (text.includes('납품')) score += 5;
  if (text.includes('기획')) score += 5;
  if (text.includes('촬영')) score += 5;
  return score;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('\n🔍 Notion 워크스페이스 전체 스캔 시작...\n');

  // Phase 1: 키워드 검색
  const allPages = new Map();
  const searchKeywords = ['상세페이지', '작업의뢰서', '브리프', '기획안', '촬영콘티', '촬영 콘티', '디자인가이드', '콘티', '의뢰서'];

  for (const kw of searchKeywords) {
    try {
      const res = await notion.search({ query: kw, page_size: 100 });
      let newCount = 0;
      for (const item of res.results) {
        if (!allPages.has(item.id)) { allPages.set(item.id, item); newCount++; }
      }
      console.log(`  🔎 "${kw}" → ${res.results.length}건 (새로운: ${newCount})`);
    } catch (e) { console.error(`  ❌ "${kw}" 검색 실패:`, e.message); }
    await sleep(400);
  }

  // Phase 2: 전체 페이지 수집
  console.log('\n📋 전체 페이지 수집 중...');
  let hasMore = true;
  let cursor = undefined;
  let totalCount = 0;
  while (hasMore && totalCount < 1000) {
    try {
      const res = await notion.search({ page_size: 100, start_cursor: cursor });
      for (const item of res.results) {
        if (!allPages.has(item.id)) allPages.set(item.id, item);
      }
      totalCount += res.results.length;
      hasMore = res.has_more;
      cursor = res.next_cursor;
      process.stdout.write(`  수집: ${totalCount}건...\r`);
    } catch (e) { console.error('전체 검색 오류:', e.message); break; }
    await sleep(400);
  }
  console.log(`\n📊 총 ${allPages.size}개 고유 페이지 발견\n`);

  // Phase 3: 관련성 평가 & 정렬
  const pagesToProcess = [];
  for (const [id, item] of allPages) {
    const title = getPageTitle(item);
    const titleScore = relevanceScore(title, '');
    pagesToProcess.push({ id, item, title, type: item.object, score: titleScore });
  }
  pagesToProcess.sort((a, b) => b.score - a.score);

  // Phase 4: 내용 읽기 & KB 저장
  const entries = loadKB();
  const existingUrls = new Set(entries.map(e => e.sourceUrl));
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let irrelevant = 0;

  console.log('📥 관련 문서 가져오기 시작...\n');

  for (let i = 0; i < pagesToProcess.length; i++) {
    const pg = pagesToProcess[i];
    const cleanId = pg.id.replace(/-/g, '');
    const sourceUrl = `https://www.notion.so/${cleanId}`;

    // 중복 체크
    if (existingUrls.has(sourceUrl)) { skipped++; continue; }

    try {
      let content = '';
      let fullTitle = pg.title;

      if (pg.type === 'database') {
        // 데이터베이스 항목 읽기
        try {
          const dbRes = await notion.databases.query({ database_id: pg.id, page_size: 50 });
          const rows = [];
          for (const row of dbRes.results) {
            const fields = [];
            for (const [key, val] of Object.entries(row.properties || {})) {
              const text = extractPropertyValue(val);
              if (text) fields.push(`${key}: ${text}`);
            }
            if (fields.length > 0) rows.push(fields.join(' | '));
          }
          content = rows.join('\n');
        } catch (e) { content = ''; }
      } else {
        // 페이지 블록 읽기
        try {
          const page = await notion.pages.retrieve({ page_id: pg.id });
          const props = page.properties || {};
          for (const k of Object.keys(props)) {
            if (props[k].type === 'title' && props[k].title?.[0]?.plain_text) {
              fullTitle = props[k].title[0].plain_text;
              break;
            }
          }
        } catch {}

        try {
          const blocks = await notion.blocks.children.list({ block_id: pg.id, page_size: 100 });
          content = blocks.results.map(b => blockToText(b)).filter(Boolean).join('\n');
        } catch (e) {
          content = '';
        }
      }

      // 관련성 재평가
      const finalScore = relevanceScore(fullTitle, content);
      if (finalScore === 0) { irrelevant++; continue; }

      // 카테고리 & 태그
      const category = detectCategory(fullTitle, content);
      const tags = extractTags(fullTitle, content);

      // KB에 저장
      const entry = {
        id: generateId(),
        category,
        title: fullTitle,
        content: content.slice(0, 50000),
        source: 'notion',
        sourceUrl,
        tags,
        createdAt: new Date().toISOString(),
      };
      entries.push(entry);
      existingUrls.add(sourceUrl);
      imported++;

      const catLabel = { brief: '브리프', plan: '기획안', conti: '촬영콘티', final: '최종산출물', process: '프로세스', reference: '레퍼런스' };
      console.log(`  ✅ [${catLabel[category] || category}] ${fullTitle}`);

      // 매 10건마다 저장
      if (imported % 10 === 0) {
        saveKB(entries);
        process.stdout.write(`  💾 중간 저장 (${imported}건)...\n`);
      }

    } catch (e) {
      errors++;
      if (errors <= 5) console.error(`  ❌ ${pg.title}: ${e.message}`);
    }

    // Rate limit
    await sleep(400);

    // 진행률
    if ((i + 1) % 50 === 0) {
      console.log(`\n  📊 진행: ${i + 1}/${pagesToProcess.length} (가져옴: ${imported}, 건너뜀: ${skipped}, 비관련: ${irrelevant})\n`);
    }
  }

  // 최종 저장
  saveKB(entries);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Notion 스캔 완료!');
  console.log('='.repeat(60));
  console.log(`  📊 발견된 페이지: ${allPages.size}개`);
  console.log(`  ✅ 새로 가져온 문서: ${imported}건`);
  console.log(`  ⏭️  이미 존재: ${skipped}건`);
  console.log(`  🔘 비관련 문서: ${irrelevant}건`);
  console.log(`  ❌ 오류: ${errors}건`);
  console.log(`  📁 KB 총 항목: ${entries.length}건`);
  console.log('='.repeat(60) + '\n');

  // 카테고리별 통계
  const catCount = {};
  for (const e of entries) {
    catCount[e.category] = (catCount[e.category] || 0) + 1;
  }
  console.log('📂 카테고리별 통계:');
  const catLabels = { brief: '브리프', plan: '기획안', conti: '촬영콘티', final: '최종산출물', process: '프로세스', reference: '레퍼런스' };
  for (const [cat, count] of Object.entries(catCount)) {
    console.log(`  ${catLabels[cat] || cat}: ${count}건`);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
