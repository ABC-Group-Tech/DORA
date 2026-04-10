import { ALLOWED_EXTENSIONS, DEFAULT_SETTINGS, DEFAULT_SOURCES, STORAGE_KEYS } from './src/constants.js';
import { classifySource } from './src/classifier.js';
import { buildFilePath } from './src/filenameBuilder.js';
import { saveLog } from './src/logger.js';

const NATIVE_HOST = 'com.abc.dora';
const PENDING_KEY = 'dora_pending'; // session storage 키

// ── 설정 로드 ──────────────────────────────────────────────────
async function getSettings() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// ── 소스 목록 로드 ──────────────────────────────────────────────
async function getSources() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SOURCES);
    return result[STORAGE_KEYS.SOURCES] ?? DEFAULT_SOURCES;
  } catch {
    return DEFAULT_SOURCES;
  }
}

// ── session storage: pendingMap 대체 (SW 재시작 대비) ──────────
async function setPending(downloadId, data) {
  const result = await chrome.storage.session.get(PENDING_KEY);
  const map = result[PENDING_KEY] ?? {};
  map[downloadId] = data;
  await chrome.storage.session.set({ [PENDING_KEY]: map });
}

async function getPending(downloadId) {
  const result = await chrome.storage.session.get(PENDING_KEY);
  return (result[PENDING_KEY] ?? {})[downloadId] ?? null;
}

async function deletePending(downloadId) {
  const result = await chrome.storage.session.get(PENDING_KEY);
  const map = result[PENDING_KEY] ?? {};
  delete map[downloadId];
  await chrome.storage.session.set({ [PENDING_KEY]: map });
}

// ── Native Messaging: 파일 이동 요청 ───────────────────────────
function moveFile(src, dst) {
  return new Promise((resolve, reject) => {
    let port;
    let responded = false;

    try {
      port = chrome.runtime.connectNative(NATIVE_HOST);
    } catch (err) {
      reject(new Error(`Native Host 연결 실패: ${err.message}`));
      return;
    }

    port.onMessage.addListener((response) => {
      responded = true;
      port.disconnect();
      if (response.success) {
        resolve(response.dst);
      } else {
        reject(new Error(response.error ?? '알 수 없는 오류'));
      }
    });

    port.onDisconnect.addListener(() => {
      if (responded) return;
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(`Native Host 연결 끊김: ${err.message}`));
    });

    port.postMessage({ action: 'move', src, dst });
  });
}

// ── 다운로드 파일명 결정 이벤트 ────────────────────────────────
async function handleDeterminingFilename(downloadItem, suggest) {
  const [settings, sources] = await Promise.all([getSettings(), getSources()]);

  if (!settings.enabled) { suggest(); return; }

  const lowerFilename = (downloadItem.filename ?? '').toLowerCase();
  const isAllowed = ALLOWED_EXTENSIONS.some(ext => lowerFilename.endsWith(ext));
  if (!isAllowed) { suggest(); return; }

  const source = classifySource(downloadItem.referrer ?? '', sources);

  // 미분류: ETC 처리 설정에 따라 결정
  if (!source) {
    if (!settings.processEtc) { suggest(); return; }

    // ETC로 처리
    const etcSource = { id: 'ETC', name: 'ETC', prefix: 'ETC', destination: '' };
    try {
      const newFilePath = buildFilePath(downloadItem, etcSource, settings.rootFolder);
      suggest({ filename: newFilePath, conflictAction: 'uniquify' });
      saveLog({ id: downloadItem.id, timestamp: new Date().toISOString(),
        originalFilename: downloadItem.filename, newFilePath,
        source: 'ETC', referrer: downloadItem.referrer ?? '', status: 'renamed'
      }).catch(console.error);
    } catch { suggest(); }
    return;
  }

  try {
    const newFilePath = buildFilePath(downloadItem, source, settings.rootFolder);
    const destination = (source.destination ?? '').trim();

    if (destination !== '') {
      const filename = newFilePath.split('/').pop();
      const targetPath = `${destination.replace(/[/\\]$/, '')}/${filename}`;
      await setPending(downloadItem.id, {
        newFilePath, targetPath,
        sourceId: source.id, sourceName: source.name,
        referrer: downloadItem.referrer ?? ''
      });
    }

    suggest({ filename: newFilePath, conflictAction: 'uniquify' });

    if (destination === '') {
      saveLog({ id: downloadItem.id, timestamp: new Date().toISOString(),
        originalFilename: downloadItem.filename, newFilePath,
        source: source.name, referrer: downloadItem.referrer ?? '', status: 'renamed'
      }).catch(console.error);
    }

  } catch (error) {
    suggest();
    saveLog({ id: downloadItem.id, timestamp: new Date().toISOString(),
      originalFilename: downloadItem.filename ?? '', newFilePath: '',
      source: source?.name ?? 'UNKNOWN', referrer: downloadItem.referrer ?? '',
      status: 'error', errorMessage: error.message
    }).catch(console.error);
  }
}

// ── 다운로드 완료 이벤트: 파일 이동 실행 ───────────────────────
async function handleDownloadChanged(delta) {
  if (delta.state?.current !== 'complete') return;

  const pending = await getPending(delta.id);
  if (!pending) return;

  await deletePending(delta.id);

  const [downloadItem] = await chrome.downloads.search({ id: delta.id });
  if (!downloadItem) return;

  const srcPath = downloadItem.filename;

  try {
    const movedPath = await moveFile(srcPath, pending.targetPath);
    saveLog({ id: delta.id, timestamp: new Date().toISOString(),
      originalFilename: srcPath.split(/[/\\]/).pop(), newFilePath: movedPath,
      source: pending.sourceName, referrer: pending.referrer, status: 'moved'
    }).catch(console.error);

  } catch (error) {
    console.error('[DORA] 파일 이동 실패:', error.message);
    saveLog({ id: delta.id, timestamp: new Date().toISOString(),
      originalFilename: srcPath.split(/[/\\]/).pop(), newFilePath: pending.newFilePath,
      source: pending.sourceName, referrer: pending.referrer,
      status: 'error', errorMessage: `파일 이동 실패: ${error.message}`
    }).catch(console.error);
  }
}

// ── 리스너 등록 ────────────────────────────────────────────────
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  handleDeterminingFilename(downloadItem, suggest);
  return true;
});

chrome.downloads.onChanged.addListener(handleDownloadChanged);
