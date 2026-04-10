# DORA — Document Organizer & Retrieval Assistant

> AI 도구(NotebookLM, Claude, ChatGPT)에서 다운로드된 문서를 자동으로 분류·정리하는 Chrome 확장 프로그램

---

## 배경 및 문제 정의

Claude, ChatGPT, NotebookLM 등 AI 도구에서 생성된 PDF/PPTX 파일을 다운로드하면 모두 `Downloads` 폴더에 무분별하게 쌓이는 문제가 있다. 출처와 날짜 기준의 수동 정리가 반복적으로 필요한 상황이다.

DORA는 Chrome Extension의 `onDeterminingFilename` API를 활용해 **다운로드 시점에** 출처 URL을 즉시 판별하고, 파일명 변경과 지정 폴더로의 이동을 자동으로 처리한다.

---

## 주요 기능

- 다운로드 시점에 출처 URL(referrer)을 즉시 판별하여 파일명 자동 변경
- 출처별 지정 폴더로 자동 이동 (Native Messaging 경유)
- 출처 동적 관리 — 팝업에서 AI 도구 추가 / 수정 / 삭제 가능
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
└── AI출력물/          ← 저장 경로 미지정 시 기본 위치
    ├── Claude/
    │   └── 2026-04/
    │       └── CDL_20260410_회사소개서.pptx
    ├── ChatGPT/
    │   └── 2026-04/
    │       └── GPT_20260410_마케팅분석.pdf
    └── NotebookLM/
        └── 2026-04/
            └── NLM_20260410_전략플레이북.pdf

[사용자 지정 폴더]     ← 출처별 폴더 지정 시 Downloads 밖으로 이동
    ├── Claude/        ← DORA 팝업에서 [폴더 선택]으로 지정
    ├── ChatGPT/
    └── NotebookLM/
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
│  └──────┬────────┘      │     onChanged() → moveFile()     │ │
│         │               │         │                        │ │
│         │               │   ReferrerClassifier             │ │
│         │               │   FilenameBuilder                │ │
│         │               │   Logger                         │ │
│         │               └──────────┬───────────────────────┘ │
│         │                          │ chrome.runtime           │
│         └──────────────►chrome.storage   .connectNative()     │
│                           sync/local/session                  │
└──────────────────────────────────┬───────────────────────────┘
                                   │ Native Messaging (stdio)
                          ┌────────▼────────┐
                          │  dora_host      │
                          │  (.py / .exe)   │
                          │                 │
                          │  move_file()    │  shutil.move
                          │  pick_folder()  │  tkinter dialog
                          └─────────────────┘
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
          │
          ├─ [3] 파일 확장자 필터 (.pdf / .pptx 만 처리)
          │
          ├─ [4] referrer URL로 출처 판별
          │         ├─ notebooklm.google.com → NLM
          │         ├─ claude.ai             → CDL
          │         ├─ chatgpt.com           → GPT
          │         └─ 미매칭               → ETC
          │
          ├─ [5] 파일 경로 생성 및 suggest() 호출
          │         └─ "AI출력물/Claude/2026-04/CDL_20260410_파일명.pdf"
          │
          ├─ [6] 목적지 폴더가 설정된 경우 → session storage에 대기 등록
          │
          └─ [7] 다운로드 완료 (onChanged state=complete)
                    │
                    └─ [8] Native Messaging으로 파일 이동 요청
                              dora_host → shutil.move (macOS: Finder fallback)
                              → 지정 폴더로 이동 완료
                              → 로그 저장 (chrome.storage.local)
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
│   ├── popup.js               # 설정 저장, 출처 CRUD, 로그 렌더링
│   └── popup.css              # 팝업 스타일
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── native/
│   ├── dora_host.py           # Native Messaging 호스트 (파일 이동 / 폴더 선택)
│   ├── installer_gui.py       # GUI 설치 앱 (tkinter) — PyInstaller로 빌드
│   ├── build_installer.sh     # 맥 로컬 빌드 스크립트
│   └── build_installer.bat    # 윈도우 로컬 빌드 스크립트
├── DORA_설치가이드.txt
├── .github/
│   └── workflows/
│       └── release.yml        # macOS / Windows 자동 빌드 및 릴리즈
└── README.md
```

---

## 기술 스택

| 항목 | 선택 |
|------|------|
| 플랫폼 | Chrome Extension (Manifest V3) |
| 언어 | JavaScript (ES2020+), Python 3.11 |
| 핵심 API | `chrome.downloads.onDeterminingFilename` |
| 파일 이동 | Native Messaging (`chrome.runtime.connectNative`) |
| 설정 저장 | `chrome.storage.sync` |
| 임시 상태 | `chrome.storage.session` (Service Worker 재시작 대비) |
| 로그 저장 | `chrome.storage.local` |
| UI | Extension Popup (HTML / CSS / JS) |
| 설치 앱 | Python tkinter + PyInstaller |
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

### 출처 목록 (chrome.storage.sync)

```js
// key: 'dora_sources' — 팝업에서 CRUD 관리
[
  {
    id: 'claude',
    name: 'Claude',
    urlPattern: 'claude.ai',
    prefix: 'CDL',
    destination: '/Users/이름/Documents/Claude'  // 폴더 미지정 시 빈 문자열
  },
  ...
]
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
    source: "NotebookLM",
    referrer: "https://notebooklm.google.com/...",
    status: "moved"        // "renamed" | "moved" | "skipped" | "error"
  }
]
```

---

## 설정 UI (Popup)

```
┌─────────────────────────────┐
│  DORA              [ON/OFF] │  ← 확장 활성화 토글
├─────────────────────────────┤
│  AI 출처 관리               │
│  ┌─────────────────────┐   │
│  │ Claude   CDL  [폴더]│   │  ← 출처 카드 (수정/삭제/폴더선택)
│  │ ChatGPT  GPT  [폴더]│   │
│  │ ...               +추가│   │
│  └─────────────────────┘   │
├─────────────────────────────┤
│  설정                       │
│  루트 폴더: [AI출력물      ]│
│  ETC 처리:  [  토글  ]      │
│                  [설정 저장]│
├─────────────────────────────┤
│  최근 다운로드 로그         │
│  ┌─────────────────────┐   │
│  │ CDL │ 04-10 │ ...  │   │
│  └─────────────────────┘   │
│                [로그 초기화]│
└─────────────────────────────┘
```

---

## Chrome 권한

| 권한 | 용도 |
|------|------|
| `downloads` | 다운로드 이벤트 감지 및 파일명 변경 |
| `storage` | 사용자 설정, 출처 목록, 로그 저장 |
| `nativeMessaging` | Python 호스트와 통신 (파일 이동, 폴더 선택) |

---

## 사용자 설치 방법

> 상세 안내는 릴리즈 페이지에서 `DORA_설치가이드.txt`를 함께 확인하세요.

### Step 1. Chrome 확장 로드
```
1. chrome://extensions 접속
2. 개발자 모드 ON
3. "압축해제된 확장 프로그램 로드" → DORA_extension 폴더 선택
4. 카드 하단의 Extension ID (32자리) 복사
```

### Step 2. 설치 프로그램 실행

| OS | 파일 | 방법 |
|----|------|------|
| 맥 | `DORA_mac.zip` → `DORA_installer.app` | 우클릭 → 열기 (첫 실행 시) |
| 윈도우 | `DORA_windows.zip` → `DORA_installer.exe` | 추가 정보 → 실행 |

Extension ID 입력 → [설치 시작] → Chrome 완전 종료(Cmd+Q) 후 재시작

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
| `DORA_mac.zip` | 맥용 패키지 (DORA_installer.app + DORA_extension + 가이드) |
| `DORA_windows.zip` | 윈도우용 패키지 (DORA_installer.exe + DORA_extension + 가이드) |

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
