import { getCategory } from './categories.js';

const COMMON_REQUIRED_TEXT_FIELDS = ['topic', 'title'];

/**
 * 카테고리의 섹션 정의를 기준으로 완성도를 기계적으로 검증한다. 사람 검수를
 * 생략하는 대신 이 체크를 통과해야만 발행 단계로 넘어가도록 해서 빈 섹션인 채로
 * 공개 발행되는 것을 막는다.
 */
export function checkDraftQuality(draft, categoryKey) {
  const category = getCategory(categoryKey);
  const problems = [];

  for (const field of COMMON_REQUIRED_TEXT_FIELDS) {
    if (!draft?.[field] || String(draft[field]).trim().length === 0) {
      problems.push(`"${field}" 필드가 비어 있음`);
    }
  }

  for (const s of category.sections) {
    const value = draft?.[s.key];

    if (s.kind === 'text') {
      if (!value || String(value).trim().length === 0) {
        problems.push(`"${s.label}" 섹션이 비어 있음`);
      }
    } else if (s.kind === 'list') {
      const count = Array.isArray(value) ? value.filter(Boolean).length : 0;
      if (count < s.minItems) {
        problems.push(`"${s.label}"이(가) ${s.minItems}개 미만`);
      }
    } else if (s.kind === 'pairs') {
      const count = Array.isArray(value)
        ? value.filter((v) => v?.[s.titleField] && v?.[s.descField]).length
        : 0;
      if (count < s.minItems) {
        problems.push(`"${s.label}"이(가) ${s.minItems}개 미만`);
      }
    }
  }

  return { passed: problems.length === 0, problems };
}
