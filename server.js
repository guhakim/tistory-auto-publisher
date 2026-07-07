import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './src/config.js';
import { peekTodayCount } from './src/rateLimiter.js';
import { runPipeline } from './src/runPipeline.js';
import { CATEGORIES, DEFAULT_CATEGORY_KEY } from './src/categories.js';
import { BLOGS, DEFAULT_BLOG_KEY, getBlog } from './src/blogs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', (req, res) => {
  const blogKey = req.query.blog || DEFAULT_BLOG_KEY;
  const blog = getBlog(blogKey);
  res.json({
    loggedIn: fs.existsSync(config.paths.storageState),
    blogName: blog.subdomain,
    todayCount: peekTodayCount(config.paths.publishLog, blog.subdomain),
    dailyLimit: config.dailyPublishLimit,
  });
});

app.get('/api/categories', (req, res) => {
  const categories = Object.entries(CATEGORIES).map(([key, c]) => ({ key, label: c.label }));
  res.json({ categories, defaultKey: DEFAULT_CATEGORY_KEY });
});

app.get('/api/blogs', (req, res) => {
  const blogs = Object.entries(BLOGS).map(([key, b]) => ({ key, label: b.label }));
  res.json({ blogs, defaultKey: DEFAULT_BLOG_KEY });
});

app.post('/api/run', async (req, res) => {
  const { url, product, categoryKey, blogKey, dryRun } = req.body || {};

  if (!url && !product) {
    return res.status(400).json({ ok: false, error: 'url 또는 product 중 하나는 반드시 입력해야 합니다.' });
  }

  try {
    const result = await runPipeline({
      url,
      product,
      categoryKey: categoryKey || DEFAULT_CATEGORY_KEY,
      blogKey: blogKey || DEFAULT_BLOG_KEY,
      dryRun: Boolean(dryRun),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`웹 UI 실행 중: http://localhost:${PORT}`);
});
