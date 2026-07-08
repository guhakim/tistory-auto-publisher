import * as cheerio from 'cheerio';
import { chromium } from 'playwright';

const MAX_CHARS = 6000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function fetchWithHttp(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.text();
}

/**
 * Kickstarter 등 Cloudflare 봇 차단이 걸린 사이트 대응: 일반 fetch가 403 등으로
 * 막히면 실제 브라우저 엔진(Playwright)으로 재시도한다.
 */
async function fetchWithBrowser(url) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
    return await page.content();
  } finally {
    await browser.close();
  }
}

/**
 * 참고 URL의 페이지를 가져와 본문으로 추정되는 텍스트를 추출한다.
 * script/style/nav/footer 등 노이즈 태그는 제거하고, 남은 텍스트를 정리해 반환한다.
 */
export async function fetchReference(url) {
  let html;
  try {
    html = await fetchWithHttp(url);
  } catch (err) {
    try {
      html = await fetchWithBrowser(url);
    } catch {
      throw new Error(`참고 URL을 가져오지 못했습니다 (HTTP ${err.status ?? 'ERR'}): ${url}`);
    }
  }

  const $ = cheerio.load(html);

  $('script, style, nav, footer, header, noscript, svg, iframe').remove();

  const title = $('title').first().text().trim();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  return {
    url,
    title,
    text: bodyText.slice(0, MAX_CHARS),
  };
}
