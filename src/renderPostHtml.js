import { getCategory } from './categories.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * 카테고리별 섹션 정의(src/categories.js)를 기준으로 JSON 초안을 티스토리
 * 에디터에 그대로 주입할 수 있는 시맨틱 HTML 본문으로 변환한다.
 */
export function renderPostHtml(draft, categoryKey) {
  const category = getCategory(categoryKey);
  const parts = [];

  for (const s of category.sections) {
    parts.push(`<h2>${escapeHtml(s.label)}</h2>`);
    const value = draft[s.key];

    if (s.kind === 'list') {
      parts.push('<ul>');
      for (const item of value || []) parts.push(`<li>${escapeHtml(item)}</li>`);
      parts.push('</ul>');
    } else if (s.kind === 'pairs') {
      parts.push('<ul>');
      for (const item of value || []) {
        parts.push(
          `<li><strong>${escapeHtml(item[s.titleField])}</strong> — ${escapeHtml(item[s.descField])}</li>`
        );
      }
      parts.push('</ul>');
    } else {
      parts.push(`<p>${escapeHtml(value)}</p>`);
    }
  }

  return parts.join('\n');
}
