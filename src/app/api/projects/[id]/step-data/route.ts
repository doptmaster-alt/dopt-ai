import { NextRequest, NextResponse } from 'next/server';
import { getStepData, getAllStepData, saveStepData, updateStepStatus } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = parseInt(id);
  const step = req.nextUrl.searchParams.get('step');

  if (step !== null) {
    const data = getStepData(projectId, parseInt(step));
    if (!data) {
      return NextResponse.json({ formData: {}, status: 'empty' });
    }
    return NextResponse.json({
      formData: JSON.parse(data.form_data),
      status: data.status,
      updatedAt: data.updated_at,
    });
  }

  const allData = getAllStepData(projectId);
  return NextResponse.json(
    allData.map((d: any) => ({
      step: d.step,
      formData: JSON.parse(d.form_data),
      status: d.status,
      updatedAt: d.updated_at,
    }))
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = parseInt(id);
  const body = await req.json();
  const { step, formData, status } = body;

  saveStepData(projectId, step, JSON.stringify(formData), status || 'draft');
  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = parseInt(id);
  const body = await req.json();
  const { step, status } = body;

  updateStepStatus(projectId, step, status);
  return NextResponse.json({ success: true });
}
