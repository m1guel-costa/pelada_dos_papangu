/* =============================================
   PELADA DOS PAPANGU — APP LOGIC
   ============================================= */

// ── STORAGE HELPERS ─────────────────────────
const KEY_USERS   = 'papangu_users';
const KEY_PLAYERS = 'papangu_players';
const KEY_SESSION = 'papangu_session';
const KEY_PENDING = 'papangu_pending';

function loadData(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function saveData(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ── DEFAULTS ────────────────────────────────
function initDefaults() {
  let users = loadData(KEY_USERS);

  // Garante que Sidney sempre existe como admin principal
  const sidneyExiste = users.find(u => u.username === 'Sidney');
  if (!sidneyExiste) {
    users = users.filter(u => u.username !== 'Sidney'); // remove duplicata por segurança
    users.unshift({ id: 'sid-admin-001', username: 'Sidney', password: 'caua1015', role: 'admin', nome: 'Sidney' });
    saveData(KEY_USERS, users);
  }

  // Cria usuário padrão admin de backup apenas se não houver nenhum usuário ainda
  if (users.length <= 1) {
    users.push({ id: uid(), username: 'admin', password: 'admin123', role: 'admin' });
    saveData(KEY_USERS, users);
  }

  // Migração única: substitui os jogadores fictícios pelos mensalistas de novembro/2026.
  // Não sobrescreve alterações feitas pelos administradores após a migração.
  const playersVersion = 'papangu_players_nov2026_v1';
  if (localStorage.getItem(playersVersion) !== 'ok') {
    const nomesMensalistas = [
      'Miguel',
      'Moa',
      'Eva',
      'Viana',
      'Igor',
      'Cauã',
      'Leo22',
      'Lucas',
      'Math',
      'Guete',
      'Bruno',
      'Lucas G',
      'Luna',
      'Rapha',
      'João Henrique',
      'Meiota',
      'Bebeto',
      'Bosco',
      'Filipe',
      'Cadoca'
    ];
    const jogadoresReais = nomesMensalistas.map((nome, i) => ({
      id: 'mensalista-nov26-' + (i + 1),
      nome,
      apelido: '',
      posicao: 'Não definida',
      estrelas: 3, // avaliação provisória até o administrador definir
      foto: ''
    }));
    saveData(KEY_PLAYERS, jogadoresReais);
    localStorage.setItem(playersVersion, 'ok');
  }

}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── STATE ────────────────────────────────────
let currentUser = null;
let editingStars = 3;

// ── INIT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDefaults();
  const sess = localStorage.getItem(KEY_SESSION);
  if (sess) {
    const users = loadData(KEY_USERS);
    const u = users.find(x => x.id === sess);
    if (u) { currentUser = u; enterApp(); return; }
  }
  showScreen('screen-login');
});

// ── LOGIN / LOGOUT ───────────────────────────
function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('auth-login').style.display    = isLogin ? '' : 'none';
  document.getElementById('auth-register').style.display = isLogin ? 'none' : '';
  document.getElementById('tab-login-btn').classList.toggle('active', isLogin);
  document.getElementById('tab-register-btn').classList.toggle('active', !isLogin);
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('reg-error').style.display   = 'none';
  document.getElementById('reg-success').style.display = 'none';
}

function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!username || !password) {
    showError(errEl, 'Preencha usuário e senha.');
    return;
  }
  const users = loadData(KEY_USERS);
  const user  = users.find(u => u.username === username && u.password === password);
  if (!user) { showError(errEl, 'Usuário ou senha incorretos.'); return; }

  currentUser = user;
  localStorage.setItem(KEY_SESSION, user.id);
  enterApp();
}

function doRegister() {
  const nome     = document.getElementById('reg-nome').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const apelido  = document.getElementById('reg-apelido').value.trim();
  const posicao  = document.getElementById('reg-posicao').value;
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const errEl    = document.getElementById('reg-error');
  const okEl     = document.getElementById('reg-success');
  errEl.style.display = 'none';
  okEl.style.display  = 'none';

  if (!nome)     { showError(errEl, 'Informe seu nome.'); return; }
  if (!username) { showError(errEl, 'Escolha um nome de usuário.'); return; }
  if (username.length < 3) { showError(errEl, 'O usuário precisa ter pelo menos 3 caracteres.'); return; }
  if (!password) { showError(errEl, 'Crie uma senha.'); return; }
  if (password.length < 4) { showError(errEl, 'A senha precisa ter pelo menos 4 caracteres.'); return; }
  if (password !== confirm)  { showError(errEl, 'As senhas não coincidem.'); return; }

  const users   = loadData(KEY_USERS);
  const pending = loadData(KEY_PENDING);

  const taken = [...users, ...pending].find(u => u.username.toLowerCase() === username.toLowerCase());
  if (taken) { showError(errEl, 'Este nome de usuário já está em uso.'); return; }

  const newUser = { id: uid(), username, password, role: 'user', nome, apelido, posicao, pendente: true };
  pending.push(newUser);
  saveData(KEY_PENDING, pending);

  // Clear fields
  ['reg-nome','reg-username','reg-apelido','reg-password','reg-confirm'].forEach(id => {
    document.getElementById(id).value = '';
  });

  okEl.textContent = `✅ Cadastro enviado! Aguarde a aprovação do administrador para acessar.`;
  okEl.style.display = 'block';
}

function doLogout() {
  currentUser = null;
  localStorage.removeItem(KEY_SESSION);
  showScreen('screen-login');
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
}

function enterApp() {
  showScreen('screen-app');
  document.getElementById('sidebar-username').textContent = '👤 ' + currentUser.username;
  const adminMenu = document.getElementById('nav-admin-menu');
  adminMenu.style.display = currentUser.role === 'admin' ? '' : 'none';
  if (currentUser.role === 'admin') updatePendingBadge();
  goTo('ranking');
}

// ── NAVIGATION ───────────────────────────────
function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  const nav = document.getElementById('nav-' + page);
  if (nav) nav.classList.add('active');

  if (page === 'ranking') renderRanking();
  if (page === 'sorteio') renderSorteioPlayers();
  if (page === 'admin')   { renderAdminPlayers(); renderAdminUsers(); renderPendingUsers(); updatePendingBadge(); }
}

// ── SCREENS ──────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

// ── STARS ────────────────────────────────────
function setStars(val) {
  editingStars = val;
  document.getElementById('p-estrelas').value = val;
  document.querySelectorAll('#star-input .star').forEach((s, i) => {
    s.classList.toggle('active', i < val);
  });
}

function starsHTML(n, big = false) {
  const size = big ? '1.1rem' : '.85rem';
  let h = '';
  for (let i = 1; i <= 5; i++) {
    h += `<span style="color:${i<=n?'#facc15':'#334155'};font-size:${size}">★</span>`;
  }
  return h;
}

// ── RANKING ──────────────────────────────────
function renderRanking() {
  const q   = (document.getElementById('search-player').value || '').toLowerCase();
  const pos = document.getElementById('filter-pos').value;
  let players = loadData(KEY_PLAYERS)
    .filter(p => (!q || p.nome.toLowerCase().includes(q) || (p.apelido||'').toLowerCase().includes(q)))
    .filter(p => (!pos || p.posicao === pos))
    .sort((a, b) => b.estrelas - a.estrelas);

  const container = document.getElementById('ranking-list');
  if (!players.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">Nenhum jogador encontrado.</p>';
    return;
  }

  container.innerHTML = players.map((p, i) => {
    const posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const initials = (p.apelido || p.nome).slice(0, 2).toUpperCase();
    const avatar = p.foto
      ? `<img src="${p.foto}" alt="${p.nome}" onerror="this.style.display='none';this.parentNode.textContent='${initials}'" />`
      : initials;
    return `
      <div class="rank-card">
        <div class="rank-pos ${posClass}">${i < 3 ? ['🥇','🥈','🥉'][i] : '#'+(i+1)}</div>
        <div class="rank-avatar">${avatar}</div>
        <div class="rank-info">
          <div class="rank-name">${p.nome}</div>
          ${p.apelido ? `<div class="rank-apelido">"${p.apelido}"</div>` : ''}
          <span class="rank-pos-label pos-${p.posicao}">${p.posicao}</span>
          <div class="rank-stars" style="margin-top:.3rem">${starsHTML(p.estrelas, true)}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ── SORTEIO ──────────────────────────────────
function renderSorteioPlayers() {
  const players  = loadData(KEY_PLAYERS).sort((a,b) => a.nome.localeCompare(b.nome));
  const container = document.getElementById('sorteio-player-list');
  container.innerHTML = players.map(p => `
    <div class="sorteio-player-item" id="sp-${p.id}" onclick="togglePlayerSelect('${p.id}')">
      <input type="checkbox" id="chk-${p.id}" />
      <span class="sorteio-player-name">${p.apelido || p.nome}</span>
      <span class="sorteio-player-stars">${starsHTML(p.estrelas)}</span>
    </div>
  `).join('');
}

function togglePlayerSelect(id) {
  const item = document.getElementById('sp-' + id);
  const chk  = document.getElementById('chk-' + id);
  chk.checked = !chk.checked;
  item.classList.toggle('selected', chk.checked);
}

function selectAll(val) {
  document.querySelectorAll('.sorteio-player-item').forEach(item => {
    const id = item.id.replace('sp-', '');
    const chk = document.getElementById('chk-' + id);
    chk.checked = val;
    item.classList.toggle('selected', val);
  });
}

function getSelectedPlayers() {
  const players = loadData(KEY_PLAYERS);
  const selected = [];
  players.forEach(p => {
    const chk = document.getElementById('chk-' + p.id);
    if (chk && chk.checked) selected.push(p);
  });
  return selected;
}

function realizarSorteio() {
  const nTimes   = parseInt(document.getElementById('num-times').value) || 2;
  const nPerTime = parseInt(document.getElementById('jogadores-por-time').value) || 5;
  const modo     = document.getElementById('modo-sorteio').value;
  const warnEl   = document.getElementById('sorteio-warn');
  warnEl.style.display = 'none';

  const selected = getSelectedPlayers();
  const total    = nTimes * nPerTime;

  if (selected.length < total) {
    warnEl.textContent = `Você precisa de pelo menos ${total} jogadores selecionados para ${nTimes} times de ${nPerTime}.`;
    warnEl.style.display = 'block';
    document.getElementById('resultado-sorteio').style.display = 'none';
    return;
  }

  // Shuffle
  let pool = [...selected].sort(() => Math.random() - .5);

  let times = Array.from({ length: nTimes }, () => []);

  if (modo === 'equilibrado') {
    // Sort descending by stars, distribute like a draft (snake draft)
    pool.sort((a, b) => b.estrelas - a.estrelas);
    pool = pool.slice(0, total);
    // Snake draft: 0,1,2,1,0 for 3 teams
    let dir = 1, ti = 0;
    for (let i = 0; i < pool.length; i++) {
      times[ti].push(pool[i]);
      if (ti === nTimes - 1) dir = -1;
      else if (ti === 0 && i > 0) dir = 1;
      ti += dir;
      if (ti < 0) ti = 0;
      if (ti >= nTimes) ti = nTimes - 1;
    }
  } else {
    pool = pool.slice(0, total);
    for (let i = 0; i < pool.length; i++) {
      times[i % nTimes].push(pool[i]);
    }
  }

  renderResultado(times);
}

const TIME_COLORS = [
  { bg: '#1a3a2a', border: '#16a34a', emoji: '🟢' },
  { bg: '#1e3a5f', border: '#3b82f6', emoji: '🔵' },
  { bg: '#3b0a0a', border: '#ef4444', emoji: '🔴' },
  { bg: '#3b2f00', border: '#facc15', emoji: '🟡' },
  { bg: '#2d1a4f', border: '#a855f7', emoji: '🟣' },
  { bg: '#1a2a2a', border: '#06b6d4', emoji: '🩵' },
];

function renderResultado(times) {
  const container = document.getElementById('times-resultado');
  container.innerHTML = times.map((jogadores, ti) => {
    const c   = TIME_COLORS[ti % TIME_COLORS.length];
    const avg = (jogadores.reduce((s, p) => s + p.estrelas, 0) / jogadores.length).toFixed(1);
    return `
      <div class="time-card" style="background:${c.bg};border-color:${c.border}">
        <h4>${c.emoji} Time ${ti + 1} <span class="time-avg">⭐ média ${avg}</span></h4>
        ${jogadores.map(p => `
          <div class="time-player-row">
            <span>${p.apelido || p.nome}</span>
            <span style="margin-left:auto;font-size:.78rem;color:var(--text-muted)">${p.posicao}</span>
            <span style="font-size:.8rem;color:#facc15">${starsHTML(p.estrelas)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
  document.getElementById('resultado-sorteio').style.display = 'block';
  document.getElementById('resultado-sorteio').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── ADMIN TABS ───────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    const tabs = ['tab-players', 'tab-users', 'tab-pending'];
    b.classList.toggle('active', tabs[i] === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(t => {
    t.classList.toggle('active', t.id === tabId);
  });
  if (tabId === 'tab-pending') renderPendingUsers();
}

// ── PLAYERS ADMIN ────────────────────────────
function renderAdminPlayers() {
  const q = (document.getElementById('search-admin-player')?.value || '').toLowerCase();
  let players = loadData(KEY_PLAYERS)
    .filter(p => !q || p.nome.toLowerCase().includes(q) || (p.apelido||'').toLowerCase().includes(q))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const container = document.getElementById('admin-player-list');
  if (!players.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:1rem">Nenhum jogador cadastrado.</p>';
    return;
  }

  container.innerHTML = players.map(p => `
    <div class="admin-item">
      <div class="admin-item-info">
        <div class="admin-item-name">${p.nome}${p.apelido ? ` <span style="color:var(--text-muted)">"${p.apelido}"</span>` : ''}</div>
        <div class="admin-item-sub">${p.posicao} · ${starsHTML(p.estrelas)}</div>
      </div>
      <div class="admin-item-actions">
        <button class="btn btn-outline btn-sm" onclick="editPlayer('${p.id}')">✏️ Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deletePlayer('${p.id}')">🗑️ Excluir</button>
      </div>
    </div>
  `).join('');
}

function savePlayer() {
  const nome     = document.getElementById('p-nome').value.trim();
  const apelido  = document.getElementById('p-apelido').value.trim();
  const posicao  = document.getElementById('p-posicao').value;
  const estrelas = parseInt(document.getElementById('p-estrelas').value) || 3;
  const foto     = document.getElementById('p-foto').value.trim();
  const editId   = document.getElementById('edit-player-id').value;

  if (!nome) { alert('Informe o nome do jogador.'); return; }

  let players = loadData(KEY_PLAYERS);
  if (editId) {
    const idx = players.findIndex(p => p.id === editId);
    if (idx >= 0) players[idx] = { ...players[idx], nome, apelido, posicao, estrelas, foto };
  } else {
    players.push({ id: uid(), nome, apelido, posicao, estrelas, foto });
  }
  saveData(KEY_PLAYERS, players);
  cancelEditPlayer();
  renderAdminPlayers();
}

function editPlayer(id) {
  const p = loadData(KEY_PLAYERS).find(x => x.id === id);
  if (!p) return;
  document.getElementById('p-nome').value     = p.nome;
  document.getElementById('p-apelido').value  = p.apelido || '';
  document.getElementById('p-posicao').value  = p.posicao;
  document.getElementById('p-foto').value     = p.foto || '';
  document.getElementById('edit-player-id').value = p.id;
  document.getElementById('form-player-title').textContent = '✏️ Editando: ' + p.nome;
  document.getElementById('btn-cancel-player').style.display = '';
  setStars(p.estrelas);
  document.getElementById('tab-players').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEditPlayer() {
  document.getElementById('p-nome').value = '';
  document.getElementById('p-apelido').value = '';
  document.getElementById('p-posicao').value = 'Atacante';
  document.getElementById('p-foto').value = '';
  document.getElementById('edit-player-id').value = '';
  document.getElementById('form-player-title').textContent = '➕ Adicionar Jogador';
  document.getElementById('btn-cancel-player').style.display = 'none';
  setStars(3);
}

function deletePlayer(id) {
  if (!confirm('Excluir este jogador?')) return;
  let players = loadData(KEY_PLAYERS).filter(p => p.id !== id);
  saveData(KEY_PLAYERS, players);
  renderAdminPlayers();
}

// ── PENDING USERS ────────────────────────────
function updatePendingBadge() {
  const pending = loadData(KEY_PENDING);
  const badge   = document.getElementById('pending-badge');
  if (!badge) return;
  if (pending.length > 0) {
    badge.textContent = pending.length;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function renderPendingUsers() {
  const pending   = loadData(KEY_PENDING);
  const container = document.getElementById('admin-pending-list');
  if (!pending.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:1.5rem">✅ Nenhum cadastro pendente.</p>';
    return;
  }
  container.innerHTML = pending.map(u => `
    <div class="admin-item" style="flex-wrap:wrap;gap:.75rem">
      <div class="admin-item-info">
        <div class="admin-item-name">👤 ${u.username} <span style="color:var(--text-muted);font-weight:400">(${u.nome || ''})</span></div>
        <div class="admin-item-sub">
          Posição: ${u.posicao || '—'}
          ${u.apelido ? ` · Apelido: "${u.apelido}"` : ''}
          <span class="badge badge-pending" style="margin-left:.5rem">⏳ Aguardando</span>
        </div>
      </div>
      <div class="admin-item-actions" style="align-items:center;flex-wrap:wrap;gap:.5rem">
        <select id="role-pending-${u.id}" class="role-select-inline">
          <option value="user">👥 Usuário</option>
          <option value="admin">🛡️ Admin</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="approvePending('${u.id}')">✅ Aprovar</button>
        <button class="btn btn-danger btn-sm" onclick="rejectPending('${u.id}')">❌ Rejeitar</button>
      </div>
    </div>
  `).join('');
}

function approvePending(id) {
  let pending = loadData(KEY_PENDING);
  const user  = pending.find(u => u.id === id);
  if (!user) return;

  // Pega o papel escolhido no select
  const roleSelect = document.getElementById('role-pending-' + id);
  const chosenRole = roleSelect ? roleSelect.value : 'user';

  // Move to users (remove pending flag, aplica role escolhido)
  const { pendente, ...approvedUser } = user;
  approvedUser.role = chosenRole;

  let users = loadData(KEY_USERS);
  users.push(approvedUser);
  saveData(KEY_USERS, users);

  pending = pending.filter(u => u.id !== id);
  saveData(KEY_PENDING, pending);

  renderPendingUsers();
  renderAdminUsers();
  updatePendingBadge();
}

function rejectPending(id) {
  if (!confirm('Rejeitar este cadastro? A ação não pode ser desfeita.')) return;
  let pending = loadData(KEY_PENDING).filter(u => u.id !== id);
  saveData(KEY_PENDING, pending);
  renderPendingUsers();
  updatePendingBadge();
}

// ── USERS ADMIN ──────────────────────────────
function renderAdminUsers() {
  const users = loadData(KEY_USERS);
  const container = document.getElementById('admin-user-list');
  if (!users.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:1rem">Nenhum usuário cadastrado.</p>';
    return;
  }
  container.innerHTML = users.map(u => `
    <div class="admin-item">
      <div class="admin-item-info">
        <div class="admin-item-name">👤 ${u.username} ${u.nome ? `<span style="color:var(--text-muted);font-weight:400">(${u.nome})</span>` : ''}</div>
        <div class="admin-item-sub"><span class="badge badge-${u.role}">${u.role === 'admin' ? '🛡️ Administrador' : '👥 Usuário'}</span></div>
      </div>
      <div class="admin-item-actions">
        ${u.id !== currentUser.id ? `
          <button class="btn btn-sm ${u.role === 'admin' ? 'btn-outline' : 'btn-admin'}" onclick="toggleAdminRole('${u.id}')">
            ${u.role === 'admin' ? '👥 Tornar Usuário' : '🛡️ Tornar Admin'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')">🗑️ Excluir</button>
        ` : `<span style="font-size:.8rem;color:var(--text-muted)">(você)</span>`}
      </div>
    </div>
  `).join('');
}

function toggleAdminRole(id) {
  let users = loadData(KEY_USERS);
  const idx = users.findIndex(u => u.id === id);
  if (idx < 0) return;
  const novoRole = users[idx].role === 'admin' ? 'user' : 'admin';
  const acao = novoRole === 'admin' ? 'tornar ADMINISTRADOR' : 'tornar Usuário comum';
  if (!confirm(`Deseja ${acao} o usuário "${users[idx].username}"?`)) return;
  users[idx].role = novoRole;
  saveData(KEY_USERS, users);
  renderAdminUsers();
}

function saveUser() {
  const username = document.getElementById('u-username').value.trim();
  const password = document.getElementById('u-password').value;
  const role     = document.getElementById('u-role').value;
  const errEl    = document.getElementById('user-form-error');
  errEl.style.display = 'none';

  if (!username) { showError(errEl, 'Informe o nome de usuário.'); return; }
  if (!password) { showError(errEl, 'Informe a senha.'); return; }

  let users = loadData(KEY_USERS);
  if (users.find(u => u.username === username)) {
    showError(errEl, 'Já existe um usuário com esse nome.');
    return;
  }
  users.push({ id: uid(), username, password, role });
  saveData(KEY_USERS, users);
  document.getElementById('u-username').value = '';
  document.getElementById('u-password').value = '';
  renderAdminUsers();
}

function deleteUser(id) {
  if (!confirm('Excluir este usuário?')) return;
  let users = loadData(KEY_USERS).filter(u => u.id !== id);
  saveData(KEY_USERS, users);
  renderAdminUsers();
}

// ── ENTER KEY LOGIN ──────────────────────────
document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});
document.getElementById('login-username').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-password').focus();
});

// Init stars display
setStars(3);
