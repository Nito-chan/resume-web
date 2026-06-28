const API = '/api';
let token = localStorage.getItem('token');
let currentView = 'dashboard';
let currentNiche = localStorage.getItem('currentNiche') || 'cleaning';

function $(sel, ctx) { return (ctx || document).querySelector(sel); }
function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { headers, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (res.status === 401) { token = null; localStorage.removeItem('token'); render(); }
  if (res.status === 204) return null;
  return res.json();
}

/* ================ APP ================ */

function render() {
  if (!token) return renderLogin();
  const app = $('#app');
  app.innerHTML = `
    <nav class="sidebar">
      <div class="sidebar-brand">📋 <span>Outreach</span></div>
      <div style="padding:8px 16px;border-bottom:1px solid var(--border);margin-bottom:8px">
        <select id="niche-selector" style="font-size:13px;padding:6px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);width:100%;cursor:pointer">
          <option value="cleaning" ${currentNiche==='cleaning'?'selected':''}>🧹 Cleaning</option>
          <option value="dental" ${currentNiche==='dental'?'selected':''}>🦷 Dental</option>
        </select>
      </div>
      <ul class="sidebar-nav">
        <li class="active" data-view="dashboard"><span class="icon">📊</span> Dashboard</li>
        <li data-view="leads"><span class="icon">👥</span> Leads</li>
        <li data-view="scraper"><span class="icon">🔍</span> Scraper</li>
        <li data-view="campaigns"><span class="icon">📨</span> Campaigns</li>
        <li data-view="instagram"><span class="icon">📸</span> Instagram</li>
        <li data-view="templates"><span class="icon">✏️</span> Templates</li>
        <li data-view="settings"><span class="icon">⚙️</span> Settings</li>
      </ul>
      <ul class="sidebar-nav" style="margin-top:auto;border-top:1px solid var(--border);padding-top:8px;">
        <li id="logout-btn"><span class="icon">🚪</span> Logout</li>
      </ul>
    </nav>
    <main class="main" id="main-content"></main>
  `;

  $$('.sidebar-nav li[data-view]').forEach(el => {
    el.addEventListener('click', () => {
      $$('.sidebar-nav li').forEach(l => l.classList.remove('active'));
      el.classList.add('active');
      currentView = el.dataset.view;
      renderView(currentView);
    });
  });

  $('#logout-btn').addEventListener('click', () => {
    token = null;
    localStorage.removeItem('token');
    render();
  });

  $('#niche-selector').addEventListener('change', (e) => {
    currentNiche = e.target.value;
    localStorage.setItem('currentNiche', currentNiche);
    renderView(currentView);
  });

  renderView('dashboard');
}

/* ================ LOGIN ================ */

function renderLogin() {
  $('#app').innerHTML = `
    <div class="login-page">
      <div class="login-box">
        <h1>Client Outreach</h1>
        <p>Enter admin password to continue</p>
        <form id="login-form">
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="login-pass" autofocus required>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%">Sign In</button>
        </form>
      </div>
    </div>
  `;

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = $('#login-pass').value;
    try {
      const res = await fetch(API + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass })
      });
      if (!res.ok) { toast('Invalid password', 'error'); return; }
      const data = await res.json();
      token = data.token;
      localStorage.setItem('token', token);
      render();
    } catch { toast('Connection failed', 'error'); }
  });
}

/* ================ VIEWS ================ */

function renderView(view) {
  const main = $('#main-content');
  if (!main) return;
  if (view === 'dashboard') renderDashboard(main);
  else if (view === 'leads') renderLeads(main);
  else if (view === 'scraper') renderScraper(main);
  else if (view === 'campaigns') renderCampaigns(main);
  else if (view === 'instagram') renderInstagram(main);
  else if (view === 'templates') renderTemplates(main);
  else if (view === 'settings') renderSettings(main);
}

/* ================ DASHBOARD ================ */

async function renderDashboard(main) {
  main.innerHTML = `<div class="page-header"><div><h1>Dashboard</h1><div class="subtitle">${currentNiche === 'dental' ? '🦷 Dental' : '🧹 Cleaning'} niche</div></div></div><div class="stats-grid" id="stats-grid"></div><div style="margin-top:20px"><h3 style="margin-bottom:12px">Recent Replies</h3><div id="recent-replies"></div></div>`;

  const stats = await api('/leads/stats?niche=' + currentNiche);
  const grid = $('#stats-grid');
  grid.innerHTML = `
    <div class="stat-card blue"><div class="stat-label">Total Leads</div><div class="stat-value">${stats.total}</div></div>
    <div class="stat-card blue"><div class="stat-label">New</div><div class="stat-value">${stats.new}</div></div>
    <div class="stat-card yellow"><div class="stat-label">Sent</div><div class="stat-value">${stats.sent}</div></div>
    <div class="stat-card green"><div class="stat-label">Replied</div><div class="stat-value">${stats.replied}</div></div>
    <div class="stat-card red"><div class="stat-label">No Website</div><div class="stat-value">${stats.noWebsite}</div></div>
    <div class="stat-card red"><div class="stat-label">Bounced</div><div class="stat-value">${stats.bounced}</div></div>
  `;

  const { leads } = await api('/leads?limit=10&status=replied&niche=' + currentNiche);
  const repliesDiv = $('#recent-replies');
  if (leads.length === 0) {
    repliesDiv.innerHTML = '<div class="empty-state"><h3>No replies yet</h3><p>Start a campaign to see replies here</p></div>';
  } else {
    repliesDiv.innerHTML = `<div class="table-container"><table>
      <tr><th>Company</th><th>City</th><th>Email</th><th>Status</th></tr>
      ${leads.map(l => `<tr><td>${esc(l.company)}</td><td>${esc(l.city)}</td><td>${esc(l.email)}</td><td><span class="badge badge-replied">Replied</span></td></tr>`).join('')}
    </table></div>`;
  }
}

/* ================ LEADS ================ */

let leadFilters = { status: '', city: '', quality: '', niche: '', search: '', page: 0 };

async function renderLeads(main) {
  main.innerHTML = `
    <div class="page-header">
      <div><h1>Leads</h1><div class="subtitle">Manage your leads</div></div>
      <div>
        <button class="btn btn-outline" onclick="deleteSelectedLeads()">🗑️ Delete Selected</button>
        <button class="btn btn-primary" onclick="showAddLeadModal()">+ Add Lead</button>
      </div>
    </div>
    <div class="search-bar">
      <input type="text" id="lead-search" placeholder="Search..." value="${esc(leadFilters.search)}" oninput="debounceSearch()">
      <select id="lead-status-filter" onchange="applyLeadFilters()">
        <option value="">All Status</option>
        <option value="new" ${leadFilters.status==='new'?'selected':''}>New</option>
        <option value="sent" ${leadFilters.status==='sent'?'selected':''}>Sent</option>
        <option value="replied" ${leadFilters.status==='replied'?'selected':''}>Replied</option>
        <option value="closed" ${leadFilters.status==='closed'?'selected':''}>Closed</option>
        <option value="bounced" ${leadFilters.status==='bounced'?'selected':''}>Bounced</option>
      </select>
      <select id="lead-quality-filter" onchange="applyLeadFilters()">
        <option value="">All Quality</option>
        <option value="none" ${leadFilters.quality==='none'?'selected':''}>No Website</option>
        <option value="poor" ${leadFilters.quality==='poor'?'selected':''}>Poor</option>
        <option value="fair" ${leadFilters.quality==='fair'?'selected':''}>Fair</option>
      </select>
      <select id="lead-niche-filter" onchange="applyLeadFilters()">
        <option value="">All Niches</option>
        <option value="cleaning" ${leadFilters.niche==='cleaning'?'selected':''}>🧹 Cleaning</option>
        <option value="dental" ${leadFilters.niche==='dental'?'selected':''}>🦷 Dental</option>
      </select>
      <select id="lead-city-filter" onchange="applyLeadFilters()">
        <option value="">All Cities</option>
      </select>
    </div>
    <div id="leads-table"></div>
    <div id="lead-pagination" style="display:flex;gap:8px;justify-content:center;margin-top:16px"></div>
  `;

  const cities = await api('/leads/cities');
  const citySelect = $('#lead-city-filter');
  cities.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    if (c === leadFilters.city) opt.selected = true;
    citySelect.appendChild(opt);
  });

  await loadLeadsTable();
  $('#lead-search').addEventListener('keydown', e => { if (e.key === 'Enter') applyLeadFilters(); });
}

let debounceTimer;
function debounceSearch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyLeadFilters, 300);
}

function applyLeadFilters() {
  leadFilters.status = $('#lead-status-filter').value;
  leadFilters.quality = $('#lead-quality-filter').value;
  leadFilters.niche = $('#lead-niche-filter').value;
  leadFilters.city = $('#lead-city-filter').value;
  leadFilters.search = $('#lead-search').value;
  leadFilters.page = 0;
  loadLeadsTable();
}

function loadLeadsTable() {
  const params = new URLSearchParams({ limit: '50', offset: leadFilters.page * 50 });
  if (leadFilters.status) params.set('status', leadFilters.status);
  if (leadFilters.quality) params.set('quality', leadFilters.quality);
  if (leadFilters.niche) params.set('niche', leadFilters.niche);
  if (leadFilters.city) params.set('city', leadFilters.city);
  if (leadFilters.search) params.set('search', leadFilters.search);

  api('/leads?' + params.toString()).then(({ leads, total }) => {
    const container = $('#leads-table');
    if (!container) return;

    if (leads.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No leads found</h3></div>';
      $('#lead-pagination').innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(total / 50);
    container.innerHTML = `<div class="table-container"><table>
      <tr>
        <th style="width:30px"><input type="checkbox" id="select-all" onchange="toggleAllLeads(this)"></th>
        <th>Company</th><th>Email</th><th>City</th><th>Niche</th><th>Quality</th><th>Status</th><th>Actions</th>
      </tr>
      ${leads.map(l => `<tr>
        <td><input type="checkbox" class="lead-checkbox" value="${l.id}"></td>
        <td><strong>${esc(l.company)}</strong>${l.name ? '<br><span style="color:var(--text2);font-size:11px">' + esc(l.name) + '</span>' : ''}</td>
        <td>${esc(l.email)}${l.instagram ? '<br><span style="color:var(--text2);font-size:11px">@' + esc(l.instagram) + '</span>' : ''}</td>
        <td>${esc(l.city)}${l.state ? ', ' + esc(l.state) : ''}</td>
        <td><span class="badge badge-${esc(l.niche || 'cleaning')}">${esc(l.niche || 'cleaning')}</span></td>
        <td>${l.website_quality ? `<span class="badge badge-${l.website_quality}">${l.website_quality}</span>` : '<span style="color:var(--text2);font-size:11px">—</span>'}</td>
        <td><span class="badge badge-${l.status}">${l.status}</span></td>
        <td><button class="btn btn-sm btn-outline" onclick="viewLead(${l.id})">View</button></td>
      </tr>`).join('')}
    </table></div>`;

    const pagination = $('#lead-pagination');
    pagination.innerHTML = '';
    for (let i = 0; i < totalPages; i++) {
      const btn = document.createElement('button');
      btn.className = `btn btn-sm ${i === leadFilters.page ? 'btn-primary' : 'btn-outline'}`;
      btn.textContent = i + 1;
      btn.onclick = () => { leadFilters.page = i; loadLeadsTable(); };
      pagination.appendChild(btn);
    }
    if (totalPages > 1) {
      const info = document.createElement('span');
      info.style.cssText = 'color:var(--text2);font-size:12px;padding:6px';
      info.textContent = `${total} total`;
      pagination.appendChild(info);
    }
  });
}

function toggleAllLeads(cb) {
  $$('.lead-checkbox').forEach(c => c.checked = cb.checked);
}

async function deleteSelectedLeads() {
  const ids = $$('.lead-checkbox:checked').map(c => parseInt(c.value));
  if (ids.length === 0) return toast('No leads selected', 'error');
  if (!confirm(`Delete ${ids.length} leads?`)) return;
  await api('/leads/bulk-delete', { method: 'POST', body: { ids } });
  toast(`Deleted ${ids.length} leads`, 'success');
  loadLeadsTable();
}

async function viewLead(id) {
  const data = await api(`/leads/${id}`);
  if (!data) return;
  const { lead, messages } = data;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="width:640px">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
        <h2>${esc(lead.company)}</h2>
        <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="lead-detail-grid">
        <div class="detail-field"><label>Name</label><div>${esc(lead.name || '—')}</div></div>
        <div class="detail-field"><label>Email</label><div>${esc(lead.email || '—')}</div></div>
        <div class="detail-field"><label>Phone</label><div>${esc(lead.phone || '—')}</div></div>
        <div class="detail-field"><label>Website</label><div>${lead.website ? '<a href="' + esc(lead.website) + '" target="_blank">' + esc(lead.website) + '</a>' : '—'}</div></div>
        <div class="detail-field"><label>Instagram</label><div>${lead.instagram ? '@' + esc(lead.instagram) : '—'}</div></div>
        <div class="detail-field"><label>City / State</label><div>${esc(lead.city)}${lead.state ? ', ' + esc(lead.state) : ''}</div></div>
        <div class="detail-field"><label>Website Quality</label><div>${lead.website_quality ? `<span class="badge badge-${lead.website_quality}">${lead.website_quality}</span>` : '—'}</div></div>
        <div class="detail-field"><label>Status</label><div><span class="badge badge-${lead.status}">${lead.status}</span></div></div>
        <div class="detail-field"><label>Rating</label><div>${lead.rating ? '⭐ ' + lead.rating : '—'}</div></div>
        <div class="detail-field"><label>Source</label><div>${esc(lead.source || '—')}</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary" onclick="updateLeadStatus(${lead.id},'sent')">Mark Sent</button>
        <button class="btn btn-sm btn-success" onclick="updateLeadStatus(${lead.id},'replied')">Mark Replied</button>
        <button class="btn btn-sm btn-outline" onclick="updateLeadStatus(${lead.id},'closed')">Mark Closed</button>
        <button class="btn btn-sm btn-danger" onclick="updateLeadStatus(${lead.id},'bounced')">Mark Bounced</button>
      </div>
      <h3 style="font-size:14px;margin-bottom:8px">Messages</h3>
      <div class="message-timeline">
        ${messages.length === 0 ? '<div style="color:var(--text2);font-size:13px">No messages sent yet</div>' :
          messages.map(m => `
            <div class="message-item ${m.replied_at ? 'replied' : (m.sent_at ? 'sent' : '')}">
              <div class="msg-meta">
                ${m.channel} · Step ${m.step}${m.sent_at ? ' · ' + new Date(m.sent_at).toLocaleDateString() : ''}
                ${m.replied_at ? ' · Replied' : ''}
              </div>
              <div class="msg-body">${esc(m.body.substring(0, 200))}${m.body.length > 200 ? '...' : ''}</div>
              ${m.error ? '<div style="color:var(--red);font-size:12px;margin-top:4px">❌ ' + esc(m.error) + '</div>' : ''}
            </div>
          `).join('')}
      </div>
      <div class="modal-actions">
        <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function updateLeadStatus(id, status) {
  await api(`/leads/${id}`, { method: 'PUT', body: { status } });
  toast(`Status updated to ${status}`, 'success');
  document.querySelector('.modal-overlay')?.remove();
  loadLeadsTable();
}

function showAddLeadModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <h2>Add Lead Manually</h2>
      <form id="add-lead-form">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label>Company *</label><input name="company" required></div>
          <div class="form-group"><label>Name</label><input name="name"></div>
          <div class="form-group"><label>Email</label><input name="email" type="email"></div>
          <div class="form-group"><label>Phone</label><input name="phone"></div>
          <div class="form-group"><label>Website</label><input name="website"></div>
          <div class="form-group"><label>Instagram</label><input name="instagram"></div>
          <div class="form-group"><label>City</label><input name="city"></div>
          <div class="form-group"><label>State</label><input name="state"></div>
        </div>
        <div class="form-group"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">Add Lead</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  $('#add-lead-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    await api('/leads', { method: 'POST', body: data });
    toast('Lead added', 'success');
    modal.remove();
    loadLeadsTable();
  });
}

/* ================ SCRAPER ================ */

async function renderScraper(main) {
  main.innerHTML = `
    <div class="page-header">
      <div><h1>Lead Scraper</h1><div class="subtitle">Find ${currentNiche === 'dental' ? 'dental practices' : 'cleaning companies'} with bad/no websites</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-outline" id="scraper-refresh-btn" onclick="updateScraperStatus()">🔄 Refresh</button>
        <select id="scraper-niche" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:13px">
          <option value="cleaning" ${currentNiche==='cleaning'?'selected':''}>🧹 Cleaning</option>
          <option value="dental" ${currentNiche==='dental'?'selected':''}>🦷 Dental</option>
        </select>
        <input type="text" id="single-city-input" placeholder="e.g. New York, NY" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);width:200px;font-size:13px">
        <button class="btn btn-primary" onclick="scrapeSingleCity()">▶ Scrape One</button>
        <button class="btn btn-success" id="scraper-start-btn" onclick="startScraper()">▶ Scrape All 50</button>
        <button class="btn btn-danger hidden" id="scraper-stop-btn" onclick="stopScraper()">⏹ Stop</button>
      </div>
    </div>
    <div id="scraper-status"></div>
    <div style="margin-top:16px">
      <div class="card">
        <div class="card-title">Target Cities (${cities.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">
          ${cities.map(c => `<span style="background:var(--surface2);padding:3px 8px;border-radius:4px;font-size:12px;color:var(--text2)">${esc(c)}</span>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Scrape Log</div>
        <div class="logs" id="scraper-logs"><div style="color:var(--text2)">Ready to scrape</div></div>
      </div>
    </div>
  `;

  await updateScraperStatus();
}

const cities = ['New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','Austin','Jacksonville','Fort Worth','Columbus','Charlotte','Indianapolis','San Francisco','Seattle','Denver','Nashville','El Paso','Washington DC','Boston','Detroit','Memphis','Portland','Oklahoma City','Las Vegas','Louisville','Baltimore','Milwaukee','Albuquerque','Tucson','Fresno','Sacramento','Mesa','Kansas City','Atlanta','Omaha','Colorado Springs','Raleigh','Long Beach','Virginia Beach','Miami','Oakland','Minneapolis','Tampa','New Orleans','Cleveland','Honolulu'];

async function updateScraperStatus() {
  try {
    const status = await api('/scraper/status');
    if (!status) return;
    const container = $('#scraper-status');
    if (!container) return;

    if (status.running) {
      $('#scraper-start-btn')?.classList.add('hidden');
      $('#scraper-stop-btn')?.classList.remove('hidden');

      const pct = status.total > 0 ? Math.round((status.progress / status.total) * 100) : 0;
      container.innerHTML = `
        <div class="card">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span>Scraping: <strong>${esc(status.currentCity || '...')}</strong></span>
            <span style="color:var(--text2)">${status.progress}/${status.total} · ${status.leadsFound} leads found</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
      `;

      const logs = $('#scraper-logs');
      if (logs) {
        logs.innerHTML = status.logs.map(l => `<div class="info">${esc(l)}</div>`).join('');
        logs.scrollTop = logs.scrollHeight;
      }

      setTimeout(updateScraperStatus, 2000);
    } else {
      $('#scraper-start-btn')?.classList.remove('hidden');
      $('#scraper-stop-btn')?.classList.add('hidden');

      container.innerHTML = `
        <div class="card">
          <div style="display:flex;justify-content:space-between">
            <span>Scraper <strong style="color:var(--green)">Idle</strong></span>
            <span style="color:var(--text2)">Last run: ${status.leadsFound > 0 ? status.leadsFound + ' leads found' : 'No runs yet'}</span>
          </div>
        </div>
      `;

      if (status.logs.length > 0) {
        const logs = $('#scraper-logs');
        if (logs) {
          logs.innerHTML = status.logs.map(l => {
            const cls = l.includes('Error') || l.includes('error') ? 'error' : l.includes('Finished') ? 'success' : 'info';
            return `<div class="${cls}">${esc(l)}</div>`;
          }).join('');
          logs.scrollTop = logs.scrollHeight;
        }
      }
    }
  } catch {}
}

async function scrapeSingleCity() {
  const city = $('#single-city-input').value.trim();
  if (!city) return toast('Enter a city name', 'error');
  const niche = $('#scraper-niche').value;
  await api('/scraper/start', { method: 'POST', body: { city, niche } });
  toast(`Scraping: ${city} (${niche})`, 'success');
  updateScraperStatus();
}

async function startScraper() {
  const niche = $('#scraper-niche').value;
  await api('/scraper/start', { method: 'POST', body: { cities, niche } });
  toast(`Scraper started (${niche})`, 'success');
  updateScraperStatus();
}

async function stopScraper() {
  await api('/scraper/stop', { method: 'POST' });
  toast('Stopping scraper...', 'success');
}

/* ================ CAMPAIGNS ================ */

async function renderCampaigns(main) {
  main.innerHTML = `
    <div class="page-header">
      <div><h1>Campaigns</h1><div class="subtitle">Send outreach campaigns</div></div>
      <button class="btn btn-primary" onclick="showNewCampaignModal()">+ New Campaign</button>
    </div>
    <div id="campaigns-list"></div>
  `;
  await loadCampaigns();
}

async function loadCampaigns() {
  const campaigns = await api('/campaign');
  const container = $('#campaigns-list');
  if (!container) return;

  if (campaigns.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No campaigns yet</h3><p>Create your first campaign to start outreach</p></div>';
    return;
  }

  container.innerHTML = `<div class="table-container"><table>
    <tr><th>Name</th><th>Niche</th><th>Status</th><th>Targeted</th><th>Sent</th><th>Replies</th><th>Conversion</th><th>Actions</th></tr>
    ${campaigns.map(c => {
      const conv = c.sent_count > 0 ? Math.round((c.reply_count / c.sent_count) * 100) : 0;
      return `<tr>
        <td><strong>${esc(c.name)}</strong></td>
        <td><span class="badge badge-${esc(c.niche || 'cleaning')}">${esc(c.niche || 'cleaning')}</span></td>
        <td><span class="badge badge-${c.status === 'running' ? 'sent' : (c.status === 'completed' ? 'replied' : 'new')}">${c.status}</span></td>
        <td>${c.leads_targeted}</td>
        <td>${c.sent_count}</td>
        <td>${c.reply_count}</td>
        <td>${conv}%</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="viewCampaign(${c.id})">View</button>
          ${c.status === 'running' ? `<button class="btn btn-sm btn-outline" onclick="pauseCampaign(${c.id})">Pause</button>` : ''}
          ${c.status === 'paused' ? `<button class="btn btn-sm btn-success" onclick="resumeCampaign(${c.id})">Resume</button>` : ''}
          ${c.status === 'running' || c.status === 'paused' ? `<button class="btn btn-sm btn-danger" onclick="stopCampaign(${c.id})">Stop</button>` : ''}
        </td>
      </tr>`;
    }).join('')}
  </table></div>`;
}

async function viewCampaign(id) {
  const data = await api(`/campaign/${id}`);
  if (!data) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="width:700px">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
        <h2>${esc(data.campaign.name)}</h2>
        <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
        <div class="stat-card"><div class="stat-label">Targeted</div><div class="stat-value">${data.campaign.leads_targeted}</div></div>
        <div class="stat-card yellow"><div class="stat-label">Sent</div><div class="stat-value">${data.campaign.sent_count}</div></div>
        <div class="stat-card green"><div class="stat-label">Replies</div><div class="stat-value">${data.campaign.reply_count}</div></div>
        <div class="stat-card blue"><div class="stat-label">Status</div><div class="stat-value" style="font-size:16px">${data.campaign.status}</div></div>
      </div>
      <h3 style="font-size:14px;margin-bottom:8px">Leads in Campaign</h3>
      <div class="table-container"><table>
        <tr><th>Company</th><th>Email</th><th>Step</th><th>Status</th></tr>
        ${data.leads.map(l => `<tr>
          <td>${esc(l.company)}</td>
          <td>${esc(l.email)}</td>
          <td>${l.current_step}/4</td>
          <td><span class="badge badge-${l.campaign_status === 'replied' ? 'replied' : 'sent'}">${l.campaign_status}</span></td>
        </tr>`).join('')}
      </table></div>
      <div class="modal-actions">
        <button class="btn btn-sm btn-outline" onclick="this.closest('.modal-overlay').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function pauseCampaign(id) { await api(`/campaign/${id}/pause`, { method: 'POST' }); toast('Campaign paused', 'success'); loadCampaigns(); }
async function resumeCampaign(id) { await api(`/campaign/${id}/resume`, { method: 'POST' }); toast('Campaign resumed', 'success'); loadCampaigns(); }
async function stopCampaign(id) { await api(`/campaign/${id}/stop`, { method: 'POST' }); toast('Campaign stopped', 'success'); loadCampaigns(); }

async function showNewCampaignModal() {
  const niche = currentNiche;
  const { leads } = await api('/leads?limit=500&status=new&niche=' + niche);
  if (leads.length === 0) return toast('No new ' + niche + ' leads available. Scrape or add leads first.', 'error');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="width:640px">
      <h2>New Campaign</h2>
      <form id="new-campaign-form">
        <div class="form-group">
          <label>Campaign Name</label>
          <input name="name" value="${niche === 'dental' ? '🦷' : '🧹'} Outreach ${new Date().toLocaleDateString()}" required>
        </div>
        <div class="form-group">
          <label>Industry</label>
          <select name="niche" style="max-width:200px">
            <option value="cleaning" ${niche==='cleaning'?'selected':''}>🧹 Cleaning</option>
            <option value="dental" ${niche==='dental'?'selected':''}>🦷 Dental</option>
          </select>
        </div>
        <div class="form-group">
          <label>Select Leads (${leads.length} available)</label>
          <div style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:4px">
            ${leads.map(l => `
              <label style="display:flex;align-items:center;gap:8px;padding:4px 8px;cursor:pointer;font-size:13px">
                <input type="checkbox" name="leadIds" value="${l.id}" checked>
                <span>${esc(l.company)} — ${esc(l.city)} ${l.website_quality === 'none' ? '🔴' : ''} ${l.email ? '📧' : '⚠️'}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
          <button type="submit" class="btn btn-primary">Start Campaign</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  $('#new-campaign-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const leadIds = form.getAll('leadIds').map(Number);
    if (leadIds.length === 0) return toast('Select at least one lead', 'error');

    await api('/campaign', {
      method: 'POST',
      body: { name: form.get('name'), leadIds, niche: form.get('niche') }
    });
    toast(`Campaign started with ${leadIds.length} leads`, 'success');
    modal.remove();
    loadCampaigns();
  });
}

/* ================ INSTAGRAM ================ */

async function renderInstagram(main) {
  main.innerHTML = `
    <div class="page-header">
      <div><h1>Instagram DM Helper</h1><div class="subtitle">Semi-automated Instagram outreach</div></div>
    </div>
    <div class="search-bar">
      <input type="text" id="ig-search" placeholder="Search leads..." oninput="filterInstagramLeads()">
      <select id="ig-filter" onchange="filterInstagramLeads()">
        <option value="">All</option>
        <option value="instagram">Has Instagram</option>
        <option value="no-instagram">No Instagram</option>
      </select>
    </div>
    <div id="ig-results"></div>
  `;
  await loadInstagramLeads();
}

let allInstagramLeads = [];

async function loadInstagramLeads() {
  const { leads } = await api('/leads?limit=500');
  allInstagramLeads = leads;
  filterInstagramLeads();
}

function filterInstagramLeads() {
  const search = $('#ig-search')?.value.toLowerCase() || '';
  const filter = $('#ig-filter')?.value || '';
  const container = $('#ig-results');
  if (!container) return;

  let filtered = allInstagramLeads;
  if (search) filtered = filtered.filter(l => l.company.toLowerCase().includes(search) || l.name.toLowerCase().includes(search));
  if (filter === 'instagram') filtered = filtered.filter(l => l.instagram);
  if (filter === 'no-instagram') filtered = filtered.filter(l => !l.instagram);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>No leads found</h3></div>';
    return;
  }

  container.innerHTML = `<div class="table-container"><table>
    <tr><th>Company</th><th>Instagram</th><th>Niche</th><th>Status</th><th>DM Preview</th><th>Actions</th></tr>
    ${filtered.map(l => {
      const preview = l.instagram
        ? `Hey ${esc(l.name || 'there')}! 👋 I came across ${esc(l.company)}...`
        : '<span style="color:var(--text2)">No Instagram found</span>';
      return `<tr>
        <td><strong>${esc(l.company)}</strong><br><span style="color:var(--text2);font-size:11px">${esc(l.city)}</span></td>
        <td>${l.instagram ? `<a href="https://www.instagram.com/${esc(l.instagram)}/" target="_blank">@${esc(l.instagram)}</a>` : '<span style="color:var(--text2);font-size:12px">—</span>'}</td>
        <td><span class="badge badge-${esc(l.niche || 'cleaning')}">${esc(l.niche || 'cleaning')}</span></td>
        <td><span class="badge badge-${l.status}">${l.status}</span></td>
        <td style="font-size:12px;color:var(--text2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${preview}</td>
        <td>
          ${l.instagram ? `
            <button class="btn btn-sm btn-primary" onclick="autoTypeInstagram(${l.id})">🤖 Auto-Type</button>
            <button class="btn btn-sm btn-outline" onclick="copyInstagramDM(${l.id})">📋 Copy</button>
            <a href="https://www.instagram.com/${esc(l.instagram)}/" target="_blank" class="btn btn-sm btn-outline" style="display:inline-flex">🔗 Open</a>
            <div style="display:flex;gap:4px;margin-top:6px">
              <button class="btn btn-sm btn-success" onclick="markInstagramSent(${l.id})" style="font-size:10px;padding:3px 6px">✅ Sent</button>
              <button class="btn btn-sm btn-danger" onclick="markInstagramUnavailable(${l.id})" style="font-size:10px;padding:3px 6px">🚫 Unavailable</button>
              <button class="btn btn-sm btn-outline" onclick="markInstagramDefault(${l.id})" style="font-size:10px;padding:3px 6px">↩️ Default</button>
            </div>
          ` : '<span style="color:var(--text2);font-size:12px">N/A</span>'}
        </td>
      </tr>`;
    }).join('')}
  </table></div>`;
}

async function copyInstagramDM(id) {
  const data = await api(`/leads/${id}`);
  if (!data) return;
  const template = new Function('lead', 'demo_link',
    `return \`${data.lead.instagram_template || 'Hey {name}! 👋\\n\\nI came across {company}...'}\``
  );
  const text = `Hey ${data.lead.name || 'there'}! 👋\n\nI came across ${data.lead.company} and saw you don't have a website yet. We just built this cleaning site for a client — check it out: https://cleaning-service-one-lyart.vercel.app/\n\nWould love to help ${data.lead.company} get online and start getting more bookings. Let me know! 🙌`;

  await navigator.clipboard.writeText(text);
  toast('DM copied to clipboard! Paste in Instagram', 'success');
  window.open(`https://www.instagram.com/${data.lead.instagram}/`, '_blank');
}

async function autoTypeInstagram(id) {
  const data = await api(`/leads/${id}`);
  if (!data || !data.lead.instagram) return toast('No Instagram handle', 'error');

  toast('Opening browser to type DM...', 'success');

  try {
    await api('/instagram/prepare', { method: 'POST', body: { leadId: id } });
  } catch {
    const text = `Hey ${data.lead.name || 'there'}! 👋\n\nI came across ${data.lead.company} and saw you don't have a website yet. We just built this cleaning site for a client — check it out: https://cleaning-service-one-lyart.vercel.app/\n\nWould love to help ${data.lead.company} get online and start getting more bookings. Let me know! 🙌`;

    await navigator.clipboard.writeText(text);
    window.open(`https://www.instagram.com/${data.lead.instagram}/`, '_blank');
    toast('Copied to clipboard. Paste in Instagram DM.', 'success');
  }
}

async function markInstagramSent(id) {
  await api(`/leads/${id}`, { method: 'PUT', body: { status: 'sent' } });
  toast('Marked as sent', 'success');
  filterInstagramLeads();
}

async function markInstagramUnavailable(id) {
  await api(`/leads/${id}`, { method: 'PUT', body: { status: 'bounced', notes: 'Instagram page not available' } });
  toast('Marked as page not available', 'success');
  filterInstagramLeads();
}

async function markInstagramDefault(id) {
  await api(`/leads/${id}`, { method: 'PUT', body: { status: 'new', notes: '' } });
  toast('Reset to default', 'success');
  filterInstagramLeads();
}

/* ================ TEMPLATES ================ */

let templateTab = 'cleaning';

async function renderTemplates(main) {
  main.innerHTML = `
    <div class="page-header">
      <div><h1>Message Templates</h1><div class="subtitle">Edit outreach message templates per industry</div></div>
      <button class="btn btn-primary" onclick="saveTemplates()">💾 Save All</button>
    </div>
    <div class="tabs" id="template-tabs">
      <div class="tab ${templateTab==='cleaning'?'active':''}" data-tab="cleaning">🧹 Cleaning</div>
      <div class="tab ${templateTab==='dental'?'active':''}" data-tab="dental">🦷 Dental</div>
    </div>
    <div id="template-editors"></div>
  `;

  $$('#template-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('#template-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      templateTab = tab.dataset.tab;
      renderTemplateEditors();
    });
  });

  await renderTemplateEditors();
}

async function renderTemplateEditors() {
  const settings = await api('/settings');
  const prefix = templateTab + '_';
  const templates = [
    { key: prefix + 'initial_template', label: 'Initial Email', desc: 'Sent on day 0' },
    { key: prefix + 'followup1_template', label: 'Follow-up #1', desc: 'Sent on day 3' },
    { key: prefix + 'followup2_template', label: 'Follow-up #2', desc: 'Sent on day 5' },
    { key: prefix + 'closing_template', label: 'Closing Email', desc: 'Sent on day 7' },
    { key: prefix + 'instagram_template', label: 'Instagram DM', desc: 'Used for manual/copy DM' }
  ];

  const container = $('#template-editors');
  container.innerHTML = templates.map(t => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div class="card-title" style="margin-bottom:0">${t.label}</div>
          <span style="color:var(--text2);font-size:11px">${t.desc}</span>
        </div>
      </div>
      <textarea class="template-field" data-key="${t.key}" rows="6" style="font-size:13px;line-height:1.5">${esc(settings[t.key] || '')}</textarea>
      <div style="margin-top:8px;font-size:11px;color:var(--text2)">
        Available variables: <code>{name}</code> <code>{company}</code> <code>{city}</code> <code>{demo_link}</code> <code>{demo_link2}</code>
      </div>
    </div>
  `).join('');
}

async function saveTemplates() {
  const updates = {};
  $$('.template-field').forEach(el => {
    updates[el.dataset.key] = el.value;
  });
  await api('/settings', { method: 'PUT', body: updates });
  toast('Templates saved', 'success');
}

/* ================ SETTINGS ================ */

async function renderSettings(main) {
  main.innerHTML = `
    <div class="page-header">
      <div><h1>Settings</h1><div class="subtitle">System configuration</div></div>
      <button class="btn btn-primary" onclick="saveSettings()">💾 Save Settings</button>
    </div>
    <div class="card">
      <div class="card-title">Email Configuration</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
        <div class="form-group"><label>SMTP Host</label><input id="set-smtp-host" value="${esc(config.smtp.host)}"></div>
        <div class="form-group"><label>SMTP Port</label><input id="set-smtp-port" value="${config.smtp.port}"></div>
        <div class="form-group"><label>SMTP User</label><input id="set-smtp-user" value="${esc(config.smtp.user)}"></div>
        <div class="form-group"><label>SMTP Password</label><input id="set-smtp-pass" type="password" value="${esc(config.smtp.pass)}"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Schedule (days between follow-ups)</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:8px">
        <div class="form-group"><label>Follow-up #1</label><input id="set-f1" type="number" value="${config.schedule.followup1Day}"></div>
        <div class="form-group"><label>Follow-up #2</label><input id="set-f2" type="number" value="${config.schedule.followup2Day}"></div>
        <div class="form-group"><label>Closing</label><input id="set-closing" type="number" value="${config.schedule.closingDay}"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Demo Links</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
        <div class="form-group"><label>🧹 Cleaning Demo Link</label><input id="set-demo-link" value="${esc(config.demoLink)}"></div>
        <div class="form-group"><label>🦷 Dental Demo Link</label><input id="set-dental-demo-link" value="${esc(config.dentalDemoLink || 'https://bright-smile-tan.vercel.app/')}"></div>
        <div class="form-group"><label>🦷 Dental Demo Link 2</label><input id="set-dental-demo-link-2" value="${esc(config.dentalDemoLink2 || 'https://dental-clinic-usa.vercel.app/')}"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Notifications</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
        <div class="form-group"><label>Notification Email</label><input id="set-notification-email" value="${esc(config.notificationEmail)}"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Instagram</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
        <div class="form-group"><label>Username</label><input id="set-ig-user" value="${esc(config.instagram.username)}"></div>
        <div class="form-group"><label>Password</label><input id="set-ig-pass" type="password" value="${esc(config.instagram.password)}"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">IMAP (Reply Detection)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
        <div class="form-group"><label>IMAP Host</label><input id="set-imap-host" value="${esc(config.imap.host)}"></div>
        <div class="form-group"><label>IMAP Port</label><input id="set-imap-port" value="${config.imap.port}"></div>
        <div class="form-group"><label>IMAP User</label><input id="set-imap-user" value="${esc(config.imap.user)}"></div>
        <div class="form-group"><label>IMAP Password</label><input id="set-imap-pass" type="password" value="${esc(config.imap.pass)}"></div>
      </div>
    </div>
  `;
}

async function saveSettings() {
  const updates = {};
  const fields = [
    'smtp-host', 'smtp-port', 'smtp-user', 'smtp-pass',
    'f1', 'f2', 'closing',
    'notification-email', 'demo-link', 'dental-demo-link', 'dental-demo-link-2',
    'ig-user', 'ig-pass',
    'imap-host', 'imap-port', 'imap-user', 'imap-pass'
  ];
  fields.forEach(f => {
    const el = $(`#set-${f}`);
    if (el) updates[f] = el.value;
  });
  await api('/settings', { method: 'PUT', body: updates });
  toast('Settings saved. Some changes require restart.', 'success');
}

/* ================ CONFIG (for settings page) ================ */
const config = {
  smtp: { host: 'smtp-relay.brevo.com', port: 587, user: '', pass: '' },
  schedule: { followup1Day: 3, followup2Day: 5, closingDay: 7 },
  notificationEmail: '',
  demoLink: 'https://cleaning-service-one-lyart.vercel.app/',
  dentalDemoLink: 'https://bright-smile-tan.vercel.app/',
  dentalDemoLink2: 'https://dental-clinic-usa.vercel.app/',
  instagram: { username: '', password: '' },
  imap: { host: 'imap.gmail.com', port: 993, user: '', pass: '' }
};

async function loadConfig() {
  try {
    const settings = await api('/settings');
    if (settings) {
      Object.assign(config, {
        smtp: {
          host: settings['smtp-host'] || config.smtp.host,
          port: parseInt(settings['smtp-port']) || config.smtp.port,
          user: settings['smtp-user'] || '',
          pass: settings['smtp-pass'] || ''
        },
        schedule: {
          followup1Day: parseInt(settings['f1']) || 3,
          followup2Day: parseInt(settings['f2']) || 5,
          closingDay: parseInt(settings['closing']) || 7
        },
        notificationEmail: settings['notification-email'] || '',
        demoLink: settings['demo-link'] || config.demoLink,
        dentalDemoLink: settings['dental-demo-link'] || config.dentalDemoLink,
        dentalDemoLink2: settings['dental-demo-link-2'] || config.dentalDemoLink2,
        instagram: {
          username: settings['ig-user'] || '',
          password: settings['ig-pass'] || ''
        },
        imap: {
          host: settings['imap-host'] || 'imap.gmail.com',
          port: parseInt(settings['imap-port']) || 993,
          user: settings['imap-user'] || '',
          pass: settings['imap-pass'] || ''
        }
      });
    }
  } catch {}
}

/* ================ UTILS ================ */

function esc(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

loadConfig().then(render);
