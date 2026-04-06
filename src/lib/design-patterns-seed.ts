/**
 * 디자인 패턴 시드 데이터
 * 섹션 유형별 검증된 와이어프레임 패턴 라이브러리
 * AI가 사용하면서 점수를 올리고, 새 패턴을 학습해서 확장함
 */

interface PatternSeed {
  section_type: string;
  pattern_name: string;
  description: string;
  industry: string;  // '' = 범용
  tone: string;
  wireframe_blocks: any[];
  copy_blocks: any[];
  tags: string;
}

export const SEED_PATTERNS: PatternSeed[] = [
  // ========================
  // 히어로/메인 배너 (6개)
  // ========================
  {
    section_type: 'hero',
    pattern_name: '중앙 제품 히어로',
    description: '제품 이미지를 중앙에 크게 배치하고 상하에 카피를 넣는 클래식 구조',
    industry: '',
    tone: '고급',
    wireframe_blocks: [
      { type: 'wf-heading', text: '메인 카피', bold: true, align: 'center' },
      { type: 'wf-text', text: '서브 카피 영역', align: 'center' },
      { type: 'wf-image', text: '제품 메인 이미지', height: 280 },
      { type: 'wf-text', text: '한 줄 요약 문구', align: 'center' },
      { type: 'wf-badge-row', items: [{ label: '핵심 USP 1' }, { label: '핵심 USP 2' }, { label: '핵심 USP 3' }] },
    ],
    copy_blocks: [
      { type: 'copy-main', text: '메인 카피 (제품의 핵심 가치)' },
      { type: 'copy-sub', text: '서브 카피 (부연 설명)' },
      { type: 'image-placeholder', text: '제품 메인 이미지 (고해상도)' },
      { type: 'text', text: '한 줄 요약 문구' },
    ],
    tags: '클래식,중앙배치,제품중심,범용',
  },
  {
    section_type: 'hero',
    pattern_name: '분할 레이아웃 히어로',
    description: '좌우 분할로 한쪽에 제품, 한쪽에 카피를 배치하는 세련된 구조',
    industry: '',
    tone: '모던',
    wireframe_blocks: [
      { type: 'wf-split', items: [{ label: '카피 영역', desc: '메인/서브 카피' }, { label: '제품 이미지', desc: '메인 비주얼' }] },
      { type: 'wf-heading', text: '메인 카피', bold: true },
      { type: 'wf-text', text: '서브 카피' },
      { type: 'wf-button', text: '자세히 보기' },
    ],
    copy_blocks: [
      { type: 'copy-main', text: '메인 카피' },
      { type: 'copy-sub', text: '서브 카피' },
      { type: 'image-placeholder', text: '제품 비주얼 (좌우 분할)' },
    ],
    tags: '분할,좌우,모던,세련된',
  },
  {
    section_type: 'hero',
    pattern_name: '풀블리드 이미지 히어로',
    description: '전체 화면을 채우는 임팩트 있는 이미지 위에 카피를 오버레이',
    industry: '',
    tone: '임팩트',
    wireframe_blocks: [
      { type: 'wf-image', text: '풀블리드 배경 이미지', height: 400 },
      { type: 'wf-heading', text: '오버레이 메인 카피', bold: true, align: 'center', color: '#FFFFFF' },
      { type: 'wf-text', text: '서브 카피', align: 'center' },
      { type: 'wf-button', text: 'CTA 버튼', align: 'center' },
    ],
    copy_blocks: [
      { type: 'image-placeholder', text: '풀블리드 배경 이미지 (분위기 중심)' },
      { type: 'copy-main', text: '오버레이 메인 카피 (흰색 텍스트)' },
      { type: 'copy-sub', text: '서브 카피' },
    ],
    tags: '풀블리드,임팩트,오버레이,강렬한',
  },
  {
    section_type: 'hero',
    pattern_name: '그라데이션 히어로',
    description: '그라데이션 배경에 제품과 카피를 배치하는 고급 구조',
    industry: '뷰티',
    tone: '고급',
    wireframe_blocks: [
      { type: 'wf-spacer', height: 20 },
      { type: 'wf-heading', text: '브랜드 로고/네임', align: 'center' },
      { type: 'wf-heading', text: '메인 카피', bold: true, align: 'center' },
      { type: 'wf-image', text: '제품 이미지 (그라데이션 배경)', height: 300 },
      { type: 'wf-text', text: '핵심 셀링 포인트', align: 'center' },
      { type: 'wf-badge-row', items: [{ label: '키워드 1' }, { label: '키워드 2' }] },
    ],
    copy_blocks: [
      { type: 'label', text: '브랜드명' },
      { type: 'copy-main', text: '메인 카피' },
      { type: 'image-placeholder', text: '제품 이미지 + 그라데이션 배경' },
      { type: 'copy-sub', text: '핵심 셀링 포인트' },
    ],
    tags: '그라데이션,고급,뷰티,프리미엄',
  },
  {
    section_type: 'hero',
    pattern_name: '숫자 강조 히어로',
    description: '핵심 수치(판매량, 만족도 등)를 전면에 내세우는 신뢰 기반 구조',
    industry: '건기식',
    tone: '신뢰',
    wireframe_blocks: [
      { type: 'wf-heading', text: '메인 카피', bold: true, align: 'center' },
      { type: 'wf-number-highlight', items: [{ label: '누적 판매', value: '100만+' }, { label: '만족도', value: '97%' }, { label: '리뷰', value: '4.9점' }] },
      { type: 'wf-image', text: '제품 이미지', height: 250 },
      { type: 'wf-text', text: '서브 카피', align: 'center' },
    ],
    copy_blocks: [
      { type: 'copy-main', text: '메인 카피 (신뢰감 중심)' },
      { type: 'info-box', text: '핵심 수치 3가지' },
      { type: 'image-placeholder', text: '제품 이미지' },
    ],
    tags: '숫자,신뢰,판매량,건기식',
  },
  {
    section_type: 'hero',
    pattern_name: '비디오 히어로',
    description: '영상 썸네일을 중심으로 카피와 재생 버튼을 배치',
    industry: '',
    tone: '다이나믹',
    wireframe_blocks: [
      { type: 'wf-heading', text: '메인 카피', bold: true, align: 'center' },
      { type: 'wf-video', text: '제품 소개 영상', height: 220 },
      { type: 'wf-text', text: '서브 카피 / 영상 설명', align: 'center' },
      { type: 'wf-button', text: '자세히 보기' },
    ],
    copy_blocks: [
      { type: 'copy-main', text: '메인 카피' },
      { type: 'image-placeholder', text: '영상 썸네일 (재생 버튼 오버레이)' },
      { type: 'copy-sub', text: '서브 카피' },
    ],
    tags: '영상,비디오,다이나믹',
  },

  // ========================
  // 성분/원료 소개 (5개)
  // ========================
  {
    section_type: 'ingredient',
    pattern_name: '아이콘 그리드 성분',
    description: '핵심 성분 3~6개를 아이콘+텍스트 그리드로 깔끔하게 나열',
    industry: '',
    tone: '깔끔',
    wireframe_blocks: [
      { type: 'wf-heading', text: '핵심 성분 소개', bold: true, align: 'center' },
      { type: 'wf-text', text: '서브 카피', align: 'center' },
      { type: 'wf-icon-list', items: [
        { label: '성분 A', desc: '효능 설명' },
        { label: '성분 B', desc: '효능 설명' },
        { label: '성분 C', desc: '효능 설명' },
        { label: '성분 D', desc: '효능 설명' },
      ]},
      { type: 'wf-source', text: '출처: 식약처 인증 원료' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '핵심 성분 소개' },
      { type: 'copy-sub', text: '서브 카피' },
      { type: 'list', items: ['성분 A: 효능', '성분 B: 효능', '성분 C: 효능'] },
      { type: 'note', text: '출처 표기' },
    ],
    tags: '아이콘,그리드,성분,깔끔,범용',
  },
  {
    section_type: 'ingredient',
    pattern_name: '성분 카드 레이아웃',
    description: '각 성분을 개별 카드로 만들어 이미지+설명 조합으로 상세 소개',
    industry: '건기식',
    tone: '상세',
    wireframe_blocks: [
      { type: 'wf-heading', text: '이런 성분이 들어있어요', bold: true, align: 'center' },
      { type: 'wf-card-grid', cols: 2, items: [
        { label: '성분 A', desc: '함량 및 효능 설명' },
        { label: '성분 B', desc: '함량 및 효능 설명' },
        { label: '성분 C', desc: '함량 및 효능 설명' },
        { label: '성분 D', desc: '함량 및 효능 설명' },
      ]},
      { type: 'wf-text', text: '전성분 표기', align: 'center' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '핵심 성분 소개' },
      { type: 'info-box', text: '성분 카드 (이미지 + 함량 + 효능)' },
      { type: 'note', text: '전성분 표기' },
    ],
    tags: '카드,성분,상세,건기식',
  },
  {
    section_type: 'ingredient',
    pattern_name: '성분 스포트라이트',
    description: '핵심 1~2개 성분을 대형 이미지와 함께 집중 부각',
    industry: '뷰티',
    tone: '프리미엄',
    wireframe_blocks: [
      { type: 'wf-heading', text: '핵심 원료', bold: true, align: 'center' },
      { type: 'wf-image', text: '핵심 성분 클로즈업 이미지', height: 200 },
      { type: 'wf-heading', text: '성분 이름', bold: true },
      { type: 'wf-text', text: '성분 효능 상세 설명 (2~3줄)' },
      { type: 'wf-stats', items: [{ label: '함량', value: '000mg' }, { label: '순도', value: '99.9%' }] },
      { type: 'wf-divider' },
      { type: 'wf-image', text: '두 번째 핵심 성분 이미지', height: 200 },
      { type: 'wf-heading', text: '두 번째 성분 이름', bold: true },
      { type: 'wf-text', text: '효능 설명' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '핵심 원료' },
      { type: 'image-placeholder', text: '성분 클로즈업 이미지' },
      { type: 'heading', text: '성분 이름' },
      { type: 'text', text: '효능 상세 설명' },
    ],
    tags: '스포트라이트,집중,프리미엄,뷰티',
  },
  {
    section_type: 'ingredient',
    pattern_name: '성분 비교 테이블',
    description: '자사 vs 타사 성분 함량을 표로 비교하여 우위를 보여줌',
    industry: '건기식',
    tone: '신뢰',
    wireframe_blocks: [
      { type: 'wf-heading', text: '성분 함량 비교', bold: true, align: 'center' },
      { type: 'wf-text', text: '타사 대비 압도적인 함량', align: 'center' },
      { type: 'wf-table', headers: ['성분', '자사', '타사 A', '타사 B'], rows: [
        { cells: ['핵심 성분', '500mg', '200mg', '150mg'] },
        { cells: ['부원료', '100mg', '50mg', '30mg'] },
      ]},
      { type: 'wf-source', text: '※ 1일 섭취량 기준' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '성분 함량 비교' },
      { type: 'copy-sub', text: '자사 우위 강조 카피' },
      { type: 'info-box', text: '비교 테이블' },
      { type: 'note', text: '출처/기준' },
    ],
    tags: '비교,테이블,함량,건기식,신뢰',
  },
  {
    section_type: 'ingredient',
    pattern_name: '원료 산지 스토리',
    description: '원료의 산지와 채취 과정을 스토리텔링 형식으로 소개',
    industry: '',
    tone: '자연',
    wireframe_blocks: [
      { type: 'wf-heading', text: '원료 이야기', bold: true, align: 'center' },
      { type: 'wf-image', text: '산지/자연 풍경 이미지', height: 200 },
      { type: 'wf-text', text: '원료 산지 소개 스토리' },
      { type: 'wf-timeline', items: [
        { label: '채취', desc: '엄선된 원료 수확' },
        { label: '가공', desc: '저온 추출 공법' },
        { label: '검증', desc: '품질 테스트 통과' },
      ]},
      { type: 'wf-trust-badges', items: [{ label: 'HACCP' }, { label: '유기농 인증' }] },
    ],
    copy_blocks: [
      { type: 'section-title', text: '원료 이야기' },
      { type: 'image-placeholder', text: '산지 이미지' },
      { type: 'text', text: '스토리텔링 카피' },
      { type: 'list', items: ['채취 → 가공 → 검증 과정'] },
    ],
    tags: '산지,스토리,자연,프로세스',
  },

  // ========================
  // 효능/효과 (5개)
  // ========================
  {
    section_type: 'benefit',
    pattern_name: '아이콘 효능 리스트',
    description: '핵심 효능 4~6가지를 아이콘+텍스트로 나열하는 기본 구조',
    industry: '',
    tone: '깔끔',
    wireframe_blocks: [
      { type: 'wf-heading', text: '이런 효과를 느낄 수 있어요', bold: true, align: 'center' },
      { type: 'wf-icon-list', items: [
        { label: '효능 1', desc: '상세 설명' },
        { label: '효능 2', desc: '상세 설명' },
        { label: '효능 3', desc: '상세 설명' },
        { label: '효능 4', desc: '상세 설명' },
      ]},
    ],
    copy_blocks: [
      { type: 'section-title', text: '효능/효과' },
      { type: 'list', items: ['효능 1', '효능 2', '효능 3', '효능 4'] },
    ],
    tags: '아이콘,리스트,효능,기본,범용',
  },
  {
    section_type: 'benefit',
    pattern_name: 'Before-After 비교',
    description: '사용 전후 비교로 효과를 직관적으로 보여주는 구조',
    industry: '뷰티',
    tone: '직관',
    wireframe_blocks: [
      { type: 'wf-heading', text: '사용 전후 변화', bold: true, align: 'center' },
      { type: 'wf-before-after', before: '사용 전', after: '사용 후' },
      { type: 'wf-text', text: '※ 개인마다 결과가 다를 수 있습니다', align: 'center' },
      { type: 'wf-stats', items: [{ label: '만족도', value: '94%' }, { label: '재구매율', value: '89%' }] },
    ],
    copy_blocks: [
      { type: 'section-title', text: '사용 전후 변화' },
      { type: 'image-placeholder', text: 'Before-After 이미지' },
      { type: 'note', text: '면책 문구' },
      { type: 'info-box', text: '만족도/재구매율 수치' },
    ],
    tags: '비포애프터,비교,뷰티,직관적',
  },
  {
    section_type: 'benefit',
    pattern_name: '수치 강조 효능',
    description: '임상 데이터나 수치를 크게 보여주며 효과를 증명하는 구조',
    industry: '건기식',
    tone: '신뢰',
    wireframe_blocks: [
      { type: 'wf-heading', text: '임상으로 입증된 효과', bold: true, align: 'center' },
      { type: 'wf-number-highlight', items: [
        { label: '피부 수분', value: '+43%' },
        { label: '탄력 개선', value: '+28%' },
        { label: '주름 감소', value: '-31%' },
      ]},
      { type: 'wf-bar-chart', items: [
        { label: '자사 제품', percent: 95 },
        { label: '타사 A', percent: 62 },
        { label: '타사 B', percent: 45 },
      ]},
      { type: 'wf-source', text: '출처: 인체적용시험 결과 (n=60, 8주)' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '임상 입증 효과' },
      { type: 'info-box', text: '핵심 수치 3가지' },
      { type: 'info-box', text: '비교 차트' },
      { type: 'note', text: '출처 표기' },
    ],
    tags: '수치,임상,차트,신뢰,건기식',
  },
  {
    section_type: 'benefit',
    pattern_name: '체크리스트 효능',
    description: '이런 분께 추천 / 이런 고민이 있다면 형태의 체크리스트',
    industry: '',
    tone: '공감',
    wireframe_blocks: [
      { type: 'wf-heading', text: '이런 분께 추천합니다', bold: true, align: 'center' },
      { type: 'wf-checklist', items: [
        { label: '항상 피곤하고 기운이 없는 분' },
        { label: '불규칙한 식습관으로 영양 부족인 분' },
        { label: '면역력이 약해 자주 아픈 분' },
        { label: '건강한 피부를 원하는 분' },
      ]},
      { type: 'wf-text', text: '하나라도 해당된다면, 지금 시작하세요', align: 'center', bold: true },
    ],
    copy_blocks: [
      { type: 'section-title', text: '이런 분께 추천' },
      { type: 'list', items: ['타겟 고민 1', '타겟 고민 2', '타겟 고민 3'] },
      { type: 'copy-sub', text: 'CTA 문구' },
    ],
    tags: '체크리스트,추천,공감,타겟팅',
  },
  {
    section_type: 'benefit',
    pattern_name: '인포그래픽 효능',
    description: '효능 과정을 시각적 인포그래픽으로 설명하는 구조',
    industry: '',
    tone: '교육적',
    wireframe_blocks: [
      { type: 'wf-heading', text: '어떻게 효과가 나타나나요?', bold: true, align: 'center' },
      { type: 'wf-timeline', items: [
        { label: '1주차', desc: '체내 흡수 시작' },
        { label: '2~3주차', desc: '변화 체감 시작' },
        { label: '4주차', desc: '눈에 보이는 변화' },
        { label: '8주차', desc: '최적의 효과' },
      ]},
      { type: 'wf-image', text: '효과 메커니즘 일러스트', height: 180 },
      { type: 'wf-text', text: '꾸준한 섭취가 중요합니다', align: 'center' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '효과 메커니즘' },
      { type: 'info-box', text: '주차별 효과 타임라인' },
      { type: 'image-placeholder', text: '메커니즘 일러스트' },
    ],
    tags: '인포그래픽,타임라인,메커니즘,교육',
  },

  // ========================
  // 사용법/먹는법 (4개)
  // ========================
  {
    section_type: 'how-to',
    pattern_name: '단계별 사용법',
    description: '1-2-3 스텝으로 사용 방법을 간단하게 안내',
    industry: '',
    tone: '간결',
    wireframe_blocks: [
      { type: 'wf-heading', text: '이렇게 드세요', bold: true, align: 'center' },
      { type: 'wf-timeline', items: [
        { label: 'STEP 1', desc: '하루 1포를 꺼냅니다' },
        { label: 'STEP 2', desc: '물 200ml와 함께 섭취합니다' },
        { label: 'STEP 3', desc: '매일 같은 시간에 드세요' },
      ]},
      { type: 'wf-text', text: '💡 공복 섭취 시 흡수율 UP', align: 'center' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '섭취 방법' },
      { type: 'list', items: ['STEP 1: 설명', 'STEP 2: 설명', 'STEP 3: 설명'] },
      { type: 'note', text: '팁/주의사항' },
    ],
    tags: '스텝,단계별,간결,범용',
  },
  {
    section_type: 'how-to',
    pattern_name: '이미지 스텝 사용법',
    description: '각 단계마다 이미지를 넣어 시각적으로 안내',
    industry: '뷰티',
    tone: '시각적',
    wireframe_blocks: [
      { type: 'wf-heading', text: '사용 방법', bold: true, align: 'center' },
      { type: 'wf-card-grid', cols: 3, items: [
        { label: 'Step 1', desc: '적당량을 덜어냅니다' },
        { label: 'Step 2', desc: '얼굴에 고르게 펴 바릅니다' },
        { label: 'Step 3', desc: '가볍게 두드려 흡수시킵니다' },
      ]},
      { type: 'wf-text', text: '아침, 저녁 스킨케어 마지막 단계에 사용', align: 'center' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '사용 방법' },
      { type: 'info-box', text: '각 스텝 이미지 + 설명 카드' },
      { type: 'note', text: '추가 팁' },
    ],
    tags: '이미지,스텝,시각적,뷰티',
  },
  {
    section_type: 'how-to',
    pattern_name: 'Q&A형 사용법',
    description: '자주 묻는 질문 형태로 사용법과 주의사항을 안내',
    industry: '',
    tone: '친근',
    wireframe_blocks: [
      { type: 'wf-heading', text: '자주 묻는 사용법 Q&A', bold: true, align: 'center' },
      { type: 'wf-accordion', items: [
        { label: 'Q. 하루에 몇 번 먹나요?', desc: 'A. 1일 1회, 1포씩 섭취하세요.' },
        { label: 'Q. 언제 먹는 게 좋나요?', desc: 'A. 아침 공복에 먹으면 흡수율이 높아요.' },
        { label: 'Q. 다른 영양제와 같이 먹어도 되나요?', desc: 'A. 네, 대부분 병용 가능합니다.' },
      ]},
    ],
    copy_blocks: [
      { type: 'section-title', text: '사용법 Q&A' },
      { type: 'list', items: ['Q1: 질문/답변', 'Q2: 질문/답변', 'Q3: 질문/답변'] },
    ],
    tags: 'QA,아코디언,친근,범용',
  },
  {
    section_type: 'how-to',
    pattern_name: '비교형 사용법',
    description: 'O/X 또는 올바른/잘못된 사용법을 비교하여 보여줌',
    industry: '',
    tone: '교육적',
    wireframe_blocks: [
      { type: 'wf-heading', text: '올바른 섭취 방법', bold: true, align: 'center' },
      { type: 'wf-comparison-row', items: [
        { label: '✓ 올바른 방법', desc: '미지근한 물과 함께' },
        { label: '✗ 잘못된 방법', desc: '뜨거운 물에 녹여 먹기' },
      ]},
      { type: 'wf-comparison-row', items: [
        { label: '✓ 올바른 방법', desc: '매일 같은 시간 섭취' },
        { label: '✗ 잘못된 방법', desc: '생각날 때만 섭취' },
      ]},
      { type: 'wf-text', text: '올바른 방법으로 최대 효과를!', align: 'center', bold: true },
    ],
    copy_blocks: [
      { type: 'section-title', text: '올바른 섭취 방법' },
      { type: 'info-box', text: 'O/X 비교 카드' },
      { type: 'copy-sub', text: '요약 문구' },
    ],
    tags: '비교,OX,교육,올바른방법',
  },

  // ========================
  // 리뷰/후기 (4개)
  // ========================
  {
    section_type: 'review',
    pattern_name: '카드형 리뷰',
    description: '고객 리뷰를 개별 카드로 보여주는 깔끔한 구조',
    industry: '',
    tone: '깔끔',
    wireframe_blocks: [
      { type: 'wf-heading', text: '고객 후기', bold: true, align: 'center' },
      { type: 'wf-stats', items: [{ label: '평점', value: '4.9' }, { label: '리뷰 수', value: '2,847건' }] },
      { type: 'wf-review-card', items: [
        { label: '김○○', desc: '확실히 효과가 있어요! 2주 만에 변화 느꼈습니다.', value: '★★★★★' },
        { label: '이○○', desc: '맛도 좋고 간편해서 매일 먹고 있어요.', value: '★★★★★' },
        { label: '박○○', desc: '선물로 보냈는데 부모님이 좋아하세요.', value: '★★★★☆' },
      ]},
      { type: 'wf-source', text: '실제 구매자 리뷰 (네이버 스마트스토어)' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '고객 후기' },
      { type: 'info-box', text: '평점 + 리뷰 수' },
      { type: 'text', text: '리뷰 카드 3~5개' },
      { type: 'note', text: '리뷰 출처' },
    ],
    tags: '카드,리뷰,후기,깔끔,범용',
  },
  {
    section_type: 'review',
    pattern_name: 'SNS 스크린샷 리뷰',
    description: '실제 SNS/블로그 후기 스크린샷을 나열하는 생생한 구조',
    industry: '',
    tone: '생생함',
    wireframe_blocks: [
      { type: 'wf-heading', text: 'SNS에서 화제!', bold: true, align: 'center' },
      { type: 'wf-text', text: '실제 고객님들의 생생한 후기', align: 'center' },
      { type: 'wf-card-grid', cols: 2, items: [
        { label: 'SNS 후기 1', desc: '스크린샷 이미지' },
        { label: 'SNS 후기 2', desc: '스크린샷 이미지' },
        { label: 'SNS 후기 3', desc: '스크린샷 이미지' },
        { label: 'SNS 후기 4', desc: '스크린샷 이미지' },
      ]},
    ],
    copy_blocks: [
      { type: 'section-title', text: 'SNS 화제' },
      { type: 'copy-sub', text: '실제 후기 강조 카피' },
      { type: 'image-placeholder', text: 'SNS 스크린샷 4~6개' },
    ],
    tags: 'SNS,스크린샷,생생,블로그',
  },
  {
    section_type: 'review',
    pattern_name: '인용문 리뷰',
    description: '핵심 리뷰 문구를 크게 인용하는 임팩트 있는 구조',
    industry: '',
    tone: '임팩트',
    wireframe_blocks: [
      { type: 'wf-heading', text: '고객이 말하는 효과', bold: true, align: 'center' },
      { type: 'wf-quote', text: '"써본 것 중에 최고예요. 인생템 찾았습니다!"', desc: '30대 직장인 김○○ 님' },
      { type: 'wf-divider' },
      { type: 'wf-quote', text: '"남편이 먼저 재구매 해달라고 했어요"', desc: '40대 주부 이○○ 님' },
      { type: 'wf-divider' },
      { type: 'wf-quote', text: '"부모님 선물로 드렸는데 정말 좋아하세요"', desc: '20대 대학생 박○○ 님' },
      { type: 'wf-number-highlight', items: [{ label: '만족도', value: '97%' }, { label: '재구매율', value: '91%' }] },
    ],
    copy_blocks: [
      { type: 'section-title', text: '고객 인용 후기' },
      { type: 'text', text: '인용문 + 출처 3~4개' },
      { type: 'info-box', text: '만족도/재구매율' },
    ],
    tags: '인용문,후기,임팩트,감성적',
  },
  {
    section_type: 'review',
    pattern_name: '별점 요약 리뷰',
    description: '별점 분포와 요약 통계를 보여주고 대표 리뷰를 나열',
    industry: '',
    tone: '데이터',
    wireframe_blocks: [
      { type: 'wf-heading', text: '리뷰 평점', bold: true, align: 'center' },
      { type: 'wf-number-highlight', items: [{ label: '평균 평점', value: '4.9/5.0' }] },
      { type: 'wf-bar-chart', items: [
        { label: '5점', percent: 85 },
        { label: '4점', percent: 10 },
        { label: '3점', percent: 3 },
        { label: '2점', percent: 1 },
        { label: '1점', percent: 1 },
      ]},
      { type: 'wf-review-card', items: [
        { label: 'BEST 리뷰', desc: '가장 도움이 된 리뷰 내용', value: '★★★★★' },
      ]},
    ],
    copy_blocks: [
      { type: 'section-title', text: '리뷰 평점' },
      { type: 'info-box', text: '별점 분포 차트' },
      { type: 'text', text: 'BEST 리뷰' },
    ],
    tags: '별점,차트,데이터,통계,리뷰',
  },

  // ========================
  // 인증/신뢰 (4개)
  // ========================
  {
    section_type: 'trust',
    pattern_name: '뱃지 나열형',
    description: '인증마크/수상이력을 뱃지 형태로 한 줄에 나열',
    industry: '',
    tone: '신뢰',
    wireframe_blocks: [
      { type: 'wf-heading', text: '믿을 수 있는 품질', bold: true, align: 'center' },
      { type: 'wf-trust-badges', items: [
        { label: 'HACCP' }, { label: 'GMP' }, { label: 'ISO 22000' }, { label: '식약처 인증' },
      ]},
      { type: 'wf-text', text: '국내외 인증을 획득한 안전한 제품', align: 'center' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '품질 인증' },
      { type: 'info-box', text: '인증마크 뱃지 4~6개' },
      { type: 'copy-sub', text: '안전성 강조 카피' },
    ],
    tags: '뱃지,인증,HACCP,GMP,범용',
  },
  {
    section_type: 'trust',
    pattern_name: '인증서 그리드',
    description: '인증서/시험성적서 이미지를 그리드로 보여주는 상세 구조',
    industry: '건기식',
    tone: '전문적',
    wireframe_blocks: [
      { type: 'wf-heading', text: '공인 시험 성적서', bold: true, align: 'center' },
      { type: 'wf-card-grid', cols: 2, items: [
        { label: 'HACCP 인증서', desc: '인증서 이미지' },
        { label: 'GMP 인증서', desc: '인증서 이미지' },
        { label: '인체적용시험', desc: '시험성적서 이미지' },
        { label: '중금속 검사', desc: '성적서 이미지' },
      ]},
      { type: 'wf-source', text: '모든 인증서는 원본 확인 가능합니다' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '공인 인증서' },
      { type: 'image-placeholder', text: '인증서 이미지 4개 그리드' },
      { type: 'note', text: '원본 확인 안내' },
    ],
    tags: '인증서,그리드,시험성적서,전문적',
  },
  {
    section_type: 'trust',
    pattern_name: '수상/미디어 노출',
    description: '수상 이력과 미디어 노출을 보여주는 권위 구조',
    industry: '',
    tone: '권위',
    wireframe_blocks: [
      { type: 'wf-heading', text: '수상 & 미디어', bold: true, align: 'center' },
      { type: 'wf-badge-row', items: [
        { label: '2024 올해의 브랜드' }, { label: 'TV 방영' }, { label: '뷰티 어워드' },
      ]},
      { type: 'wf-card-grid', cols: 3, items: [
        { label: '매거진 A', desc: '게재 이미지' },
        { label: 'TV 프로그램', desc: '방영 캡처' },
        { label: '인플루언서', desc: '추천 이미지' },
      ]},
    ],
    copy_blocks: [
      { type: 'section-title', text: '수상 & 미디어' },
      { type: 'info-box', text: '수상 뱃지' },
      { type: 'image-placeholder', text: '미디어 노출 이미지' },
    ],
    tags: '수상,미디어,TV,권위',
  },
  {
    section_type: 'trust',
    pattern_name: '제조 과정 공개',
    description: '제조 시설과 공정을 공개하여 신뢰를 구축',
    industry: '',
    tone: '투명',
    wireframe_blocks: [
      { type: 'wf-heading', text: '이렇게 만들어집니다', bold: true, align: 'center' },
      { type: 'wf-timeline', items: [
        { label: '원료 검수', desc: '엄격한 입고 검사' },
        { label: '배합/생산', desc: 'GMP 인증 시설' },
        { label: '품질 검사', desc: '3단계 QC' },
        { label: '포장/출하', desc: '위생 관리 포장' },
      ]},
      { type: 'wf-image', text: '제조 시설 사진', height: 180 },
      { type: 'wf-trust-badges', items: [{ label: 'GMP' }, { label: 'HACCP' }] },
    ],
    copy_blocks: [
      { type: 'section-title', text: '제조 과정' },
      { type: 'list', items: ['원료 검수 → 배합 → 검사 → 포장'] },
      { type: 'image-placeholder', text: '제조 시설 사진' },
    ],
    tags: '제조,공정,투명,GMP',
  },

  // ========================
  // 가격/구매 (3개)
  // ========================
  {
    section_type: 'pricing',
    pattern_name: '번들 옵션 가격표',
    description: '1개/3개/6개 등 번들 옵션을 카드로 비교하는 구조',
    industry: '',
    tone: '실용적',
    wireframe_blocks: [
      { type: 'wf-heading', text: '합리적인 가격', bold: true, align: 'center' },
      { type: 'wf-card-grid', cols: 3, items: [
        { label: '1개월분', desc: '39,000원\n1일 1,300원' },
        { label: '3개월분 (인기)', desc: '99,000원\n1일 1,100원\n15% 할인' },
        { label: '6개월분 (최저가)', desc: '179,000원\n1일 993원\n23% 할인' },
      ]},
      { type: 'wf-promo-badge', text: '지금 구매 시 무료 배송' },
      { type: 'wf-button', text: '구매하기', align: 'center' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '가격 안내' },
      { type: 'info-box', text: '번들 옵션 3가지 카드' },
      { type: 'label', text: '프로모션 뱃지' },
      { type: 'text', text: 'CTA 버튼' },
    ],
    tags: '번들,가격,옵션,할인',
  },
  {
    section_type: 'pricing',
    pattern_name: '프로모션 배너 가격',
    description: '한정 할인/특가를 강조하는 긴급감 있는 구조',
    industry: '',
    tone: '긴급',
    wireframe_blocks: [
      { type: 'wf-promo-badge', text: '🔥 오픈 특가 진행 중' },
      { type: 'wf-heading', text: '지금이 가장 저렴한 가격', bold: true, align: 'center' },
      { type: 'wf-price', text: '정가 59,000원 → 39,000원', desc: '34% 할인' },
      { type: 'wf-text', text: '⏰ 남은 수량 한정', align: 'center' },
      { type: 'wf-button', text: '특가로 구매하기', align: 'center' },
      { type: 'wf-badge-row', items: [{ label: '무료 배송' }, { label: '100% 환불 보장' }, { label: '당일 출고' }] },
    ],
    copy_blocks: [
      { type: 'label', text: '프로모션 배지' },
      { type: 'copy-main', text: '할인 강조 카피' },
      { type: 'info-box', text: '가격 정보 (정가/할인가)' },
      { type: 'text', text: '긴급감 문구' },
    ],
    tags: '프로모션,할인,특가,긴급',
  },
  {
    section_type: 'pricing',
    pattern_name: '일일 비용 환산 가격',
    description: '하루에 커피 한 잔 값으로 등 일일 비용으로 환산해서 보여줌',
    industry: '',
    tone: '합리적',
    wireframe_blocks: [
      { type: 'wf-heading', text: '하루에 커피 한 잔 가격으로', bold: true, align: 'center' },
      { type: 'wf-number-highlight', items: [{ label: '1일 비용', value: '1,100원' }] },
      { type: 'wf-comparison-row', items: [
        { label: '커피 1잔', desc: '4,500원/일' },
        { label: '이 제품', desc: '1,100원/일' },
      ]},
      { type: 'wf-price', text: '3개월분 99,000원', desc: '무료 배송 포함' },
      { type: 'wf-button', text: '시작하기', align: 'center' },
    ],
    copy_blocks: [
      { type: 'copy-main', text: '일일 비용 환산 카피' },
      { type: 'info-box', text: '비용 비교 (커피 vs 제품)' },
      { type: 'text', text: '가격 + 혜택' },
    ],
    tags: '일일비용,합리적,비교,환산',
  },

  // ========================
  // FAQ (2개)
  // ========================
  {
    section_type: 'faq',
    pattern_name: '아코디언 FAQ',
    description: '질문을 클릭하면 답변이 펼쳐지는 아코디언 구조',
    industry: '',
    tone: '깔끔',
    wireframe_blocks: [
      { type: 'wf-heading', text: '자주 묻는 질문', bold: true, align: 'center' },
      { type: 'wf-accordion', items: [
        { label: 'Q. 배송은 얼마나 걸리나요?', desc: 'A. 주문 후 1~2 영업일 내 출고됩니다.' },
        { label: 'Q. 반품/환불이 가능한가요?', desc: 'A. 수령 후 7일 이내 100% 환불 가능합니다.' },
        { label: 'Q. 유통기한은 얼마나 되나요?', desc: 'A. 제조일로부터 24개월입니다.' },
        { label: 'Q. 임산부도 섭취 가능한가요?', desc: 'A. 전문의 상담 후 섭취를 권장합니다.' },
      ]},
    ],
    copy_blocks: [
      { type: 'section-title', text: '자주 묻는 질문' },
      { type: 'list', items: ['Q&A 4~6개'] },
    ],
    tags: '아코디언,FAQ,질문,범용',
  },
  {
    section_type: 'faq',
    pattern_name: '카테고리 분류 FAQ',
    description: '배송/제품/교환 등 카테고리별로 FAQ를 분류한 구조',
    industry: '',
    tone: '체계적',
    wireframe_blocks: [
      { type: 'wf-heading', text: '궁금한 점이 있으신가요?', bold: true, align: 'center' },
      { type: 'wf-tabs', tabs: ['제품', '배송', '교환/반품'] },
      { type: 'wf-accordion', items: [
        { label: 'Q. 어떤 성분이 들어있나요?', desc: 'A. 핵심 성분 리스트' },
        { label: 'Q. 하루에 몇 번 먹나요?', desc: 'A. 1일 1회 섭취' },
        { label: 'Q. 알레르기 성분이 있나요?', desc: 'A. 알레르기 정보 안내' },
      ]},
    ],
    copy_blocks: [
      { type: 'section-title', text: 'FAQ' },
      { type: 'label', text: '카테고리 탭' },
      { type: 'list', items: ['카테고리별 Q&A'] },
    ],
    tags: '카테고리,탭,FAQ,체계적',
  },

  // ========================
  // CTA/마무리 (3개)
  // ========================
  {
    section_type: 'cta',
    pattern_name: '혜택 요약 CTA',
    description: '핵심 혜택을 요약하고 구매 버튼으로 마무리하는 구조',
    industry: '',
    tone: '설득력',
    wireframe_blocks: [
      { type: 'wf-heading', text: '지금 시작하세요', bold: true, align: 'center' },
      { type: 'wf-checklist', items: [
        { label: '핵심 성분 고함량 배합' },
        { label: '임상 시험 입증 효과' },
        { label: '97% 고객 만족도' },
        { label: '100% 환불 보장' },
      ]},
      { type: 'wf-price', text: '39,000원', desc: '무료 배송' },
      { type: 'wf-button', text: '구매하기', align: 'center' },
    ],
    copy_blocks: [
      { type: 'copy-main', text: 'CTA 메인 카피' },
      { type: 'list', items: ['핵심 혜택 요약 4개'] },
      { type: 'text', text: '가격 + CTA 버튼' },
    ],
    tags: '혜택요약,CTA,구매,설득',
  },
  {
    section_type: 'cta',
    pattern_name: '긴급감 CTA',
    description: '한정 수량/기간을 강조하여 즉시 행동을 유도하는 구조',
    industry: '',
    tone: '긴급',
    wireframe_blocks: [
      { type: 'wf-promo-badge', text: '⏰ 한정 특가 마감 임박' },
      { type: 'wf-heading', text: '지금이 가장 좋은 기회입니다', bold: true, align: 'center' },
      { type: 'wf-text', text: '남은 수량: 127개', align: 'center' },
      { type: 'wf-price', text: '59,000원 → 39,000원', desc: '34% 할인' },
      { type: 'wf-button', text: '특가로 구매하기', align: 'center' },
      { type: 'wf-badge-row', items: [{ label: '무료 배송' }, { label: '당일 출고' }, { label: '100% 환불' }] },
    ],
    copy_blocks: [
      { type: 'label', text: '긴급 프로모션 배지' },
      { type: 'copy-main', text: '긴급감 카피' },
      { type: 'text', text: '남은 수량/기간' },
      { type: 'text', text: '가격 + CTA' },
    ],
    tags: '긴급,한정,마감,FOMO',
  },
  {
    section_type: 'cta',
    pattern_name: '보증 안심 CTA',
    description: '환불 보증/무료 체험을 강조하여 구매 장벽을 낮추는 구조',
    industry: '',
    tone: '안심',
    wireframe_blocks: [
      { type: 'wf-heading', text: '마음 놓고 시작하세요', bold: true, align: 'center' },
      { type: 'wf-text', text: '만족하지 못하면 100% 환불해 드립니다', align: 'center' },
      { type: 'wf-icon-list', items: [
        { label: '30일 환불 보장', desc: '조건 없이 전액 환불' },
        { label: '무료 배송', desc: '전 제품 무료 배송' },
        { label: '고객센터 상담', desc: '평일 09~18시 운영' },
      ]},
      { type: 'wf-button', text: '안심하고 구매하기', align: 'center' },
    ],
    copy_blocks: [
      { type: 'copy-main', text: '안심 CTA 카피' },
      { type: 'copy-sub', text: '환불 보증 문구' },
      { type: 'list', items: ['환불 보장', '무료 배송', '고객 상담'] },
    ],
    tags: '보증,환불,안심,신뢰',
  },

  // ========================
  // 브랜드 스토리 (3개)
  // ========================
  {
    section_type: 'story',
    pattern_name: '창업자 스토리',
    description: '창업자/개발자의 개인 스토리를 통해 브랜드 철학을 전달',
    industry: '',
    tone: '감성',
    wireframe_blocks: [
      { type: 'wf-heading', text: '이런 마음으로 만들었습니다', bold: true, align: 'center' },
      { type: 'wf-image', text: '창업자/개발자 사진', height: 200 },
      { type: 'wf-quote', text: '"가족에게 먹일 수 있는 제품만 만들겠습니다"', desc: '대표 ○○○' },
      { type: 'wf-text', text: '브랜드 탄생 스토리 (2~3문단)' },
      { type: 'wf-divider' },
      { type: 'wf-text', text: '브랜드 철학/미션' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '브랜드 스토리' },
      { type: 'image-placeholder', text: '창업자 사진' },
      { type: 'text', text: '인용문 + 스토리' },
    ],
    tags: '창업자,스토리,감성,철학',
  },
  {
    section_type: 'story',
    pattern_name: '브랜드 히스토리',
    description: '브랜드의 연혁과 발전 과정을 타임라인으로 보여줌',
    industry: '',
    tone: '신뢰',
    wireframe_blocks: [
      { type: 'wf-heading', text: '브랜드 히스토리', bold: true, align: 'center' },
      { type: 'wf-timeline', items: [
        { label: '2018', desc: '브랜드 설립' },
        { label: '2020', desc: '누적 판매 10만 돌파' },
        { label: '2022', desc: '올해의 브랜드 수상' },
        { label: '2024', desc: '글로벌 진출' },
      ]},
      { type: 'wf-stats', items: [{ label: '설립', value: '2018년' }, { label: '누적 판매', value: '200만+' }] },
    ],
    copy_blocks: [
      { type: 'section-title', text: '브랜드 히스토리' },
      { type: 'info-box', text: '연도별 타임라인' },
      { type: 'info-box', text: '핵심 수치' },
    ],
    tags: '히스토리,타임라인,연혁,신뢰',
  },
  {
    section_type: 'story',
    pattern_name: '미션/비전 스토리',
    description: '브랜드의 미션과 비전을 깔끔하게 전달하는 구조',
    industry: '',
    tone: '진정성',
    wireframe_blocks: [
      { type: 'wf-heading', text: '우리의 약속', bold: true, align: 'center' },
      { type: 'wf-text', text: '브랜드 미션 한 줄', align: 'center', bold: true },
      { type: 'wf-icon-list', items: [
        { label: '정직한 성분', desc: '불필요한 첨가물 ZERO' },
        { label: '과학적 배합', desc: '임상 근거 기반 설계' },
        { label: '합리적 가격', desc: '중간 유통 없이 직접 판매' },
      ]},
      { type: 'wf-image', text: '브랜드 이미지 / 팀 사진', height: 180 },
    ],
    copy_blocks: [
      { type: 'section-title', text: '브랜드 미션' },
      { type: 'copy-main', text: '미션 한 줄' },
      { type: 'list', items: ['핵심 가치 3가지'] },
    ],
    tags: '미션,비전,약속,진정성',
  },

  // ========================
  // 비교/차별점 (3개)
  // ========================
  {
    section_type: 'comparison',
    pattern_name: '테이블 비교',
    description: '자사 vs 타사를 표로 항목별 비교하는 직관적 구조',
    industry: '',
    tone: '객관적',
    wireframe_blocks: [
      { type: 'wf-heading', text: '왜 이 제품인가요?', bold: true, align: 'center' },
      { type: 'wf-table', headers: ['항목', '자사', '타사 평균'], rows: [
        { cells: ['핵심 성분 함량', '500mg', '200mg'] },
        { cells: ['부원료 수', '5종', '2종'] },
        { cells: ['인증', 'HACCP+GMP', 'GMP만'] },
        { cells: ['가격 (1일)', '1,100원', '1,500원'] },
      ]},
      { type: 'wf-text', text: '같은 가격, 더 많은 성분', align: 'center', bold: true },
    ],
    copy_blocks: [
      { type: 'section-title', text: '비교 분석' },
      { type: 'info-box', text: '비교 테이블' },
      { type: 'copy-sub', text: '결론 카피' },
    ],
    tags: '테이블,비교,vs,객관적',
  },
  {
    section_type: 'comparison',
    pattern_name: '체크 비교',
    description: 'O/X 체크 형태로 자사와 타사를 비교',
    industry: '',
    tone: '명확',
    wireframe_blocks: [
      { type: 'wf-heading', text: '차이를 확인하세요', bold: true, align: 'center' },
      { type: 'wf-table', headers: ['특징', '자사 ✓', '일반 제품'], rows: [
        { cells: ['고함량 배합', '✓', '✗'] },
        { cells: ['임상 시험 완료', '✓', '✗'] },
        { cells: ['무첨가 (합성첨가물 0)', '✓', '✗'] },
        { cells: ['환불 보장', '✓', '✗'] },
      ]},
    ],
    copy_blocks: [
      { type: 'section-title', text: '차별점' },
      { type: 'info-box', text: 'O/X 체크 비교표' },
    ],
    tags: '체크,OX,차별점,명확',
  },
  {
    section_type: 'comparison',
    pattern_name: '카드 차별점',
    description: '차별점을 개별 카드로 부각하는 깔끔한 구조',
    industry: '',
    tone: '세련된',
    wireframe_blocks: [
      { type: 'wf-heading', text: '이 제품만의 차별점', bold: true, align: 'center' },
      { type: 'wf-card-grid', cols: 2, items: [
        { label: '차별점 1', desc: '핵심 설명' },
        { label: '차별점 2', desc: '핵심 설명' },
        { label: '차별점 3', desc: '핵심 설명' },
        { label: '차별점 4', desc: '핵심 설명' },
      ]},
      { type: 'wf-text', text: '결론 카피', align: 'center', bold: true },
    ],
    copy_blocks: [
      { type: 'section-title', text: '차별점' },
      { type: 'info-box', text: '차별점 카드 4개' },
      { type: 'copy-sub', text: '결론 카피' },
    ],
    tags: '카드,차별점,깔끔,세련',
  },

  // ========================
  // 상세 정보 (2개)
  // ========================
  {
    section_type: 'detail',
    pattern_name: '스펙 테이블 상세',
    description: '제품 스펙/영양정보를 표로 정리하는 구조',
    industry: '',
    tone: '정보',
    wireframe_blocks: [
      { type: 'wf-heading', text: '제품 상세 정보', bold: true, align: 'center' },
      { type: 'wf-table', headers: ['항목', '내용'], rows: [
        { cells: ['제품명', '제품명'] },
        { cells: ['용량', '30포 (1개월분)'] },
        { cells: ['원산지', '국내 제조'] },
        { cells: ['유통기한', '제조일로부터 24개월'] },
        { cells: ['섭취 방법', '1일 1회, 1포'] },
      ]},
      { type: 'wf-text', text: '주의사항 및 보관 방법', align: 'left' },
    ],
    copy_blocks: [
      { type: 'section-title', text: '상세 정보' },
      { type: 'info-box', text: '스펙 테이블' },
      { type: 'note', text: '주의사항' },
    ],
    tags: '스펙,테이블,상세정보,영양정보',
  },
  {
    section_type: 'detail',
    pattern_name: '탭 상세 정보',
    description: '제품정보/영양정보/주의사항을 탭으로 분류하는 구조',
    industry: '',
    tone: '체계적',
    wireframe_blocks: [
      { type: 'wf-heading', text: '상세 정보', bold: true, align: 'center' },
      { type: 'wf-tabs', tabs: ['제품 정보', '영양 성분', '주의사항'] },
      { type: 'wf-table', headers: ['항목', '내용'], rows: [
        { cells: ['제품명', '값'] },
        { cells: ['용량', '값'] },
        { cells: ['원재료', '값'] },
      ]},
    ],
    copy_blocks: [
      { type: 'section-title', text: '상세 정보' },
      { type: 'label', text: '탭 분류' },
      { type: 'info-box', text: '정보 테이블' },
    ],
    tags: '탭,상세,체계적,영양정보',
  },

  // ========================
  // 구성품/언박싱 (2개)
  // ========================
  {
    section_type: 'unboxing',
    pattern_name: '구성품 나열',
    description: '패키지에 포함된 구성품을 이미지와 함께 보여줌',
    industry: '',
    tone: '깔끔',
    wireframe_blocks: [
      { type: 'wf-heading', text: '패키지 구성', bold: true, align: 'center' },
      { type: 'wf-image', text: '전체 구성품 이미지', height: 220 },
      { type: 'wf-card-grid', cols: 3, items: [
        { label: '본품 30포', desc: '1개월분' },
        { label: '설명서', desc: '섭취 가이드' },
        { label: '쇼핑백', desc: '선물용 포장' },
      ]},
    ],
    copy_blocks: [
      { type: 'section-title', text: '패키지 구성' },
      { type: 'image-placeholder', text: '구성품 전체 이미지' },
      { type: 'info-box', text: '구성품 리스트' },
    ],
    tags: '구성품,패키지,언박싱,깔끔',
  },
  {
    section_type: 'unboxing',
    pattern_name: '선물 포장 강조',
    description: '선물용 패키지를 강조하여 선물 수요를 공략',
    industry: '',
    tone: '감성',
    wireframe_blocks: [
      { type: 'wf-heading', text: '소중한 분께 선물하세요', bold: true, align: 'center' },
      { type: 'wf-image', text: '선물 포장 이미지', height: 250 },
      { type: 'wf-text', text: '고급 포장으로 마음을 전하세요', align: 'center' },
      { type: 'wf-icon-list', items: [
        { label: '프리미엄 박스', desc: '고급 패키지' },
        { label: '메시지 카드', desc: '직접 작성 가능' },
        { label: '리본 포장', desc: '감성 마무리' },
      ]},
    ],
    copy_blocks: [
      { type: 'section-title', text: '선물 패키지' },
      { type: 'image-placeholder', text: '선물 포장 이미지' },
      { type: 'copy-sub', text: '선물 감성 카피' },
      { type: 'list', items: ['포장 구성'] },
    ],
    tags: '선물,포장,감성,프리미엄',
  },

  // ========================
  // 보증/안심 (2개)
  // ========================
  {
    section_type: 'guarantee',
    pattern_name: '환불 보증',
    description: '100% 환불 보증으로 구매 불안을 해소하는 구조',
    industry: '',
    tone: '안심',
    wireframe_blocks: [
      { type: 'wf-heading', text: '100% 만족 보증', bold: true, align: 'center' },
      { type: 'wf-image', text: '보증 마크/실드 이미지', height: 120 },
      { type: 'wf-text', text: '만족하지 못하시면 30일 이내 전액 환불해 드립니다', align: 'center' },
      { type: 'wf-icon-list', items: [
        { label: '조건 없는 환불', desc: '이유 불문 전액 환불' },
        { label: '간편한 절차', desc: '고객센터 한 통이면 끝' },
        { label: '빠른 처리', desc: '3영업일 이내 환불' },
      ]},
    ],
    copy_blocks: [
      { type: 'section-title', text: '만족 보증' },
      { type: 'image-placeholder', text: '보증 마크' },
      { type: 'copy-sub', text: '환불 정책 안내' },
      { type: 'list', items: ['환불 조건 3가지'] },
    ],
    tags: '환불,보증,안심,만족보장',
  },
  {
    section_type: 'guarantee',
    pattern_name: '안전성 보증',
    description: '원료 안전성과 부작용 없음을 강조하는 구조',
    industry: '건기식',
    tone: '신뢰',
    wireframe_blocks: [
      { type: 'wf-heading', text: '안심하고 드세요', bold: true, align: 'center' },
      { type: 'wf-checklist', items: [
        { label: '합성 첨가물 0% — 순수 원료만 사용' },
        { label: '중금속 불검출 — 공인 시험 성적서 보유' },
        { label: '알레르기 유발 물질 無 — 안심 설계' },
        { label: '국내 GMP 시설 제조 — 위생 관리 철저' },
      ]},
      { type: 'wf-trust-badges', items: [{ label: '무첨가' }, { label: '중금속 불검출' }, { label: 'GMP' }] },
    ],
    copy_blocks: [
      { type: 'section-title', text: '안전성 보증' },
      { type: 'list', items: ['안전성 체크리스트 4가지'] },
      { type: 'info-box', text: '안전 인증 뱃지' },
    ],
    tags: '안전,무첨가,중금속,건기식',
  },
];

/**
 * 섹션 이름으로 section_type을 추론하는 함수
 * AI가 새 패턴을 학습할 때 사용
 */
export function inferSectionType(sectionName: string): string {
  const name = sectionName.toLowerCase();

  const patterns: [RegExp, string][] = [
    [/히어로|메인.*배너|hero|키비주얼|kv|첫.*화면/, 'hero'],
    [/성분|원료|원재료|ingredient|함량/, 'ingredient'],
    [/효능|효과|benefit|장점|개선/, 'benefit'],
    [/사용|먹는|섭취|how.?to|방법|복용/, 'how-to'],
    [/리뷰|후기|review|고객.*소리|평가/, 'review'],
    [/인증|신뢰|trust|HACCP|GMP|시험|안전/, 'trust'],
    [/가격|구매|price|프로모|할인|특가/, 'pricing'],
    [/faq|질문|궁금|자주.*묻/, 'faq'],
    [/cta|구매.*유도|마무리|행동.*유도|주문/, 'cta'],
    [/스토리|이야기|브랜드.*소개|철학|미션/, 'story'],
    [/비교|차별|vs|다른.*제품|경쟁/, 'comparison'],
    [/상세.*정보|스펙|영양|제품.*정보/, 'detail'],
    [/보증|보장|환불|guarantee|안심/, 'guarantee'],
    [/구성|언박싱|패키지|unbox|세트/, 'unboxing'],
  ];

  for (const [regex, type] of patterns) {
    if (regex.test(name)) return type;
  }
  return 'detail'; // 기본값
}
