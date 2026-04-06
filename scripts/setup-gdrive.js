#!/usr/bin/env node
/**
 * Google Drive 연동 설정 도우미
 * 사용법: node scripts/setup-gdrive.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Google Drive 연동 설정 도우미');
  console.log('='.repeat(60));

  console.log('\n이 스크립트는 Google Drive API 연동을 설정합니다.');
  console.log('서비스 계정(Service Account) 방식을 사용합니다.\n');

  // Step 1: 서비스 계정 JSON 파일 확인
  console.log('📋 Step 1: 서비스 계정 JSON 키 파일 준비');
  console.log('─'.repeat(50));
  console.log('아직 서비스 계정이 없다면:');
  console.log('  1. https://console.cloud.google.com 접속');
  console.log('  2. 프로젝트 선택 또는 새로 생성');
  console.log('  3. 좌측 메뉴 "API 및 서비스" → "라이브러리"');
  console.log('  4. "Google Drive API" 검색 → "사용" 클릭');
  console.log('  5. 좌측 "사용자 인증 정보" → "+ 사용자 인증 정보 만들기"');
  console.log('  6. "서비스 계정" 선택 → 이름 입력 → "만들기"');
  console.log('  7. 생성된 서비스 계정 클릭 → "키" 탭');
  console.log('  8. "키 추가" → "새 키 만들기" → "JSON" → 다운로드');
  console.log('');

  const keyPath = await ask('다운로드한 JSON 키 파일 경로를 입력하세요\n(드래그앤드롭 가능): ');
  const cleanPath = keyPath.trim().replace(/^['"]|['"]$/g, '');

  if (!cleanPath) {
    console.log('\n⚠️  파일 경로가 비어있습니다. 나중에 다시 실행해주세요.');
    rl.close();
    return;
  }

  const resolvedPath = path.resolve(cleanPath);
  if (!fs.existsSync(resolvedPath)) {
    console.log(`\n❌ 파일을 찾을 수 없습니다: ${resolvedPath}`);
    rl.close();
    return;
  }

  // JSON 키 파일 검증
  let keyFile;
  try {
    keyFile = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
    if (!keyFile.client_email || !keyFile.private_key) {
      throw new Error('client_email 또는 private_key가 없습니다.');
    }
  } catch (e) {
    console.log(`\n❌ 유효한 서비스 계정 JSON 파일이 아닙니다: ${e.message}`);
    rl.close();
    return;
  }

  console.log(`\n✅ 서비스 계정 확인: ${keyFile.client_email}`);

  // 프로젝트 루트로 복사
  const targetPath = path.resolve(process.cwd(), 'google-service-account.json');
  fs.copyFileSync(resolvedPath, targetPath);
  console.log(`📁 키 파일 복사: ${targetPath}`);

  // .gitignore에 추가
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignore.includes('google-service-account.json')) {
      fs.appendFileSync(gitignorePath, '\n# Google Service Account Key\ngoogle-service-account.json\n');
      console.log('🔒 .gitignore에 추가됨');
    }
  }

  // .env.local에 추가
  const envPath = path.resolve(process.cwd(), '.env.local');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  if (!envContent.includes('GOOGLE_SERVICE_ACCOUNT_KEY')) {
    envContent += '\n# Google Drive\nGOOGLE_SERVICE_ACCOUNT_KEY=./google-service-account.json\n';
    fs.writeFileSync(envPath, envContent);
    console.log('📝 .env.local에 GOOGLE_SERVICE_ACCOUNT_KEY 추가됨');
  }

  // Step 2: 폴더 공유 안내
  console.log('\n📋 Step 2: Google Drive 폴더 공유');
  console.log('─'.repeat(50));
  console.log(`Google Drive에서 스캔하고 싶은 폴더를 열고,`);
  console.log(`"공유" 버튼을 눌러 다음 이메일을 추가해주세요:\n`);
  console.log(`  📧 ${keyFile.client_email}\n`);
  console.log('권한: "뷰어" (읽기만 필요)');
  console.log('');

  const ready = await ask('폴더를 공유했나요? (y/n): ');
  if (ready.toLowerCase() !== 'y') {
    console.log('\n폴더를 공유한 후 다음 명령어로 스캔을 시작할 수 있습니다:');
    console.log('  node scripts/scan-gdrive.js');
    console.log('\n또는 웹에서: http://localhost:3100/knowledge → "Google Drive 스캔" 버튼');
    rl.close();
    return;
  }

  // Step 3: 폴더 ID 입력 (선택)
  console.log('\n📋 Step 3: 폴더 ID (선택사항)');
  console.log('─'.repeat(50));
  console.log('특정 폴더만 스캔하려면 폴더 ID를 입력하세요.');
  console.log('폴더 URL 예시: https://drive.google.com/drive/folders/ABC123...');
  console.log('위에서 "ABC123..." 부분이 폴더 ID입니다.');
  console.log('비워두면 공유된 모든 파일에서 키워드 검색합니다.\n');

  const folderId = await ask('폴더 ID (비워두면 전체 검색): ');

  console.log('\n🚀 연동 테스트 중...');

  // 연결 테스트
  try {
    const { google } = require('googleapis');
    const auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });

    const conditions = ['trashed = false'];
    if (folderId.trim()) conditions.push(`'${folderId.trim()}' in parents`);

    const res = await drive.files.list({
      q: conditions.join(' and '),
      pageSize: 5,
      fields: 'files(id, name, mimeType)',
    });

    const files = res.data.files || [];
    if (files.length > 0) {
      console.log(`\n✅ 연결 성공! ${files.length}개 파일 접근 가능:`);
      files.forEach((f, i) => console.log(`  [${i+1}] ${f.name} (${f.mimeType})`));
    } else {
      console.log('\n⚠️  접근 가능한 파일이 없습니다.');
      console.log('   Google Drive에서 폴더를 서비스 계정 이메일로 공유했는지 확인해주세요.');
    }
  } catch (e) {
    console.log(`\n❌ 연결 테스트 실패: ${e.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('설정 완료! 다음 명령어로 스캔을 시작하세요:');
  console.log(`  node scripts/scan-gdrive.js${folderId.trim() ? ' ' + folderId.trim() : ''}`);
  console.log('\n또는 웹에서: http://localhost:3100/knowledge → "Google Drive 스캔" 버튼');
  console.log('='.repeat(60) + '\n');

  rl.close();
}

main().catch(e => {
  console.error('오류:', e.message);
  rl.close();
  process.exit(1);
});
