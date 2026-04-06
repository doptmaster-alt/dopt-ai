import { NextResponse } from 'next/server';
import { getAndClearCommands, updatePollTime } from '@/lib/figma-queue';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// 플러그인이 주기적으로 호출하여 대기 중인 명령을 가져감
export async function GET() {
  updatePollTime();
  const commands = getAndClearCommands();
  return NextResponse.json({ commands }, { headers: corsHeaders });
}
