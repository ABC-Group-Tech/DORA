/**
 * referrer URL을 동적 소스 목록과 대조해 출처를 판별한다.
 *
 * @param {string} referrer   - downloadItem.referrer
 * @param {object[]} sources  - chrome.storage.sync에서 불러온 소스 배열
 * @returns {object|null}     - 매칭된 소스 객체, 없으면 null
 */
export function classifySource(referrer, sources) {
  if (!referrer || referrer.trim() === '') return null;

  for (const source of sources) {
    const pattern = (source.urlPattern ?? '').trim();
    if (!pattern) continue;

    if (referrer.includes(pattern)) {
      return source;
    }
  }

  return null;
}
