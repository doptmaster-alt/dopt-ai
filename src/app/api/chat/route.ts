import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { streamChatWithTools, FileAttachment } from '@/lib/claude';
import { getMessages, addMessage, getProject, updateProjectStep, saveStepData, getStepData } from '@/lib/db';
import { addCommands, isPluginConnected } from '@/lib/figma-queue';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { projectId, message, currentStep, fileAttachment } = await req.json();

  const project = getProject(projectId);
  if (!project) {
    return new Response('Project not found', { status: 404 });
  }

  // 사용자 메시지 저장
  addMessage(projectId, 'user', message, currentStep);

  // 기존 대화 이력 불러오기 (최근 40개로 제한 — 너무 길면 AI가 도구 호출 대신 텍스트로만 답함)
  const dbMessages = getMessages(projectId);
  const allMessages = dbMessages.map((m: any) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
  // 최근 40개 메시지만 사용 (첫 2개는 컨텍스트를 위해 항상 포함)
  const chatMessages = allMessages.length > 40
    ? [...allMessages.slice(0, 2), ...allMessages.slice(-38)]
    : allMessages;

  try {
    // 자동 스텝 전환 감지
    let effectiveStep = currentStep;
    // 디자인 가이드 요청 → STEP 6
    if (currentStep !== 6 && currentStep >= 4 && /디자인\s*가이드/i.test(message)) {
      effectiveStep = 6;
      updateProjectStep(projectId, 6);
      console.log(`[Chat API] Auto-advance to STEP 6 (design guide request detected)`);
    }
    // 총평 요청 → STEP 9
    if (currentStep !== 9 && currentStep >= 8 && /총평|리포트|리포팅|마무리.*평가/i.test(message)) {
      effectiveStep = 9;
      updateProjectStep(projectId, 9);
      console.log(`[Chat API] Auto-advance to STEP 9 (review request detected)`);
    }

    console.log('[Chat API] Starting chat for project', projectId, 'step', effectiveStep, 'messages:', chatMessages.length, 'hasFile:', !!fileAttachment);

    // export_to_figma 핸들러가 DB에서 섹션 데이터를 병합할 수 있도록 projectId 전달
    (globalThis as any).__dioptCurrentProjectId = projectId;

    const encoder = new TextEncoder();
    let fullResponse = '';
    let formUpdateCalled = false;

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // 스텝 전환이 발생했으면 프론트엔드에도 알림
          if (effectiveStep !== currentStep) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ stepUpdate: effectiveStep })}\n\n`)
            );
          }

          const generator = streamChatWithTools(
            chatMessages,
            effectiveStep,
            fileAttachment as FileAttachment | undefined,
            project.client_name || undefined,
          );

          for await (const event of generator) {
            if (event.type === 'text' && event.text) {
              fullResponse += event.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.text })}\n\n`)
              );
            } else if (event.type === 'form_update' && event.formData) {
              formUpdateCalled = true;
              // 기획안 데이터(sections 포함)는 항상 step 3에 저장 (V2 파이프라인 10단계)
              const saveStep = (event.formData.sections?.length > 0 && effectiveStep === 3) ? 3 : effectiveStep;
              try {
                let dataToSave = event.formData;

                // ═══ 섹션 병합: 기존 DB 데이터와 새 섹션을 합침 (배치 저장 지원) ═══
                if (saveStep === 3 && event.formData.sections?.length > 0) {
                  try {
                    const existingRow = getStepData(parseInt(projectId), 3);
                    if (existingRow?.form_data) {
                      const existing = JSON.parse(existingRow.form_data);
                      if (existing.sections?.length > 0) {
                        // 기존 섹션을 Map으로 (num 기준)
                        const sectionMap = new Map<number, any>();
                        for (const sec of existing.sections) {
                          sectionMap.set(sec.num, sec);
                        }
                        // 새 섹션으로 덮어쓰기/추가
                        for (const sec of event.formData.sections) {
                          sectionMap.set(sec.num, sec);
                        }
                        // num 순서로 정렬
                        const mergedSections = [...sectionMap.values()].sort((a, b) => a.num - b.num);
                        dataToSave = { ...existing, ...event.formData, sections: mergedSections };
                        console.log(`[Chat API] Sections merged: existing ${existing.sections.length} + new ${event.formData.sections.length} = ${mergedSections.length}`);
                      }
                    }
                  } catch (mergeErr: any) {
                    console.error('[Chat API] Section merge error:', mergeErr.message);
                  }
                }

                // ═══ 콘티 병합: step 6 데이터 (V2) — cutPages 배치 누적 병합 ═══
                if (saveStep === 4) {
                  try {
                    const existingRow = getStepData(parseInt(projectId), 4);
                    if (existingRow?.form_data) {
                      const existing = JSON.parse(existingRow.form_data);

                      if (event.formData.cutPages?.length > 0) {
                        const isBatch = event.formData.cutPagesBatch === true;

                        if (isBatch && existing.cutPages?.length > 0) {
                          // 배치 모드: 기존 cutPages에 새 컷 추가 (cutNum 기준 중복 제거)
                          const cutMap = new Map<number, any>();
                          for (const cut of existing.cutPages) cutMap.set(cut.cutNum, cut);
                          for (const cut of event.formData.cutPages) cutMap.set(cut.cutNum, cut);
                          const mergedCuts = [...cutMap.values()].sort((a, b) => a.cutNum - b.cutNum);
                          const { cutPagesBatch, ...rest } = event.formData;
                          dataToSave = { ...existing, ...rest, cutPages: mergedCuts };
                          console.log(`[Chat API] Conti BATCH merge: existing ${existing.cutPages.length} + new ${event.formData.cutPages.length} = ${mergedCuts.length} cuts`);
                        } else {
                          // 일반 모드: 기본 정보 병합 + cutPages 교체
                          dataToSave = { ...existing, ...event.formData };
                          console.log(`[Chat API] Conti replace: ${event.formData.cutPages.length} cuts`);
                        }
                      } else {
                        // cutPages 없이 기본 정보만 온 경우 — 기존 cutPages 보존
                        dataToSave = { ...existing, ...event.formData };
                        if (existing.cutPages?.length > 0) {
                          dataToSave.cutPages = existing.cutPages;
                        }
                        console.log(`[Chat API] Conti info update, preserved ${dataToSave.cutPages?.length || 0} existing cuts`);
                      }
                    }
                  } catch (mergeErr: any) {
                    console.error('[Chat API] Conti merge error:', mergeErr.message);
                  }
                }

                saveStepData(projectId, saveStep, JSON.stringify(dataToSave), event.formStatus || 'draft');
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ formUpdate: dataToSave, formStatus: event.formStatus || 'draft' })}\n\n`)
                );
                console.log('[Chat API] Form data updated for step', saveStep, 'sections:', dataToSave.sections?.length || 0, 'cutPages:', dataToSave.cutPages?.length || 0);
              } catch (e: any) {
                console.error('[Chat API] Failed to save form data:', e.message);
              }
            } else if (event.type === 'tool_use') {
              // 도구 사용 중임을 프론트엔드에 알림
              const statusMessages: Record<string, string> = {
                web_search: `🔍 웹 검색 중: "${event.toolInput}"...`,
                fetch_webpage: `🌐 웹페이지 로딩 중...`,
                notion_search: `📓 노션 검색 중: "${event.toolInput}"...`,
                notion_read_page: `📓 노션 페이지 읽는 중...`,
                notion_query_database: `📓 노션 데이터베이스 조회 중...`,
                notion_create_page: `📓 노션 페이지 생성 중...`,
                notion_append_content: `📓 노션에 내용 추가 중...`,
                figma_get_file: `🎨 Figma 파일 분석 중...`,
                figma_get_node: `🎨 Figma 요소 조회 중...`,
                figma_export_image: `🎨 Figma 이미지 내보내기 중...`,
                figma_add_comment: `🎨 Figma에 댓글 추가 중...`,
                figma_get_comments: `🎨 Figma 댓글 조회 중...`,
                figma_list_team_projects: `🎨 Figma 프로젝트 목록 조회 중...`,
                figma_list_project_files: `🎨 Figma 파일 목록 조회 중...`,
                figma_design: `🎨 Figma에서 디자인 생성 중...`,
                export_to_figma: `🎨 Figma에 기획안 내보내기 중...`,
                search_knowledge: `📚 Knowledge Base 검색 중...`,
                save_to_knowledge: `📚 Knowledge Base에 저장 중...`,
                update_step_form: `📝 기획안 섹션 데이터 저장 중...`,
                take_screenshot: `📸 웹페이지 스크린샷 촬영 중...`,
                screenshot_to_figma: `📸 스크린샷 촬영 후 Figma에 배치 중...`,
              };
              const statusMsg = statusMessages[event.toolName || ''] || `⚙️ 작업 중...`;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ status: statusMsg })}\n\n`)
              );
            }
          }

          console.log('[Chat API] Complete, response length:', fullResponse.length);

          // 레퍼런스 이미지 폴백: AI가 update_step_form을 호출하지 않은 경우
          // 최소한 referenceImageUrl만이라도 해당 섹션에 저장
          const hasRefImage = fileAttachment?.type === 'image' && fileAttachment?.fileUrl;
          const isRefRequest = hasRefImage && /섹션|구조|참고|레퍼런스|이렇게|이 느낌|이 구조|반영|수정|변경|적용/i.test(message);
          if (isRefRequest && !formUpdateCalled) {
            console.log('[Chat API] Reference image fallback: AI did not call update_step_form, saving referenceImageUrl directly');
            try {
              // 섹션 번호 추출 (예: "9번째 섹션", "섹션 9", "9섹션", "9번 섹션")
              const sectionMatch = message.match(/(\d+)\s*번?\s*(?:째\s*)?섹션|섹션\s*(\d+)/);
              const sectionNum = sectionMatch ? parseInt(sectionMatch[1] || sectionMatch[2]) : null;

              if (sectionNum) {
                // step 5 우선, 없으면 현재 step
                let stepToSave = 3;
                let row = getStepData(parseInt(projectId), 3);
                if (!row?.form_data) {
                  row = getStepData(parseInt(projectId), effectiveStep);
                  stepToSave = effectiveStep;
                }
                if (row?.form_data) {
                  const formData = JSON.parse(row.form_data);
                  if (formData.sections && Array.isArray(formData.sections)) {
                    const sectionIdx = sectionNum - 1; // 0-indexed
                    if (sectionIdx >= 0 && sectionIdx < formData.sections.length) {
                      const serverUrl = process.env.NEXTAUTH_URL || 'http://localhost:3100';
                      formData.sections[sectionIdx].referenceImageUrl = `${serverUrl}${fileAttachment.fileUrl}`;
                      formData.sections[sectionIdx].referenceNote = formData.sections[sectionIdx].referenceNote || `레퍼런스 이미지 (섹션 ${sectionNum})`;

                      // AI 응답에서 wireframeBlocks 파싱 시도
                      const wfMatch = fullResponse.match(/"wireframeBlocks"\s*:\s*(\[[\s\S]*?\])\s*(?:,|\})/);
                      if (wfMatch) {
                        try {
                          const wireframeBlocks = JSON.parse(wfMatch[1]);
                          if (Array.isArray(wireframeBlocks) && wireframeBlocks.length > 0) {
                            formData.sections[sectionIdx].wireframeBlocks = wireframeBlocks;
                            console.log(`[Chat API] Parsed ${wireframeBlocks.length} wireframeBlocks from AI response for section ${sectionNum}`);
                          }
                        } catch {}
                      }

                      // AI 응답에서 copyBlocks 파싱 시도
                      const cbMatch = fullResponse.match(/"copyBlocks"\s*:\s*(\[[\s\S]*?\])\s*(?:,|\})/);
                      if (cbMatch) {
                        try {
                          const copyBlocks = JSON.parse(cbMatch[1]);
                          if (Array.isArray(copyBlocks) && copyBlocks.length > 0) {
                            formData.sections[sectionIdx].copyBlocks = copyBlocks;
                            console.log(`[Chat API] Parsed ${copyBlocks.length} copyBlocks from AI response for section ${sectionNum}`);
                          }
                        } catch {}
                      }

                      saveStepData(projectId, stepToSave, JSON.stringify(formData), 'draft');
                      console.log(`[Chat API] Reference image saved to section ${sectionNum} (step ${stepToSave})`);

                      controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ formUpdate: formData, formStatus: 'draft' })}\n\n`)
                      );
                    }
                  }
                }
              }
            } catch (e: any) {
              console.error('[Chat API] Reference image fallback error:', e.message);
            }
          }

          // 기획안 텍스트 파싱 폴백: AI가 기획안을 텍스트로만 작성하고 update_step_form을 호출하지 않은 경우
          if (!formUpdateCalled && effectiveStep >= 4 && effectiveStep <= 5) {
            // 3개 이상 섹션이 텍스트에 포함되어 있으면 기획안 작성으로 간주
            const sectionMatches = fullResponse.match(/섹션\s*\d+\s*[:：]/g) || [];
            if (sectionMatches.length >= 3) {
              console.log(`[Chat API] Plan text fallback: Found ${sectionMatches.length} sections in text, parsing...`);
              try {
                const sections: any[] = [];
                // 섹션별로 분리하여 파싱
                const sectionRegex = /(?:#{1,4}\s*)?(?:\*{0,2})?(?:[\u{1F300}-\u{1F9FF}]\s*)?섹션\s*(\d+)\s*[:：.]\s*(.+?)(?:\*{0,2})\n([\s\S]*?)(?=(?:#{1,4}\s*)?(?:\*{0,2})?(?:[\u{1F300}-\u{1F9FF}]\s*)?섹션\s*\d+\s*[:：.]|##\s*[🎯💬📋]|---\s*$|$)/gmu;
                let match;
                while ((match = sectionRegex.exec(fullResponse)) !== null) {
                  const num = parseInt(match[1]);
                  const name = match[2].trim().replace(/\*+/g, '');
                  const body = match[3];

                  const mainCopy = body.match(/\*{0,2}메인\s*카피\*{0,2}\s*[:：]\s*(.+)/)?.[1]?.trim() || '';
                  const subCopy = body.match(/\*{0,2}서브\s*카피\*{0,2}\s*[:：]\s*(.+)/)?.[1]?.trim() || '';
                  const visualDirection = body.match(/\*{0,2}비주얼\s*디렉션\*{0,2}\s*[:：]\s*(.+)/)?.[1]?.trim() || '';
                  const layout = body.match(/\*{0,2}레이아웃\*{0,2}\s*[:：]\s*(.+)/)?.[1]?.trim() || '';
                  const aeCommentary = body.match(/\*{0,2}AE\s*Commentary\*{0,2}\s*[:：]\s*(.+)/)?.[1]?.trim() || '';

                  // ═══ 📋 문구 구성 파싱 → copyBlocks ═══
                  const copyBlocks: any[] = [];
                  const copySection = body.match(/문구\s*구성\s*[:：]?\s*\n([\s\S]*?)(?=\n\s*(?:\*{0,2})?(?:📐|디자인\s*구조)|비주얼\s*디렉션|레이아웃|$)/)?.[1] || '';
                  if (copySection) {
                    const lines = copySection.split('\n').map(l => l.replace(/^[\s\-\*•]+/, '').trim()).filter(Boolean);
                    for (const line of lines) {
                      const m = line.match(/\[([^\]]+)\]\s*(.+)/);
                      if (!m) continue;
                      const tag = m[1].trim();
                      const text = m[2].trim();
                      if (/섹션\s*타이틀/i.test(tag)) copyBlocks.push({ type: 'section-title', text });
                      else if (/라벨/i.test(tag)) copyBlocks.push({ type: 'label', text });
                      else if (/메인\s*카피/i.test(tag)) copyBlocks.push({ type: 'copy-main', text });
                      else if (/서브\s*카피/i.test(tag)) copyBlocks.push({ type: 'copy-sub', text });
                      else if (/리스트/i.test(tag)) copyBlocks.push({ type: 'list', items: text.split(/\s*[\/|]\s*/).filter(Boolean) });
                      else if (/숫자\s*강조|kv|키.*값/i.test(tag)) {
                        const kvMatch = text.match(/(.+?)[:：]\s*(.+)/);
                        if (kvMatch) copyBlocks.push({ type: 'kv-pair', label: kvMatch[1].trim(), value: kvMatch[2].trim() });
                        else copyBlocks.push({ type: 'text', text });
                      }
                      else if (/참고/i.test(tag)) copyBlocks.push({ type: 'note', text });
                      else if (/ae/i.test(tag)) copyBlocks.push({ type: 'ae-comment', text });
                      else if (/이미지\s*영역/i.test(tag)) copyBlocks.push({ type: 'image-placeholder', text, desc: text });
                      else if (/프로모|배지|뱃지/i.test(tag)) copyBlocks.push({ type: 'promo-box', text });
                      else if (/정보\s*박스|info/i.test(tag)) {
                        const ibMatch = text.match(/(.+?)[:：]\s*(.+)/);
                        if (ibMatch) copyBlocks.push({ type: 'info-box', label: ibMatch[1].trim(), text: ibMatch[2].trim() });
                        else copyBlocks.push({ type: 'info-box', label: tag, text });
                      }
                      else if (/가격/i.test(tag)) copyBlocks.push({ type: 'kv-pair', label: '가격', value: text });
                      else if (/텍스트/i.test(tag)) copyBlocks.push({ type: 'text', text });
                      else copyBlocks.push({ type: 'text', text: `${tag}: ${text}` });
                    }
                  }

                  // ═══ 📐 디자인 구조 파싱 → wireframeBlocks ═══
                  const wfBlocks: any[] = [];
                  const wfSection = body.match(/디자인\s*구조\s*[:：]?\s*\n([\s\S]*?)(?=\n\s*(?:\*{0,2})?(?:비주얼\s*디렉션|레이아웃|AE\s*Commentary)|$)/)?.[1] || '';
                  if (wfSection) {
                    const lines = wfSection.split('\n').map(l => l.replace(/^[\s\-\*•]+/, '').trim()).filter(Boolean);
                    for (const line of lines) {
                      const m = line.match(/\[([^\]]+)\]\s*(.+)/);
                      if (!m) continue;
                      const tag = m[1].trim();
                      const text = m[2].trim();
                      if (/헤딩/i.test(tag)) wfBlocks.push({ type: 'wf-heading', text: text.replace(/\s*\([^)]*\)\s*$/, '') });
                      else if (/텍스트/i.test(tag)) wfBlocks.push({ type: 'wf-text', text: text.replace(/\s*\([^)]*\)\s*$/, '') });
                      else if (/이미지/i.test(tag)) wfBlocks.push({ type: 'wf-image', text, desc: text, height: 280 });
                      else if (/카드\s*그리드/i.test(tag)) {
                        const colMatch = tag.match(/(\d+)\s*열/); const cols = colMatch ? parseInt(colMatch[1]) : 3;
                        const items = text.split(/\s*[\/|]\s*/).filter(Boolean).map(t => { const p = t.match(/(.+?)[:：]\s*(.+)/); return p ? { label: p[1].trim(), desc: p[2].trim() } : { label: t.trim(), desc: '' }; });
                        wfBlocks.push({ type: 'wf-card-grid', cols, items });
                      }
                      else if (/테이블/i.test(tag)) {
                        const items = text.split(/\s*[\/|]\s*/).filter(Boolean).map(t => { const p = t.match(/(.+?)[:：]\s*(.+)/); return p ? { label: p[1].trim(), value: p[2].trim() } : { label: t.trim(), value: '' }; });
                        wfBlocks.push({ type: 'wf-table', text: tag, items });
                      }
                      else if (/숫자\s*강조|스탯|stats/i.test(tag)) {
                        const items = text.split(/\s*[\/|]\s*/).filter(Boolean).map(t => { const p = t.match(/(.+?)[:：]\s*(.+)/); return p ? { label: p[1].trim(), value: p[2].trim() } : { label: t.trim(), value: '-' }; });
                        wfBlocks.push({ type: 'wf-stats', items });
                      }
                      else if (/체크리스트|체크\s*포인트/i.test(tag)) {
                        const items = text.split(/\s*[\/|]\s*/).filter(Boolean).map(t => ({ label: t.trim() }));
                        wfBlocks.push({ type: 'wf-checklist', items });
                      }
                      else if (/비교/i.test(tag)) {
                        const items = text.split(/\s*[\/|]\s*/).filter(Boolean).map(t => { const p = t.match(/(.+?)[:：]\s*(.+)/); return p ? { label: p[1].trim(), value: '', desc: p[2].trim() } : { label: t.trim(), value: '', desc: '' }; });
                        wfBlocks.push({ type: 'wf-comparison-row', items });
                      }
                      else if (/뱃지|배지|프로모\s*배지/i.test(tag)) {
                        const items = text.split(/\s*[\/|]\s*/).filter(Boolean).map(t => ({ label: t.trim() }));
                        wfBlocks.push({ type: 'wf-badge-row', items });
                      }
                      else if (/아이콘\s*리스트/i.test(tag)) {
                        const items = text.split(/\s*[\/|]\s*/).filter(Boolean).map(t => { const p = t.match(/(.+?)[:：]\s*(.+)/); return p ? { label: p[1].trim(), desc: p[2].trim() } : { label: t.trim(), desc: '' }; });
                        wfBlocks.push({ type: 'wf-icon-list', items });
                      }
                      else if (/분할|좌우/i.test(tag)) wfBlocks.push({ type: 'wf-split', text, label: '[이미지]', desc: text });
                      else if (/바\s*차트|진행/i.test(tag)) {
                        const items = text.split(/\s*[\/|]\s*/).filter(Boolean).map(t => { const p = t.match(/(.+?)[:：]\s*(\d+)/); return p ? { label: p[1].trim(), percent: parseInt(p[2]) } : { label: t.trim(), percent: 80 }; });
                        wfBlocks.push({ type: 'wf-bar-chart', text: tag, items });
                      }
                      else if (/아코디언|faq/i.test(tag)) {
                        const items = text.split(/\s*[\/|]\s*/).filter(Boolean).map(t => { const p = t.match(/(.+?)[:：]\s*(.+)/); return p ? { label: p[1].trim(), desc: p[2].trim() } : { label: t.trim(), desc: '' }; });
                        wfBlocks.push({ type: 'wf-accordion', items });
                      }
                      else if (/제품\s*그리드/i.test(tag)) {
                        const items = text.split(/\s*[\/|]\s*/).filter(Boolean).map(t => ({ label: t.trim(), desc: '', value: '' }));
                        wfBlocks.push({ type: 'wf-product-grid', cols: 2, items });
                      }
                      else wfBlocks.push({ type: 'wf-text', text });
                    }
                  }

                  sections.push({ num, name, mainCopy, subCopy, visualDirection, layout, aeCommentary,
                    copyBlocks: copyBlocks.length >= 3 ? copyBlocks : null,
                    wireframeBlocks: wfBlocks.length >= 2 ? wfBlocks : null,
                  });
                }

                if (sections.length >= 3) {
                  // ═══ 전체 섹션 일괄 보강 (copyBlocks + wireframeBlocks) — 섹션 간 중복 방지 ═══
                  const allComplexTypes = ['wf-card-grid','wf-table','wf-split','wf-checklist','wf-stats','wf-image','wf-icon-list','wf-bar-chart','wf-badge-row','wf-accordion','wf-comparison-row','wf-product-grid'];
                  const globalUsed = new Set<string>();
                  const keywordMap: [RegExp, string, number][] = [
                    [/히어로|메인.*비주얼|대표|커버|첫/, 'wf-image', 4],
                    [/분할|좌우|좌측|우측|split/, 'wf-split', 3],
                    [/통계|수치|데이터|%|증가|감소|매출|성장|효과|결과/, 'wf-stats', 4],
                    [/통계|수치|%|효과|결과|실험/, 'wf-bar-chart', 3],
                    [/비교|차별|차이|vs|대비|기존|경쟁/, 'wf-comparison-row', 4],
                    [/비교|스펙|사양|규격|성분표/, 'wf-table', 3],
                    [/특징|기능|장점|포인트|핵심|강점/, 'wf-icon-list', 4],
                    [/나열|종류|구성|라인업|카테고리/, 'wf-card-grid', 4],
                    [/후기|리뷰|고객|만족|평점|추천/, 'wf-bar-chart', 4],
                    [/후기|리뷰|인증|수상|신뢰/, 'wf-stats', 3],
                    [/faq|질문|답변|궁금|문의/, 'wf-accordion', 5],
                    [/구매|주문|가격|할인|프로모|혜택|cta/, 'wf-product-grid', 4],
                    [/구매|배송|무료|보장|정품/, 'wf-badge-row', 3],
                    [/체크|확인|문제|고민|안전|위험|pain/, 'wf-checklist', 4],
                    [/인증|특허|수상|iso|kc/, 'wf-badge-row', 3],
                    [/성분|원료|기술|원리|과학/, 'wf-table', 4],
                    [/패키지|세트|옵션|용량/, 'wf-product-grid', 3],
                    [/사용.*방법|how|step|단계|절차/, 'wf-icon-list', 3],
                    [/제품.*소개|overview|핵심/, 'wf-split', 3],
                    [/이미지|사진|촬영|비주얼|무드/, 'wf-image', 2],
                  ];
                  const createWfBlock = (type: string, sec: any): any => {
                    const n = sec.name || '', mc = sec.mainCopy || n, sc = sec.subCopy || '', vd = sec.visualDirection || '', ly = sec.layout || '';
                    switch (type) {
                      case 'wf-image': return { type, text: `${n} 비주얼`, desc: vd || mc, height: 280 + (sec.num % 4) * 40 };
                      case 'wf-split': return { type, text: mc, label: '[이미지]', desc: ly || sc || '구성' };
                      case 'wf-stats': return { type, items: [{ label: '지표 1', value: '-' }, { label: '지표 2', value: '-' }, { label: '지표 3', value: '-' }] };
                      case 'wf-bar-chart': return { type, text: `${n} 데이터`, items: [{ label: 'A', percent: 85+(sec.num*3)%15 }, { label: 'B', percent: 70+(sec.num*7)%25 }] };
                      case 'wf-comparison-row': return { type, items: [{ label: '비교', value: '기존', desc: '당사' }, { label: '추가', value: '일반', desc: '프리미엄' }] };
                      case 'wf-table': return { type, text: `${n} 상세`, items: [{ label: '항목1', value: '값1' }, { label: '항목2', value: '값2' }, { label: '항목3', value: '값3' }] };
                      case 'wf-icon-list': return { type, items: [{ label: '포인트1', desc: mc }, { label: '포인트2', desc: sc || '설명' }, { label: '포인트3', desc: '설명' }] };
                      case 'wf-card-grid': return { type, cols: 3, items: [{ label: '항목1', desc: '설명' }, { label: '항목2', desc: '설명' }, { label: '항목3', desc: '설명' }] };
                      case 'wf-checklist': return { type, items: [{ label: '체크1' }, { label: '체크2' }, { label: '체크3' }] };
                      case 'wf-badge-row': return { type, items: [{ label: '뱃지1' }, { label: '뱃지2' }, { label: '뱃지3' }] };
                      case 'wf-accordion': return { type, items: [{ label: 'Q1', desc: '답변' }, { label: 'Q2', desc: '답변' }] };
                      case 'wf-product-grid': return { type, cols: 2, items: [{ label: '옵션A', desc: '구성', value: '가격' }, { label: '옵션B', desc: '구성', value: '가격' }] };
                      default: return { type: 'wf-text', text: `${n} 구성` };
                    }
                  };

                  let parsedCount = 0;
                  let enrichedCount = 0;
                  for (const sec of sections) {
                    const n = sec.name || '', mc = sec.mainCopy || '', sc = sec.subCopy || '', vd = sec.visualDirection || '', ly = sec.layout || '', ae = sec.aeCommentary || '';

                    // copyBlocks — 파싱된 것이 있으면 사용, 없으면 생성
                    if (sec.copyBlocks && sec.copyBlocks.length >= 3) {
                      parsedCount++;
                    } else {
                      sec.copyBlocks = [
                        { type: 'section-title', text: `섹션 ${sec.num}  ${n}` },
                        { type: 'label', text: '메인 카피' },
                        { type: 'copy-main', text: mc || n },
                        { type: 'copy-sub', text: sc || `${n} 상세 설명` },
                        { type: 'label', text: '비주얼 디렉션' },
                        { type: 'text', text: vd || `${n} 비주얼 구성` },
                        { type: 'info-box', label: '레이아웃', text: ly || `${n} 레이아웃` },
                        { type: 'ae-comment', text: ae || `${n} 전략 코멘트` },
                      ];
                      enrichedCount++;
                    }

                    // wireframeBlocks — 파싱된 것이 있으면 사용, 없으면 키워드 기반 생성
                    if (sec.wireframeBlocks && sec.wireframeBlocks.length >= 2) {
                      // 파싱 성공 — 그대로 사용
                    } else {
                      const allText = `${n} ${mc} ${sc} ${vd} ${ly} ${ae}`.toLowerCase();
                      const scores: Record<string, number> = {};
                      allComplexTypes.forEach(t => { scores[t] = 0; });
                      for (const [rx, bt, sc2] of keywordMap) { if (rx.test(allText)) scores[bt] = (scores[bt] || 0) + sc2; }

                      const ranked = Object.entries(scores).filter(([,s]) => s > 0).sort((a,b) => b[1] - a[1]);
                      const selected: string[] = [];
                      for (const [bt] of ranked) {
                        if (selected.length >= 3) break;
                        if (globalUsed.has(bt) && ranked.length > selected.length + 1) continue;
                        selected.push(bt);
                      }
                      if (selected.length < 2) {
                        for (const t of allComplexTypes) { if (selected.length >= 3) break; if (!selected.includes(t) && !globalUsed.has(t)) selected.push(t); }
                      }
                      selected.forEach(t => globalUsed.add(t));

                      const wf: any[] = [{ type: 'wf-heading', text: mc || n }, { type: 'wf-text', text: sc || `${n} 설명` }];
                      for (const t of selected) { if (wf.length < 6) wf.push(createWfBlock(t, sec)); }
                      while (wf.length < 5) { const u = allComplexTypes.find(t => !selected.includes(t) && !globalUsed.has(t)); if (u) { wf.push(createWfBlock(u, sec)); globalUsed.add(u); } else wf.push({ type: 'wf-text', text: `${n} 추가` }); }
                      sec.wireframeBlocks = wf;
                    }
                  }
                  console.log(`[Chat API] Text fallback: ${sections.length} sections — parsed: ${parsedCount}, enriched: ${enrichedCount}, blocks: [${[...globalUsed].join(',')}]`);

                  const planData = { sections, brandName: project.client_name || project.title, productName: project.title };
                  saveStepData(projectId, 4, JSON.stringify(planData), 'draft');
                  console.log(`[Chat API] Plan text fallback: Saved ${sections.length} sections to step 4`);

                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ formUpdate: planData, formStatus: 'draft' })}\n\n`)
                  );
                }
              } catch (e: any) {
                console.error('[Chat API] Plan text fallback error:', e.message);
              }
            }
          }

          // Figma 내보내기 폴백: AI가 도구를 호출하지 않고 텍스트로만 답한 경우
          const isFigmaRequest = /피그마|figma/i.test(message) && /내보내|보내|작성|만들|출력|다시/i.test(message);
          const toolWasCalled = fullResponse.includes('Figma에') && fullResponse.includes('내보내기 완료');
          if (isFigmaRequest && !toolWasCalled && isPluginConnected()) {
            console.log('[Chat API] Figma export fallback: AI did not call tool, executing directly');
            try {
              // 기획안 데이터 가져오기 (step 3 기획안 우선, 없으면 현재 step)
              const stepsToTry = [3, effectiveStep];
              let formData: any = null;
              for (const s of stepsToTry) {
                const row = getStepData(parseInt(projectId), s);
                if (row?.form_data) {
                  try { formData = JSON.parse(row.form_data); } catch {}
                  if (formData && Object.keys(formData).length > 0) break;
                  formData = null;
                }
              }
              if (formData) {
                const { buildFigmaExport } = await import('@/app/api/figma-export/builder');
                const step = formData.sections ? 3 : (formData.competitors ? 0 : (formData.productName ? 1 : 3));
                const commands = buildFigmaExport(step, formData, project.title || '프로젝트');
                console.log(`[Chat API] Figma fallback: step ${step}, ${commands.length} commands`);
                addCommands(commands);
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ status: `🎨 Figma에 기획안 내보내기 중... (${commands.length}개 요소)` })}\n\n`)
                );
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: `\n\n✅ Figma에 ${commands.length}개 요소를 직접 전송했습니다! Figma를 확인해보세요.` })}\n\n`)
                );
              }
            } catch (e: any) {
              console.error('[Chat API] Figma fallback error:', e.message);
            }
          }

          // AI 응답 저장
          if (fullResponse) {
            addMessage(projectId, 'assistant', fullResponse, effectiveStep);
          }

          // 단계 전환 감지
          const stepMatch = fullResponse.match(/STEP\s*(\d+)/);
          if (stepMatch) {
            const detectedStep = parseInt(stepMatch[1]);
            if (detectedStep > effectiveStep && detectedStep <= 11) {
              updateProjectStep(projectId, detectedStep);
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ stepUpdate: detectedStep })}\n\n`)
              );
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err: any) {
          console.error('[Chat API] Error:', err?.message || err);
          const errorMsg = err?.message || 'AI 응답 생성 중 오류가 발생했습니다.';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`)
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Claude API error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'AI 응답 생성 중 오류가 발생했습니다.' }),
      { status: 500 }
    );
  }
}
