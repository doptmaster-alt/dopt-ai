import { NextResponse } from 'next/server';
import { isPluginConnected } from '@/lib/figma-queue';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET() {
  const connected = isPluginConnected();
  return NextResponse.json({ connected }, { headers: corsHeaders });
}
