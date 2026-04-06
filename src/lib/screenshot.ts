import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

const SCREENSHOT_DIR = path.join(process.cwd(), 'public', 'screenshots');

// 스크린샷 저장 디렉토리 확보
function ensureDir() {
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

export interface ScreenshotResult {
  id: string;
  url: string;
  filePath: string;
  width: number;
  height: number;
}

/**
 * 웹페이지 스크린샷 촬영
 * @param targetUrl - 스크린샷을 찍을 URL
 * @param options - 옵션 (viewport 크기, fullPage 여부)
 */
export async function takeScreenshot(
  targetUrl: string,
  options?: {
    width?: number;
    height?: number;
    fullPage?: boolean;
    selector?: string;
  }
): Promise<ScreenshotResult> {
  ensureDir();

  const id = crypto.randomBytes(8).toString('hex');
  const fileName = `${id}.png`;
  const filePath = path.join(SCREENSHOT_DIR, fileName);

  const width = options?.width || 1440;
  const height = options?.height || 900;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const page = await browser.newPage();

    // 봇 감지 우회
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.setViewport({ width, height });

    // domcontentloaded로 먼저 시도, 실패하면 load
    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    } catch (e) {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    }

    // 추가 렌더링 대기
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

    // 접근 차단 감지
    const pageTitle = await page.title();
    const bodyText = await page.evaluate(() => (document.body.innerText || '').substring(0, 500));
    const blockedPatterns = ['Access Denied', 'Forbidden', '403', 'Bot detected', 'captcha', 'CAPTCHA', 'Please verify', '차단', '접근 거부'];
    const isBlocked = blockedPatterns.some(p => pageTitle.includes(p) || bodyText.includes(p));
    if (isBlocked) {
      throw new Error(`사이트 접근이 차단되었습니다 (${pageTitle}). 이 사이트는 봇 접근을 허용하지 않습니다. 다른 사이트를 시도해주세요.`);
    }

    const screenshotOptions: any = {
      path: filePath,
      type: 'png',
    };

    if (options?.selector) {
      // 특정 요소만 캡처
      const element = await page.$(options.selector);
      if (element) {
        await element.screenshot(screenshotOptions);
      } else {
        await page.screenshot({ ...screenshotOptions, fullPage: options?.fullPage ?? false });
      }
    } else {
      screenshotOptions.fullPage = options?.fullPage ?? false;
      await page.screenshot(screenshotOptions);
    }

    return {
      id,
      url: `/api/screenshots/${fileName}`,
      filePath,
      width,
      height,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 여러 URL의 스크린샷을 동시에 촬영
 */
export async function takeMultipleScreenshots(
  urls: string[],
  options?: { width?: number; height?: number; fullPage?: boolean }
): Promise<ScreenshotResult[]> {
  const results: ScreenshotResult[] = [];
  // 순차 실행 (브라우저 리소스 절약)
  for (const url of urls) {
    try {
      const result = await takeScreenshot(url, options);
      results.push(result);
    } catch (e: any) {
      console.error(`Screenshot failed for ${url}:`, e.message);
    }
  }
  return results;
}
