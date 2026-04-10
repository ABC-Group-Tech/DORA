import { ALLOWED_EXTENSIONS, DEFAULT_SETTINGS, STORAGE_KEYS } from './src/constants.js';
import { classifySource } from './src/classifier.js';
import { buildFilePath } from './src/filenameBuilder.js';
import { saveLog } from './src/logger.js';

const NATIVE_HOST = 'com.abc.dora';

// 다운로드 ID → { newFilePath, source, destinationDir } 임시 저장
// Service Worker 재시작에 대비해 chrome.storage.session도 병행 사용
const pendingMap = new Map();

// ── 설정 로드 ──────────────────────────────────────────────────
async function getSettings() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    const saved = result[STORAGE_KEYS.SETTINGS] ?? {};
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      destinations: { ...DEFAULT_SETTINGS.destinations, ...(saved.destinations ?? {}) }
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// ── Native Messaging: 파일 이동 요청 ───────────────────────────
function moveFile(src, dst) {
  return new Promise((resolve, reject) => {
    let port;
    try {
      port = chrome.runtime.connectNative(NATIVE_HOST);
    } catch (err) {
      reject(new Error(`Native Host 연결 실패: ${err.message}`));
      return;
    }

    port.onMessage.addListener((response) => {
      port.disconnect();
      if (response.success) {
        resolve(response.dst);
      } else {
        reject(new Error(response.error ?? '알 수 없는 오류'));
      }
    });

    port.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(`Native Host 연결 끊김: ${err.message}`));
    });

    port.postMessage({ action: 'move', src, dst });
  });
}

// ── 다운로드 파일명 결정 이벤트 ────────────────────────────────
async function handleDeterminingFilename(downloadItem, suggest) {
  const settings = await getSettings();

  if (!settings.enabled) { suggest(); return; }

  const lowerFilename = (downloadItem.filename ?? '').toLowerCase();
  const isAllowed = ALLOWED_EXTENSIONS.some(ext => lowerFilename.endsWith(ext));
  if (!isAllowed) { suggest(); return; }

  const source = classifySource(downloadItem.referrer ?? '');

  if (source.id === 'ETC' && !settings.processEtc) { suggest(); return; }

  try {
    const newFilePath = buildFilePath(downloadItem, source, settings.rootFolder);
    const destinationDir = settings.destinations[source.id] ?? '';

    // 이동 대상 경로가 지정된 경우: 다운로드 후 이동 처리를 위해 pending 등록
    if (destinationDir.trim() !== '') {
      const filename = newFilePath.split('/').pop();
      const targetPath = `${destinationDir.replace(/[/\\]$/, '')}/${filename}`;

      pendingMap.set(downloadItem.id, {
        newFilePath,
        targetPath,
        sourceId: source.id,
        referrer: downloadItem.referrer ?? ''
      });
    }

    suggest({ filename: newFilePath, conflictAction: 'uniquify' });

  } catch (error) {
    suggest();
    saveLog({
      id: downloadItem.id,
      timestamp: new Date().toISOString(),
      originalFilename: downloadItem.filename ?? '',
      newFilePath: '',
      source: source?.id ?? 'UNKNOWN',
      referrer: downloadItem.referrer ?? '',
      status: 'error',
      errorMessage: error.message
    }).catch(console.error);
  }
}

// ── 다운로드 완료 이벤트: 파일 이동 실행 ───────────────────────
async function handleDownloadChanged(delta) {
  // 완료 상태 변경만 처리
  if (delta.state?.current !== 'complete') return;

  const pending = pendingMap.get(delta.id);
  if (!pending) return;

  pendingMap.delete(delta.id);

  // 실제 다운로드된 파일 경로 조회
  const [downloadItem] = await chrome.downloads.search({ id: delta.id });
  if (!downloadItem) return;

  const srcPath = downloadItem.filename; // 실제 저장된 절대 경로

  try {
    const movedPath = await moveFile(srcPath, pending.targetPath);

    saveLog({
      id: delta.id,
      timestamp: new Date().toISOString(),
      originalFilename: srcPath.split(/[/\\]/).pop(),
      newFilePath: movedPath,
      source: pending.sourceId,
      referrer: pending.referrer,
      status: 'moved'
    }).catch(console.error);

  } catch (error) {
    console.error('[DORA] 파일 이동 실패:', error.message);

    saveLog({
      id: delta.id,
      timestamp: new Date().toISOString(),
      originalFilename: srcPath.split(/[/\\]/).pop(),
      newFilePath: pending.newFilePath,
      source: pending.sourceId,
      referrer: pending.referrer,
      status: 'error',
      errorMessage: `파일 이동 실패: ${error.message}`
    }).catch(console.error);
  }
}

// ── 리스너 등록 ────────────────────────────────────────────────
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  handleDeterminingFilename(downloadItem, suggest);
  return true; // 비동기 suggest() 사용 명시
});

chrome.downloads.onChanged.addListener(handleDownloadChanged);
