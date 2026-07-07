import fs from 'node:fs';
import { chromium } from 'playwright';
import { config } from './config.js';

// 저장된 로그인 세션(.state/storageState.json)으로 실제 글쓰기 화면을 열어
// 검증한 선택자. 티스토리 에디터는 TinyMCE 기반이라, 본문은 UI를 클릭하는 대신
// tinymce 전역 API로 직접 setContent 하는 편이 훨씬 안정적이다.
const SELECTORS = {
  titleInput: '#post-title-inp',
  tinymceEditorId: 'editor-tistory',
  tagInput: '#tagText',
  categoryButton: '#category-btn',
  completeButton: '#publish-layer-btn',
  publicVisibilityRadio: '#open20',
  finalPublishButton: '#publish-btn',
  addCategoryLabel: 'label.lab_add',
  newCategoryNameInput: 'input.tf_blog.tf_on',
};

const DEFAULT_CATEGORY = '테크';

/**
 * 티스토리 카테고리 관리 화면에서 원하는 카테고리가 이미 있는지 확인하고,
 * 없으면 새로 만든다. 새 콘텐츠 주제(맛집/여행/생활정보 등)를 처음 쓸 때
 * 해당 카테고리가 블로그에 없을 수 있어서 필요하다.
 */
async function ensureCategoryExists(page, blogName, categoryLabel) {
  await page.goto(`https://${blogName}.tistory.com/manage/category`, { waitUntil: 'networkidle' });

  const exists = await page.evaluate((label) => {
    const rows = [...document.querySelectorAll('.set_order *')].map((e) => e.textContent.trim());
    return rows.includes(label);
  }, categoryLabel);

  if (exists) return;

  await page.locator(SELECTORS.addCategoryLabel).click();
  await page.waitForTimeout(400);
  await page.locator(SELECTORS.newCategoryNameInput).fill(categoryLabel);
  await page.locator('button:has-text("확인")').last().click();
  await page.waitForTimeout(400);

  // "확인"은 화면에 행을 추가할 뿐이고, 페이지 상단의 "변경사항 저장"을 눌러야
  // 실제로 서버에 반영된다. 이걸 빠뜨리면 새로고침 시 카테고리가 사라진다.
  await page.locator('button:has-text("변경사항 저장")').first().click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
}

// 카테고리/에디터모드 드롭다운은 TinyMCE 메뉴라 DOM에 숨겨진 중복 항목이 함께 있다.
// 화면에 실제로 보이는(너비/높이>0) 항목의 좌표를 찾아 그 위치를 직접 클릭해야
// locator.click()의 가시성 검사에 걸리지 않는다.
async function clickVisibleMenuItem(page, text) {
  const box = await page.evaluate((t) => {
    const items = [...document.querySelectorAll('.mce-menu-item')].filter((e) => e.textContent.trim() === t);
    const visible = items.find((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!visible) return null;
    const r = visible.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, text);

  if (!box) throw new Error(`"${text}" 메뉴 항목을 찾을 수 없음`);
  await page.mouse.click(box.x, box.y);
}

function assertSession() {
  if (!fs.existsSync(config.paths.storageState)) {
    throw new Error(
      `로그인 세션 파일이 없습니다: ${config.paths.storageState}\n먼저 "npm run login"으로 티스토리에 로그인하세요.`
    );
  }
}

/**
 * 저장된 로그인 세션으로 티스토리 새 글 작성 페이지에 접속해
 * 제목/본문/태그를 입력하고 공개 발행까지 자동으로 수행한다.
 */
export async function publishTistory({
  title,
  contentHtml,
  tags = [],
  tistoryCategory = DEFAULT_CATEGORY,
  blogName = config.tistoryBlogName,
  debug = false,
}) {
  assertSession();

  const browser = await chromium.launch({ headless: !debug, slowMo: debug ? 250 : 0 });
  const context = await browser.newContext({ storageState: config.paths.storageState });
  const page = await context.newPage();

  try {
    await step('카테고리 존재 확인/생성', async () => {
      await ensureCategoryExists(page, blogName, tistoryCategory);
    });

    await page.goto(`https://${blogName}.tistory.com/manage/newpost/`, {
      waitUntil: 'networkidle',
    });

    await step('제목 입력', async () => {
      await page.locator(SELECTORS.titleInput).fill(title);
    });

    await step('카테고리 선택', async () => {
      await page.locator(SELECTORS.categoryButton).click();
      await page.waitForTimeout(300);
      await clickVisibleMenuItem(page, tistoryCategory);
      await page.waitForTimeout(300);
    });

    await step('본문 입력 (TinyMCE API)', async () => {
      const editorId = SELECTORS.tinymceEditorId;
      await page.waitForFunction(
        (id) => window.tinymce?.get(id) != null,
        editorId,
        { timeout: 15000 }
      );
      await page.evaluate(
        ({ id, html }) => {
          const editor = window.tinymce.get(id);
          editor.setContent(html);
          // setContent()는 화면(iframe)만 갱신하고 실제 제출용 <textarea>에는
          // 자동 동기화되지 않는다. save()를 명시적으로 호출해야 본문이
          // 실제로 제출되어, 빈 본문으로 발행되는 것을 막는다.
          editor.save();
        },
        { id: editorId, html: contentHtml }
      );

      const syncedLength = await page.evaluate(
        (id) => document.getElementById(id)?.value.length || 0,
        editorId
      );
      if (syncedLength === 0 && contentHtml.length > 0) {
        throw new Error('본문이 textarea에 동기화되지 않았습니다 (길이 0)');
      }
    });

    if (tags.length > 0) {
      await step('태그 입력', async () => {
        // 태그 입력창은 "완료" 버튼을 누르기 전, 기본 에디터 화면에 항상 떠 있는
        // 별도 영역이다. 완료를 먼저 누르고 태그를 넣으면 발행 레이어가 열고 닫히는
        // 타이밍과 꼬여 태그 커밋이 씹히거나 공개 설정 단계가 막히므로, 반드시
        // 완료를 누르기 전에 태그부터 입력한다. fill()이 아닌 실제 키 입력 이벤트로
        // 커밋되므로 태그마다 타이핑 + Enter가 필요하다.
        for (const tag of tags) {
          await page.locator(SELECTORS.tagInput).click();
          await page.keyboard.type(tag, { delay: 30 });
          await page.keyboard.press('Enter');
          await page.waitForTimeout(150);
        }
      });
    }

    await step('발행 다이얼로그 열기 + 공개 설정', async () => {
      // 발행 레이어가 늦게 뜨는 경우가 있어, 처음 시도에서 공개 설정 라디오가
      // 안 보이면 완료 버튼을 한 번 더 눌러 재시도한다.
      await page.locator(SELECTORS.completeButton).click();
      await page.waitForTimeout(800);

      const radio = page.locator(SELECTORS.publicVisibilityRadio);
      try {
        await radio.waitFor({ state: 'visible', timeout: 5000 });
      } catch {
        await page.locator(SELECTORS.completeButton).click({ force: true });
        await page.waitForTimeout(1200);
        await radio.waitFor({ state: 'visible', timeout: 10000 });
      }
      await radio.check();
    });

    await step('공개 발행 확정', async () => {
      await page.locator(SELECTORS.finalPublishButton).click();
    });

    // 발행 확정 후에는 /manage/posts/ 목록으로 리다이렉트되고 실제 글 URL은
    // 알려주지 않으므로, 방금 쓴 제목으로 목록에서 실제 permalink를 찾아온다.
    const publishedUrl = await step('발행된 글 링크 확인', async () => {
      await page.waitForURL(/\/manage\/posts\/?/, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);

      const titlePrefix = title.slice(0, 15);
      const href = await page.evaluate((prefix) => {
        const link = [...document.querySelectorAll('a')].find((a) => a.textContent.includes(prefix));
        return link ? link.href : null;
      }, titlePrefix);

      if (!href) {
        throw new Error('발행은 진행됐지만 글 목록에서 링크를 찾지 못했습니다. felpen.tistory.com/manage/posts/ 에서 직접 확인하세요.');
      }
      return href;
    });

    return { publishedUrl };
  } catch (err) {
    throw new Error(
      `발행 자동화 중 실패: ${err.message}\n` +
        '티스토리 에디터 UI가 바뀌었을 수 있습니다. src/publishTistory.js의 SELECTORS를 다시 확인하세요.'
    );
  } finally {
    await browser.close();
  }
}

async function step(name, fn) {
  try {
    return await fn();
  } catch (err) {
    throw new Error(`[${name}] 단계 실패 — ${err.message}`);
  }
}
