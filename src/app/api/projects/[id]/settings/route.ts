import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProjectSettings, updateProjectSettings, updateProjectInfo, getProject } from '@/lib/db';

/**
 * GET /api/projects/[id]/settings
 * 프로젝트 기본 정보 + 계약 조건 조회
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const projectId = parseInt(id);
  const project = getProject(projectId);
  const settings = getProjectSettings(projectId);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({
    // 기본 정보
    title: project.title || '',
    clientName: project.client_name || '',
    productName: project.product_name || '',
    industry: project.industry || '',
    // 계약 조건
    sectionCount: settings?.section_count || 0,
    shootingCutCount: settings?.shooting_cut_count || 0,
    budget: settings?.budget || '',
    useModels: settings?.use_models === 1,
    pipelineVersion: settings?.pipeline_version || 1,
    // 스케줄/클라이언트
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

/**
 * PUT /api/projects/[id]/settings
 * 프로젝트 기본 정보 + 계약 조건 업데이트
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const projectId = parseInt(id);
  const body = await req.json();

  // 기본 정보 업데이트
  if (body.title !== undefined || body.clientName !== undefined || body.productName !== undefined || body.industry !== undefined) {
    updateProjectInfo(projectId, {
      title: body.title,
      clientName: body.clientName,
      productName: body.productName,
      industry: body.industry,
    });
  }

  // 계약 조건 업데이트
  if (body.sectionCount !== undefined || body.shootingCutCount !== undefined || body.budget !== undefined || body.useModels !== undefined) {
    updateProjectSettings(projectId, {
      sectionCount: body.sectionCount,
      shootingCutCount: body.shootingCutCount,
      budget: body.budget,
      useModels: body.useModels,
    });
  }

  return NextResponse.json({ success: true });
}
