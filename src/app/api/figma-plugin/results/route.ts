import { NextRequest, NextResponse } from 'next/server';
import { reportResults } from '@/lib/figma-queue';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// 플러그인이 명령 실행 결과를 보고
export async function POST(req: NextRequest) {
  const { results } = await req.json();
  reportResults(results);
  return NextResponse.json({ success: true }, { headers: corsHeaders });
}
