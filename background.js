import { ALLOWED_EXTENSIONS, DEFAULT_SETTINGS, STORAGE_KEYS } from './src/constants.js';
import { classifySource } from './src/classifier.js';
import { buildFilePath } from './src/filenameBuilder.js';
import { saveLog } from './src/logger.js';

/**
 * chrome.storage.sync에서 설정을 읽어 반환한다.
 * 읽기 실패 시 DEFAULT_SETTINGS로 폴백한다.
 *
 * @returns {Promise<object>}
 */
async function getSettings() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * onDeterminingFilename 이벤트의 핵심 처리 로직.
 * 모든 경로에서 반드시 suggest()를 한 번 호출한다.
 *
 * @param {chrome.downloads.DownloadItem} downloadItem
 * @param {Function} suggest
 */
async function handleDownload(downloadItem, suggest) {
  let settings;

  try {
    settings = await getSettings();
  } catch {
    suggest();
    return;
  }

  // [1] 확장 프로그램 비활성화
  if (!settings.enabled) {
    suggest();
    return;
  }

  // [2] 파일 확장자 필터
  const lowerFilename = (downloadItem.filename ?? '').toLowerCase();
  const isAllowed = ALLOWED_EXTENSIONS.some(ext => lowerFilename.endsWith(ext));
  if (!isAllowed) {
    suggest();
    return;
  }

  // [3] 출처 판별
  const source = classifySource(downloadItem.referrer ?? '');

  // [4] ETC 처리 여부 확인
  if (source.id === 'ETC' && !settings.processEtc) {
    suggest();
    return;
  }

  try {
    // [5] 저장 경로 생성
    const newFilePath = buildFilePath(downloadItem, source, settings.rootFolder);

    // [6] Chrome에 파일명 제안
    suggest({ filename: newFilePath, conflictAction: 'uniquify' });

    // [7] 로그 저장 (비동기, 실패해도 다운로드에 영향 없음)
    saveLog({
      id: downloadItem.id,
      timestamp: new Date().toISOString(),
      originalFilename: downloadItem.filename,
      newFilePath,
      source: source.id,
      referrer: downloadItem.referrer ?? '',
      status: 'renamed'
    }).catch(console.error);

  } catch (error) {
    // 경로 생성 실패 시 기본 동작 유지 + 오류 로그
    suggest();
    saveLog({
      id: downloadItem.id,
      timestamp: new Date().toISOString(),
      originalFilename: downloadItem.filename ?? '',
      newFilePath: '',
      source: source.id,
      referrer: downloadItem.referrer ?? '',
      status: 'error',
      errorMessage: error.message
    }).catch(console.error);
  }
}

// 리스너 등록 — 비동기 suggest() 사용을 위해 return true 명시
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  handleDownload(downloadItem, suggest);
  return true;
});
