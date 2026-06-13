'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const API = '';  // same origin
const STORAGE_KEY = 'powers-agent-sessions';
const THEME_KEY = 'powers-agent-theme';
const SECRET_KEY = 'powers-agent-secret';

// ── API Secret ─────────────────────────────────────────────────────────────
function getSecret() { return sessionStorage.getItem(SECRET_KEY) || ''; }

function saveSecret() {
  const val = document.getElementById('api-secret-input').value;
  if (val) sessionStorage.setItem(SECRET_KEY, val);
  else sessionStorage.removeItem(SECRET_KEY);
}

function apiFetch(url, opts = {}) {
  const secret = getSecret();
  if (secret) {
    opts = { ...opts, headers: { ...(opts.headers || {}), 'Authorization': `Bearer ${secret}` } };
  }
  return fetch(url, opts);
}

const HELP = {
  walletKey: 'Private key for the Ethereum wallet this agent uses to sign transactions. Use a dedicated agent wallet — not a personal one. Generate one with <code>cast wallet new</code> (Foundry) or MetaMask, then fund it with a small amount of ETH for gas.',
  claudeKey: 'Anthropic API key that powers this agent\'s reasoning. Get yours at console.anthropic.com under API Keys. Keys start with <code>sk-ant-api03-</code>.',
  sessionDuration: 'How long the agent runs before automatically shutting down. The agent keeps running server-side after you close this tab — reconnect anytime using the Session ID.',
  powersAddress: 'On-chain address of the Powers governance contract this agent monitors and acts on. Find it in your deployment output or on the Powers frontend dashboard.',
  xmtpAddress: 'Address of the XMTP group chat manager contract for this organisation. Enables the agent to send and receive governance messages via XMTP. Leave blank if not using XMTP messaging.',
  fundAgent: 'Send ETH to the agent\'s wallet to cover gas fees for on-chain governance actions. The agent spends this automatically — top up when it runs low. Use a small amount; the agent only needs gas, not value.',
  addOrg: 'Connect this agent to an additional Powers governance contract. The agent will monitor and participate in governance for every organisation listed. You can add as many as needed.',
  addSkill: 'Skills extend what the agent can do — fetching prices, reading proposals, querying external APIs. Each skill runs in a sandboxed handler and is only permitted to contact the domains you specify.',
};

function helpLabel(text, tipHtml) {
  return `<div class="label-wrap"><label>${text}</label><button class="help-btn" onclick="toggleHelp(event,this)" aria-label="Help">?</button><div class="help-popover">${tipHtml}</div></div>`;
}

function toggleHelp(e, btn) {
  e.stopPropagation();
  const popover = btn.nextElementSibling;
  const isOpen = popover.classList.contains('open');
  document.querySelectorAll('.help-popover.open').forEach(p => p.classList.remove('open'));
  if (!isOpen) popover.classList.add('open');
}

// ── Theme ──────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
}
const CHAINS = [
  { id: 421614,   name: 'Arbitrum Sepolia' },
  { id: 11155111, name: 'Sepolia' },
  { id: 84532,    name: 'Base Sepolia' },
  { id: 11155420, name: 'Optimism Sepolia' },
  { id: 31337,    name: 'Anvil (local)' },
];

let currentSessionId = null;
let orgRowCount = 0;

// ── Boot ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    document.getElementById('http-warning').style.display = 'block';
  }

  initTheme();
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.addEventListener('click', () => {
    document.querySelectorAll('.help-popover.open').forEach(p => p.classList.remove('open'));
  });

  const stored = getSecret();
  if (stored) document.getElementById('api-secret-input').value = stored;

  addOrgRow();
  await loadSessionList();
});

// ── Screen switching ───────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  if (name === 'list') loadSessionList();
}

// ── Stored session IDs (UUIDs only, never keys) ────────────────────────────
function getStoredIds() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveStoredIds(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
}

function addStoredId(id) { saveStoredIds([...getStoredIds(), id]); }

function removeStoredId(id) { saveStoredIds(getStoredIds().filter(i => i !== id)); }

// ── Session List ───────────────────────────────────────────────────────────
async function loadSessionList() {
  const container = document.getElementById('session-list');
  container.innerHTML = '<div class="status info">Loading…</div>';

  let active = [];
  try {
    const res = await apiFetch(`${API}/api/sessions`);
    active = await res.json();
  } catch {
    container.innerHTML = '<div class="status error">Could not reach the agent server.</div>';
    return;
  }

  // Reconcile localStorage — remove expired session IDs
  const activeIds = new Set(active.map(s => s.sessionId));
  const stored = getStoredIds().filter(id => activeIds.has(id));
  saveStoredIds(stored);

  // Show sessions that are in localStorage (this user's agents) first, then others
  const mine = active.filter(s => stored.includes(s.sessionId));
  const others = active.filter(s => !stored.includes(s.sessionId));
  const sorted = [...mine, ...others];

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty">No active agents. Click "New Agent" to start one.</div>';
    return;
  }

  container.innerHTML = sorted.map(s => sessionCard(s)).join('');
  sorted.forEach(s => loadCardFunds(s.sessionId));
}

function sessionCard(s) {
  const expires = new Date(s.expiresAt);
  const remaining = Math.max(0, expires - Date.now());
  const mins = Math.floor(remaining / 60000);
  const timeLabel = mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  const chainName = id => CHAINS.find(c => c.id === id)?.name || `Chain ${id}`;
  const orgLines = (s.organisations || []).map(o =>
    `<div>${esc(chainName(o.chainId))} — <code>${shortAddr(o.powersAddress)}</code>${o.label ? ` (${esc(o.label)})` : ''}</div>`
  ).join('') || '—';

  return `
  <div class="card card-clickable" onclick="openManage('${s.sessionId}')">
    <div class="card-header">
      <h3>${esc(s.personaName || 'Agent')}</h3>
      <span class="tag">expires in ${timeLabel}</span>
    </div>
    <div class="meta-row">
      <div class="meta-item"><label>Agent wallet</label><span>${shortAddr(s.agentAddress)}</span></div>
      <div class="meta-item"><label>Balance</label><span id="card-funds-${s.sessionId}">…</span></div>
    </div>
    <div class="meta-item" style="margin-top:8px">
      <label>Organisations</label>
      <div style="font-size:12px;margin-top:4px;font-family:inherit">${orgLines}</div>
    </div>
  </div>`;
}

// ── Org rows ───────────────────────────────────────────────────────────────
function addOrgRow(values = {}) {
  orgRowCount++;
  const i = orgRowCount;
  const chainOptions = CHAINS.map(c =>
    `<option value="${c.id}"${values.chainId == c.id ? ' selected' : ''}>${c.name}</option>`
  ).join('');

  const row = document.createElement('div');
  row.className = 'org-entry';
  row.id = `org-row-${i}`;
  row.innerHTML = `
    <div class="form-group" style="margin:0">
      ${helpLabel('Powers Address', HELP.powersAddress)}
      <input class="org-addr" placeholder="0x…" value="${values.powersAddress || ''}" />
    </div>
    <div class="form-group" style="margin:0">
      <label>Chain</label>
      <select class="org-chain">${chainOptions}</select>
    </div>
    <div class="form-group" style="margin:0">
      <label>Label (optional)</label>
      <input class="org-label" placeholder="e.g. 7Cedars DAO" value="${values.label || ''}" />
    </div>
    <div class="form-group" style="margin:0">
      ${helpLabel('XMTP Chat Manager (optional)', HELP.xmtpAddress)}
      <input class="org-xmtp" placeholder="0x…" value="${values.xmtpAgentAddress || ''}" />
    </div>
    <button class="btn remove-org" onclick="removeOrgRow(${i})" title="Remove">×</button>`;

  document.getElementById('org-list').appendChild(row);
}

function removeOrgRow(i) {
  const row = document.getElementById(`org-row-${i}`);
  const list = document.getElementById('org-list');
  if (list.children.length > 1) row?.remove();
}

function collectOrgs() {
  return [...document.querySelectorAll('.org-entry')].map(row => ({
    powersAddress: row.querySelector('.org-addr').value.trim(),
    chainId: Number(row.querySelector('.org-chain').value),
    label: row.querySelector('.org-label').value.trim() || undefined,
    xmtpAgentAddress: row.querySelector('.org-xmtp').value.trim() || undefined,
  })).filter(o => o.powersAddress);
}

// ── Start Session ──────────────────────────────────────────────────────────
async function startSession() {
  const status = document.getElementById('start-status');
  status.className = 'status info';
  status.textContent = 'Starting agent…';

  const walletKey = document.getElementById('f-walletKey').value.trim();
  const claudeApiKey = document.getElementById('f-claudeKey').value.trim();
  const ttlMs = Number(document.getElementById('f-ttl').value);
  const organisations = collectOrgs();
  const name = document.getElementById('f-name').value.trim();
  const roleDescription = document.getElementById('f-roleDesc').value.trim();
  const strategy = document.getElementById('f-strategy').value.trim();
  const constraints = document.getElementById('f-constraints').value.trim();

  if (!walletKey || !claudeApiKey || !name || !strategy || organisations.length === 0) {
    status.className = 'status error';
    status.textContent = 'Please fill in all required fields and at least one organisation.';
    return;
  }

  const body = {
    walletKey,
    claudeApiKey,
    organisations,
    persona: { name, roleDescription, strategy, constraints: constraints || undefined },
    skills: [],
    ttlMs,
  };

  try {
    const res = await apiFetch(`${API}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      status.className = 'status error';
      status.textContent = data.error || 'Failed to start session.';
      return;
    }

    const sessionId = data.sessionId;
    addStoredId(sessionId);
    currentSessionId = sessionId;

    // Clear sensitive fields immediately
    document.getElementById('f-walletKey').value = '';
    document.getElementById('f-claudeKey').value = '';

    status.textContent = '';
    document.getElementById('start-session-id').textContent = sessionId;
    document.getElementById('start-success').style.display = 'block';
  } catch (err) {
    status.className = 'status error';
    status.textContent = 'Network error: ' + err.message;
  }
}

function copySessionId() {
  navigator.clipboard?.writeText(currentSessionId);
}

// ── Load Session by ID ─────────────────────────────────────────────────────
async function loadSessionById() {
  const status = document.getElementById('load-status');
  const id = document.getElementById('f-load-id').value.trim();

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) {
    status.className = 'status error';
    status.textContent = 'Not a valid session ID (expected UUID format).';
    return;
  }

  status.className = 'status info';
  status.textContent = 'Looking up session…';

  let sessions;
  try {
    const res = await apiFetch(`${API}/api/sessions`);
    sessions = await res.json();
  } catch {
    status.className = 'status error';
    status.textContent = 'Could not reach the agent server.';
    return;
  }

  const found = sessions.find(s => s.sessionId === id);
  if (!found) {
    status.className = 'status error';
    status.textContent = 'Session not found. It may have expired or the ID is incorrect.';
    return;
  }

  addStoredId(id);
  document.getElementById('f-load-id').value = '';
  status.textContent = '';
  openManage(id);
}

// ── Manage Session ─────────────────────────────────────────────────────────
async function openManage(sessionId) {
  currentSessionId = sessionId;
  showScreen('manage');

  const container = document.getElementById('manage-content');
  container.innerHTML = '<div class="status info">Loading…</div>';

  let sessions;
  try {
    const res = await apiFetch(`${API}/api/sessions`);
    sessions = await res.json();
  } catch {
    container.innerHTML = '<div class="status error">Could not load session.</div>';
    return;
  }

  const s = sessions.find(x => x.sessionId === sessionId);
  if (!s) {
    container.innerHTML = '<div class="status error">Session not found. It may have expired.</div>';
    removeStoredId(sessionId);
    return;
  }

  container.innerHTML = manageHTML(s);
}

function manageHTML(s) {
  const orgs = (s.organisations || []).map(o =>
    `<div><code>${esc(o.powersAddress)}</code> on chain ${o.chainId}${o.label ? ` — ${esc(o.label)}` : ''}</div>`
  ).join('');

  const uniqueChainIds = [...new Set((s.organisations || []).map(o => o.chainId))];
  const fundChainOptions = uniqueChainIds.map(id => {
    const name = CHAINS.find(c => c.id === id)?.name || `Chain ${id}`;
    return `<option value="${id}">${esc(name)}</option>`;
  }).join('');

  return `
  <!-- Summary -->
  <div class="card">
    <div class="card-header"><h3>${esc(s.personaName)}</h3><span class="tag">${shortAddr(s.agentAddress)}</span></div>
    <div class="section-title">Organisations</div>
    <div style="margin-bottom:12px; font-size:13px; color:var(--muted-foreground)">${orgs}</div>
    <div style="font-size:12px; color:var(--muted-foreground)">Expires: ${new Date(s.expiresAt).toLocaleString()}</div>
  </div>

  <!-- Fund -->
  <div class="card">
    <div class="card-header">
      <div class="label-wrap" style="margin-bottom:0"><h3>Fund Agent Wallet</h3><button class="help-btn" onclick="toggleHelp(event,this)" aria-label="Help">?</button><div class="help-popover">${HELP.fundAgent}</div></div>
    </div>
    <div id="fund-info" class="status info">Fetching balance…</div>
    <div class="form-group" style="margin-top:12px">
      <label>Chain</label>
      <select id="fund-chain">${fundChainOptions}</select>
    </div>
    <div class="form-group">
      <label>Amount (ETH)</label>
      <input id="fund-amount" type="number" step="0.001" placeholder="0.01" style="width:180px" />
    </div>
    <button class="btn btn-primary btn-sm" onclick="fundAgent('${s.sessionId}')">Send ETH</button>
    <div id="fund-status" class="status"></div>
  </div>

  <!-- Add Organisation -->
  <div class="card">
    <div class="card-header">
      <div class="label-wrap" style="margin-bottom:0"><h3>Add Organisation</h3><button class="help-btn" onclick="toggleHelp(event,this)" aria-label="Help">?</button><div class="help-popover">${HELP.addOrg}</div></div>
    </div>
    <div class="org-entry" id="manage-org-row">
      <div class="form-group" style="margin:0">${helpLabel('Powers Address', HELP.powersAddress)}<input id="m-org-addr" placeholder="0x…" /></div>
      <div class="form-group" style="margin:0"><label>Chain</label>
        <select id="m-org-chain">${CHAINS.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
      </div>
      <div class="form-group" style="margin:0"><label>Label</label><input id="m-org-label" placeholder="optional" /></div>
      <div class="form-group" style="margin:0">${helpLabel('XMTP Agent Address (optional)', HELP.xmtpAddress)}<input id="m-org-xmtp" placeholder="0x…" /></div>
      <div></div>
    </div>
    <button class="btn btn-primary btn-sm" onclick="addOrg('${s.sessionId}')">Add</button>
    <div id="add-org-status" class="status"></div>
  </div>

  <!-- Current Skills -->
  <div class="card">
    <div class="card-header"><h3>Current Skills</h3></div>
    <div id="skill-list"><div class="status info">Loading…</div></div>
  </div>

  <!-- Add Skill -->
  <div class="card">
    <div class="card-header">
      <div class="label-wrap" style="margin-bottom:0"><h3>Add Skill</h3><button class="help-btn" onclick="toggleHelp(event,this)" aria-label="Help">?</button><div class="help-popover">${HELP.addSkill}</div></div>
    </div>
    <div class="form-group"><label>Name (snake_case)</label><input id="m-skill-name" placeholder="get_eth_price" /></div>
    <div class="form-group"><label>Description</label><input id="m-skill-desc" placeholder="Fetches current ETH price from CoinGecko" /></div>
    <div class="form-group">
      <label>Handler</label>
      <select id="m-skill-handler">
        <option value="fetch_url">fetch_url</option>
        <option value="coingecko_price">coingecko_price</option>
        <option value="snapshot_proposal">snapshot_proposal</option>
        <option value="github_file">github_file</option>
        <option value="chainlink_price">chainlink_price</option>
        <option value="assess_proposal">assess_proposal</option>
      </select>
    </div>
    <div class="form-group"><label>Allowed Domains (comma-separated)</label><input id="m-skill-domains" placeholder="api.coingecko.com" /></div>
    <div class="form-group"><label>Handler Config (JSON)</label><textarea id="m-skill-config" placeholder='{"coinIds":["ethereum"]}'></textarea></div>
    <button class="btn btn-primary btn-sm" onclick="addSkill('${s.sessionId}')">Add Skill</button>
    <div id="add-skill-status" class="status"></div>
  </div>

  <!-- Update Persona -->
  <div class="card">
    <div class="card-header"><h3>Update Persona</h3></div>
    <div class="form-group"><label>Agent Name</label><input id="m-persona-name" value="${esc(s.personaName)}" /></div>
    <div class="form-group"><label>Description</label><textarea id="m-persona-roleDesc">${esc(s.persona?.roleDescription || '')}</textarea></div>
    <div class="form-group"><label>Strategy</label><textarea id="m-persona-strategy" style="min-height:100px">${esc(s.persona?.strategy || '')}</textarea></div>
    <div class="form-group"><label>Constraints</label><textarea id="m-persona-constraints">${esc(s.persona?.constraints || '')}</textarea></div>
    <button class="btn btn-primary btn-sm" onclick="updatePersona('${s.sessionId}')">Save</button>
    <div id="persona-status" class="status"></div>
  </div>

  <!-- End Session -->
  <div class="card" style="border-color:#3d1f1f">
    <div class="card-header"><h3>End Session</h3></div>
    <p style="color:var(--muted);font-size:13px;margin-bottom:12px">Permanently destroys this agent. The wallet key is zeroed immediately.</p>
    <button class="btn btn-danger btn-sm" onclick="endSession('${s.sessionId}')">End Session</button>
    <div id="end-status" class="status"></div>
  </div>`;
}

// ── Fund Agent ─────────────────────────────────────────────────────────────
async function loadCardFunds(sessionId) {
  const el = document.getElementById(`card-funds-${sessionId}`);
  if (!el) return;
  try {
    const res = await apiFetch(`${API}/api/session/${sessionId}/fund`);
    const data = await res.json();
    const chainMap = Object.fromEntries(CHAINS.map(c => [c.id, c.name]));
    el.textContent = data.balances
      .map(b => `${chainMap[b.chainId] || `Chain ${b.chainId}`}: ${b.balance}`)
      .join(' · ') || '—';
  } catch {
    el.textContent = 'unavailable';
  }
}

async function loadFundInfo(sessionId) {
  const el = document.getElementById('fund-info');
  if (!el) return;
  try {
    const res = await apiFetch(`${API}/api/session/${sessionId}/fund`);
    const data = await res.json();
    const chainMap = Object.fromEntries(CHAINS.map(c => [c.id, c.name]));
    const balanceLines = data.balances.map(b =>
      `<span>${chainMap[b.chainId] || `Chain ${b.chainId}`}: <strong>${b.balance}</strong></span>`
    ).join('<br>');
    el.innerHTML = `Agent: <code>${data.agentAddress}</code><br>${balanceLines}`;
    el.className = 'status info';
  } catch {
    el.textContent = 'Could not fetch balance.';
    el.className = 'status error';
  }
}

async function fundAgent(sessionId) {
  const status = document.getElementById('fund-status');
  const amountEth = parseFloat(document.getElementById('fund-amount').value);
  if (!amountEth || amountEth <= 0) {
    status.className = 'status error'; status.textContent = 'Enter a valid ETH amount.'; return;
  }

  const chainId = Number(document.getElementById('fund-chain').value);

  const res = await apiFetch(`${API}/api/session/${sessionId}/fund`);
  const data = await res.json();
  const agentAddress = data.agentAddress;

  if (!window.ethereum) {
    status.className = 'status error'; status.textContent = 'No browser wallet detected.'; return;
  }

  try {
    status.className = 'status info'; status.textContent = 'Requesting wallet…';

    await window.ethereum.request({ method: 'eth_requestAccounts' });

    // Ask wallet to switch chain
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + chainId.toString(16) }],
    }).catch(() => {}); // ignore if already on correct chain

    const weiHex = '0x' + BigInt(Math.round(amountEth * 1e18)).toString(16);
    const [from] = await window.ethereum.request({ method: 'eth_accounts' });

    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: agentAddress, value: weiHex }],
    });

    status.className = 'status ok';
    status.textContent = `Sent! Tx: ${txHash}`;
    setTimeout(() => loadFundInfo(sessionId), 3000);
  } catch (err) {
    status.className = 'status error'; status.textContent = err.message || 'Transaction failed.';
  }
}

// ── Add Org ────────────────────────────────────────────────────────────────
async function addOrg(sessionId) {
  const status = document.getElementById('add-org-status');
  const org = {
    powersAddress: document.getElementById('m-org-addr').value.trim(),
    chainId: Number(document.getElementById('m-org-chain').value),
    label: document.getElementById('m-org-label').value.trim() || undefined,
    xmtpAgentAddress: document.getElementById('m-org-xmtp').value.trim() || undefined,
  };

  if (!org.powersAddress) { status.className = 'status error'; status.textContent = 'Address required.'; return; }

  status.className = 'status info'; status.textContent = 'Validating…';
  try {
    const res = await apiFetch(`${API}/api/session/${sessionId}/organisations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(org),
    });
    const data = await res.json();
    if (!res.ok) { status.className = 'status error'; status.textContent = data.error; return; }
    status.className = 'status ok'; status.textContent = `Added. ${data.organisations.length} org(s) total.`;
  } catch (err) {
    status.className = 'status error'; status.textContent = err.message;
  }
}

// ── Skills List ────────────────────────────────────────────────────────────
async function loadSkills(sessionId) {
  const el = document.getElementById('skill-list');
  if (!el) return;
  try {
    const res = await apiFetch(`${API}/api/session/${sessionId}/skills`);
    const skills = await res.json();
    if (!Array.isArray(skills) || skills.length === 0) {
      el.innerHTML = '<div style="color:var(--muted);font-size:13px">No skills added yet.</div>';
      return;
    }
    el.innerHTML = skills.map(sk => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;font-family:monospace">${esc(sk.name)}</div>
          <div style="font-size:11px;color:var(--muted-foreground)">${esc(sk.handler)} — ${esc(sk.description)}</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="removeSkill('${sessionId}','${esc(sk.name)}')">Remove</button>
      </div>`).join('');
  } catch {
    el.innerHTML = '<div class="status error">Could not load skills.</div>';
  }
}

async function removeSkill(sessionId, skillName) {
  try {
    const res = await apiFetch(`${API}/api/session/${sessionId}/skills/${encodeURIComponent(skillName)}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to remove skill.');
      return;
    }
    await loadSkills(sessionId);
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

// ── Add Skill ──────────────────────────────────────────────────────────────
async function addSkill(sessionId) {
  const status = document.getElementById('add-skill-status');
  const name = document.getElementById('m-skill-name').value.trim();
  const description = document.getElementById('m-skill-desc').value.trim();
  const handler = document.getElementById('m-skill-handler').value;
  const domainsRaw = document.getElementById('m-skill-domains').value.trim();
  const configRaw = document.getElementById('m-skill-config').value.trim();

  if (!name || !description) { status.className = 'status error'; status.textContent = 'Name and description required.'; return; }

  let handlerConfig = {};
  try { handlerConfig = configRaw ? JSON.parse(configRaw) : {}; }
  catch { status.className = 'status error'; status.textContent = 'Handler Config is not valid JSON.'; return; }

  const allowedDomains = domainsRaw.split(',').map(d => d.trim()).filter(Boolean);
  handlerConfig.allowedDomains = allowedDomains;

  const body = { name, description, handler, handlerConfig, inputSchema: { type: 'object', properties: {}, required: [] } };

  status.className = 'status info'; status.textContent = 'Adding…';
  try {
    const res = await apiFetch(`${API}/api/session/${sessionId}/skills`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { status.className = 'status error'; status.textContent = data.error; return; }
    status.className = 'status ok'; status.textContent = `Added. ${data.skillsCount} skill(s) total.`;
    await loadSkills(sessionId);
  } catch (err) {
    status.className = 'status error'; status.textContent = err.message;
  }
}

// ── Update Persona ─────────────────────────────────────────────────────────
async function updatePersona(sessionId) {
  const status = document.getElementById('persona-status');
  const patch = {
    name: document.getElementById('m-persona-name').value.trim() || undefined,
    roleDescription: document.getElementById('m-persona-roleDesc').value.trim() || undefined,
    strategy: document.getElementById('m-persona-strategy').value.trim() || undefined,
    constraints: document.getElementById('m-persona-constraints').value.trim() || undefined,
  };

  status.className = 'status info'; status.textContent = 'Saving…';
  try {
    const res = await apiFetch(`${API}/api/session/${sessionId}/persona`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) { status.className = 'status error'; status.textContent = data.error; return; }
    status.className = 'status ok'; status.textContent = 'Persona updated.';
  } catch (err) {
    status.className = 'status error'; status.textContent = err.message;
  }
}

// ── End Session ────────────────────────────────────────────────────────────
async function endSession(sessionId) {
  const status = document.getElementById('end-status');
  if (!confirm('End this agent session? The wallet key will be zeroed immediately.')) return;

  status.className = 'status info'; status.textContent = 'Ending session…';
  try {
    await apiFetch(`${API}/api/session/${sessionId}`, { method: 'DELETE' });
    removeStoredId(sessionId);
    showScreen('list');
  } catch (err) {
    status.className = 'status error'; status.textContent = err.message;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function shortAddr(addr) {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

// Load fund info when manage screen opens
const _origOpenManage = openManage;
// eslint-disable-next-line no-global-assign
window.openManage = async function(sessionId) {
  await _origOpenManage(sessionId);
  setTimeout(() => { loadFundInfo(sessionId); loadSkills(sessionId); }, 200);
};
