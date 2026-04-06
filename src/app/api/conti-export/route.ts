import { NextRequest, NextResponse } from 'next/server';
import PptxGenJS from 'pptxgenjs';

export async function POST(req: NextRequest) {
  try {
    const { contiData } = await req.json();

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.author = 'D:opt studio';
    pptx.title = contiData.projectTitle || '촬영콘티';

    // ── 색상 팔레트 (D:opt 브랜드) ──
    const C = {
      black: '000000',
      navy: '1B2A4A',
      darkGray: '2D3748',
      medGray: '4A5568',
      lightGray: 'F7F8FA',
      borderGray: 'E2E8F0',
      white: 'FFFFFF',
      accent: 'E67E22',
      accentLight: 'FFF3E0',
      blue: '3182CE',
      green: '38A169',
      red: 'E53E3E',
      purple: '805AD5',
    };

    const addTopBar = (slide: PptxGenJS.Slide, color: string = C.accent) => {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.06,
        fill: { color },
      });
    };

    const addPageTitle = (slide: PptxGenJS.Slide, title: string) => {
      slide.addText(title, {
        x: 0.6, y: 0.25, w: 8, h: 0.6,
        fontSize: 22, fontFace: 'Arial',
        color: C.black, bold: true,
      });
    };

    const addFooter = (slide: PptxGenJS.Slide, pageNum: number) => {
      slide.addText(`ⓒ D:opt studio  |  PAGE ${pageNum}`, {
        x: 0.6, y: 5.0, w: 8.8, h: 0.3,
        fontSize: 8, fontFace: 'Arial',
        color: 'A0AEC0',
      });
    };

    let pageCounter = 1;

    // ══════════════════════════════════════════
    // PAGE 1: 표지
    // ══════════════════════════════════════════
    const cover = pptx.addSlide();
    cover.background = { color: C.black };
    addTopBar(cover);

    cover.addText('[콘티]', {
      x: 0.8, y: 1.6, w: 8.4, h: 0.4,
      fontSize: 14, fontFace: 'Arial',
      color: C.accent, bold: true,
    });

    cover.addText(contiData.projectTitle || '프로젝트명', {
      x: 0.8, y: 2.0, w: 8.4, h: 1.2,
      fontSize: 36, fontFace: 'Arial',
      color: C.white, bold: true,
    });

    cover.addShape(pptx.ShapeType.rect, {
      x: 0.8, y: 3.3, w: 3.0, h: 0.02,
      fill: { color: C.accent },
    });

    const infoLines = [];
    if (contiData.shootDate) infoLines.push(`📅  ${contiData.shootDate}`);
    if (contiData.location) infoLines.push(`📍  ${contiData.location}`);
    if (contiData.team) infoLines.push(`👥  ${contiData.team}`);

    infoLines.forEach((line, i) => {
      cover.addText(line, {
        x: 0.8, y: 3.6 + i * 0.35, w: 8.4, h: 0.3,
        fontSize: 12, fontFace: 'Arial',
        color: 'A0AEC0',
      });
    });

    cover.addText('ⓒ D:opt studio', {
      x: 0.8, y: 4.8, w: 3, h: 0.3,
      fontSize: 10, fontFace: 'Arial',
      color: C.accent,
    });
    pageCounter++;

    // ══════════════════════════════════════════
    // PAGE 2: 촬영 안내 가이드
    // ══════════════════════════════════════════
    if (contiData.shootGuide) {
      const guideSlide = pptx.addSlide();
      guideSlide.background = { color: C.white };
      addTopBar(guideSlide);
      addPageTitle(guideSlide, '촬영 안내 가이드');

      const guideItems = [
        { label: '이미지 전달 기준', value: contiData.shootGuide.imageStandard, icon: '📐' },
        { label: '소품 안내', value: contiData.shootGuide.propNotice, icon: '🎨' },
        { label: '제품 수량', value: contiData.shootGuide.productQty, icon: '📦' },
        { label: '목업 안내', value: contiData.shootGuide.mockupNotice, icon: '🖥️' },
      ].filter(i => i.value);

      guideItems.forEach((item, idx) => {
        const y = 1.2 + idx * 0.9;
        guideSlide.addShape(pptx.ShapeType.roundRect, {
          x: 0.6, y, w: 8.8, h: 0.75,
          fill: { color: idx % 2 === 0 ? C.lightGray : C.white },
          line: { color: C.borderGray, width: 0.5 },
          rectRadius: 0.05,
        });
        guideSlide.addText(`${item.icon}  ${item.label}`, {
          x: 0.8, y, w: 2.5, h: 0.75,
          fontSize: 11, fontFace: 'Arial',
          color: C.medGray, bold: true, valign: 'middle',
        });
        guideSlide.addText(item.value!, {
          x: 3.5, y, w: 5.7, h: 0.75,
          fontSize: 11, fontFace: 'Arial',
          color: C.darkGray, valign: 'middle',
        });
      });

      addFooter(guideSlide, pageCounter++);
    }

    // ══════════════════════════════════════════
    // PAGE 3: INFORMATION
    // ══════════════════════════════════════════
    if (contiData.information) {
      const infoSlide = pptx.addSlide();
      infoSlide.background = { color: C.white };
      addTopBar(infoSlide);
      addPageTitle(infoSlide, 'INFORMATION');

      const info = contiData.information;
      let yPos = 1.2;

      const addInfoRow = (label: string, value: string) => {
        infoSlide.addText(label, {
          x: 0.6, y: yPos, w: 2.2, h: 0.5,
          fontSize: 11, fontFace: 'Arial',
          color: C.white, bold: true,
          fill: { color: C.navy },
          valign: 'middle',
        });
        infoSlide.addText(value, {
          x: 2.8, y: yPos, w: 6.6, h: 0.5,
          fontSize: 11, fontFace: 'Arial',
          color: C.darkGray, valign: 'middle',
          line: { color: C.borderGray, width: 0.5 },
        });
        yPos += 0.55;
      };

      if (info.productName) addInfoRow('제품명', info.productName);
      if (info.lineup?.length) addInfoRow('라인업', info.lineup.join(', '));
      if (info.ingredients) addInfoRow('주요 성분', info.ingredients);
      if (info.features) addInfoRow('제품 특징', info.features);
      if (info.notes) addInfoRow('참고사항', info.notes);

      addFooter(infoSlide, pageCounter++);
    }

    // ══════════════════════════════════════════
    // PAGE 4: 소품 LIST
    // ══════════════════════════════════════════
    if (contiData.propList && contiData.propList.length > 0) {
      const propSlide = pptx.addSlide();
      propSlide.background = { color: C.white };
      addTopBar(propSlide);
      addPageTitle(propSlide, '소품 LIST');

      const propRows: PptxGenJS.TableRow[] = [
        [
          { text: 'No.', options: { bold: true, color: C.white, fill: { color: C.black }, fontSize: 10, fontFace: 'Arial', align: 'center' } },
          { text: '소품', options: { bold: true, color: C.white, fill: { color: C.black }, fontSize: 10, fontFace: 'Arial' } },
          { text: '수량', options: { bold: true, color: C.white, fill: { color: C.black }, fontSize: 10, fontFace: 'Arial', align: 'center' } },
          { text: '비고', options: { bold: true, color: C.white, fill: { color: C.black }, fontSize: 10, fontFace: 'Arial' } },
        ],
      ];

      contiData.propList.forEach((p: any, idx: number) => {
        propRows.push([
          { text: String(idx + 1), options: { fontSize: 10, fontFace: 'Arial', fill: { color: idx % 2 === 0 ? C.white : C.lightGray }, align: 'center' } },
          { text: p.item || '', options: { fontSize: 10, fontFace: 'Arial', fill: { color: idx % 2 === 0 ? C.white : C.lightGray } } },
          { text: p.qty || '', options: { fontSize: 10, fontFace: 'Arial', fill: { color: idx % 2 === 0 ? C.white : C.lightGray }, align: 'center' } },
          { text: p.note || '', options: { fontSize: 10, fontFace: 'Arial', fill: { color: idx % 2 === 0 ? C.white : C.lightGray } } },
        ]);
      });

      propSlide.addTable(propRows, {
        x: 0.6, y: 1.1, w: 8.8,
        colW: [0.8, 3.5, 1.0, 3.5],
        border: { type: 'solid', pt: 0.5, color: C.borderGray },
        rowH: 0.38,
      });

      addFooter(propSlide, pageCounter++);
    }

    // ══════════════════════════════════════════
    // PAGE 5: CUT LIST
    // ══════════════════════════════════════════
    const cutListSlide = pptx.addSlide();
    cutListSlide.background = { color: C.white };
    addTopBar(cutListSlide);
    addPageTitle(cutListSlide, 'CUT LIST');

    // Cut count summary
    const cl = contiData.cutList || {};
    const totalCuts = cl.total || contiData.totalCuts || 0;
    const summaryText = `TOTAL ${totalCuts}컷  (연출 ${cl.styled || contiData.styledCuts || 0}  |  GIF ${cl.gif || contiData.gifCuts || 0}  |  누끼 ${cl.nukki || contiData.nukkiCuts || 0}${cl.ai ? `  |  AI ${cl.ai}` : ''})`;

    cutListSlide.addShape(pptx.ShapeType.roundRect, {
      x: 0.6, y: 1.0, w: 8.8, h: 0.45,
      fill: { color: C.black },
      rectRadius: 0.05,
    });
    cutListSlide.addText(summaryText, {
      x: 0.6, y: 1.0, w: 8.8, h: 0.45,
      fontSize: 11, fontFace: 'Arial',
      color: C.white, bold: true, align: 'center', valign: 'middle',
    });

    if (cl.rows && cl.rows.length > 0) {
      const cutRows: PptxGenJS.TableRow[] = [
        [
          { text: 'No.', options: { bold: true, color: C.white, fill: { color: C.black }, fontSize: 9, fontFace: 'Arial', align: 'center' } },
          { text: '구분', options: { bold: true, color: C.white, fill: { color: C.black }, fontSize: 9, fontFace: 'Arial', align: 'center' } },
          { text: '컷 상세', options: { bold: true, color: C.white, fill: { color: C.black }, fontSize: 9, fontFace: 'Arial' } },
          { text: '수량', options: { bold: true, color: C.white, fill: { color: C.black }, fontSize: 9, fontFace: 'Arial', align: 'center' } },
        ],
      ];

      cl.rows.forEach((r: any, idx: number) => {
        cutRows.push([
          { text: String(r.no), options: { fontSize: 9, fontFace: 'Arial', fill: { color: idx % 2 === 0 ? C.white : C.lightGray }, align: 'center' } },
          { text: r.type || '', options: { fontSize: 9, fontFace: 'Arial', fill: { color: idx % 2 === 0 ? C.white : C.lightGray }, align: 'center', bold: true } },
          { text: r.detail || '', options: { fontSize: 9, fontFace: 'Arial', fill: { color: idx % 2 === 0 ? C.white : C.lightGray } } },
          { text: String(r.qty || 1), options: { fontSize: 9, fontFace: 'Arial', fill: { color: idx % 2 === 0 ? C.white : C.lightGray }, align: 'center' } },
        ]);
      });

      cutListSlide.addTable(cutRows, {
        x: 0.6, y: 1.6, w: 8.8,
        colW: [0.7, 1.0, 6.1, 1.0],
        border: { type: 'solid', pt: 0.5, color: C.borderGray },
        rowH: 0.35,
      });
    }

    addFooter(cutListSlide, pageCounter++);

    // ══════════════════════════════════════════
    // PAGE 6: CONCEPT SUMMARY
    // ══════════════════════════════════════════
    if (contiData.conceptSummary) {
      const conceptSlide = pptx.addSlide();
      conceptSlide.background = { color: C.white };
      addTopBar(conceptSlide);
      addPageTitle(conceptSlide, 'CONCEPT SUMMARY');

      const cs = contiData.conceptSummary;

      // Concept description
      if (cs.concept || cs.mood) {
        conceptSlide.addShape(pptx.ShapeType.roundRect, {
          x: 0.6, y: 1.1, w: 8.8, h: 1.2,
          fill: { color: C.lightGray },
          rectRadius: 0.08,
        });
        conceptSlide.addText(cs.concept || cs.mood || '', {
          x: 0.8, y: 1.2, w: 8.4, h: 1.0,
          fontSize: 12, fontFace: 'Arial',
          color: C.darkGray, valign: 'top',
          lineSpacing: 20, wrap: true,
        });
      }

      // Keywords
      if (cs.keywords && cs.keywords.length > 0) {
        conceptSlide.addText('KEYWORD', {
          x: 0.6, y: 2.5, w: 2, h: 0.3,
          fontSize: 10, fontFace: 'Arial',
          color: C.medGray, bold: true,
        });

        cs.keywords.forEach((kw: string, i: number) => {
          conceptSlide.addShape(pptx.ShapeType.roundRect, {
            x: 0.6 + i * 1.8, y: 2.85, w: 1.6, h: 0.35,
            fill: { color: C.black },
            rectRadius: 0.15,
          });
          conceptSlide.addText(kw, {
            x: 0.6 + i * 1.8, y: 2.85, w: 1.6, h: 0.35,
            fontSize: 9, fontFace: 'Arial',
            color: C.white, align: 'center', valign: 'middle',
          });
        });
      }

      // Colors
      if (cs.colors && cs.colors.length > 0) {
        conceptSlide.addText('COLOR', {
          x: 0.6, y: 3.5, w: 2, h: 0.3,
          fontSize: 10, fontFace: 'Arial',
          color: C.medGray, bold: true,
        });

        cs.colors.forEach((c: any, i: number) => {
          const hex = (c.hex || '#CCCCCC').replace('#', '');
          conceptSlide.addShape(pptx.ShapeType.roundRect, {
            x: 0.6 + i * 1.5, y: 3.9, w: 1.2, h: 0.8,
            fill: { color: hex },
            rectRadius: 0.08,
            line: { color: C.borderGray, width: 0.5 },
          });
          conceptSlide.addText(`${c.name}\n${c.hex}`, {
            x: 0.6 + i * 1.5, y: 4.75, w: 1.2, h: 0.4,
            fontSize: 8, fontFace: 'Arial',
            color: C.medGray, align: 'center',
          });
        });
      } else if (cs.keyColor || cs.background) {
        // Legacy format
        const legacyItems = [
          { label: '배경', value: cs.background },
          { label: '키 컬러', value: cs.keyColor },
          { label: '라이팅', value: cs.lighting },
        ].filter(i => i.value);

        legacyItems.forEach((item, idx) => {
          const y = 2.8 + idx * 0.6;
          conceptSlide.addText(item.label, {
            x: 0.6, y, w: 2.0, h: 0.5,
            fontSize: 11, fontFace: 'Arial',
            color: C.medGray, bold: true, valign: 'middle',
          });
          conceptSlide.addText(item.value!, {
            x: 2.8, y, w: 6.6, h: 0.5,
            fontSize: 11, fontFace: 'Arial',
            color: C.darkGray, valign: 'middle',
          });
        });
      }

      addFooter(conceptSlide, pageCounter++);
    }

    // ══════════════════════════════════════════
    // PAGE 7+: 개별 컷 페이지 (D:opt 표준 포맷)
    // ══════════════════════════════════════════
    const cutPages = contiData.cutPages || (contiData.cutDetails || []).map((c: any) => ({
      cutNum: c.cutNum,
      conceptNum: `CONCEPT ${String(c.cutNum).padStart(2, '0')}`,
      type: c.type,
      background: { description: c.concept },
      composition: c.composition,
      props: c.props ? c.props.split(',').map((s: string) => s.trim()) : [],
      note: c.note,
    }));

    cutPages.forEach((cut: any) => {
      const slide = pptx.addSlide();
      slide.background = { color: C.white };
      addTopBar(slide);

      // ── Header: CONCEPT 번호 + 타입 ──
      slide.addText(cut.conceptNum || `CUT ${cut.cutNum}`, {
        x: 0.6, y: 0.2, w: 4, h: 0.5,
        fontSize: 20, fontFace: 'Arial',
        color: C.black, bold: true,
      });

      if (cut.type) {
        const typeColorMap: Record<string, string> = {
          '연출': C.blue, '스타일링': C.blue,
          'GIF': C.purple, 'gif': C.purple,
          '누끼': C.green, 'nukki': C.green,
          'AI': C.accent,
        };
        const tc = typeColorMap[cut.type] || C.medGray;
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 4.8, y: 0.27, w: 1.4, h: 0.35,
          fill: { color: tc },
          rectRadius: 0.15,
        });
        slide.addText(cut.type, {
          x: 4.8, y: 0.27, w: 1.4, h: 0.35,
          fontSize: 10, fontFace: 'Arial',
          color: C.white, bold: true,
          align: 'center', valign: 'middle',
        });
      }

      // Section mapping badge (right side)
      if (cut.sectionMapping) {
        slide.addText(`→ ${cut.sectionMapping}`, {
          x: 6.5, y: 0.27, w: 3.0, h: 0.35,
          fontSize: 9, fontFace: 'Arial',
          color: C.accent, align: 'right',
        });
      }

      // ── Left: 촬영 시안 영역 (배경색 프리뷰) ──
      const bgHex = (cut.background?.color || '#F0F0F0').replace('#', '');
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.6, y: 0.85, w: 4.8, h: 3.6,
        fill: { color: bgHex },
        rectRadius: 0.1,
        line: { color: C.borderGray, width: 0.5 },
      });

      // Background description label
      if (cut.background?.description) {
        slide.addText(cut.background.description, {
          x: 0.8, y: 3.65, w: 4.4, h: 0.6,
          fontSize: 10, fontFace: 'Arial',
          color: C.medGray, valign: 'top',
        });
      }

      // ── Right: 정보 패널 ──
      const rX = 5.7;
      const rW = 3.9;
      let rY = 0.85;

      const addInfoBlock = (label: string, text: string, labelColor: string = C.medGray) => {
        slide.addText(label, {
          x: rX, y: rY, w: rW, h: 0.25,
          fontSize: 8, fontFace: 'Arial',
          color: labelColor, bold: true,
        });
        rY += 0.25;
        slide.addText(text, {
          x: rX, y: rY, w: rW, h: 0.55,
          fontSize: 10, fontFace: 'Arial',
          color: C.darkGray, valign: 'top', wrap: true,
        });
        rY += 0.6;
      };

      // 배경/색상
      const bgLabel = cut.background?.color ? `배경 ${cut.background.color}` : '배경';
      addInfoBlock('배경 / 색상', cut.background?.description || bgLabel);

      // 구도
      addInfoBlock('구도 / COMPOSITION', cut.composition || '-');

      // 소품
      const propsText = Array.isArray(cut.props) ? cut.props.join(', ') : (cut.props || '-');
      addInfoBlock('소품 / PROPS', propsText);

      // 무드/라이팅
      if (cut.moodLighting) {
        addInfoBlock('무드 / 라이팅', cut.moodLighting);
      }

      // ── Bottom: 레퍼런스 노트 ──
      if (cut.referenceNote) {
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.6, y: 4.6, w: 8.8, h: 0.45,
          fill: { color: C.accentLight },
          rectRadius: 0.05,
        });
        slide.addText(`📌 레퍼런스: ${cut.referenceNote}`, {
          x: 0.8, y: 4.6, w: 8.4, h: 0.45,
          fontSize: 9, fontFace: 'Arial',
          color: C.accent, valign: 'middle',
        });
      }

      // 비고
      if (cut.note) {
        const noteY = cut.referenceNote ? 5.1 : 4.6;
        slide.addText(`💡 ${cut.note}`, {
          x: 0.6, y: noteY, w: 8.8, h: 0.3,
          fontSize: 9, fontFace: 'Arial',
          color: C.medGray, italic: true,
        });
      }

      addFooter(slide, pageCounter++);
    });

    // ══════════════════════════════════════════
    // 누끼 가이드 슬라이드
    // ══════════════════════════════════════════
    if (contiData.nukkiGuide) {
      const nukkiSlide = pptx.addSlide();
      nukkiSlide.background = { color: C.white };
      addTopBar(nukkiSlide, C.green);
      addPageTitle(nukkiSlide, '📐 누끼 가이드');

      nukkiSlide.addText(contiData.nukkiGuide, {
        x: 0.6, y: 1.2, w: 8.8, h: 3.5,
        fontSize: 12, fontFace: 'Arial',
        color: C.darkGray, valign: 'top',
        wrap: true, lineSpacing: 22,
      });

      addFooter(nukkiSlide, pageCounter++);
    }

    // ══════════════════════════════════════════
    // 촬영 주의사항 슬라이드
    // ══════════════════════════════════════════
    if (contiData.shootNotice) {
      const noticeSlide = pptx.addSlide();
      noticeSlide.background = { color: C.white };
      addTopBar(noticeSlide, C.red);
      addPageTitle(noticeSlide, '⚠️ 촬영 주의사항');

      noticeSlide.addText(contiData.shootNotice, {
        x: 0.6, y: 1.2, w: 8.8, h: 3.5,
        fontSize: 12, fontFace: 'Arial',
        color: C.darkGray, valign: 'top',
        wrap: true, lineSpacing: 22,
      });

      addFooter(noticeSlide, pageCounter++);
    }

    // ── PPT 생성 및 반환 ──
    const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(`[콘티]${contiData.projectTitle || '촬영콘티'}`)}.pptx"`,
      },
    });
  } catch (error: any) {
    console.error('PPT 생성 오류:', error);
    return NextResponse.json({ error: `PPT 생성 실패: ${error.message}` }, { status: 500 });
  }
}
