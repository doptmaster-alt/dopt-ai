#!/usr/bin/env node
/**
 * Figma 전체 스캔 & KB 가져오기 스크립트
 * 팀의 모든 프로젝트 → 파일 → 페이지/프레임 구조 + 텍스트 추출
 */

const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
const token = envContent.match(/^FIGMA_API_KEY=(.+)$/m)[1].trim();
const headers = { 'X-Figma-Token': token };
const KB_PATH = path.resolve(process.cwd(), 'knowledge-base.json');

function loadKB() { try { return JSON.parse(fs.readFileSync(KB_PATH, 'utf-8')); } catch { return []; } }
function saveKB(entries) { fs.writeFileSync(KB_PATH, JSON.stringify(entries, null, 2), 'utf-8'); }
function generateId() { return `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 카테고리 판별
function detectCategory(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  if (text.includes('작업의뢰서') || text.includes('의뢰서')) return 'brief';
  if (text.includes('브리프') || text.includes('brief')) return 'brief';
  if (text.includes('기획안') || text.includes('기획서')) return 'plan';
  if (text.includes('스토리보드') || text.includes('컨셉') || text.includes('구성안')) return 'plan';
  if (text.includes('촬영') || text.includes('콘티') || text.includes('conti')) return 'conti';
  if (text.includes('스튜디오') || text.includes('매뉴얼')) return 'conti';
  if (text.includes('최종') || text.includes('완성') || text.includes('final')) return 'final';
  if (text.includes('상세페이지') || text.includes('디자인가이드') || text.includes('디자인 가이드')) return 'final';
  if (text.includes('pdp') || text.includes('상세')) return 'final';
  if (text.includes('제안서') || text.includes('포트폴리오')) return 'reference';
  if (text.includes('피드백') || text.includes('수정')) return 'process';
  return 'reference';
}

// 태그 추출
function extractTags(title, content) {
  const tags = new Set();
  const text = `${title} ${content}`;
  const kws = ['건기식', '뷰티', '화장품', '식품', '패션', '가전', '다이어트', '영양제', '패키지'];
  for (const t of kws) { if (text.includes(t)) tags.add(t); }
  if (text.includes('상세페이지') || text.includes('PDP') || text.includes('pdp')) tags.add('상세페이지');
  if (text.includes('촬영') || text.includes('콘티')) tags.add('촬영콘티');
  if (text.includes('디자인')) tags.add('디자인');
  if (text.includes('기획')) tags.add('기획');
  if (text.includes('제안서')) tags.add('제안서');
  if (text.includes('인스타') || text.includes('IG')) tags.add('SNS');
  tags.add('figma');
  return [...tags];
}

// 관련성 점수
function relevanceScore(title) {
  const text = title.toLowerCase();
  let score = 0;
  const keywords = ['상세', '기획', '브리프', '콘티', '촬영', '의뢰', '디자인', '가이드', '최종', 'pdp', '제안', '패키지', '피드백'];
  for (const kw of keywords) { if (text.includes(kw)) score += 10; }
  // 거의 모든 Figma 파일은 디자인 관련이므로 기본 점수 부여
  score += 5;
  return score;
}

// Figma API 호출
async function figmaFetch(endpoint) {
  const res = await fetch(`https://api.figma.com/v1${endpoint}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Figma API (${res.status}): ${text.substring(0, 200)}`);
  }
  return res.json();
}

// 노드에서 텍스트 추출 (재귀)
function extractTexts(node, texts = [], depth = 0) {
  if (depth > 5) return texts; // 너무 깊이 들어가지 않기

  if (node.type === 'TEXT' && node.characters) {
    texts.push(node.characters);
  }

  // 프레임/그룹 이름도 유용한 정보
  if (['FRAME', 'SECTION', 'COMPONENT', 'COMPONENT_SET'].includes(node.type) && node.name) {
    texts.push(`[${node.type}] ${node.name}`);
  }

  if (node.children) {
    for (const child of node.children) {
      extractTexts(child, texts, depth + 1);
    }
  }

  return texts;
}

// 파일 구조를 텍스트로 변환
function fileToText(fileData, depth = 2) {
  let result = `# ${fileData.name}\n`;
  result += `마지막 수정: ${fileData.lastModified}\n\n`;

  if (!fileData.document || !fileData.document.children) return result;

  for (const page of fileData.document.children) {
    result += `## 📄 ${page.name}\n`;

    if (page.children) {
      for (const frame of page.children.slice(0, 30)) {
        const size = frame.absoluteBoundingBox
          ? `${Math.round(frame.absoluteBoundingBox.width)}x${Math.round(frame.absoluteBoundingBox.height)}`
          : '';
        result += `- ${frame.type}: ${frame.name} ${size ? `(${size})` : ''}\n`;

        // 하위 요소 텍스트 추출
        const texts = extractTexts(frame);
        if (texts.length > 0) {
          const uniqueTexts = [...new Set(texts)].slice(0, 50); // 중복 제거, 최대 50개
          for (const t of uniqueTexts) {
            if (t.length > 3) { // 너무 짧은 텍스트 제외
              result += `    "${t.substring(0, 200)}"\n`;
            }
          }
        }
      }
      if (page.children.length > 30) {
        result += `... 외 ${page.children.length - 30}개 요소\n`;
      }
    }
    result += '\n';
  }

  return result;
}

async function main() {
  console.log('\n🎨 Figma 전체 스캔 시작...\n');

  const teamIds = [
    { id: '1602571060488240908', name: 'Tei HA의 팀' },
    { id: '1481927646906094974', name: '디옵트프로 team' },
  ];

  // Phase 1: 모든 프로젝트 & 파일 목록 수집
  const allFiles = [];

  for (const team of teamIds) {
    console.log(`\n📁 팀: ${team.name}`);
    try {
      const projData = await figmaFetch(`/teams/${team.id}/projects`);
      if (!projData.projects) { console.log('  프로젝트 없음'); continue; }

      for (const proj of projData.projects) {
        console.log(`  📂 ${proj.name}`);
        try {
          const filesData = await figmaFetch(`/projects/${proj.id}/files`);
          if (filesData.files) {
            for (const f of filesData.files) {
              allFiles.push({
                key: f.key,
                name: f.name,
                lastModified: f.last_modified,
                project: proj.name,
                team: team.name,
              });
            }
            console.log(`     → ${filesData.files.length}개 파일`);
          }
        } catch (e) { console.log(`     파일 목록 오류: ${e.message}`); }
        await sleep(300);
      }
    } catch (e) { console.log(`  팀 프로젝트 오류: ${e.message}`); }
  }

  console.log(`\n📊 총 ${allFiles.length}개 파일 발견\n`);

  // Phase 2: 각 파일의 구조 + 텍스트 읽기 → KB 저장
  const entries = loadKB();
  const existingUrls = new Set(entries.map(e => e.sourceUrl));
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  console.log('📥 파일 분석 및 가져오기 시작...\n');

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i];
    const sourceUrl = `https://www.figma.com/design/${file.key}`;

    // 중복 체크
    if (existingUrls.has(sourceUrl)) { skipped++; continue; }

    try {
      // depth=3으로 충분한 구조 + 텍스트 가져오기 (depth 높으면 API 느려짐)
      const fileData = await figmaFetch(`/files/${file.key}?depth=3`);

      const content = fileToText(fileData);

      if (content.length < 50) continue; // 빈 파일 건너뛰기

      const category = detectCategory(file.name, content);
      const tags = extractTags(file.name, content);

      const entry = {
        id: generateId(),
        category,
        title: `[Figma] ${file.name}`,
        content: content.substring(0, 50000),
        source: 'figma',
        sourceUrl,
        tags,
        createdAt: new Date().toISOString(),
      };
      entries.push(entry);
      existingUrls.add(sourceUrl);
      imported++;

      const catLabel = { brief: '브리프', plan: '기획안', conti: '촬영콘티', final: '최종산출물', process: '프로세스', reference: '레퍼런스' };
      console.log(`  ✅ [${catLabel[category] || category}] ${file.name} (${file.project})`);

      if (imported % 10 === 0) {
        saveKB(entries);
        console.log(`  💾 중간 저장 (${imported}건)`);
      }

    } catch (e) {
      errors++;
      if (errors <= 10) console.error(`  ❌ ${file.name}: ${e.message.substring(0, 100)}`);
    }

    // Figma API Rate Limit (30 req/min for personal tokens)
    await sleep(2200); // ~27 req/min으로 안전하게

    // 진행률
    if ((i + 1) % 20 === 0) {
      console.log(`\n  📊 진행: ${i + 1}/${allFiles.length} (가져옴: ${imported}, 건너뜀: ${skipped}, 오류: ${errors})\n`);
    }
  }

  // 최종 저장
  saveKB(entries);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Figma 스캔 완료!');
  console.log('='.repeat(60));
  console.log(`  📊 발견된 파일: ${allFiles.length}개`);
  console.log(`  ✅ 새로 가져옴: ${imported}건`);
  console.log(`  ⏭️  이미 존재: ${skipped}건`);
  console.log(`  ❌ 오류: ${errors}건`);
  console.log(`  📁 KB 총 항목: ${entries.length}건`);
  console.log('='.repeat(60));

  // 카테고리별 통계
  const catCount = {};
  for (const e of entries) { catCount[e.category] = (catCount[e.category] || 0) + 1; }
  console.log('\n📂 카테고리별 통계:');
  const catLabels = { brief: '브리프', plan: '기획안', conti: '촬영콘티', final: '최종산출물', process: '프로세스', reference: '레퍼런스' };
  for (const [cat, count] of Object.entries(catCount)) {
    console.log(`  ${catLabels[cat] || cat}: ${count}건`);
  }

  const srcCount = {};
  for (const e of entries) { srcCount[e.source] = (srcCount[e.source] || 0) + 1; }
  console.log('\n📂 출처별 통계:');
  for (const [src, count] of Object.entries(srcCount)) {
    console.log(`  ${src}: ${count}건`);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
