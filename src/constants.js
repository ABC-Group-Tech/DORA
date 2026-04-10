// 기본 제공 AI 출처 목록 (사용자가 팝업에서 추가/수정/삭제 가능)
export const DEFAULT_SOURCES = [
  {
    id: 'claude',
    name: 'Claude',
    urlPattern: 'claude.ai',
    prefix: 'CDL',
    destination: ''
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    urlPattern: 'chatgpt.com',
    prefix: 'GPT',
    destination: ''
  },
  {
    id: 'notebooklm',
    name: 'NotebookLM',
    urlPattern: 'notebooklm.google.com',
    prefix: 'NLM',
    destination: ''
  }
];

// 처리 대상 파일 확장자
export const ALLOWED_EXTENSIONS = ['.pdf', '.pptx'];

// 기본 설정값
export const DEFAULT_SETTINGS = {
  rootFolder: 'AI출력물',
  processEtc: false,
  enabled: true
};

// storage 키
export const STORAGE_KEYS = {
  SETTINGS: 'dora_settings',
  LOGS: 'dora_logs',
  SOURCES: 'dora_sources'
};

// 로그 최대 보관 건수
export const MAX_LOG_COUNT = 20;
