import fs from 'node:fs';
import path from 'node:path';

function logKey(blogName) {
  const date = new Date().toISOString().slice(0, 10);
  return `${date}:${blogName}`;
}

function readLog(logPath) {
  if (!fs.existsSync(logPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(logPath, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * 티스토리는 저품질 판정을 피하려면 하루 발행 개수를 관행적으로 제한하는 것이
 * 안전하다고 알려져 있다. 이 한도를 넘으면 발행을 막아 계정 자체가
 * 스팸으로 분류될 위험을 줄인다. 블로그별로 별도 카운트한다.
 *
 * 카운트는 실제 발행이 성공했을 때만 올라가야 하므로, 한도 확인(canPublishToday)과
 * 기록(recordPublish)을 분리한다 — 발행 자동화가 도중에 실패해도 한도를 소모하지 않는다.
 */
export function canPublishToday({ publishLogPath, dailyLimit, blogName }) {
  const countToday = peekTodayCount(publishLogPath, blogName);
  return { allowed: countToday < dailyLimit, countToday };
}

export function recordPublish(publishLogPath, blogName) {
  fs.mkdirSync(path.dirname(publishLogPath), { recursive: true });
  const log = readLog(publishLogPath);
  const key = logKey(blogName);
  log[key] = (log[key] || 0) + 1;
  fs.writeFileSync(publishLogPath, JSON.stringify(log, null, 2));
  return log[key];
}

export function peekTodayCount(publishLogPath, blogName) {
  return readLog(publishLogPath)[logKey(blogName)] || 0;
}
