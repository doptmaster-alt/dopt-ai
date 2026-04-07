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
    // Docker 컨테이너에서는 시스템 Chromium 사용, 로컬에서는 Puppeteer 번들 사용
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    console.log(`[WebSearch] Launching browser, executablePath: ${executablePath || 'bundled'}`);
    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-software-rasterizer',
        '--disable-crashpad',
        '--single-process',
        '--no-zygote',
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

  // 2차: Brave Search API (무료, API키 불필요, 서버 IP 차단 없음)
  try {
    const results = await braveSearch(query);
    if (results.length > 0) {
      console.log(`[WebSearch] Brave 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] Brave 검색 실패:', e.message);
  }

  // 3차: Google 검색 (Puppeteer)
  try {
    const results = await googleSearchPuppeteer(query);
    if (results.length > 0) {
      console.log(`[WebSearch] Google 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] Google 검색 실패:', e.message);
  }

  // 4차: Naver 검색 (Puppeteer)
  try {
    const results = await naverSearchPuppeteer(query);
    if (results.length > 0) {
      console.log(`[WebSearch] Naver 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] Naver 검색 실패:', e.message);
  }

  // 5차: SearXNG 공개 인스턴스 (다중 검색엔진 메타서치)
  try {
    const results = await searxngSearch(query);
    if (results.length > 0) {
      console.log(`[WebSearch] SearXNG 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] SearXNG 검색 실패:', e.message);
  }

  console.error('[WebSearch] 모든 검색 방법 실패');
  return [];
}

// Brave Search (HTML 스크래핑 — API 키 불필요, 서버 IP에서도 안정적)
async function braveSearch(query: string): Promise<SearchResult[]> {
  const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return [];
  const html = await res.text();
  const results: SearchResult[] = [];

  // Brave 검색 결과 파싱 — <a class="result-header"> 또는 <a class="heading-serpresult">
  const resultRegex = /<div[^>]+class="snippet[^"]*"[^>]*>[\s\S]*?<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p[^>]*class="snippet-description"[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < 8) {
    const href = match[1];
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    const snippet = match[3].replace(/<[^>]+>/g, '').trim();
    if (title && href) {
      results.push({ title, url: href, snippet });
    }
  }

  // 위 패턴이 안 맞으면 더 일반적인 파싱 시도
  if (results.length === 0) {
    const altRegex = /<a[^>]+href="(https?:\/\/(?!search\.brave)[^"]+)"[^>]*>[^<]*<span[^>]*>([\s\S]*?)<\/span>/gi;
    while ((match = altRegex.exec(html)) !== null && results.length < 8) {
      const href = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      if (title && title.length > 5 && href && !href.includes('brave.com')) {
        results.push({ title, url: href, snippet: '' });
      }
    }
  }

  return results;
}

// SearXNG 공개 인스턴스 (다중 검색엔진 메타서치, JSON API 지원)
async function searxngSearch(query: string): Promise<SearchResult[]> {
  const instances = [
    'https://searx.be',
    'https://search.ononoki.org',
    'https://searx.tiekoetter.com',
    'https://search.inetol.net',
    'https://priv.au',
  ];

  for (const instance of instances) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&language=ko-KR`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;

      // JSON인지 확인
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) continue;

      const data = await res.json();
      if (data.results && data.results.length > 0) {
        return data.results.slice(0, 8).map((r: any) => ({
          title: r.title || '',
          url: r.url || '',
          snippet: (r.content || '').substring(0, 200),
        }));
      }
    } catch {
      continue;
    }
  }
  return [];
}

// DuckDuckGo HTML 검색 (Puppeteer 불필요)
async function duckDuckGoSearch(query: string): Promise<SearchResult[]> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  ];
  const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
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
