// 카테고리별로 글의 구조(섹션)와 문체 가이드가 완전히 달라진다.
// section.kind: 'text'(문단) | 'list'(문자열 배열) | 'pairs'(제목+설명 배열)
// tistoryCategory: 실제 티스토리 블로그 카테고리명 (없으면 자동 생성 대상)
export const CATEGORIES = {
  tech: {
    label: '테크(얼리어답터 리뷰)',
    tistoryCategory: '테크',
    styleGuide:
      '얼리어답터 대상 신제품 리뷰. 스펙/성능을 다각도로 다루고, 담백하고 정보 중심적인 문체를 쓴다. ' +
      '경쟁 제품과의 비교, 구체적인 추천 대상 제시가 핵심이다.',
    sections: [
      { key: 'intro', label: '도입', kind: 'text' },
      { key: 'design', label: '디자인/외관', kind: 'text' },
      { key: 'features', label: '핵심 기능', kind: 'text' },
      { key: 'performance', label: '성능/실사용', kind: 'text' },
      { key: 'pros', label: '장점', kind: 'list', minItems: 3, itemHint: '구체적인 장점 (Korean)' },
      { key: 'cons', label: '단점', kind: 'list', minItems: 2, itemHint: '구체적인 단점 (Korean)' },
      { key: 'personas', label: '추천 대상', kind: 'pairs', minItems: 3, titleField: 'who', descField: 'why' },
      { key: 'competitors', label: '경쟁 제품 비교', kind: 'pairs', minItems: 2, titleField: 'name', descField: 'diff' },
      { key: 'buying_guide', label: '구매 가이드', kind: 'text' },
    ],
  },
  food: {
    label: '맛집',
    tistoryCategory: '맛집',
    styleGuide:
      '1인칭 방문 후기 문체. 딱딱한 정보 나열이 아니라 "왜 이 가게를 찾아가게 됐는지" 감정이입되는 도입부로 시작한다. ' +
      '위치/영업시간/주차 같은 실용 정보는 명확한 숫자·사실로 앞부분에 배치해 신뢰를 준다. ' +
      '메뉴는 실제 가격과 함께 제시하고, 맛 평가는 구체적인 식감·향·온도 묘사를 포함한다.',
    sections: [
      { key: 'intro', label: '방문 계기', kind: 'text' },
      { key: 'info', label: '위치·영업시간·주차 정보', kind: 'text' },
      { key: 'atmosphere', label: '매장 분위기', kind: 'text' },
      { key: 'menu', label: '대표 메뉴·가격', kind: 'pairs', minItems: 2, titleField: 'name', descField: 'price_desc' },
      { key: 'taste_review', label: '맛 평가', kind: 'text' },
      { key: 'tips', label: '웨이팅·예약 팁', kind: 'text' },
      { key: 'conclusion', label: '총평 및 추천 대상', kind: 'text' },
    ],
  },
  travel: {
    label: '여행',
    tistoryCategory: '여행',
    styleGuide:
      '여행지의 매력과 실용 정보를 함께 담는다. 사진/볼거리 포인트를 구체적으로 짚어주고, ' +
      '가는 방법과 소요시간, 예상 비용처럼 독자가 바로 계획에 쓸 수 있는 숫자 정보를 포함한다. ' +
      '계절/시기에 따라 달라지는 팁을 반드시 언급한다.',
    sections: [
      { key: 'intro', label: '여행지 소개', kind: 'text' },
      { key: 'access', label: '가는 방법·소요시간', kind: 'text' },
      { key: 'course', label: '추천 코스·일정', kind: 'text' },
      { key: 'prep', label: '준비물·예상 비용', kind: 'text' },
      { key: 'highlights', label: '포토스팟·볼거리', kind: 'pairs', minItems: 2, titleField: 'name', descField: 'desc' },
      { key: 'season_tips', label: '시기별 팁', kind: 'text' },
      { key: 'conclusion', label: '총평', kind: 'text' },
    ],
  },
  lifeTips: {
    label: '생활정보',
    tistoryCategory: '생활정보',
    styleGuide:
      '검색으로 바로 문제를 해결하려는 독자를 위한 글. 첫 문단에 결론/핵심 요약을 먼저 제시하고, ' +
      '이후 단계별로 구체적인 해결 방법을 순서대로 설명한다. 실수하기 쉬운 부분은 주의사항으로 명확히 분리한다.',
    sections: [
      { key: 'situation', label: '문제 상황', kind: 'text' },
      { key: 'summary', label: '핵심 요약', kind: 'text' },
      { key: 'steps', label: '해결 방법', kind: 'text' },
      { key: 'cautions', label: '주의사항', kind: 'text' },
      { key: 'extra_tips', label: '추가 팁', kind: 'pairs', minItems: 2, titleField: 'name', descField: 'desc' },
      { key: 'conclusion', label: '마무리', kind: 'text' },
    ],
  },
};

export const DEFAULT_CATEGORY_KEY = 'tech';

export function getCategory(key) {
  return CATEGORIES[key] || CATEGORIES[DEFAULT_CATEGORY_KEY];
}
