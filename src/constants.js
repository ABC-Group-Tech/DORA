// 출처별 메타 정보 및 URL 패턴 정의
export const SOURCES = {
  NOTEBOOKLM: {
    id: 'NOTEBOOKLM',
    prefix: 'NLM',
    folderName: 'NotebookLM',
    patterns: [
      /notebooklm\.google\.com/i,
      /notebook\.new/i
    ]
  },
  CLAUDE: {
    id: 'CLAUDE',
    prefix: 'CDL',
    folderName: 'Claude',
    patterns: [
      /claude\.ai/i,
      /anthropic\.com/i
    ]
  },
  CHATGPT: {
    id: 'CHATGPT',
    prefix: 'GPT',
    folderName: 'ChatGPT',
    patterns: [
      /chatgpt\.com/i,
      /chat\.openai\.com/i
    ]
  },
  ETC: {
    id: 'ETC',
    prefix: 'ETC',
    folderName: 'ETC',
    patterns: []
  }
};

// 처리 대상 파일 확장자
export const ALLOWED_EXTENSIONS = ['.pdf', '.pptx'];

// 기본 설정값
export const DEFAULT_SETTINGS = {
  rootFolder: 'AI출력물',
  processEtc: false,
  enabled: true,
  // 출처별 저장 경로 (절대 경로). 비어있으면 Downloads 하위 폴더 구조 사용
  destinations: {
    NOTEBOOKLM: '',
    CLAUDE: '',
    CHATGPT: '',
    ETC: ''
  }
};

// storage 키
export const STORAGE_KEYS = {
  SETTINGS: 'dora_settings',
  LOGS: 'dora_logs',
  PENDING: 'dora_pending'  // 다운로드 중인 항목 임시 저장 (session storage)
};

// 로그 최대 보관 건수
export const MAX_LOG_COUNT = 20;
