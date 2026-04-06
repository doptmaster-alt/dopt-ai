import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProject, updateProjectSchedule } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const project = getProject(parseInt(id));
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    clientEmail: project.client_email || '',
    clientContact: project.client_contact || '',
    plannerEmail: project.planner_email || '',
    briefDue: project.brief_due || '',
    planDue: project.plan_due || '',
    shootDate: project.shoot_date || '',
    designDue: project.design_due || '',
    finalDue: project.final_due || '',
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  updateProjectSchedule(parseInt(id), body);
  return NextResponse.json({ success: true });
}
