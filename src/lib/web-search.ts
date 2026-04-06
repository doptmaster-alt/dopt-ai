// 웹 검색 기능 - Puppeteer 기반 (안정적)

import puppeteer from 'puppeteer';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

let browserInstance: any = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });
  }
  return browserInstance;
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  console.log(`[WebSearch] 검색 시작: "${query}"`);

  // 1차: DuckDuckGo HTML (봇 차단 없음, 가장 안정적)
  try {
    const results = await duckDuckGoSearch(query);
    if (results.length > 0) {
      console.log(`[WebSearch] DuckDuckGo 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] DuckDuckGo 검색 실패:', e.message);
  }

  // 2차: Google 검색 (Puppeteer)
  try {
    const results = await googleSearchPuppeteer(query);
    if (results.length > 0) {
      console.log(`[WebSearch] Google 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] Google 검색 실패:', e.message);
  }

  // 3차: Naver 검색 (Puppeteer)
  try {
    const results = await naverSearchPuppeteer(query);
    if (results.length > 0) {
      console.log(`[WebSearch] Naver 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] Naver 검색 실패:', e.message);
  }

  console.error('[WebSearch] 모든 검색 방법 실패');
  return [];
}

// DuckDuckGo HTML 검색 (Puppeteer 불필요, 봇 차단 없음)
async function duckDuckGoSearch(query: string): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return [];

  const html = await res.text();
  const results: SearchResult[] = [];

  // DuckDuckGo HTML 결과 파싱
  const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  const links: { url: string; title: string }[] = [];
  let match;
  while ((match = resultRegex.exec(html)) !== null) {
    let href = match[1];
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    // DuckDuckGo redirect URL 디코딩
    if (href.includes('uddg=')) {
      const uddgMatch = href.match(/uddg=([^&]+)/);
      if (uddgMatch) href = decodeURIComponent(uddgMatch[1]);
    }
    if (title && href && href.startsWith('http')) {
      links.push({ url: href, title });
    }
  }

  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, '').trim());
  }

  for (let i = 0; i < Math.min(links.length, 8); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
    });
  }

  return results;
}

async function googleSearchPuppeteer(query: string): Promise<SearchResult[]> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9' });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ko&num=8`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForSelector('h3', { timeout: 5000 }).catch(() => {});

    const results = await page.evaluate(() => {
      const items: { title: string; url: string; snippet: string }[] = [];
      // h3 기준으로 부모 링크 찾기 (Google HTML 구조 변경에 강건)
      document.querySelectorAll('h3').forEach((h3) => {
        const a = h3.closest('a') || (h3.parentElement ? h3.parentElement.closest('a') : null);
        if (a && a.href && a.href.startsWith('http') && !a.href.includes('google.com')) {
          let snippet = '';
          const container = h3.closest('[data-sokoban-container]') || (h3.closest('[lang]')) || (h3.parentElement ? h3.parentElement.parentElement?.parentElement : null);
          if (container) {
            const spans = container.querySelectorAll('span, em, div');
            for (const s of Array.from(spans)) {
              const t = s.textContent || '';
              if (t.length > 40 && !t.includes(h3.textContent || '___')) {
                snippet = t.substring(0, 200);
                break;
              }
            }
          }
          items.push({
            title: h3.textContent || '',
            url: a.href,
            snippet,
          });
        }
      });
      return items.slice(0, 8);
    });

    return results;
  } finally {
    await page.close();
  }
}

async function naverSearchPuppeteer(query: string): Promise<SearchResult[]> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );

    const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    const results = await page.evaluate(() => {
      const items: { title: string; url: string; snippet: string }[] = [];

      // 네이버 검색 결과 (웹사이트/블로그/카페 등)
      const selectors = [
        '.total_wrap .total_tit a',        // 통합검색
        '.api_txt_lines.total_tit',        // 웹사이트
        '.news_tit',                        // 뉴스
        '.link_tit',                        // 블로그
      ];

      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach((el) => {
          const a = el.closest('a') || el.querySelector('a') || (el.tagName === 'A' ? el : null);
          if (a) {
            const href = a.getAttribute('href') || '';
            const title = a.textContent || '';
            // 주변 텍스트에서 snippet 추출
            const parent = a.closest('.total_wrap, .bx, .news_wrap, .api_txt_lines');
            const snippetEl = parent ? parent.querySelector('.dsc_txt, .total_dsc, .news_dsc, .api_txt_lines:not(.total_tit)') : null;
            const snippet = snippetEl ? (snippetEl.textContent || '').substring(0, 200) : '';

            if (href && title && !href.includes('naver.com/search')) {
              items.push({ title: title.trim(), url: href, snippet: snippet.trim() });
            }
          }
        });
      }

      return items.slice(0, 8);
    });

    return results;
  } finally {
    await page.close();
  }
}

export async function fetchWebPage(url: string): Promise<string> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    const text = await page.evaluate(() => {
      // 불필요한 요소 제거
      ['script', 'style', 'nav', 'footer', 'header', 'iframe'].forEach(tag => {
        document.querySelectorAll(tag).forEach(el => el.remove());
      });
      return (document.body.innerText || '').substring(0, 5000);
    });

    return text || '[페이지 내용을 추출할 수 없습니다]';
  } catch (e: any) {
    return `[웹페이지 로드 실패: ${e.message}]`;
  } finally {
    await page.close();
  }
}

// 서버 종료 시 브라우저 정리
process.on('beforeExit', async () => {
  if (browserInstance) {
    await browserInstance.close();
  }
});
