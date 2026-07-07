# tistory-auto-publisher

주제(URL 또는 상품명/키워드)를 입력하면 리서치 → 카테고리별 스타일에 맞는 글 생성 → 품질 검증 →
원하는 티스토리 블로그에 실제 공개 발행까지 한 번에 처리하는 개인용 자동화 도구.

- **리서치**: 참고 URL 본문 스크래핑 + Gemini의 `google_search` 그라운딩으로 실제 정보 확인
- **카테고리별 완전히 다른 글 구조**: 테크 리뷰 / 맛집 / 여행 / 요리 레시피 / 생활정보 — 각기 다른 섹션 구성과 문체
- **여러 블로그 지원**: 같은 티스토리(카카오) 계정 아래 있는 블로그 여러 개 중 선택해 발행
- **발행 자동화**: Playwright로 실제 로그인 세션을 재사용해 티스토리 웹 에디터를 직접 조작 (Open API는 종료됨, 아래 참고)

## 왜 브라우저 자동화인가

티스토리 Open API의 글쓰기 기능은 2024년 2월에 공식 종료되어 API로 직접 발행하는 방법이 없다.
이 도구는 대신 Playwright로 실제 로그인 세션을 재사용해 티스토리 웹 에디터(TinyMCE 기반)를 직접
조작한다. 공식 지원 방식이 아니므로 티스토리가 에디터 UI를 바꾸면 `src/publishTistory.js`의
선택자를 다시 맞춰야 할 수 있다.

## 프로젝트 구조

```
tistory-auto-publisher/
  server.js                # 로컬 웹 UI 서버 (Express)
  public/index.html         # 웹 UI 화면
  bin/generate-and-publish.js  # CLI 진입점
  src/
    runPipeline.js           # 리서치 → 생성 → 품질게이트 → 발행, CLI/웹서버 공용 파이프라인
    categories.js             # 카테고리별 섹션 구조·문체 정의 (새 카테고리는 여기만 추가하면 됨)
    blogs.js                  # 발행 대상 블로그 목록 정의
    fetchReference.js         # 참고 URL 본문 텍스트 추출
    generateDraft.js          # Gemini API 호출, 카테고리 스키마 기반 JSON 생성
    qualityGate.js            # 카테고리 섹션 완성도 자동 검증
    renderPostHtml.js         # JSON 초안 → 티스토리 본문 HTML 변환
    rateLimiter.js            # 블로그별 일일 발행 개수 제한
    tistoryLogin.js           # 최초 1회 로그인 세션 저장 스크립트
    publishTistory.js         # Playwright 발행 자동화 (카테고리 자동 생성 포함)
    config.js                 # 환경변수 로드/검증
```

## 설치

```bash
git clone https://github.com/guhakim/tistory-auto-publisher.git
cd tistory-auto-publisher
npm install
npx playwright install chromium
cp .env.example .env   # GEMINI_API_KEY 채워넣기 (https://aistudio.google.com/apikey 에서 무료 발급)
```

## 최초 1회 설정

### 1) 로그인 세션 저장

```bash
npm run login
```

브라우저 창이 뜨면 직접 티스토리(카카오 계정)로 로그인한다. 로그인이 끝나면 터미널로 돌아와 Enter.
`.state/storageState.json`에 세션이 저장된다. 같은 계정 아래 있는 블로그라면 이 세션 하나로
전부 접근 가능하다. **이 파일은 로그인 쿠키이므로 절대 공유/커밋하지 말 것** (`.gitignore` 처리됨).

### 2) 에디터 선택자 (이미 확인 완료, 참고용)

`src/publishTistory.js`의 `SELECTORS`는 실제 로그인 세션으로 글쓰기 화면을 직접 열어 DOM을
검사해 확인한 값이다(제목 `#post-title-inp`, 본문은 TinyMCE API
`tinymce.get('editor-tistory').setContent()` + `.save()`, 태그 `#tagText`, 공개 설정 `#open20`,
최종 발행 `#publish-btn`). 이후 티스토리가 에디터 UI를 바꿔서 자동화가 깨지면, 아래 명령으로
실제 화면을 열어 선택자를 다시 확인할 수 있다 (스크립트의 URL은 기본적으로 felpen 기준이니 필요시 블로그명을 바꿀 것).

```bash
npm run codegen
```

## 사용법

### 웹 UI (권장)

```bash
npm run web
```

`http://localhost:4321` 접속. 이 서버는 로컬(`localhost`)에서만 열리며, API 키와 로그인 세션은
이 컴퓨터를 벗어나지 않는다.

1. **블로그** 선택 (`src/blogs.js`에 정의된 목록)
2. **주제(카테고리)** 선택 (`src/categories.js`에 정의된 목록)
3. 참고 URL 또는 주제/상품명 입력
4. "미리보기만 생성" 체크 여부 결정 후 "실행"

상단 상태 표시줄에 로그인 여부와 선택한 블로그의 오늘 발행 수가 표시된다.

### CLI (대안)

```bash
# 미리보기만 (발행 안 함)
node bin/generate-and-publish.js --url "https://example.com/product-page" --dry-run

# 실제 발행 (카테고리/블로그 지정)
node bin/generate-and-publish.js --product "을지로 냉면집" --category food --blog felpen
```

| 플래그 | 설명 |
|---|---|
| `--url` | 참고 사이트 URL (상품 페이지, 맛집/장소 정보 등) |
| `--product` | `--url` 없이 주제/상품명만으로 리서치 (Gemini의 `google_search`로 보완) |
| `--category` | `tech` \| `food` \| `travel` \| `recipe` \| `lifeTips` (기본값 `tech`) |
| `--blog` | `src/blogs.js`에 정의된 블로그 키 (기본값은 `DEFAULT_BLOG_KEY`) |
| `--dry-run` | 발행하지 않고 생성 결과만 출력 |
| `--debug` | 브라우저 창을 띄우고 느리게 실행해 실패 단계를 눈으로 확인 |

## 카테고리 추가/수정

`src/categories.js`의 `CATEGORIES` 객체에 항목을 추가하면 생성 프롬프트·품질 검증·HTML 렌더링에
자동으로 반영된다 (세 모듈 모두 이 정의 하나만 참조). 섹션 종류는 세 가지뿐이다:

- `text`: 문단 하나
- `list`: 문자열 배열 (예: 장점/단점)
- `pairs`: `{제목, 설명}` 배열 (예: 추천 대상, 경쟁 제품 비교)

`tistoryCategory` 필드에 적은 이름이 실제 티스토리 카테고리명이 되며, 블로그에 없으면
발행 시 자동으로 생성된다.

## 블로그 추가/수정

`src/blogs.js`의 `BLOGS` 객체에 `{ label, subdomain }`을 추가하면 된다. 단, 로그인 세션이
그 블로그에도 접근 권한이 있는 계정이어야 한다.

## 무료 API(Gemini) 사용 시 유의점

- 결제 없이 [aistudio.google.com/apikey](https://aistudio.google.com/apikey)에서 키 발급 가능
- 무료 티어는 분당/일당 요청 수 제한이 있음 (모델에 따라 다름). 짧은 시간에 여러 번 실행하면 429 오류가 날 수 있으니 몇 분 간격을 두고 재시도할 것
- 모델 ID(`src/generateDraft.js`의 `GEMINI_MODEL`)는 시점에 따라 바뀔 수 있으므로, 404/모델 오류가 나면 [Google AI Studio](https://aistudio.google.com)에서 현재 사용 가능한 모델명을 확인해 교체

## 안전장치

- **품질 게이트**: 카테고리의 필수 섹션이 다 채워지지 않으면(각 섹션 최소 항목 수 미달 등) 1회 재생성 후에도 실패 시 발행하지 않음
- **일일 발행 제한**: `.env`의 `DAILY_PUBLISH_LIMIT`(기본 5)을 블로그별로 넘으면 발행 차단 — 티스토리 저품질 판정 방지
- `.env`, `.state/`는 `.gitignore` 처리되어 API 키·로그인 세션이 저장소에 올라가지 않음

## 남아있는 리스크

- AI가 전량 생성한 콘텐츠를 무검수로 자동 발행하는 것은 구글의 "scaled content abuse" 스팸 정책 위반으로 사이트 전체 검색 노출이 떨어질 위험이 있다. 문제가 감지되면 즉시 자동 발행을 멈추고 품질 게이트 기준을 강화하거나 발행 전 수동 검수 단계를 되살릴 것.
- 브라우저 자동화는 티스토리 공식 지원 방식이 아니므로, 에디터 UI가 바뀌면 `src/publishTistory.js`의 `SELECTORS`를 다시 맞춰야 한다.
