// 이 도구로 발행할 수 있는 티스토리 블로그 목록. 같은 카카오/티스토리 계정
// 아래 있는 블로그라면 로그인 세션(.state/storageState.json) 하나로 전부 접근 가능하다.
export const BLOGS = {
  felpen: { label: '얼리어답터 Fun 스토리 (felpen)', subdomain: 'felpen' },
  guha79: { label: '알짜 정보 상회 (guha79)', subdomain: 'guha79' },
};

export const DEFAULT_BLOG_KEY = 'felpen';

export function getBlog(key) {
  return BLOGS[key] || BLOGS[DEFAULT_BLOG_KEY];
}
