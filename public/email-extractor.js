// DIOPT AI - Hiworks 이메일 자동 추출기 v4
// 받은메일함/보낸메일함 목록에서 실행. iframe으로 각 이메일을 로드하여 본문까지 추출.
// 사용법: Hiworks 메일함 목록에서 F12 > Console > "allow pasting" > 스크립트 붙여넣기

(async function() {
  const SERVER = 'http://localhost:3100/api/email/learn';
  const LOAD_WAIT = 3000; // iframe 로드 대기 (3초)
  const MAX_EMAILS = 200;
  const BATCH_SIZE = 10;

  console.log('🚀 DIOPT AI 이메일 자동 추출기 v4 시작');
  console.log('📍 현재 URL:', window.location.href);

  // 개별 이메일 페이지면 바로 추출
  if (window.location.href.includes('/view/')) {
    console.log('📧 개별 이메일 페이지 감지');
    const email = extractFromLiveDoc(document, window.location.href);
    if (email && email.body.length > 10) {
      console.log('✅ "' + email.subject + '" (' + email.body.length + '자)');
      await sendToServer([email]);
    }
    return;
  }

  // 목록에서 링크 수집
  const mailLinks = collectMailLinks();
  console.log('📧 ' + mailLinks.length + '개 메일 링크 발견');

  if (mailLinks.length === 0) {
    console.log('⚠️ 메일 링크를 찾지 못했습니다.');
    console.log('페이지 내 링크 샘플:', Array.from(document.querySelectorAll('a[href]')).slice(0, 15).map(a => a.getAttribute('href')));
    return;
  }

  // iframe으로 각 이메일 로드 후 추출
  const allEmails = [];
  const count = Math.min(mailLinks.length, MAX_EMAILS);

  for (let i = 0; i < count; i++) {
    const url = mailLinks[i];
    console.log('\n[' + (i+1) + '/' + count + '] ' + url);

    try {
      const email = await loadAndExtract(url);
      if (email && email.body.length > 10) {
        allEmails.push(email);
        console.log('  ✅ "' + email.subject + '" (' + email.body.length + '자)');
      } else {
        console.log('  ⚠️ 본문 추출 실패');
      }
    } catch(e) {
      console.error('  ❌ 에러:', e.message);
    }

    // 배치 전송
    if (allEmails.length > 0 && allEmails.length % BATCH_SIZE === 0) {
      console.log('\n📤 중간 전송: ' + allEmails.length + '개');
      await sendToServer(allEmails.slice(allEmails.length - BATCH_SIZE));
    }
  }

  if (allEmails.length > 0) {
    console.log('\n📤 최종 전송: 총 ' + allEmails.length + '개 이메일');
    await sendToServer(allEmails);
    console.log('🎉 완료!');
  } else {
    console.log('⚠️ 추출된 이메일이 없습니다.');
  }

  // ===== iframe으로 페이지 로드 후 추출 =====
  function loadAndExtract(url) {
    return new Promise(function(resolve) {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1024px;height:768px;opacity:0;pointer-events:none;';
      iframe.src = url;
      document.body.appendChild(iframe);

      // 로드 완료 대기
      iframe.onload = function() {
        // JS 실행 시간 추가 대기
        setTimeout(function() {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const email = extractFromLiveDoc(doc, url);
            resolve(email);
          } catch(e) {
            console.error('  iframe 접근 에러:', e.message);
            resolve(null);
          } finally {
            document.body.removeChild(iframe);
          }
        }, LOAD_WAIT);
      };

      iframe.onerror = function() {
        document.body.removeChild(iframe);
        resolve(null);
      };

      // 타임아웃 (10초)
      setTimeout(function() {
        if (document.body.contains(iframe)) {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const email = extractFromLiveDoc(doc, url);
            resolve(email);
          } catch(e) { resolve(null); }
          try { document.body.removeChild(iframe); } catch(e) {}
        }
      }, 10000);
    });
  }

  // ===== 링크 수집 =====
  function collectMailLinks() {
    const links = new Set();

    // /view/ 포함 링크
    document.querySelectorAll('a[href*="/view/"]').forEach(function(a) {
      const href = a.getAttribute('href');
      if (href && !href.includes('/list/')) {
        links.add(href.startsWith('http') ? href : window.location.origin + href);
      }
    });

    // mail + read 또는 숫자 포함
    if (links.size === 0) {
      document.querySelectorAll('a[href]').forEach(function(a) {
        const href = a.getAttribute('href') || '';
        if ((href.includes('mail') && href.includes('read')) || (href.includes('mail') && /\d{5,}/.test(href))) {
          links.add(href.startsWith('http') ? href : window.location.origin + href);
        }
      });
    }

    // tr onclick / data 속성
    if (links.size === 0) {
      document.querySelectorAll('tr[onclick], tr[data-uid], tr[data-id]').forEach(function(tr) {
        const onclick = tr.getAttribute('onclick') || '';
        const match = onclick.match(/['"]([^'"]*view[^'"]*)['"]/);
        if (match) links.add(match[1].startsWith('http') ? match[1] : window.location.origin + match[1]);
        const uid = tr.getAttribute('data-uid') || tr.getAttribute('data-id');
        if (uid) links.add(window.location.href.replace('/list/', '/view/').replace(/\?.*/, '') + '/' + uid);
      });
    }

    return Array.from(links);
  }

  // ===== 라이브 DOM에서 이메일 추출 =====
  function extractFromLiveDoc(doc, url) {
    try {
      // 제목
      let subject = '';
      var subjectSels = ['.subject_text','.mail_subject','h2.subject','h1.subject','[class*="subject"]','.view_subject'];
      for (var s = 0; s < subjectSels.length; s++) {
        var el = doc.querySelector(subjectSels[s]);
        if (el && el.textContent.trim().length > 2) { subject = el.textContent.trim(); break; }
      }
      if (!subject) { var t = doc.querySelector('title'); if (t) subject = t.textContent.replace(/\s*[-|].*$/, '').trim(); }

      // 보낸 사람
      var from = '', fromSels = ['.from_addr','[class*="from"]','[class*="sender"]'];
      for (s = 0; s < fromSels.length; s++) { el = doc.querySelector(fromSels[s]); if (el) { from = el.textContent.trim(); break; } }

      // 받는 사람
      var to = '', toSels = ['.to_addr','[class*="to_addr"]','[class*="receiver"]'];
      for (s = 0; s < toSels.length; s++) { el = doc.querySelector(toSels[s]); if (el) { to = el.textContent.trim(); break; } }

      // 참조
      var cc = '', ccSels = ['[class*="cc_addr"]','[class*="cc"]'];
      for (s = 0; s < ccSels.length; s++) { el = doc.querySelector(ccSels[s]); if (el) { cc = el.textContent.trim(); break; } }

      // 날짜
      var date = '', dateSels = ['[class*="date"]','[class*="time"]'];
      for (s = 0; s < dateSels.length; s++) { el = doc.querySelector(dateSels[s]); if (el) { date = el.textContent.trim(); break; } }

      // 첨부파일
      var attachments = '', attachSels = ['[class*="attach"]','[class*="file"]'];
      for (s = 0; s < attachSels.length; s++) {
        var els = doc.querySelectorAll(attachSels[s]);
        if (els.length > 0) { attachments = Array.from(els).map(function(e) { return e.textContent.trim(); }).filter(function(t) { return t; }).join(', '); break; }
      }

      // 본문 - 핵심: iframe 내부 본문 먼저 확인
      var body = '', bodyHtml = '';

      // 1) iframe 안의 본문 (Hiworks는 이메일 본문을 iframe에 넣음)
      var iframes = doc.querySelectorAll('iframe');
      for (var f = 0; f < iframes.length; f++) {
        try {
          var iframeDoc = iframes[f].contentDocument || iframes[f].contentWindow.document;
          if (iframeDoc && iframeDoc.body) {
            var text = iframeDoc.body.innerText || iframeDoc.body.textContent || '';
            if (text.length > body.length) {
              body = text;
              bodyHtml = iframeDoc.body.innerHTML || '';
            }
          }
        } catch(e) {}
      }

      // 2) 본문 영역 클래스
      if (body.length < 30) {
        var bodySels = ['.mail_body','.mail_content','.view_body','[class*="mail_body"]','[class*="content_body"]','[class*="view_content"]','#mailBody','#mail_body'];
        for (s = 0; s < bodySels.length; s++) {
          el = doc.querySelector(bodySels[s]);
          if (el) {
            var txt = el.innerText || el.textContent || '';
            if (txt.length > body.length) { body = txt; bodyHtml = el.innerHTML || ''; }
          }
        }
      }

      // 3) 폴백: 가장 큰 텍스트 블록
      if (body.length < 30) {
        var candidates = doc.querySelectorAll('div, td, article, section');
        var bestLen = 0;
        for (var c = 0; c < candidates.length; c++) {
          var txt2 = (candidates[c].innerText || candidates[c].textContent || '').trim();
          if (txt2.length > bestLen && txt2.length > 50) {
            var ratio = txt2.length / (candidates[c].querySelectorAll('a').length + 1);
            if (ratio > 20) { body = txt2; bodyHtml = candidates[c].innerHTML || ''; bestLen = txt2.length; }
          }
        }
      }

      return { subject: subject, from: from, to: to, cc: cc, date: date, attachments: attachments, body: body.substring(0, 15000), bodyHtml: bodyHtml.substring(0, 30000), url: url, extractedAt: new Date().toISOString() };
    } catch(e) { console.error('추출 에러:', e.message); return null; }
  }

  // ===== 서버 전송 =====
  async function sendToServer(emails) {
    try {
      var res = await fetch(SERVER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emails: emails }) });
      var data = await res.json();
      console.log('✅ 서버 전송 완료:', data);
    } catch(e) {
      console.error('❌ 서버 전송 실패:', e.message);
      console.log(JSON.stringify(emails, null, 2));
    }
  }
})();
