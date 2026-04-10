# DORA — Document Organizer & Retrieval Assistant

> AI 도구(NotebookLM, Claude, ChatGPT)에서 다운로드된 문서를 자동으로 분류·정리하는 Chrome 확장 프로그램

---

## 배경 및 문제 정의

Claude, ChatGPT, NotebookLM 등 AI 도구에서 생성된 PDF/PPTX 파일을 다운로드하면 모두 `Downloads` 폴더에 무분별하게 쌓이는 문제가 있다. 출처와 날짜 기준의 수동 정리가 반복적으로 필요한 상황이다.

DORA는 Chrome Extension의 `onDeterminingFilename` API를 활용해 **다운로드 시점에** 출처 URL을 즉시 판별하고, 파일명 변경과 폴더 지정을 한 번에 처리한다.

---

## 주요 기능

- 다운로드 시점에 출처 URL(referrer)을 즉시 판별하여 파일명 자동 변경
- 출처별 지정 폴더로 자동 저장
- Chrome 확장 설치만으로 동작 — 별도 프로그램 설치 불필요
- macOS / Windows 동일 동작
- 대상 파일 형식: `.pdf`, `.pptx`

---

## 파일명 규칙

```
{PREFIX}_{YYYYMMDD}_{원본파일명}.{확장자}
```

| 출처 | Prefix | 예시 |
|------|--------|------|
| NotebookLM | `NLM` | `NLM_20260410_전략플레이북.pdf` |
| Claude | `CDL` | `CDL_20260410_회사소개서.pptx` |
| ChatGPT | `GPT` | `GPT_20260410_마케팅분석.pdf` |
| 미분류 | `ETC` | `ETC_20260410_파일명.pdf` |

---

## 폴더 구조 (저장 경로)

```
Downloads/
└── AI출력물/
    ├── NotebookLM/
    │   └── 2026-04/
    │       └── NLM_20260410_전략플레이북.pdf
    ├── Claude/
    │   └── 2026-04/
    │       └── CDL_20260410_회사소개서.pptx
    ├── ChatGPT/
    │   └── 2026-04/
    │       └── GPT_20260410_마케팅분석.pdf
    └── ETC/                          ← 설정으로 처리 여부 제어
        └── 2026-04/
```

---

## 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│                        Chrome Browser                        │
│                                                              │
│  ┌───────────────┐      ┌──────────────────────────────────┐ │
│  │   Popup UI    │◄────►│        Service Worker            │ │
│  │               │      │        (background.js)           │ │
│  │  popup.html   │      │                                  │ │
│  │  popup.js     │      │   DownloadHandler                │ │
│  │  popup.css    │      │     onDeterminingFilename()      │ │
│  └──────┬────────┘      │         │                        │ │
│         │               │   ReferrerClassifier             │ │
│         │               │     classifySource(url)          │ │
│         │               │         │                        │ │
│         │               │   FilenameBuilder                │ │
│         │               │     buildFilePath(item, source)  │ │
│         │               │         │                        │ │
│         │               │   Logger                         │ │
│         │               │     saveLog(entry)               │ │
│         │               └──────────────────────────────────┘ │
│         │                                                      │
│         └──────────────► chrome.storage                        │
│                           ├─ .sync  → 설정 (기기 간 동기화)    │
│                           └─ .local → 로그 (로컬 전용)         │
└──────────────────────────────────────────────────────────────┘
```

---

## 데이터 플로우

```
사용자가 AI 도구에서 PDF/PPTX 다운로드 클릭
          │
          ▼
chrome.downloads.onDeterminingFilename 이벤트 발생
          │
          ├─ [1] 설정 로드 (chrome.storage.sync)
          │
          ├─ [2] 확장 프로그램 활성화 여부 확인
          │         └─ 비활성화 → suggest() 기본 동작 유지
          │
          ├─ [3] 파일 확장자 필터 (.pdf / .pptx 만 처리)
          │         └─ 대상 외 → suggest() 기본 동작 유지
          │
          ├─ [4] referrer URL로 출처 판별
          │         ├─ notebooklm.google.com → NLM (NotebookLM)
          │         ├─ claude.ai             → CDL (Claude)
          │         ├─ chatgpt.com           → GPT (ChatGPT)
          │         └─ 미매칭               → ETC
          │
          ├─ [5] ETC 처리 여부 확인 (설정값)
          │         └─ processEtc=false → suggest() 기본 동작 유지
          │
          ├─ [6] 파일 경로 생성
          │         └─ "AI출력물/NotebookLM/2026-04/NLM_20260410_파일명.pdf"
          │
          ├─ [7] suggest({ filename, conflictAction: 'uniquify' })
          │         └─ Chrome이 실제 파일 저장
          │
          └─ [8] 로그 저장 (chrome.storage.local, 최근 20건 유지)
```

---

## 프로젝트 파일 구조

```
DORA/
├── manifest.json              # Extension 메타정보 및 권한 선언 (Manifest V3)
├── background.js              # Service Worker — 다운로드 이벤트 처리 핵심 로직
├── src/
│   ├── constants.js           # 출처 패턴, 기본 설정값, 상수 정의
│   ├── classifier.js          # referrer URL → 출처 분류 모듈
│   ├── filenameBuilder.js     # 파일명 / 저장 경로 생성 모듈
│   └── logger.js              # 로그 저장 / 조회 모듈
├── popup/
│   ├── popup.html             # 설정 UI 마크업
│   ├── popup.js               # 설정 저장 및 로그 렌더링 로직
│   └── popup.css              # 팝업 스타일
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## 기술 스택

| 항목 | 선택 |
|------|------|
| 플랫폼 | Chrome Extension (Manifest V3) |
| 언어 | JavaScript (ES2020+) |
| 핵심 API | `chrome.downloads.onDeterminingFilename` |
| 설정 저장 | `chrome.storage.sync` |
| 로그 저장 | `chrome.storage.local` |
| UI | Extension Popup (HTML / CSS / JS) |
| OS 호환 | macOS / Windows |

---

## 데이터 모델

### 설정 (chrome.storage.sync)

```js
// key: 'dora_settings'
{
  rootFolder: "AI출력물",   // 루트 폴더명 (사용자 변경 가능)
  processEtc: false,        // 미분류 파일 처리 여부
  enabled: true             // 확장 프로그램 활성화 여부
}
```

### 로그 (chrome.storage.local)

```js
// key: 'dora_logs' — 최신순, 최대 20건
[
  {
    id: 42,
    timestamp: "2026-04-10T09:30:00.000Z",
    originalFilename: "Podcast transcript.pdf",
    newFilePath: "AI출력물/NotebookLM/2026-04/NLM_20260410_Podcast transcript.pdf",
    source: "NOTEBOOKLM",
    referrer: "https://notebooklm.google.com/...",
    status: "renamed"        // "renamed" | "skipped" | "error"
  }
]
```

---

## 설정 UI (Popup)

```
┌─────────────────────────────┐
│  DORA              [ON/OFF] │  ← 확장 활성화 토글
├─────────────────────────────┤
│  설정                       │
│  루트 폴더: [AI출력물      ]│
│  ETC 처리:  [  토글  ]      │
│                  [설정 저장]│
├─────────────────────────────┤
│  최근 다운로드 로그         │
│  ┌─────────────────────┐   │
│  │ NLM │ 04-10 │ ...  │   │
│  │ GPT │ 04-09 │ ...  │   │
│  └─────────────────────┘   │
│                [로그 초기화]│
└─────────────────────────────┘
```

---

## Chrome 권한

| 권한 | 용도 |
|------|------|
| `downloads` | 다운로드 이벤트 감지 및 파일명 변경 |
| `storage` | 사용자 설정 및 로그 저장 |

---

## 구현 단계

| Phase | 내용 | 목표 |
|-------|------|------|
| **Phase 1** | 폴더 구조 + `manifest.json` + `constants.js` | Extension 로드 확인 |
| **Phase 2** | `classifier.js` + `filenameBuilder.js` + 리스너 연결 | 출처 분류 동작 확인 |
| **Phase 3** | `background.js` 통합 + `logger.js` | 실제 다운로드 경로 변경 확인 |
| **Phase 4** | Popup UI (설정 저장 + 로그 뷰어) | 사용자 설정 반영 |
| **Phase 5** | 예외처리 강화 + 최종 테스트 | 배포 준비 |

---

## 범위 외 (Out of Scope)

- Firefox / Safari 지원 — Chrome 전용
- 인쇄 자동화 — 수동 인쇄 유지
- 클라우드 동기화 — 로컬 저장만 대상
- Edge 지원 — Chromium 기반으로 동작 가능하나 별도 테스트 미포함

---

## 사용자 설치 방법

> 상세 안내는 릴리즈 페이지에서 `DORA_설치가이드.txt`를 함께 다운로드하세요.

### Step 1. Chrome 확장 로드
```
1. chrome://extensions 접속
2. 개발자 모드 ON
3. "압축해제된 확장 프로그램 로드" → DORA 폴더 선택
4. 카드 하단의 Extension ID (32자리) 복사
```

### Step 2. 설치 프로그램 실행

| OS | 파일 | 방법 |
|----|------|------|
| macOS | `DORA_설치_mac.zip` | 압축 해제 → `.app` 더블클릭 |
| Windows | `DORA_설치.exe` | 더블클릭 |

Extension ID 입력 후 [설치 시작] 클릭 → Chrome 완전 재시작

### Step 3. 저장 폴더 설정
```
툴바 DORA 아이콘 클릭
→ [AI 출처 관리] 섹션
→ 각 출처 카드의 [폴더 선택]으로 저장 위치 지정
→ 새 AI 도구 추가 시 [+ 추가] 버튼
```

---

## 배포 방법 (개발자용)

### 릴리즈 배포 절차

태그를 푸시하면 GitHub Actions가 자동으로 macOS/Windows 빌드 후 Release를 생성합니다.

```bash
# 1. 코드 변경 후 main에 커밋/푸시
git push origin main

# 2. 버전 태그 생성 및 푸시 → 빌드 자동 시작
git tag v1.0.0
git push origin v1.0.0
```

### 빌드 결과물 (자동 생성)

| 파일 | 내용 |
|------|------|
| `DORA_설치_mac.zip` | macOS 설치 앱 (.app 번들) |
| `DORA_설치.exe` | Windows 설치 실행 파일 |
| `DORA_설치가이드.txt` | 설치 및 사용 방법 안내 |

빌드 진행 상황: **https://github.com/ABC-Group-Tech/DORA/actions**
릴리즈 다운로드: **https://github.com/ABC-Group-Tech/DORA/releases**

### 버전 관리 규칙

```
v1.0.0  최초 릴리즈
v1.1.0  기능 추가
v1.0.1  버그 수정
```

---

## 범위 외 (Out of Scope)

- Firefox / Safari 지원 — Chrome 전용
- 인쇄 자동화 — 수동 인쇄 유지
- 클라우드 동기화 — 로컬 저장만 대상
- Edge 지원 — Chromium 기반으로 동작 가능하나 별도 테스트 미포함

---

*ABC Group Tech 내부용 | 2026.04*
