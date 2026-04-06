import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsername, registerUser } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { username, password, name } = await req.json();

  if (!username || !password || !name) {
    return NextResponse.json({ error: '모든 항목을 입력해주세요.' }, { status: 400 });
  }

  if (username.length < 3) {
    return NextResponse.json({ error: '아이디는 3자 이상이어야 합니다.' }, { status: 400 });
  }

  if (password.length < 4) {
    return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다.' }, { status: 400 });
  }

  const existing = findUserByUsername(username);
  if (existing) {
    return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });
  }

  try {
    registerUser(username, password, name);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '가입 신청 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
