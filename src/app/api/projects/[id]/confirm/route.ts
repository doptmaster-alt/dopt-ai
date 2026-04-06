import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getStepData,
  confirmStepData,
  getConfirmedData,
  isStepConfirmed,
  updateStepStatus,
} from '@/lib/db';

/**
 * POST /api/projects/[id]/confirm
 * 브리프 또는 기획안을 확정(잠금)합니다.
 *
 * Body: { dataType: 'brief' | 'plan', revisionNote?: string }
 *
 * - brief: step 2 (브리프 작성) 데이터를 스냅샷으로 저장, step 3 (브리프 확정)에 기록
 * - plan: step 4 (기획안 작성) 데이터를 스냅샷으로 저장, step 5 (기획안 확정)에 기록
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const projectId = parseInt(id);
  const userId = parseInt((session.user as any).id);

  try {
    const { dataType, revisionNote } = await req.json();

    if (!dataType || !['brief', 'plan'].includes(dataType)) {
      return NextResponse.json({ error: 'dataType must be "brief" or "plan"' }, { status: 400 });
    }

    // 이미 확정된 경우 에러
    if (isStepConfirmed(projectId, dataType)) {
      return NextResponse.json({
        error: `${dataType === 'brief' ? '브리프' : '기획안'}는 이미 확정되었습니다. 확정 후에는 수정할 수 없습니다.`,
        alreadyConfirmed: true,
      }, { status: 409 });
    }

    // 데이터 소스 스텝 결정
    const sourceStep = dataType === 'brief' ? 2 : 4;
    const confirmStep = dataType === 'brief' ? 3 : 5;

    // 현재 데이터 로드
    const stepData = getStepData(projectId, sourceStep);
    if (!stepData?.form_data) {
      return NextResponse.json({
        error: `${dataType === 'brief' ? '브리프' : '기획안'} 데이터가 없습니다. 먼저 작성을 완료해주세요.`,
      }, { status: 400 });
    }

    const formData = JSON.parse(stepData.form_data);

    // 브리프 최소 검증
    if (dataType === 'brief') {
      if (!formData.productName && !formData.slogan && !formData.uspTable?.length) {
        return NextResponse.json({
          error: '브리프에 최소 정보(제품명, 슬로건, USP)가 필요합니다.',
        }, { status: 400 });
      }
    }

    // 기획안 최소 검증
    if (dataType === 'plan') {
      if (!formData.sections?.length) {
        return NextResponse.json({
          error: '기획안에 최소 1개 이상의 섹션이 필요합니다.',
        }, { status: 400 });
      }
    }

    // 스냅샷 생성 (확정 시점의 데이터)
    const snapshot = JSON.stringify(formData, null, 2);

    // 확정 저장
    const confirmed = confirmStepData(
      projectId,
      confirmStep,
      dataType,
      snapshot,
      '', // PDF 경로 (나중에 PDF 생성 후 업데이트)
      userId,
    );

    // 확정 단계의 step_data에도 확정 정보 기록
    const confirmFormData = JSON.stringify({
      isConfirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: userId,
      [`${dataType}Snapshot`]: 'stored_in_confirmed_data_table',
      revisionNote: revisionNote || '',
    });

    // step_data에 확정 상태 저장
    const { saveStepData: saveSD } = require('@/lib/db');
    saveSD(projectId, confirmStep, confirmFormData, 'confirmed');

    // 소스 스텝도 confirmed 상태로
    updateStepStatus(projectId, sourceStep, 'confirmed');

    console.log(`[Confirm API] ${dataType} confirmed for project ${projectId} by user ${userId}`);

    return NextResponse.json({
      success: true,
      dataType,
      confirmedAt: confirmed?.confirmed_at || new Date().toISOString(),
      message: `${dataType === 'brief' ? '브리프' : '기획안'}가 확정되었습니다.`,
    });

  } catch (error: any) {
    console.error('[Confirm API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/projects/[id]/confirm?dataType=brief|plan
 * 확정된 데이터를 조회합니다.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = parseInt(id);
  const dataType = req.nextUrl.searchParams.get('dataType') as 'brief' | 'plan';

  if (!dataType || !['brief', 'plan'].includes(dataType)) {
    return NextResponse.json({ error: 'dataType query parameter required (brief|plan)' }, { status: 400 });
  }

  const confirmed = getConfirmedData(projectId, dataType);
  if (!confirmed) {
    return NextResponse.json({
      isConfirmed: false,
      data: null,
    });
  }

  return NextResponse.json({
    isConfirmed: true,
    data: JSON.parse(confirmed.confirmed_data),
    confirmedAt: confirmed.confirmed_at,
    confirmedBy: confirmed.confirmed_by,
    pdfPath: confirmed.pdf_path,
  });
}
