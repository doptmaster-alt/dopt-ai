#!/usr/bin/env node
/**
 * Google Drive 전체 스캔 & KB 가져오기 스크립트
 * 사용법: node scripts/scan-gdrive.js [폴더ID]
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const os = require('os');
const officeparser = require('officeparser');

// .env.local에서 환경변수 로드
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
function getEnv(key) {
  const m = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m ? m[1].trim() : process.env[key];
}

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

// 인증 설정
function getAuth() {
  // 방법 1: JSON 키 파일
  const keyFilePath = getEnv('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (keyFilePath) {
    const resolved = path.isAbsolute(keyFilePath) ? keyFilePath : path.resolve(process.cwd(), keyFilePath);
    if (fs.existsSync(resolved)) {
      const keyFile = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
      return new google.auth.JWT({
        email: keyFile.client_email,
        key: keyFile.private_key,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });
    }
  }

  // 방법 2: 이메일 + 키
  const email = getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = getEnv('GOOGLE_PRIVATE_KEY');
  if (email && privateKey) {
    return new google.auth.JWT({
      email,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  }

  // 방법 3: OAuth2
  const clientId = getEnv('GOOGLE_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET');
  const refreshToken = getEnv('GOOGLE_REFRESH_TOKEN');
  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }

  throw new Error(
    'Google Drive 인증 정보가 없습니다.\n' +
    '.env.local에 다음 중 하나를 설정해주세요:\n\n' +
    '방법 1 (서비스 계정 - 가장 쉬움):\n' +
    '  GOOGLE_SERVICE_ACCOUNT_KEY=./google-service-account.json\n\n' +
    '방법 2 (서비스 계정 직접 입력):\n' +
    '  GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com\n' +
    '  GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\n\n' +
    '방법 3 (OAuth2):\n' +
    '  GOOGLE_CLIENT_ID=xxx\n' +
    '  GOOGLE_CLIENT_SECRET=xxx\n' +
    '  GOOGLE_REFRESH_TOKEN=xxx'
  );
}

// 카테고리 판별
function detectCategory(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  if (text.includes('작업의뢰서') || text.includes('의뢰서')) return 'brief';
  if (text.includes('브리프') || text.includes('brief') || text.includes('요청서')) return 'brief';
  if (text.includes('기획안') || text.includes('기획서')) return 'plan';
  if (text.includes('스토리보드') || text.includes('컨셉') || text.includes('구성안')) return 'plan';
  if (text.includes('촬영') || text.includes('콘티')) return 'conti';
  if (text.includes('최종') || text.includes('완성') || text.includes('final')) return 'final';
  if (text.includes('상세페이지') || text.includes('디자인가이드')) return 'final';
  if (text.includes('프로세스') || text.includes('가이드라인') || text.includes('매뉴얼')) return 'process';
  return 'reference';
}

// 태그 추출
function extractTags(title, content) {
  const tags = new Set();
  const text = `${title} ${content}`;
  const kws = ['건기식', '뷰티', '화장품', '스킨케어', '식품', '패션', '가전', '다이어트', '영양제'];
  for (const t of kws) { if (text.includes(t)) tags.add(t); }
  if (text.includes('작업의뢰서')) tags.add('작업의뢰서');
  if (text.includes('브리프')) tags.add('브리프');
  if (text.includes('기획안')) tags.add('기획안');
  if (text.includes('촬영') || text.includes('콘티')) tags.add('촬영콘티');
  if (text.includes('상세페이지')) tags.add('상세페이지');
  if (text.includes('디자인')) tags.add('디자인');
  return [...tags];
}

// 관련성 점수
const KEYWORDS = ['상세페이지', '작업의뢰서', '의뢰서', '브리프', '기획안', '촬영콘티', '콘티', '디자인가이드', '기획', '촬영', '디자인'];
function relevanceScore(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  let score = 0;
  for (const kw of KEYWORDS) { if (text.includes(kw)) score += 10; }
  if (text.includes('프로젝트')) score += 3;
  if (text.includes('클라이언트')) score += 3;
  return score;
}

// 읽기 가능한 MIME 타입 (Google Workspace + 텍스트)
const GOOGLE_TYPES = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
];
const TEXT_TYPES = ['text/plain', 'text/csv', 'text/markdown', 'text/html', 'application/json'];

// 바이너리 파일 파싱 가능한 MIME 타입
const BINARY_PARSEABLE_TYPES = [
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',   // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',         // XLSX
  'application/vnd.ms-excel',                                                   // XLS
  'application/pdf',                                                            // PDF
  'application/haansoftpptx',                                                   // 한컴 PPTX
  'application/haansoftdocx',                                                   // 한컴 DOCX
];

const ALL_READABLE_TYPES = [...GOOGLE_TYPES, ...TEXT_TYPES, ...BINARY_PARSEABLE_TYPES];

const TYPE_LABELS = {
  'application/vnd.google-apps.document': 'Google Docs',
  'application/vnd.google-apps.spreadsheet': 'Google Sheets',
  'application/vnd.google-apps.presentation': 'Google Slides',
  'application/vnd.google-apps.folder': '폴더',
  'text/plain': '텍스트',
  'text/csv': 'CSV',
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-excel': 'XLS',
  'application/haansoftpptx': '한컴 PPTX',
  'application/haansoftdocx': '한컴 DOCX',
};

// 임시 디렉토리
const TEMP_DIR = path.join(os.tmpdir(), 'diopt-gdrive-scan');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// MIME → 확장자 매핑
const MIME_TO_EXT = {
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'application/pdf': '.pdf',
  'application/haansoftpptx': '.pptx',
  'application/haansoftdocx': '.docx',
};

// 바이너리 파일 다운로드
async function downloadFile(drive, fileId, mimeType) {
  const ext = MIME_TO_EXT[mimeType] || path.extname(fileId) || '.bin';
  const filePath = path.join(TEMP_DIR, `${fileId}${ext}`);
  const dest = fs.createWriteStream(filePath);

  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    res.data
      .on('end', () => resolve(filePath))
      .on('error', reject)
      .pipe(dest);
  });
}

// 바이너리 파일에서 텍스트 추출
async function extractTextFromFile(filePath, mimeType) {
  try {
    // officeparser로 PPTX, DOCX, XLSX, PDF 모두 처리
    const result = await officeparser.parseOffice(filePath);
    const text = typeof result === 'string' ? result : (result ? String(result) : '');
    return text;
  } catch (e) {
    // officeparser 실패 시 pdf-parse로 PDF 재시도
    if (mimeType === 'application/pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        return data.text || '';
      } catch { return ''; }
    }
    return '';
  }
}

// 임시 파일 정리
function cleanupTempFile(filePath) {
  try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const folderId = process.argv[2]; // 선택적 폴더 ID

  console.log('\n📁 Google Drive 스캔 시작...\n');

  let auth;
  try {
    auth = getAuth();
  } catch (e) {
    console.error('❌ ' + e.message);
    console.log('\n📋 Google Drive 서비스 계정 설정 가이드:');
    console.log('─'.repeat(50));
    console.log('1. https://console.cloud.google.com 접속');
    console.log('2. 프로젝트 선택 또는 새 프로젝트 생성');
    console.log('3. "API 및 서비스" → "라이브러리"에서 "Google Drive API" 활성화');
    console.log('4. "API 및 서비스" → "사용자 인증 정보" → "서비스 계정 만들기"');
    console.log('5. 서비스 계정 생성 후 "키" 탭에서 JSON 키 생성/다운로드');
    console.log('6. 다운로드한 JSON 파일을 프로젝트 루트에 저장');
    console.log('7. .env.local에 추가:');
    console.log('   GOOGLE_SERVICE_ACCOUNT_KEY=./google-service-account.json');
    console.log('8. Google Drive에서 공유할 폴더를 서비스 계정 이메일로 공유');
    console.log('   (서비스 계정 이메일: JSON 파일의 client_email 값)');
    console.log('─'.repeat(50));
    process.exit(1);
  }

  const drive = google.drive({ version: 'v3', auth });

  // Phase 1: 파일명 키워드 검색으로 파일 찾기
  const allFiles = new Map();
  const searchTerms = ['상세', '기획', '브리프', '콘티', '촬영', '의뢰', '디자인', '가이드', '레퍼런스', '최종'];

  for (const term of searchTerms) {
    try {
      let pageToken;
      let count = 0;
      do {
        const res = await drive.files.list({
          q: `name contains '${term}' and trashed = false`,
          pageSize: 100,
          pageToken,
          fields: 'nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime)',
          orderBy: 'modifiedTime desc',
        });

        for (const file of res.data.files || []) {
          if (!allFiles.has(file.id)) allFiles.set(file.id, file);
        }
        count += (res.data.files || []).length;
        pageToken = res.data.nextPageToken;
      } while (pageToken && count < 300);

      console.log(`  🔎 "${term}" → ${count}건`);
    } catch (e) {
      console.error(`  ❌ "${term}" 검색 실패: ${e.message}`);
    }
    await sleep(300);
  }

  // Phase 2: 전체 파일도 가져오기 (공유된 모든 파일)
  console.log('\n📂 전체 공유 파일 수집 중...');
  let totalScanned = 0;
  try {
    let pageToken;
    do {
      const res = await drive.files.list({
        q: 'trashed = false',
        pageSize: 100,
        pageToken,
        fields: 'nextPageToken, files(id, name, mimeType, webViewLink, modifiedTime)',
        orderBy: 'modifiedTime desc',
      });
      for (const file of res.data.files || []) {
        if (!allFiles.has(file.id)) allFiles.set(file.id, file);
      }
      totalScanned += (res.data.files || []).length;
      pageToken = res.data.nextPageToken;
      process.stdout.write(`  수집: ${totalScanned}건...\r`);
      await sleep(300);
    } while (pageToken && totalScanned < 2000);
  } catch (e) {
    console.error(`전체 파일 수집 오류: ${e.message}`);
  }

  console.log(`\n📊 총 ${allFiles.size}개 고유 파일 발견\n`);

  // Phase 3: 읽기 가능한 파일만 필터링
  const readableFiles = [];
  const unreadableTypes = {};
  for (const [id, file] of allFiles) {
    if (ALL_READABLE_TYPES.includes(file.mimeType)) {
      readableFiles.push(file);
    } else if (file.mimeType !== 'application/vnd.google-apps.folder') {
      unreadableTypes[file.mimeType] = (unreadableTypes[file.mimeType] || 0) + 1;
    }
  }

  // 분류 통계
  const googleCount = readableFiles.filter(f => GOOGLE_TYPES.includes(f.mimeType)).length;
  const textCount = readableFiles.filter(f => TEXT_TYPES.includes(f.mimeType)).length;
  const binaryCount = readableFiles.filter(f => BINARY_PARSEABLE_TYPES.includes(f.mimeType)).length;

  console.log(`📄 읽기 가능한 파일: ${readableFiles.length}개`);
  console.log(`   Google Workspace: ${googleCount}개 (Docs/Sheets/Slides)`);
  console.log(`   텍스트 파일: ${textCount}개`);
  console.log(`   바이너리 파싱: ${binaryCount}개 (PPTX/DOCX/XLSX/PDF)`);
  if (Object.keys(unreadableTypes).length > 0) {
    console.log('⏭️  건너뛸 파일 타입:');
    for (const [type, count] of Object.entries(unreadableTypes)) {
      console.log(`   ${TYPE_LABELS[type] || type}: ${count}개`);
    }
  }

  // Phase 4: 내용 읽기 & KB 저장
  const entries = loadKB();
  const existingUrls = new Set(entries.map(e => e.sourceUrl));
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let irrelevant = 0;

  console.log('\n📥 관련 문서 가져오기 시작...\n');

  for (let i = 0; i < readableFiles.length; i++) {
    const file = readableFiles[i];
    const fileUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}`;

    // 중복 체크
    if (existingUrls.has(fileUrl)) { skipped++; continue; }

    try {
      let content = '';
      let tempFilePath = null;

      if (file.mimeType === 'application/vnd.google-apps.document') {
        const res = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' });
        content = res.data || '';
      } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
        const res = await drive.files.export({ fileId: file.id, mimeType: 'text/csv' });
        content = res.data || '';
      } else if (file.mimeType === 'application/vnd.google-apps.presentation') {
        const res = await drive.files.export({ fileId: file.id, mimeType: 'text/plain' });
        content = res.data || '';
      } else if (BINARY_PARSEABLE_TYPES.includes(file.mimeType)) {
        // 바이너리 파일: 다운로드 후 텍스트 추출
        try {
          tempFilePath = await downloadFile(drive, file.id, file.mimeType);
          content = await extractTextFromFile(tempFilePath, file.mimeType);
        } catch (dlErr) {
          if (errors < 10) console.error(`  ⚠️  다운로드 실패: ${file.name}: ${dlErr.message}`);
          errors++;
          continue;
        } finally {
          if (tempFilePath) cleanupTempFile(tempFilePath);
        }
      } else {
        // 일반 텍스트 파일
        const res = await drive.files.get({ fileId: file.id, alt: 'media' });
        content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      }

      // content가 string인지 확인
      if (typeof content !== 'string') {
        content = content ? String(content) : '';
      }
      if (!content || content.length < 10) continue;

      // 관련성 평가
      const score = relevanceScore(file.name, content);
      if (score === 0) { irrelevant++; continue; }

      const category = detectCategory(file.name, content);
      const tags = extractTags(file.name, content);

      const entry = {
        id: generateId(),
        category,
        title: file.name,
        content: content.substring(0, 50000),
        source: 'gdrive',
        sourceUrl: fileUrl,
        tags,
        createdAt: new Date().toISOString(),
      };
      entries.push(entry);
      existingUrls.add(fileUrl);
      imported++;

      const catLabel = { brief: '브리프', plan: '기획안', conti: '촬영콘티', final: '최종산출물', process: '프로세스', reference: '레퍼런스' };
      const typeLabel = TYPE_LABELS[file.mimeType] || file.mimeType;
      console.log(`  ✅ [${catLabel[category] || category}] [${typeLabel}] ${file.name}`);

      // 매 10건마다 저장
      if (imported % 10 === 0) {
        saveKB(entries);
        console.log(`  💾 중간 저장 (${imported}건)`);
      }

    } catch (e) {
      errors++;
      if (errors <= 10) console.error(`  ❌ ${file.name}: ${e.message}`);
    }

    await sleep(300); // Rate limit
  }

  // 최종 저장
  saveKB(entries);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Google Drive 스캔 완료!');
  console.log('='.repeat(60));
  console.log(`  📊 발견된 파일: ${allFiles.size}개`);
  console.log(`  📄 읽기 가능: ${readableFiles.length}개`);
  console.log(`  ✅ 새로 가져옴: ${imported}건`);
  console.log(`  ⏭️  이미 존재: ${skipped}건`);
  console.log(`  🔘 비관련: ${irrelevant}건`);
  console.log(`  ❌ 오류: ${errors}건`);
  console.log(`  📁 KB 총 항목: ${entries.length}건`);
  console.log('='.repeat(60) + '\n');
}

main().catch(e => {
  console.error('Fatal error:', e.message || e);
  process.exit(1);
});
