import * as cheerio from 'cheerio';

const MAX_CHARS = 6000;

/**
 * 참고 URL의 페이지를 가져와 본문으로 추정되는 텍스트를 추출한다.
 * script/style/nav/footer 등 노이즈 태그는 제거하고, 남은 텍스트를 정리해 반환한다.
 */
export async function fetchReference(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`참고 URL을 가져오지 못했습니다 (HTTP ${res.status}): ${url}`);
  }

  const html = await res.text();
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
