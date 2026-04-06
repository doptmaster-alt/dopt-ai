import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getConfirmedData, getStepData } from '@/lib/db';

/**
 * GET /api/projects/[id]/pdf?dataType=brief|plan
 * 확정된 브리프/기획안을 HTML -> PDF로 변환하여 다운로드
 * (서버사이드 HTML 생성 후 클라이언트에서 window.print() 또는 직접 HTML 반환)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const projectId = parseInt(id);
  const dataType = req.nextUrl.searchParams.get('dataType') as 'brief' | 'plan';

  if (!dataType || !['brief', 'plan'].includes(dataType)) {
    return NextResponse.json({ error: 'dataType required (brief|plan)' }, { status: 400 });
  }

  // 확정된 데이터 가져오기
  const confirmed = getConfirmedData(projectId, dataType);
  let data: any = null;

  if (confirmed) {
    data = JSON.parse(confirmed.confirmed_data);
  } else {
    // 확정 전이면 현재 step_data에서 가져오기
    const sourceStep = dataType === 'brief' ? 2 : 4;
    const stepData = getStepData(projectId, sourceStep);
    if (stepData?.form_data) {
      data = JSON.parse(stepData.form_data);
    }
  }

  if (!data) {
    return NextResponse.json({ error: '데이터가 없습니다.' }, { status: 404 });
  }

  const label = dataType === 'brief' ? '브리프' : '기획안';
  const isConfirmed = !!confirmed;
  const confirmedAt = confirmed?.confirmed_at ? new Date(confirmed.confirmed_at).toLocaleString('ko-KR') : '';

  // HTML PDF 생성
  const html = generatePdfHtml(data, dataType, label, isConfirmed, confirmedAt);

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="${label}_${isConfirmed ? '확정본' : '초안'}_${new Date().toISOString().slice(0, 10)}.html"`,
    },
  });
}

function generatePdfHtml(
  data: any,
  dataType: 'brief' | 'plan',
  label: string,
  isConfirmed: boolean,
  confirmedAt: string
): string {
  const styles = `
    <style>
      @page { margin: 20mm; size: A4; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a1a; line-height: 1.6; font-size: 12px; }
      .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; margin-bottom: 30px; border-radius: 8px; }
      .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; }
      .header .meta { font-size: 11px; opacity: 0.85; }
      .badge { display: inline-block; background: #fbbf24; color: #78350f; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; margin-left: 10px; }
      .badge.confirmed { background: #34d399; color: #064e3b; }
      .section { margin-bottom: 24px; page-break-inside: avoid; }
      .section-title { font-size: 14px; font-weight: 700; color: #1e3a5f; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; }
      .field { margin-bottom: 12px; }
      .field-label { font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
      .field-value { font-size: 12px; color: #1a1a1a; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; font-size: 11px; }
      th { background: #f3f4f6; font-weight: 600; color: #374151; }
      .plan-section { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
      .plan-section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .plan-section-num { background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
      .plan-section-title { font-size: 13px; font-weight: 600; color: #1e3a5f; }
      .plan-detail { font-size: 11px; color: #4b5563; margin-top: 4px; }
      .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #9ca3af; }
      @media print { .no-print { display: none !important; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      .print-btn { position: fixed; top: 20px; right: 20px; background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; cursor: pointer; z-index: 100; font-weight: 600; box-shadow: 0 4px 12px rgba(59,130,246,0.3); }
      .print-btn:hover { background: #2563eb; }
    </style>
  `;

  let content = '';

  if (dataType === 'brief') {
    content = generateBriefContent(data);
  } else {
    content = generatePlanContent(data);
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DIOPT - ${label} ${isConfirmed ? '확정본' : '초안'}</title>
  ${styles}
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ PDF 다운로드 (인쇄)</button>

  <div class="header">
    <h1>DIOPT ${label}
      <span class="badge ${isConfirmed ? 'confirmed' : ''}">${isConfirmed ? '✅ 확정' : '📝 초안'}</span>
    </h1>
    <div class="meta">
      ${confirmedAt ? `확정일시: ${confirmedAt}` : `생성일시: ${new Date().toLocaleString('ko-KR')}`}
      &nbsp;|&nbsp; DIOPT AI 기획 어시스턴트
    </div>
  </div>

  ${content}

  <div class="footer">
    DIOPT AI 기획 어시스턴트 &copy; ${new Date().getFullYear()} DIOPT Studio
  </div>
</body>
</html>`;
}

function generateBriefContent(data: any): string {
  let html = '';

  // 기본 정보
  const fields = [
    { label: '제품명', key: 'productName' },
    { label: '슬로건', key: 'slogan' },
    { label: '타겟 고객', key: 'targetCustomer' },
    { label: '키 메시지', key: 'keyMessage' },
    { label: '톤 & 매너', key: 'toneAndManner' },
    { label: '제품 설명', key: 'productDescription' },
    { label: '경쟁사 분석', key: 'competitorAnalysis' },
    { label: '시장 트렌드', key: 'marketTrend' },
  ];

  html += '<div class="section"><div class="section-title">📋 기본 정보</div>';
  for (const f of fields) {
    if (data[f.key]) {
      html += `<div class="field"><div class="field-label">${f.label}</div><div class="field-value">${escapeHtml(String(data[f.key]))}</div></div>`;
    }
  }
  html += '</div>';

  // USP 테이블
  if (data.uspTable?.length > 0) {
    html += '<div class="section"><div class="section-title">⭐ USP (고유 판매 제안)</div>';
    html += '<table><thead><tr><th>특성 (Feature)</th><th>장점 (Advantage)</th><th>혜택 (Benefit)</th></tr></thead><tbody>';
    for (const row of data.uspTable) {
      html += `<tr><td>${escapeHtml(row.feature || row.F || '')}</td><td>${escapeHtml(row.advantage || row.A || '')}</td><td>${escapeHtml(row.benefit || row.B || '')}</td></tr>`;
    }
    html += '</tbody></table></div>';
  }

  // 추가 필드들 (동적)
  const knownKeys = new Set(['productName', 'slogan', 'targetCustomer', 'keyMessage', 'toneAndManner', 'productDescription', 'competitorAnalysis', 'marketTrend', 'uspTable']);
  const extraFields = Object.keys(data).filter(k => !knownKeys.has(k) && data[k] && typeof data[k] === 'string');
  if (extraFields.length > 0) {
    html += '<div class="section"><div class="section-title">📝 추가 정보</div>';
    for (const key of extraFields) {
      html += `<div class="field"><div class="field-label">${key}</div><div class="field-value">${escapeHtml(String(data[key]))}</div></div>`;
    }
    html += '</div>';
  }

  return html;
}

function generatePlanContent(data: any): string {
  let html = '';

  if (data.sections?.length > 0) {
    html += '<div class="section"><div class="section-title">📐 상세페이지 기획안</div>';
    for (let i = 0; i < data.sections.length; i++) {
      const s = data.sections[i];
      html += `<div class="plan-section">
        <div class="plan-section-header">
          <span class="plan-section-num">섹션 ${i + 1}</span>
          <span class="plan-section-title">${escapeHtml(s.title || s.name || `섹션 ${i + 1}`)}</span>
        </div>`;

      if (s.purpose) html += `<div class="plan-detail"><strong>목적:</strong> ${escapeHtml(s.purpose)}</div>`;
      if (s.emotion) html += `<div class="plan-detail"><strong>감정:</strong> ${escapeHtml(s.emotion)}</div>`;
      if (s.layout) html += `<div class="plan-detail"><strong>레이아웃:</strong> ${escapeHtml(s.layout)}</div>`;

      // 카피 블록
      if (s.copyBlocks?.length > 0) {
        html += '<div class="plan-detail" style="margin-top: 8px;"><strong>카피:</strong></div>';
        for (const cb of s.copyBlocks) {
          if (cb.text) {
            html += `<div class="plan-detail" style="padding-left: 12px; margin-top: 2px;">• [${cb.role || 'text'}] ${escapeHtml(cb.text)}</div>`;
          }
        }
      }

      // 와이어프레임 블록
      if (s.wireframeBlocks?.length > 0) {
        html += `<div class="plan-detail" style="margin-top: 4px;"><strong>와이어프레임 블록:</strong> ${s.wireframeBlocks.length}개</div>`;
      }

      html += '</div>';
    }
    html += '</div>';
  }

  // 기획안 메타 정보
  const metaFields = ['totalSections', 'totalCuts', 'modelUsage', 'budget'];
  const hasMeta = metaFields.some(k => data[k]);
  if (hasMeta) {
    html += '<div class="section"><div class="section-title">📊 기획 개요</div>';
    if (data.totalSections) html += `<div class="field"><div class="field-label">총 섹션 수</div><div class="field-value">${data.totalSections}개</div></div>`;
    if (data.totalCuts) html += `<div class="field"><div class="field-label">총 촬영 컷 수</div><div class="field-value">${data.totalCuts}컷</div></div>`;
    if (data.modelUsage !== undefined) html += `<div class="field"><div class="field-label">모델 사용</div><div class="field-value">${data.modelUsage ? '사용' : '미사용'}</div></div>`;
    if (data.budget) html += `<div class="field"><div class="field-label">예산</div><div class="field-value">${data.budget}</div></div>`;
    html += '</div>';
  }

  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}
