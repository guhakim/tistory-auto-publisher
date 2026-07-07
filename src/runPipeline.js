import { config } from './config.js';
import { fetchReference } from './fetchReference.js';
import { generateDraft } from './generateDraft.js';
import { checkDraftQuality } from './qualityGate.js';
import { renderPostHtml } from './renderPostHtml.js';
import { canPublishToday, recordPublish } from './rateLimiter.js';
import { publishTistory } from './publishTistory.js';
import { getCategory, DEFAULT_CATEGORY_KEY } from './categories.js';
import { getBlog, DEFAULT_BLOG_KEY } from './blogs.js';

async function generateWithQualityGate({ product, reference, categoryKey }) {
  let draft = await generateDraft({ apiKey: config.geminiApiKey, productHint: product, reference, categoryKey });
  let gate = checkDraftQuality(draft, categoryKey);

  if (!gate.passed) {
    draft = await generateDraft({ apiKey: config.geminiApiKey, productHint: product, reference, categoryKey });
    gate = checkDraftQuality(draft, categoryKey);
  }

  return { draft, gate };
}

/**
 * CLI와 웹 서버가 공유하는 전체 파이프라인: 리서치 → 초안 생성 →
 * 품질 게이트 → (dryRun이 아니면) 발행까지 한 번에 수행한다.
 */
export async function runPipeline({
  url,
  product,
  categoryKey = DEFAULT_CATEGORY_KEY,
  blogKey = DEFAULT_BLOG_KEY,
  dryRun = false,
  debug = false,
}) {
  const category = getCategory(categoryKey);
  const blog = getBlog(blogKey);
  const reference = url ? await fetchReference(url) : null;
  const { draft, gate } = await generateWithQualityGate({ product, reference, categoryKey });

  if (!gate.passed) {
    return { ok: false, stage: 'quality_gate', problems: gate.problems, draft };
  }

  const title = draft.title || draft.topic;
  const contentHtml = renderPostHtml(draft, categoryKey);

  if (dryRun) {
    return { ok: true, dryRun: true, draft, title, contentHtml };
  }

  const { allowed, countToday } = canPublishToday({
    publishLogPath: config.paths.publishLog,
    dailyLimit: config.dailyPublishLimit,
    blogName: blog.subdomain,
  });

  if (!allowed) {
    return { ok: false, stage: 'rate_limit', countToday, dailyLimit: config.dailyPublishLimit, draft, title, contentHtml };
  }

  const { publishedUrl } = await publishTistory({
    title,
    contentHtml,
    tags: draft.tags || [],
    tistoryCategory: category.tistoryCategory,
    blogName: blog.subdomain,
    debug,
  });

  const newCount = recordPublish(config.paths.publishLog, blog.subdomain);

  return { ok: true, dryRun: false, draft, title, contentHtml, publishedUrl, countToday: newCount };
}
