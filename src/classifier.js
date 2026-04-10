import { SOURCES } from './constants.js';

/**
 * referrer URL을 기반으로 다운로드 출처를 판별한다.
 * referrer가 없거나 어떤 패턴에도 매칭되지 않으면 SOURCES.ETC를 반환한다.
 *
 * @param {string} referrer - downloadItem.referrer
 * @returns {object} SOURCES 객체 중 하나
 */
export function classifySource(referrer) {
  if (!referrer || referrer.trim() === '') {
    return SOURCES.ETC;
  }

  for (const [key, source] of Object.entries(SOURCES)) {
    if (key === 'ETC') continue;
    for (const pattern of source.patterns) {
      if (pattern.test(referrer)) {
        return source;
      }
    }
  }

  return SOURCES.ETC;
}
