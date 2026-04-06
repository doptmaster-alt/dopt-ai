import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Hiworks에서 추출한 이메일 데이터를 저장
const DATA_DIR = path.join(process.cwd(), 'data');
const EMAIL_SAMPLES_FILE = path.join(DATA_DIR, 'email-samples.json');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { emails } = body;

  if (!emails || !Array.isArray(emails)) {
    return NextResponse.json({ error: 'emails 배열이 필요합니다.' }, { status: 400, headers: CORS_HEADERS });
  }

  // data 디렉토리 생성
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 기존 데이터 로드
  let existing: any[] = [];
  try {
    if (fs.existsSync(EMAIL_SAMPLES_FILE)) {
      existing = JSON.parse(fs.readFileSync(EMAIL_SAMPLES_FILE, 'utf-8'));
    }
  } catch {}

  // 새 데이터 추가 (중복 제거)
  const merged = [...existing];
  for (const email of emails) {
    const dup = merged.find(e => e.subject === email.subject && e.body === email.body);
    if (!dup) merged.push(email);
  }

  fs.writeFileSync(EMAIL_SAMPLES_FILE, JSON.stringify(merged, null, 2), 'utf-8');

  return NextResponse.json(
    { success: true, total: merged.length, added: merged.length - existing.length },
    { headers: CORS_HEADERS }
  );
}

export async function GET() {
  try {
    if (fs.existsSync(EMAIL_SAMPLES_FILE)) {
      const data = JSON.parse(fs.readFileSync(EMAIL_SAMPLES_FILE, 'utf-8'));
      return NextResponse.json(data, { headers: CORS_HEADERS });
    }
  } catch {}
  return NextResponse.json([], { headers: CORS_HEADERS });
}
