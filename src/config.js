import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경변수 ${name}이(가) 설정되어 있지 않습니다. .env 파일을 확인하세요.`);
  }
  return value;
}

export const config = {
  geminiApiKey: requireEnv('GEMINI_API_KEY'),
  tistoryBlogName: process.env.TISTORY_BLOG_NAME || 'felpen',
  dailyPublishLimit: Number(process.env.DAILY_PUBLISH_LIMIT || 5),
  webAuth: process.env.WEB_SHARE_USER && process.env.WEB_SHARE_PASSWORD
    ? { user: process.env.WEB_SHARE_USER, password: process.env.WEB_SHARE_PASSWORD }
    : null,
  paths: {
    root: projectRoot,
    stateDir: path.join(projectRoot, '.state'),
    storageState: path.join(projectRoot, '.state', 'storageState.json'),
    publishLog: path.join(projectRoot, '.state', 'publish-log.json'),
  },
};
