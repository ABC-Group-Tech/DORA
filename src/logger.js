import { STORAGE_KEYS, MAX_LOG_COUNT } from './constants.js';

/**
 * 로그 엔트리를 chrome.storage.local에 저장한다.
 * 최신 항목을 앞에 추가하며, MAX_LOG_COUNT 초과분은 제거한다.
 *
 * @param {object} entry - LogEntry 객체
 * @param {number} entry.id
 * @param {string} entry.timestamp  - ISO 8601
 * @param {string} entry.originalFilename
 * @param {string} entry.newFilePath
 * @param {string} entry.source
 * @param {string} entry.referrer
 * @param {string} entry.status     - "renamed" | "skipped" | "error"
 * @param {string} [entry.errorMessage]
 */
export async function saveLog(entry) {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LOGS);
  const logs = result[STORAGE_KEYS.LOGS] ?? [];

  logs.unshift(entry);
  const trimmed = logs.slice(0, MAX_LOG_COUNT);

  await chrome.storage.local.set({ [STORAGE_KEYS.LOGS]: trimmed });
}

/**
 * 저장된 로그 전체를 반환한다.
 *
 * @returns {Promise<object[]>}
 */
export async function getLogs() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.LOGS);
  return result[STORAGE_KEYS.LOGS] ?? [];
}

/**
 * 저장된 로그를 전부 삭제한다.
 */
export async function clearLogs() {
  await chrome.storage.local.remove(STORAGE_KEYS.LOGS);
}
