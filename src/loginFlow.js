import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { config } from './config.js';

const DISPLAY = ':99';
const VNC_PORT = 6080;
const RFB_PORT = 5900;
const NOVNC_SRC = '/usr/share/novnc';
const NOVNC_WEB_DIR = path.join(config.paths.stateDir, 'novnc-web');
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
export const POPUP_WIDTH = 620;
export const POPUP_HEIGHT = 760;

const state = { status: 'idle', message: null };

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function spawnDetached(command, args) {
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
  return child;
}

// 팝업창처럼 보이도록: 상단바/사이드 컨트롤 없이 화면 전체를 캔버스로 채우는 최소 noVNC 클라이언트.
const MINIMAL_VNC_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #fff; }
  #screen { width: 100%; height: 100%; }
</style>
<script type="module">
  import RFB from './core/rfb.js';
  const url = (window.location.protocol === 'https:' ? 'wss' : 'ws') + '://' + window.location.host + '/websockify';
  const rfb = new RFB(document.getElementById('screen'), url, { credentials: { password: '' } });
  rfb.scaleViewport = true;
  rfb.resizeSession = false;
</script>
</head>
<body><div id="screen"></div></body></html>`;

function ensureNovncWebDir() {
  if (fs.existsSync(path.join(NOVNC_WEB_DIR, 'core'))) return;
  fs.mkdirSync(NOVNC_WEB_DIR, { recursive: true });
  fs.cpSync(NOVNC_SRC, NOVNC_WEB_DIR, { recursive: true });
  fs.writeFileSync(path.join(NOVNC_WEB_DIR, 'index.html'), MINIMAL_VNC_HTML);
}

async function ensureDisplayStack() {
  if (!(await portOpen(RFB_PORT))) {
    spawnDetached('Xvfb', [DISPLAY, '-screen', '0', `${POPUP_WIDTH}x${POPUP_HEIGHT}x24`]);
    await new Promise((r) => setTimeout(r, 1000));
    spawnDetached('x11vnc', ['-display', DISPLAY, '-forever', '-shared', '-nopw', '-rfbport', String(RFB_PORT), '-bg']);
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!(await portOpen(VNC_PORT))) {
    ensureNovncWebDir();
    spawnDetached('websockify', ['--web=' + NOVNC_WEB_DIR, String(VNC_PORT), 'localhost:' + RFB_PORT]);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function runLoginBrowser() {
  const browser = await chromium.launch({
    headless: false,
    env: { ...process.env, DISPLAY },
    args: [`--window-size=${POPUP_WIDTH},${POPUP_HEIGHT}`, '--window-position=0,0'],
  });

  try {
    const context = await browser.newContext({ viewport: { width: POPUP_WIDTH, height: POPUP_HEIGHT - 88 } });
    const page = await context.newPage();
    await page.goto('https://www.tistory.com/auth/login');

    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    let leftLoginPage = false;
    while (Date.now() < deadline) {
      const url = page.url();
      if (/tistory\.com/.test(url) && !/\/auth\/login/.test(url) && !/kauth\.kakao\.com/.test(url)) {
        leftLoginPage = true;
        break;
      }
      await page.waitForTimeout(1500);
    }

    if (!leftLoginPage) {
      state.status = 'timeout';
      state.message = '10분 동안 로그인이 완료되지 않았습니다. 다시 시도해주세요.';
      return;
    }

    // 로그인 후 실제로 관리자 화면에 들어가지는지 블로그 관리 페이지로 이동해 확인한다.
    await page.goto(`https://${config.tistoryBlogName}.tistory.com/manage`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    if (!/\/manage/.test(page.url())) {
      state.status = 'error';
      state.message = '로그인은 됐지만 관리자 화면에 접근하지 못했습니다. 블로그 권한을 확인해주세요.';
      return;
    }

    fs.mkdirSync(config.paths.stateDir, { recursive: true });
    await context.storageState({ path: config.paths.storageState });
    state.status = 'success';
    state.message = '로그인 세션이 저장되었습니다.';
  } catch (err) {
    state.status = 'error';
    state.message = err.message;
  } finally {
    await browser.close();
  }
}

export async function startLogin() {
  if (state.status === 'starting' || state.status === 'waiting') {
    return { ...state };
  }

  state.status = 'starting';
  state.message = null;

  try {
    await ensureDisplayStack();
  } catch (err) {
    state.status = 'error';
    state.message = '가상 화면 준비 실패: ' + err.message;
    return { ...state };
  }

  state.status = 'waiting';
  runLoginBrowser();

  return { ...state };
}

export function getLoginStatus() {
  return {
    ...state,
    loggedIn: fs.existsSync(config.paths.storageState),
  };
}
