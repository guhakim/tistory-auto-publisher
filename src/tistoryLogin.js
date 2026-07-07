#!/usr/bin/env node
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { chromium } from 'playwright';
import { config } from './config.js';

function waitForEnter(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return rl.question(question).finally(() => rl.close());
}

async function main() {
  fs.mkdirSync(config.paths.stateDir, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.tistory.com/auth/login');

  console.log('\n브라우저 창에서 티스토리(카카오 계정)로 직접 로그인하세요.');
  console.log('felpen.tistory.com 관리 화면이 보일 때까지 로그인/2단계 인증을 마친 뒤,');
  await waitForEnter('이 터미널로 돌아와 Enter를 누르면 로그인 세션을 저장합니다...');

  await context.storageState({ path: config.paths.storageState });
  console.log(`로그인 세션 저장 완료: ${config.paths.storageState}`);

  await browser.close();
}

main().catch((err) => {
  console.error('로그인 세션 저장 실패:', err.message);
  process.exit(1);
});
