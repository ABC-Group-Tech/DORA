/**
 * 날짜를 파일명용(YYYYMMDD)과 폴더명용(YYYY-MM) 포맷으로 반환한다.
 *
 * @param {Date} date
 * @returns {{ fileDate: string, folderDate: string }}
 */
function formatDates(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return {
    fileDate: `${yyyy}${mm}${dd}`,
    folderDate: `${yyyy}-${mm}`
  };
}

/**
 * 파일명에서 베이스명과 확장자를 분리한다.
 *
 * @param {string} filename
 * @returns {{ baseName: string, ext: string }}
 */
function splitFilename(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return { baseName: filename, ext: '' };
  return {
    baseName: filename.substring(0, lastDot),
    ext: filename.substring(lastDot)
  };
}

/**
 * 경로 구분자 및 경로 순회 문자를 제거해 안전한 파일명을 반환한다.
 *
 * @param {string} name
 * @returns {string}
 */
function sanitize(name) {
  return name.replace(/[/\\]/g, '_').replace(/\.\./g, '_');
}

/**
 * downloadItem과 출처 정보를 바탕으로 최종 저장 경로를 생성한다.
 *
 * 결과 예시:
 *   "AI출력물/NotebookLM/2026-04/NLM_20260410_전략플레이북.pdf"
 *
 * @param {object} downloadItem - chrome.downloads.DownloadItem
 * @param {object} source       - SOURCES 객체 중 하나
 * @param {string} rootFolder   - 설정된 루트 폴더명
 * @returns {string}
 */
export function buildFilePath(downloadItem, source, rootFolder) {
  const rawFilename = downloadItem.filename.split(/[/\\]/).pop() || downloadItem.filename;
  const { baseName, ext } = splitFilename(rawFilename);
  const { fileDate, folderDate } = formatDates(new Date());

  const safeBase = sanitize(baseName);
  const safeRoot = sanitize(rootFolder);

  const newFilename = `${source.prefix}_${fileDate}_${safeBase}${ext}`;
  const folderPath = `${safeRoot}/${source.name}/${folderDate}`;

  return `${folderPath}/${newFilename}`;
}
