#!/usr/bin/env node
import { runPipeline } from '../src/runPipeline.js';
import { CATEGORIES, DEFAULT_CATEGORY_KEY } from '../src/categories.js';
import { BLOGS, DEFAULT_BLOG_KEY } from '../src/blogs.js';

function parseArgs(argv) {
  const args = { dryRun: false, debug: false, categoryKey: DEFAULT_CATEGORY_KEY, blogKey: DEFAULT_BLOG_KEY };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') args.url = argv[++i];
    else if (argv[i] === '--product') args.product = argv[++i];
    else if (argv[i] === '--category') args.categoryKey = argv[++i];
    else if (argv[i] === '--blog') args.blogKey = argv[++i];
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--debug') args.debug = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.url && !args.product) {
    const categoryKeys = Object.keys(CATEGORIES).join(' | ');
    const blogKeys = Object.keys(BLOGS).join(' | ');
    console.error(
      `사용법: generate-and-publish --url "<참고 사이트 URL>" [--product "<주제>"] [--category <${categoryKeys}>] [--blog <${blogKeys}>] [--dry-run] [--debug]`
    );
    process.exit(1);
  }

  console.log('리서치 및 초안 생성 중...');
  const result = await runPipeline(args);

  if (!result.ok) {
    if (result.stage === 'quality_gate') {
      console.error('품질 게이트를 통과하지 못해 발행을 중단합니다:', result.problems.join(', '));
      console.error('생성된 초안:', JSON.stringify(result.draft, null, 2));
    } else if (result.stage === 'rate_limit') {
      console.error(`오늘 발행 한도(${result.dailyLimit}건)를 이미 채웠습니다. 내일 다시 시도하세요.`);
    }
    process.exit(1);
  }

  console.log(`\n제목: ${result.title}`);
  console.log(`태그: ${(result.draft.tags || []).join(', ')}`);

  if (result.dryRun) {
    console.log('\n--dry-run 모드: 발행하지 않고 생성 결과만 출력합니다.\n');
    console.log(result.contentHtml);
    return;
  }

  console.log(`발행 완료: ${result.publishedUrl}`);
}

main().catch((err) => {
  console.error('실패:', err.message);
  process.exit(1);
});
