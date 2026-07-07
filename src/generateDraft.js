import { getCategory } from './categories.js';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function buildSchemaFields(category) {
  return category.sections
    .map((s) => {
      if (s.kind === 'text') {
        return `  "${s.key}": string (Korean, 2-4 sentences) — ${s.label}`;
      }
      if (s.kind === 'list') {
        return `  "${s.key}": [string, ...] (최소 ${s.minItems}개, Korean, ${s.itemHint}) — ${s.label}`;
      }
      // pairs
      return (
        `  "${s.key}": [{"${s.titleField}": string, "${s.descField}": string}, ...] ` +
        `(최소 ${s.minItems}개, Korean) — ${s.label}`
      );
    })
    .join('\n');
}

function buildSystemPrompt(category) {
  return `You are a writer for a Korean blog (felpen.tistory.com) that publishes in multiple content categories.
The current post's category is "${category.label}". Writing style for this category: ${category.styleGuide}

Given the topic and any reference material provided, search the web to confirm real, current facts (prices, hours, locations, specs, etc. as relevant to the topic).
Then respond with ONLY a single valid JSON object (no markdown fences, no preamble, no explanation text) matching exactly this schema:
{
  "topic": string,
  "title": string (Korean, SEO-friendly blog post title including the core keyword, natural, not clickbait),
  "meta_description": string (Korean, 1 sentence, under 120 characters),
  "tags": [string, ...] (5-8 Korean longtail keywords readers would search),
${buildSchemaFields(category)}
}
Keep every string field concise (1-4 sentences unless noted). All Korean text should sound natural for a Korean blog reader.
Rules for AdSense/Google Search policy compliance:
- State only facts you can find via web search or the provided reference text. If a detail is uncertain, describe it in general terms instead of inventing specifics.
- Do not use clickbait, exaggerated superlatives, or manipulative phrasing designed purely to induce clicks.
- Write with enough concrete, original detail that the post reads as firsthand analysis, not a thin rewrite.`;
}

/**
 * Gemini API(무료 티어)를 서버 사이드에서 호출해 카테고리에 맞는 구조의 글 초안을
 * JSON으로 생성한다. google_search 그라운딩 툴과 JSON 강제 응답(response_schema)은
 * 모델에 따라 함께 쓸 수 없는 경우가 있어, response_schema 대신 프롬프트 지시 +
 * 텍스트에서 JSON을 추출하는 방식을 쓴다.
 */
export async function generateDraft({ apiKey, productHint, reference, categoryKey }) {
  const category = getCategory(categoryKey);
  const systemPrompt = buildSystemPrompt(category);

  const userMsg = [
    productHint ? `주제/상품명: ${productHint}` : null,
    reference?.url ? `참고 URL: ${reference.url}` : null,
    reference?.title ? `참고 페이지 제목: ${reference.title}` : null,
    reference?.text ? `참고 페이지 본문 발췌:\n${reference.text}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const res = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMsg }] }],
      tools: [{ google_search: {} }],
    }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    const message = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(
      `Gemini API 호출 실패: ${message}. 모델 ID(${GEMINI_MODEL})가 현재 유효한지, GEMINI_API_KEY가 맞는지 확인하세요.`
    );
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  let raw = parts.map((p) => p.text || '').join('\n').trim();
  raw = raw.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemini 응답에서 JSON을 찾을 수 없습니다.');
  }

  return JSON.parse(jsonMatch[0]);
}
