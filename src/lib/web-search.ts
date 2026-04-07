// 웹 검색 기능 - 유료 API 우선, Puppeteer 폴백
// 검색 우선순위: Serper.dev (Google) → Naver API → Brave HTML → DuckDuckGo → SearXNG → Puppeteer

import puppeteer from 'puppeteer';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

let browserInstance: any = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    console.log(`[WebSearch] Launching browser, executablePath: ${executablePath || 'bundled'}`);
    browserInstance = await puppeteer.launch({
      headless: 'shell',
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-software-rasterizer',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-breakpad',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-features=AudioServiceOutOfProcess',
        '--single-process',
        '--no-zygote',
      ],
      env: {
        ...process.env,
        CHROME_CRASHPAD_PIPE_NAME: '1',
      },
    });
  }
  return browserInstance;
}

export async function webSearch(query: string): Promise<SearchResult[]> {
  console.log(`[WebSearch] 검색 시작: "${query}"`);

  // ===== 1차: Serper.dev (유료 Google Search API — 가장 정확하고 안정적) =====
  try {
    const results = await serperSearch(query);
    if (results.length > 0) {
      console.log(`[WebSearch] ✅ Serper.dev 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] Serper.dev 검색 실패:', e.message);
  }

  // ===== 2차: Naver Search API (유료 — 한국 시장 데이터에 특화) =====
  try {
    const results = await naverAPISearch(query);
    if (results.length > 0) {
      console.log(`[WebSearch] ✅ Naver API 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] Naver API 검색 실패:', e.message);
  }

  // ===== 3차: Brave Search (무료 HTML 스크래핑) =====
  try {
    const results = await braveSearch(query);
    if (results.length > 0) {
      console.log(`[WebSearch] Brave 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] Brave 검색 실패:', e.message);
  }

  // ===== 4차: DuckDuckGo HTML =====
  try {
    const results = await duckDuckGoSearch(query);
    if (results.length > 0) {
      console.log(`[WebSearch] DuckDuckGo 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] DuckDuckGo 검색 실패:', e.message);
  }

  // ===== 5차: SearXNG 메타서치 =====
  try {
    const results = await searxngSearch(query);
    if (results.length > 0) {
      console.log(`[WebSearch] SearXNG 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] SearXNG 검색 실패:', e.message);
  }

  // ===== 6차: Google Puppeteer (최후의 수단) =====
  try {
    const results = await googleSearchPuppeteer(query);
    if (results.length > 0) {
      console.log(`[WebSearch] Google Puppeteer 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] Google Puppeteer 검색 실패:', e.message);
  }

  // ===== 7차: Naver Puppeteer =====
  try {
    const results = await naverSearchPuppeteer(query);
    if (results.length > 0) {
      console.log(`[WebSearch] Naver Puppeteer 검색 성공: ${results.length}개 결과`);
      return results;
    }
  } catch (e: any) {
    console.error('[WebSearch] Naver Puppeteer 검색 실패:', e.message);
  }

  console.error('[WebSearch] ❌ 모든 검색 방법 실패');
  return [];
}


// ============================================================
// 유료 API 검색 (안정적, 고품질)
// ============================================================

// Serper.dev — Google Search JSON API ($50/월 50K 쿼리 또는 무료 2,500회)
// https://serper.dev
async function serperSearch(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.log('[Serper] API 키 없음 — 스킵');
    return [];
  }

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: 'kr',
      hl: 'ko',
      num: 10,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Serper ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const results: SearchResult[] = [];

  // Knowledge Graph (있으면 최상단에 추가)
  if (data.knowledgeGraph) {
    const kg = data.knowledgeGraph;
    if (kg.description) {
      results.push({
        title: kg.title || query,
        url: kg.website || kg.descriptionLink || '',
        snippet: kg.description.substring(0, 300),
      });
    }
  }

  // Organic Results (메인 검색 결과)
  if (data.organic) {
    for (const item of data.organic.slice(0, 10)) {
      results.push({
        title: item.title || '',
        url: item.link || '',
        snippet: item.snippet || '',
      });
    }
  }

  // People Also Ask (추가 인사이트)
  if (data.peopleAlsoAsk && results.length < 8) {
    for (const item of data.peopleAlsoAsk.slice(0, 3)) {
      if (item.link && !results.some(r => r.url === item.link)) {
        results.push({
          title: item.question || '',
          url: item.link || '',
          snippet: item.snippet || '',
        });
      }
    }
  }

  return results.slice(0, 10);
}

// Naver Search API — 네이버 공식 검색 API (하루 25,000회 무료)
// https://developers.naver.com/apps/#/register (검색 API 등록)
async function naverAPISearch(query: string): Promise<SearchResult[]> {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.log('[NaverAPI] API 키 없음 — 스킵');
    return [];
  }

  const allResults: SearchResult[] = [];

  // 블로그 + 웹문서 + 뉴스를 동시에 검색 (한국 시장 데이터 극대화)
  const searchTypes = [
    { type: 'webkr', display: 5 },    // 웹문서
    { type: 'blog', display: 5 },      // 블로그
    { type: 'news', display: 3 },      // 뉴스
    { type: 'shop', display: 3 },      // 쇼핑 (제품 시장조사용)
  ];

  const searches = searchTypes.map(async ({ type, display }) => {
    try {
      const url = `https://openapi.naver.com/v1/search/${type}.json?query=${encodeURIComponent(query)}&display=${display}&sort=sim`;
      const res = await fetch(url, {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) return [];
      const data = await res.json();

      return (data.items || []).map((item: any) => ({
        title: (item.title || '').replace(/<\/?b>/g, ''),
        url: item.link || item.originallink || '',
        snippet: (item.description || '').replace(/<\/?b>/g, '').substring(0, 300),
      }));
    } catch {
      return [];
    }
  });

  const resultGroups = await Promise.all(searches);

  // 결과를 교차 배치 (웹문서, 블로그, 뉴스 순으로 섞기)
  const seenUrls = new Set<string>();
  for (const group of resultGroups) {
    for (const item of group) {
      if (!seenUrls.has(item.url) && item.url) {
        seenUrls.add(item.url);
        allResults.push(item);
      }
    }
  }

  return allResults.slice(0, 10);
}


// ============================================================
// 무료 검색 (폴백)
// ============================================================

// Brave Search (HTML 스크래핑 — Svelte 기반 구조 파싱)
async function braveSearch(query: string): Promise<SearchResult[]> {
  const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return [];
  const html = await res.text();
  const results: SearchResult[] = [];
  const seenUrls = new Set<string>();

  // Brave Svelte 구조: <a href="외부URL"> 패턴
  const aTagRegex = /<a[^>]*href="(https?:\/\/(?!search\.brave\.com|brave\.com)[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = aTagRegex.exec(html)) !== null && results.length < 10) {
    const href = match[1];
    const rawText = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (rawText.length >= 10 && rawText.length <= 200 && !seenUrls.has(href) &&
        !href.includes('brave.com') && !href.includes('/search?')) {
      const cleanTitle = rawText.replace(/[a-zA-Z0-9.-]+\.(com|co\.kr|net|org|kr)[^a-zA-Z가-힣]*[›»>]\s*/g, '').trim();
      if (cleanTitle.length >= 5) {
        seenUrls.add(href);
        results.push({ title: cleanTitle, url: href, snippet: '' });
      }
    }
  }

  // snippet 보강
  if (results.length > 0) {
    for (const result of results) {
      const urlIdx = html.indexOf(result.url);
      if (urlIdx > 0) {
        const after = html.substring(urlIdx, urlIdx + 800);
        const textBlocks = after.match(/>([^<]{40,300})</g);
        if (textBlocks && textBlocks.length > 0) {
          result.snippet = textBlocks[0].substring(1).trim();
        }
      }
    }
  }

  return results.slice(0, 8);
}

// DuckDuckGo HTML 검색
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

  const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

  const links: { url: string; title: string }[] = [];
  let match;
  while ((match = resultRegex.exec(html)) !== null) {
    let href = match[1];
    const title = match[2].replace(/<[^>]+>/g, '').trim();
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

// SearXNG 공개 인스턴스 (다중 검색엔진 메타서치)
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


// ============================================================
// Puppeteer 기반 검색 (최후의 수단)
// ============================================================

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
      document.querySelectorAll('h3').forEach((h3) => {
        const a = h3.closest('a') || (h3.parentElement ? h3.parentElement.closest('a') : null);
        if (a && a.href && a.href.startsWith('http') && !a.href.includes('google.com')) {
          let snippet = '';
          const container = h3.closest('[data-sokoban-container]') || h3.closest('[lang]') || h3.parentElement?.parentElement?.parentElement;
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
          items.push({ title: h3.textContent || '', url: a.href, snippet });
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
      const selectors = [
        '.total_wrap .total_tit a',
        '.api_txt_lines.total_tit',
        '.news_tit',
        '.link_tit',
      ];

      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach((el) => {
          const a = el.closest('a') || el.querySelector('a') || (el.tagName === 'A' ? el : null);
          if (a) {
            const href = a.getAttribute('href') || '';
            const title = a.textContent || '';
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


// ============================================================
// 웹페이지 콘텐츠 가져오기
// 우선순위: Jina Reader API → fetch API → Google Cache → Puppeteer
// ============================================================

export async function fetchWebPage(url: string): Promise<string> {
  console.log(`[FetchPage] 페이지 로드 시작: ${url}`);

  // ===== 1차: Jina Reader API (무료, 봇 차단 우회, 클린 텍스트 추출) =====
  try {
    const text = await fetchWithJinaReader(url);
    if (text && text.length > 200) {
      console.log(`[FetchPage] ✅ Jina Reader 성공: ${text.length}자`);
      return text;
    }
  } catch (e: any) {
    console.error(`[FetchPage] Jina Reader 실패: ${e.message}`);
  }

  // ===== 2차: fetch API (빠르고 단순) =====
  try {
    const text = await fetchPageWithFetchAPI(url);
    if (text && text.length > 100) {
      console.log(`[FetchPage] ✅ fetch API 성공: ${text.length}자`);
      return text;
    }
  } catch (e: any) {
    console.error(`[FetchPage] fetch API 실패: ${e.message}`);
  }

  // ===== 3차: 캐시 서비스 =====
  try {
    const text = await fetchFromCache(url);
    if (text && text.length > 100) {
      console.log(`[FetchPage] 캐시 서비스 성공: ${text.length}자`);
      return text;
    }
  } catch (e: any) {
    console.error(`[FetchPage] 캐시 서비스 실패: ${e.message}`);
  }

  // ===== 4차: Puppeteer (JS 렌더링이 필요한 SPA 사이트용) =====
  try {
    const text = await fetchPageWithPuppeteer(url);
    if (text && text.length > 50) {
      console.log(`[FetchPage] Puppeteer 성공: ${text.length}자`);
      return text;
    }
  } catch (e: any) {
    console.error(`[FetchPage] Puppeteer 실패: ${e.message}`);
  }

  return `[웹페이지 로드 실패] URL: ${url}. 사이트가 봇 접근을 차단하거나 네트워크 문제일 수 있습니다.`;
}

// Jina Reader API — URL을 깨끗한 마크다운/텍스트로 변환 (무료, 높은 성공률)
// 쇼핑몰, 봇 차단 사이트도 잘 읽음
async function fetchWithJinaReader(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;

  const headers: Record<string, string> = {
    'Accept': 'text/plain',
    'User-Agent': 'Mozilla/5.0',
  };

  // Jina API 키는 선택사항 — 키 없어도 무료로 분당 20회 가능
  // 참고: Jina 키 인증 서버 불안정할 수 있으므로 키 없이 사용 우선
  // const jinaKey = process.env.JINA_API_KEY;
  // if (jinaKey) { headers['Authorization'] = `Bearer ${jinaKey}`; }

  const res = await fetch(jinaUrl, {
    headers,
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    throw new Error(`Jina ${res.status}`);
  }

  const text = await res.text();

  // 너무 짧거나 에러 페이지인 경우 무시
  if (text.length < 100) return '';

  // 5000자로 제한 (시스템 프롬프트에 넣을 양)
  return text.substring(0, 8000);
}

// fetch API로 페이지 로드
async function fetchPageWithFetchAPI(url: string): Promise<string> {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  ];
  const ua = userAgents[Math.floor(Math.random() * userAgents.length)];

  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
    signal: AbortSignal.timeout(12000),
    redirect: 'follow',
  });

  if (!res.ok) return '';

  const html = await res.text();
  return extractTextFromHTML(html);
}

// HTML에서 텍스트 추출 유틸리티
function extractTextFromHTML(html: string): string {
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  return cleaned.substring(0, 5000);
}

// Google 웹캐시에서 페이지 로드
async function fetchFromCache(url: string): Promise<string> {
  try {
    const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
    const res = await fetch(cacheUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (res.ok) {
      const html = await res.text();
      const text = extractTextFromHTML(html);
      if (text.length > 100) return text;
    }
  } catch {}
  return '';
}

// Puppeteer로 페이지 로드 (JS 렌더링 필요 시)
async function fetchPageWithPuppeteer(url: string): Promise<string> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    const text = await page.evaluate(() => {
      ['script', 'style', 'nav', 'footer', 'header', 'iframe'].forEach(tag => {
        document.querySelectorAll(tag).forEach(el => el.remove());
      });
      return (document.body.innerText || '').substring(0, 5000);
    });

    return text || '';
  } catch (e: any) {
    throw new Error(`Puppeteer: ${e.message}`);
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
