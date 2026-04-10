const STORAGE_KEYS = { SETTINGS: 'dora_settings', LOGS: 'dora_logs' };
const DEFAULT_SETTINGS = { rootFolder: 'AI출력물', processEtc: false, enabled: true };

// DOM 참조
const enabledToggle  = document.getElementById('enabledToggle');
const rootFolderInput = document.getElementById('rootFolderInput');
const etcToggle      = document.getElementById('etcToggle');
const saveBtn        = document.getElementById('saveBtn');
const saveMsg        = document.getElementById('saveMsg');
const logList        = document.getElementById('logList');
const clearLogBtn    = document.getElementById('clearLogBtn');

// ── 초기화 ──────────────────────────────────────────
async function init() {
  const [settingsResult, logsResult] = await Promise.all([
    chrome.storage.sync.get(STORAGE_KEYS.SETTINGS),
    chrome.storage.local.get(STORAGE_KEYS.LOGS)
  ]);

  const settings = { ...DEFAULT_SETTINGS, ...(settingsResult[STORAGE_KEYS.SETTINGS] ?? {}) };
  applySettings(settings);
  renderLogs(logsResult[STORAGE_KEYS.LOGS] ?? []);
}

// ── 설정 UI 반영 ─────────────────────────────────────
function applySettings(settings) {
  enabledToggle.checked  = settings.enabled;
  rootFolderInput.value  = settings.rootFolder;
  etcToggle.checked      = settings.processEtc;
}

// ── 설정 저장 ────────────────────────────────────────
async function saveSettings() {
  const rootFolder = rootFolderInput.value.trim().replace(/[/\\]/g, '') || DEFAULT_SETTINGS.rootFolder;
  rootFolderInput.value = rootFolder;

  const settings = {
    enabled:     enabledToggle.checked,
    rootFolder,
    processEtc:  etcToggle.checked
  };

  await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings });
  showSaveMsg('저장되었습니다.');
}

function showSaveMsg(text) {
  saveMsg.textContent = text;
  setTimeout(() => { saveMsg.textContent = ''; }, 2000);
}

// ── 로그 렌더링 ──────────────────────────────────────
function renderLogs(logs) {
  if (!logs.length) {
    logList.innerHTML = '<p class="empty-msg">로그가 없습니다.</p>';
    return;
  }

  logList.innerHTML = logs.map(entry => {
    const sourceClass = entry.status === 'error'
      ? 'error'
      : entry.source.toLowerCase();

    const badge = entry.status === 'error' ? 'ERR' : getBadgeLabel(entry.source);
    const filename = entry.newFilePath
      ? entry.newFilePath.split('/').pop()
      : entry.originalFilename;
    const time = formatTime(entry.timestamp);

    return `
      <div class="log-entry log-${sourceClass}" title="${entry.newFilePath || entry.errorMessage || ''}">
        <span class="log-badge">${badge}</span>
        <span class="log-filename">${escapeHtml(filename)}</span>
        <span class="log-time">${time}</span>
      </div>
    `;
  }).join('');
}

function getBadgeLabel(source) {
  const map = { NOTEBOOKLM: 'NLM', CLAUDE: 'CDL', CHATGPT: 'GPT', ETC: 'ETC' };
  return map[source] ?? source;
}

function formatTime(isoString) {
  const d = new Date(isoString);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 로그 초기화 ──────────────────────────────────────
async function clearLogs() {
  await chrome.storage.local.remove(STORAGE_KEYS.LOGS);
  renderLogs([]);
}

// ── 이벤트 바인딩 ────────────────────────────────────
saveBtn.addEventListener('click', saveSettings);
clearLogBtn.addEventListener('click', clearLogs);

// 팝업이 열릴 때마다 초기화
document.addEventListener('DOMContentLoaded', init);
