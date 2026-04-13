const STORAGE_KEYS  = { SETTINGS: 'dora_settings', LOGS: 'dora_logs', SOURCES: 'dora_sources' };
const DEFAULT_SETTINGS = { rootFolder: 'AI출력물', processEtc: false, enabled: true };
const DEFAULT_SOURCES  = [
  { id: 'claude',     name: 'Claude',     urlPattern: 'claude.ai',             prefix: 'CDL', destination: '' },
  { id: 'chatgpt',    name: 'ChatGPT',    urlPattern: 'chatgpt.com',           prefix: 'GPT', destination: '' },
  { id: 'notebooklm', name: 'NotebookLM', urlPattern: 'notebooklm.google.com', prefix: 'NLM', destination: '' }
];

// ── DOM 참조 ──────────────────────────────────────────────────
const enabledToggle    = document.getElementById('enabledToggle');
const rootFolderInput  = document.getElementById('rootFolderInput');
const etcToggle        = document.getElementById('etcToggle');
const saveSettingsBtn  = document.getElementById('saveSettingsBtn');
const saveSettingsMsg  = document.getElementById('saveSettingsMsg');
const addSourceBtn     = document.getElementById('addSourceBtn');
const sourceForm       = document.getElementById('sourceForm');
const formName         = document.getElementById('formName');
const formPrefix       = document.getElementById('formPrefix');
const formPattern      = document.getElementById('formPattern');
const formDest         = document.getElementById('formDest');
const formPickBtn      = document.getElementById('formPickBtn');
const formCancelBtn    = document.getElementById('formCancelBtn');
const formSaveBtn      = document.getElementById('formSaveBtn');
const sourceList       = document.getElementById('sourceList');
const clearLogBtn      = document.getElementById('clearLogBtn');
const logList          = document.getElementById('logList');

let sources   = [];
let editingId = null; // 수정 중인 소스 id (null이면 신규 추가)
let isPicking = false; // 폴더 선택 창 중복 방지 플래그

// ── 초기화 ───────────────────────────────────────────────────
async function init() {
  const [settingsResult, logsResult, sourcesResult] = await Promise.all([
    chrome.storage.sync.get(STORAGE_KEYS.SETTINGS),
    chrome.storage.local.get(STORAGE_KEYS.LOGS),
    chrome.storage.sync.get(STORAGE_KEYS.SOURCES)
  ]);

  const settings = { ...DEFAULT_SETTINGS, ...(settingsResult[STORAGE_KEYS.SETTINGS] ?? {}) };
  enabledToggle.checked = settings.enabled;
  rootFolderInput.value = settings.rootFolder;
  etcToggle.checked     = settings.processEtc;

  sources = sourcesResult[STORAGE_KEYS.SOURCES] ?? DEFAULT_SOURCES;
  renderSources();
  renderLogs(logsResult[STORAGE_KEYS.LOGS] ?? []);
}

// ── 기본 설정 저장 ────────────────────────────────────────────
async function saveSettings() {
  const rootFolder = rootFolderInput.value.trim().replace(/[/\\]/g, '') || DEFAULT_SETTINGS.rootFolder;
  rootFolderInput.value = rootFolder;

  await chrome.storage.sync.set({
    [STORAGE_KEYS.SETTINGS]: { enabled: enabledToggle.checked, rootFolder, processEtc: etcToggle.checked }
  });
  showMsg(saveSettingsMsg, '저장되었습니다.');
}

// ── 출처 목록 렌더링 ─────────────────────────────────────────
function renderSources() {
  if (!sources.length) {
    sourceList.innerHTML = '<p class="empty-msg">출처가 없습니다. 추가해주세요.</p>';
    return;
  }

  sourceList.innerHTML = sources.map(src => `
    <div class="source-card" data-id="${src.id}">
      <div class="source-card-header">
        <span class="source-badge">${escapeHtml(src.prefix)}</span>
        <span class="source-name">${escapeHtml(src.name)}</span>
        <span class="source-pattern">${escapeHtml(src.urlPattern)}</span>
        <div class="source-card-actions">
          <button class="btn btn-ghost edit-btn" data-id="${src.id}">수정</button>
          <button class="btn btn-danger delete-btn" data-id="${src.id}">삭제</button>
        </div>
      </div>
      <div class="source-card-body">
        <span class="source-dest ${src.destination ? 'set' : ''}">
          ${src.destination ? escapeHtml(src.destination) : '저장 경로 미지정 (기본 위치 사용)'}
        </span>
        <div class="source-card-actions">
          <button class="btn btn-outline pick-source-btn" data-id="${src.id}">폴더 선택</button>
        </div>
      </div>
    </div>
  `).join('');

  // 이벤트 위임
  sourceList.querySelectorAll('.edit-btn').forEach(btn =>
    btn.addEventListener('click', () => openEditForm(btn.dataset.id)));
  sourceList.querySelectorAll('.delete-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteSource(btn.dataset.id)));
  sourceList.querySelectorAll('.pick-source-btn').forEach(btn =>
    btn.addEventListener('click', () => pickFolderForSource(btn.dataset.id)));
}

// ── 폼 열기 (추가 / 수정) ────────────────────────────────────
function openAddForm() {
  editingId = null;
  formName.value    = '';
  formPrefix.value  = '';
  formPattern.value = '';
  formDest.value    = '';
  sourceForm.classList.remove('hidden');
  formName.focus();
}

function openEditForm(id) {
  const src = sources.find(s => s.id === id);
  if (!src) return;
  editingId         = id;
  formName.value    = src.name;
  formPrefix.value  = src.prefix;
  formPattern.value = src.urlPattern;
  formDest.value    = src.destination;
  sourceForm.classList.remove('hidden');
  formName.focus();
}

function closeForm() {
  editingId = null;
  sourceForm.classList.add('hidden');
}

// ── 폼에서 폴더 선택 ─────────────────────────────────────────
async function pickFolderInForm() {
  const result = await requestPickFolder('저장 폴더 선택');
  if (result) formDest.value = result;
}

// ── 카드에서 직접 폴더 선택 ──────────────────────────────────
async function pickFolderForSource(id) {
  const src = sources.find(s => s.id === id);
  if (!src) return;

  const result = await requestPickFolder(`${src.name} 저장 폴더 선택`);
  if (result === null) return; // 취소

  src.destination = result;
  await saveSources();
  renderSources();
}

// ── Native Messaging으로 폴더 선택 창 요청 ───────────────────
function requestPickFolder(title) {
  if (isPicking) {
    alert('폴더 선택 창이 이미 열려 있습니다.\n선택을 완료하거나 취소한 뒤 다시 시도하세요.');
    return Promise.resolve(null);
  }

  isPicking = true;

  return new Promise((resolve) => {
    const done = (value) => { isPicking = false; resolve(value); };

    let port;
    try {
      port = chrome.runtime.connectNative('com.abc.dora');
    } catch {
      alert('DORA 설치 앱을 먼저 실행해주세요.\n(DORA_installer.app 또는 DORA_installer.exe)');
      done(null);
      return;
    }

    port.onMessage.addListener((response) => {
      port.disconnect();
      if (response.success) {
        done(response.path);
      } else if (response.error === 'cancelled') {
        done(null);
      } else {
        alert(`폴더 선택 오류: ${response.error}`);
        done(null);
      }
    });

    port.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError;
      if (err) {
        alert('DORA 설치 앱과 연결할 수 없습니다.\nDORA_installer를 다시 실행하거나 Chrome을 완전히 재시작해주세요.');
        done(null);
      }
    });

    port.postMessage({ action: 'pick_folder', title });
  });
}

// ── 소스 저장 ────────────────────────────────────────────────
async function saveSources() {
  await chrome.storage.sync.set({ [STORAGE_KEYS.SOURCES]: sources });
}

// ── 폼 저장 (추가 or 수정) ───────────────────────────────────
async function saveSourceForm() {
  const name    = formName.value.trim();
  const prefix  = formPrefix.value.trim().toUpperCase();
  const pattern = formPattern.value.trim();
  const dest    = formDest.value.trim();

  if (!name || !prefix || !pattern) {
    alert('이름, 접두어, URL 패턴은 필수입니다.');
    return;
  }

  if (editingId) {
    const src = sources.find(s => s.id === editingId);
    if (src) { src.name = name; src.prefix = prefix; src.urlPattern = pattern; src.destination = dest; }
  } else {
    sources.push({ id: `src_${Date.now()}`, name, prefix, urlPattern: pattern, destination: dest });
  }

  await saveSources();
  closeForm();
  renderSources();
}

// ── 소스 삭제 ────────────────────────────────────────────────
async function deleteSource(id) {
  sources = sources.filter(s => s.id !== id);
  await saveSources();
  renderSources();
}

// ── 로그 렌더링 ──────────────────────────────────────────────
function renderLogs(logs) {
  if (!logs.length) {
    logList.innerHTML = '<p class="empty-msg">로그가 없습니다.</p>';
    return;
  }

  logList.innerHTML = logs.map(entry => {
    const statusClass = entry.status === 'moved' ? 'moved' : entry.status === 'error' ? 'error' : 'renamed';
    const badge = entry.status === 'moved' ? '이동' : entry.status === 'error' ? 'ERR' : '저장';
    const filename = (entry.newFilePath || entry.originalFilename || '').split(/[/\\]/).pop();
    const tooltip  = entry.status === 'error' ? (entry.errorMessage ?? '') : (entry.newFilePath ?? '');

    return `
      <div class="log-entry log-${statusClass}" title="${escapeHtml(tooltip)}">
        <span class="log-badge">${badge}</span>
        <span class="log-filename">${escapeHtml(filename)}</span>
        <span class="log-time">${formatTime(entry.timestamp)}</span>
      </div>
    `;
  }).join('');
}

// ── 유틸 ─────────────────────────────────────────────────────
function showMsg(el, text) {
  el.textContent = text;
  setTimeout(() => { el.textContent = ''; }, 2000);
}

function formatTime(iso) {
  const d = new Date(iso);
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── 이벤트 바인딩 ────────────────────────────────────────────
saveSettingsBtn.addEventListener('click', saveSettings);
addSourceBtn.addEventListener('click', openAddForm);
formPickBtn.addEventListener('click', pickFolderInForm);
formCancelBtn.addEventListener('click', closeForm);
formSaveBtn.addEventListener('click', saveSourceForm);
clearLogBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(STORAGE_KEYS.LOGS);
  renderLogs([]);
});

document.addEventListener('DOMContentLoaded', init);
