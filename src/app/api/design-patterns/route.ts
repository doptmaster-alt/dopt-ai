import { NextRequest, NextResponse } from 'next/server';
import {
  getPatternsBySectionType,
  getAllPatterns,
  getPatternById,
  createPattern,
  recordPatternUsage,
  searchPatterns,
  getPatternStats,
} from '@/lib/db';
import { SEED_PATTERNS, inferSectionType } from '@/lib/design-patterns-seed';

/**
 * GET /api/design-patterns
 *
 * Query params:
 * - sectionType: 섹션 유형별 패턴 조회
 * - sectionName: 섹션 이름으로 유형 자동 추론 후 조회
 * - industry: 업종 필터 (선택)
 * - search: 검색어
 * - stats: 'true'이면 통계 반환
 * - seed: 'true'이면 시드 데이터 삽입
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sectionType = searchParams.get('sectionType');
    const sectionName = searchParams.get('sectionName');
    const industry = searchParams.get('industry') || undefined;
    const search = searchParams.get('search');
    const stats = searchParams.get('stats');
    const seed = searchParams.get('seed');

    // 시드 데이터 삽입
    if (seed === 'true') {
      return seedPatterns();
    }

    // 통계
    if (stats === 'true') {
      return NextResponse.json(getPatternStats());
    }

    // 검색
    if (search) {
      const results = searchPatterns(search);
      return NextResponse.json({
        patterns: results.map(parsePatternBlocks),
      });
    }

    // 섹션 이름으로 유형 자동 추론
    let resolvedType = sectionType;
    if (!resolvedType && sectionName) {
      resolvedType = inferSectionType(sectionName);
    }

    // 섹션 유형별 조회
    if (resolvedType) {
      const patterns = getPatternsBySectionType(resolvedType, industry);

      // 패턴이 없으면 시드 데이터 자동 삽입 시도
      if (patterns.length === 0) {
        const allPatterns = getAllPatterns(1);
        if (allPatterns.length === 0) {
          // DB가 비어있음 — 시드 삽입
          await insertSeedData();
          const seeded = getPatternsBySectionType(resolvedType, industry);
          return NextResponse.json({
            patterns: seeded.map(parsePatternBlocks),
            inferredType: resolvedType,
            seeded: true,
          });
        }
      }

      return NextResponse.json({
        patterns: patterns.map(parsePatternBlocks),
        inferredType: resolvedType,
      });
    }

    // 전체 조회
    const all = getAllPatterns();
    return NextResponse.json({
      patterns: all.map(parsePatternBlocks),
    });
  } catch (error: any) {
    console.error('[DesignPatterns] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/design-patterns
 *
 * Body:
 * - action: 'apply' | 'like' | 'dislike' | 'revert' | 'create' | 'learn'
 * - patternId: 패턴 ID (apply/like/dislike/revert)
 * - projectId: 프로젝트 ID (선택)
 * - sectionNum: 섹션 번호 (선택)
 * - pattern: 새 패턴 데이터 (create/learn)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'apply':
      case 'like':
      case 'dislike':
      case 'revert': {
        const { patternId, projectId, sectionNum } = body;
        if (!patternId) {
          return NextResponse.json({ error: 'patternId required' }, { status: 400 });
        }
        recordPatternUsage(patternId, projectId || null, sectionNum || null, action === 'apply' ? 'applied' : action === 'like' ? 'liked' : action === 'dislike' ? 'disliked' : 'reverted');
        const updated = getPatternById(patternId);
        return NextResponse.json({
          success: true,
          pattern: updated ? parsePatternBlocks(updated) : null,
        });
      }

      case 'create':
      case 'learn': {
        const { pattern } = body;
        if (!pattern?.patternName) {
          return NextResponse.json({ error: 'patternName required' }, { status: 400 });
        }
        // sectionType이 없으면 patternName에서 자동 추론
        const resolvedSectionType = pattern.sectionType || inferSectionType(pattern.patternName);
        const result = createPattern({
          sectionType: resolvedSectionType,
          patternName: pattern.patternName,
          description: pattern.description || '',
          industry: pattern.industry || '',
          tone: pattern.tone || '',
          thumbnailUrl: pattern.thumbnailUrl || '',
          wireframeBlocks: JSON.stringify(pattern.wireframeBlocks || []),
          copyBlocks: JSON.stringify(pattern.copyBlocks || []),
          tags: pattern.tags || '',
          source: action === 'learn' ? 'learned' : 'manual',
        });
        return NextResponse.json({
          success: true,
          id: (result as any).lastInsertRowid,
          source: action,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[DesignPatterns] POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// === 헬퍼 ===

function parsePatternBlocks(row: any) {
  return {
    ...row,
    wireframe_blocks: typeof row.wireframe_blocks === 'string'
      ? JSON.parse(row.wireframe_blocks)
      : row.wireframe_blocks,
    copy_blocks: typeof row.copy_blocks === 'string'
      ? JSON.parse(row.copy_blocks)
      : row.copy_blocks,
  };
}

function seedPatterns() {
  try {
    const existing = getAllPatterns(1);
    if (existing.length > 0) {
      return NextResponse.json({ message: 'Patterns already seeded', count: getAllPatterns().length });
    }
    insertSeedData();
    const count = getAllPatterns().length;
    return NextResponse.json({ message: `Seeded ${count} patterns`, count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function insertSeedData() {
  for (const p of SEED_PATTERNS) {
    createPattern({
      sectionType: p.section_type,
      patternName: p.pattern_name,
      description: p.description,
      industry: p.industry,
      tone: p.tone,
      wireframeBlocks: JSON.stringify(p.wireframe_blocks),
      copyBlocks: JSON.stringify(p.copy_blocks),
      tags: p.tags,
      source: 'seed',
    });
  }
  console.log(`[DesignPatterns] Seeded ${SEED_PATTERNS.length} patterns`);
}
