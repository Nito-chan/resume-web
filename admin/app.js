(() => {
  'use strict';

  const API_BASE = '/api';
  let AUTH_TOKEN = localStorage.getItem('admin_token');
  let CONFIG = null;
  let PROJECTS = [];
  let editingProjectId = null;

  /* ============================================================
     DOM REFS
  ============================================================ */
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  const loginScreen = $('#loginScreen');
  const dashboard = $('#dashboard');
  const passwordInput = $('#adminPassword');
  const loginBtn = $('#loginBtn');
  const loginError = $('#loginError');
  const logoutBtn = $('#logoutBtn');
  const projectsList = $('#projectsList');
  const addProjectBtn = $('#addProjectBtn');
  const modal = $('#projectModal');
  const modalTitle = $('#modalTitle');
  const modalClose = $('#modalClose');
  const modalCancel = $('#modalCancel');
  const modalSave = $('#modalSave');
  const messagesList = $('#messagesList');
  const configForm = $('#configForm');
  const saveConfigBtn = $('#saveConfigBtn');
  const configStatus = $('#configStatus');

  /* ============================================================
     AUTH
  ============================================================ */
  async function login() {
    const password = passwordInput.value;
    if (!password) { loginError.textContent = 'Enter the admin password'; return; }

    try {
      const res = await fetch(API_BASE + '/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok) { loginError.textContent = 'Invalid password'; return; }
      const data = await res.json();
      AUTH_TOKEN = data.token;
      localStorage.setItem('admin_token', AUTH_TOKEN);
      showDashboard();
    } catch {
      loginError.textContent = 'Server unreachable';
    }
  }

  function logout() {
    AUTH_TOKEN = null;
    localStorage.removeItem('admin_token');
    loginScreen.style.display = 'flex';
    dashboard.style.display = 'none';
    passwordInput.value = '';
  }

  function showDashboard() {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'block';
    loadDashboard();
  }

  async function authFetch(url, options = {}) {
    const headers = { ...options.headers };
    if (AUTH_TOKEN) headers['Authorization'] = 'Bearer ' + AUTH_TOKEN;
    return fetch(url, { ...options, headers });
  }

  /* ============================================================
     TAB SWITCHING
  ============================================================ */
  $$('.admin-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.admin-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.admin-tab').forEach(t => t.classList.remove('active'));
      const tab = document.getElementById('tab-' + btn.dataset.tab);
      if (tab) tab.classList.add('active');
      if (btn.dataset.tab === 'messages') loadMessages();
      if (btn.dataset.tab === 'analytics') loadAnalytics();
    });
  });

  /* ============================================================
     DASHBOARD DATA LOADING
  ============================================================ */
  async function loadDashboard() {
    await Promise.all([loadConfig(), loadProjects()]);
    loadAnalytics();
  }

  async function loadConfig() {
    try {
      const res = await fetch(API_BASE + '/config');
      if (res.ok) {
        CONFIG = await res.json();
        renderConfigForm();
      }
    } catch {}
  }

  async function loadProjects() {
    try {
      const res = await fetch(API_BASE + '/projects');
      if (res.ok) {
        PROJECTS = await res.json();
        renderProjects();
      } else {
        projectsList.innerHTML = '<div class="admin-loading">Failed to load projects</div>';
      }
    } catch {
      projectsList.innerHTML = '<div class="admin-loading">Server unreachable</div>';
    }
  }

  async function loadMessages() {
    messagesList.innerHTML = '<div class="admin-loading"><div class="admin-spinner"></div> Loading messages...</div>';
    try {
      const res = await authFetch(API_BASE + '/contact/admin');
      if (res.ok) {
        const data = await res.json();
        window._allMessages = data;
        renderMessages(data);
      } else {
        messagesList.innerHTML = '<div class="admin-loading"><div class="admin-empty-icon">✉</div>No messages yet or unauthorized</div>';
      }
    } catch {
      messagesList.innerHTML = '<div class="admin-loading">Server unreachable</div>';
    }
  }

  function loadAnalytics() {
    const pCount = PROJECTS.filter(p => !p._deleted).length;
    const sCount = CONFIG?.services?.length || 0;
    const skCount = CONFIG?.skills?.groups?.reduce((a, g) => a + (g.items?.length || 0), 0) || 0;
    document.getElementById('analyticsProjects').textContent = pCount;
    document.getElementById('analyticsMessages').textContent = '—';
    document.getElementById('analyticsServices').textContent = sCount;
    document.getElementById('analyticsSkills').textContent = skCount;
  }

  /* ============================================================
     RENDER PROJECTS
  ============================================================ */
  function renderProjects() {
    if (!PROJECTS.length) {
      projectsList.innerHTML = '<div class="admin-loading"><div class="admin-empty-icon">📁</div>No projects yet. Click "+ New Project" to add one.</div>';
      return;
    }

    projectsList.innerHTML = PROJECTS.map((p, i) => `
      <div class="admin-project-item" data-index="${i}">
        <div class="admin-project-info">
          <h4>${p.title || 'Untitled'}</h4>
          <p>
            <span class="admin-project-tag">${p.category || 'web'}</span>
            ${p.description ? p.description.substring(0, 80) + (p.description.length > 80 ? '...' : '') : 'No description'}
          </p>
        </div>
        <div class="admin-project-actions">
          <button class="edit-btn" data-id="${p.id || i}" onclick="editProject('${p.id || i}')">Edit</button>
          <button class="delete-btn" data-id="${p.id || i}" onclick="deleteProject('${p.id || i}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  /* ============================================================
     PROJECT CRUD
  ============================================================ */
  window.editProject = function(id) {
    const p = PROJECTS.find(x => (x.id || PROJECTS.indexOf(x).toString()) === id);
    if (!p) return;
    editingProjectId = id;
    modalTitle.textContent = 'Edit Project';
    $('#pTitle').value = p.title || '';
    $('#pDesc').value = p.description || '';
    $('#pCategory').value = p.category || 'web';
    $('#pYear').value = p.year || '';
    $('#pTags').value = (p.tags || []).join(', ');
    $('#pLink').value = p.link || '';
    $('#pFeatured').value = p.featured ? 'true' : 'false';
    $('#projectMediaPreview').innerHTML = '';
    if (p.image) $('#projectMediaPreview').innerHTML += `<img src="${p.image}" alt="">`;
    if (p.video) $('#projectMediaPreview').innerHTML += `<video src="${p.video}" muted></video>`;
    modal.classList.add('open');
  };

  window.deleteProject = async function(id) {
    if (!(await confirmDialog('Delete this project?'))) return;
    try {
      const res = await authFetch(API_BASE + '/projects/' + id, { method: 'DELETE' });
      if (res.ok) {
        PROJECTS = PROJECTS.filter(x => (x.id || PROJECTS.indexOf(x).toString()) !== id);
        renderProjects();
        loadAnalytics();
        addToast('Project deleted', 'success');
      } else {
        addToast('Failed to delete project', 'error');
      }
    } catch {
      addToast('Server error', 'error');
    }
  };

  /* ============================================================
     MODAL
  ============================================================ */
  function resetModal() {
    editingProjectId = null;
    modalTitle.textContent = 'New Project';
    $('#pTitle').value = '';
    $('#pDesc').value = '';
    $('#pCategory').value = 'web';
    $('#pYear').value = '';
    $('#pTags').value = '';
    $('#pLink').value = '';
    $('#pFeatured').value = 'false';
    $('#pImage').value = '';
    $('#pVideo').value = '';
    $('#projectMediaPreview').innerHTML = '';
  }

  addProjectBtn.addEventListener('click', () => {
    resetModal();
    modal.classList.add('open');
  });

  modalClose.addEventListener('click', () => modal.classList.remove('open'));
  modalCancel.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  modalSave.addEventListener('click', async () => {
    const data = {
      title: $('#pTitle').value.trim(),
      description: $('#pDesc').value.trim(),
      category: $('#pCategory').value,
      year: $('#pYear').value,
      tags: $('#pTags').value.split(',').map(t => t.trim()).filter(Boolean),
      link: $('#pLink').value || '#contact',
      featured: $('#pFeatured').value === 'true'
    };

    if (!data.title) { addToast('Title is required', 'error'); return; }

    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => formData.append(k, typeof v === 'object' ? JSON.stringify(v) : v));

    const imageFile = $('#pImage').files[0];
    const videoFile = $('#pVideo').files[0];
    if (imageFile) formData.append('image', imageFile);
    if (videoFile) formData.append('video', videoFile);

    try {
      const url = editingProjectId
        ? API_BASE + '/projects/' + editingProjectId
        : API_BASE + '/projects';
      const method = editingProjectId ? 'PUT' : 'POST';

      const res = await authFetch(url, { method, body: formData });
      if (res.ok) {
        modal.classList.remove('open');
        await loadProjects();
        loadAnalytics();
        addToast(editingProjectId ? 'Project updated' : 'Project created', 'success');
      } else {
        addToast('Failed to save project', 'error');
      }
    } catch {
      addToast('Server error', 'error');
    }
  });

  /* ============================================================
     CONFIG FORM
  ============================================================ */
  function renderConfigForm() {
    if (!CONFIG) {
      configForm.innerHTML = '<div class="admin-loading">Failed to load config</div>';
      return;
    }

    const site = CONFIG.site || {};
    const author = CONFIG.author || {};
    const contact = CONFIG.contact || {};
    const social = CONFIG.social || {};

    configForm.innerHTML = `
      <div class="admin-config-section">
        <h3>Site Settings</h3>
        <div class="admin-field">
          <label>Site Title</label>
          <input type="text" id="cfg_site_title" value="${esc(site.title || '')}">
        </div>
        <div class="admin-field">
          <label>Site URL</label>
          <input type="text" id="cfg_site_url" value="${esc(site.url || '')}">
        </div>
        <div class="admin-field">
          <label>Description</label>
          <textarea id="cfg_site_desc" rows="2">${esc(site.description || '')}</textarea>
        </div>
      </div>

      <div class="admin-config-section">
        <h3>Author / Profile</h3>
        <div class="admin-field-row">
          <div class="admin-field">
            <label>Your Name</label>
            <input type="text" id="cfg_author_name" value="${esc(author.name || '')}">
          </div>
          <div class="admin-field">
            <label>Job Title</label>
            <input type="text" id="cfg_author_title" value="${esc(author.jobTitle || '')}">
          </div>
        </div>
        <div class="admin-field-row">
          <div class="admin-field">
            <label>Email</label>
            <input type="text" id="cfg_author_email" value="${esc(contact.email || author.email || '')}">
          </div>
          <div class="admin-field">
            <label>Phone</label>
            <input type="text" id="cfg_author_phone" value="${esc(contact.phone || author.phone || '')}">
          </div>
        </div>
      </div>

      <div class="admin-config-section">
        <h3>WhatsApp Integration</h3>
        <div class="admin-field-row">
          <div class="admin-field">
            <label>WhatsApp Number (with country code)</label>
            <input type="text" id="cfg_wa_number" value="${esc(contact.whatsapp?.number || '')}" placeholder="+1234567890">
          </div>
          <div class="admin-field">
            <label>WhatsApp Default Message</label>
            <input type="text" id="cfg_wa_message" value="${esc(contact.whatsapp?.message || '')}" placeholder="Hi! I'm interested...">
          </div>
        </div>
      </div>

      <div class="admin-config-section">
        <h3>Social Links</h3>
        <div class="admin-field-row">
          <div class="admin-field">
            <label>LinkedIn URL</label>
            <input type="text" id="cfg_social_linkedin" value="${esc(social.linkedin?.url || '')}">
          </div>
          <div class="admin-field">
            <label>GitHub URL</label>
            <input type="text" id="cfg_social_github" value="${esc(social.github?.url || '')}">
          </div>
        </div>
        <div class="admin-field-row">
          <div class="admin-field">
            <label>Twitter / X URL</label>
            <input type="text" id="cfg_social_twitter" value="${esc(social.twitter?.url || '')}">
          </div>
          <div class="admin-field">
            <label>Instagram URL</label>
            <input type="text" id="cfg_social_instagram" value="${esc(social.instagram?.url || '')}">
          </div>
        </div>
        <div class="admin-field-row">
          <div class="admin-field">
            <label>Fiverr URL</label>
            <input type="text" id="cfg_social_fiverr" value="${esc(social.fiverr?.url || '')}">
          </div>
          <div class="admin-field">
            <label>Upwork URL</label>
            <input type="text" id="cfg_social_upwork" value="${esc(social.upwork?.url || '')}">
          </div>
        </div>
      </div>

      <div class="admin-config-section">
        <h3>Hero Section</h3>
        <div class="admin-field">
          <label>Badge Text</label>
          <input type="text" id="cfg_hero_badge" value="${esc(CONFIG.hero?.badge || '')}">
        </div>
        <div class="admin-field">
          <label>Availability Slots</label>
          <input type="text" id="cfg_hero_slots" value="${esc(CONFIG.availability || '2 slots open')}">
        </div>
      </div>

      <div class="admin-config-section">
        <h3>Contact / Response</h3>
        <div class="admin-field">
          <label>Response Time Text</label>
          <input type="text" id="cfg_response_time" value="${esc(contact.responseTime || '')}">
        </div>
        <div class="admin-field">
          <label>Calendly URL (optional)</label>
          <input type="text" id="cfg_calendly" value="${esc(contact.calendly || '')}">
        </div>
      </div>

      <div style="text-align:right;padding-top:16px;">
        <button class="admin-btn admin-btn-primary" onclick="window.saveConfig()">Save All Changes</button>
      </div>
    `;
  }

  window.saveConfig = async function() {
    const getVal = id => document.getElementById(id)?.value || '';

    const updates = {
      site: {
        title: getVal('cfg_site_title'),
        url: getVal('cfg_site_url'),
        description: getVal('cfg_site_desc')
      },
      contact: {
        email: getVal('cfg_author_email'),
        phone: getVal('cfg_author_phone'),
        responseTime: getVal('cfg_response_time'),
        calendly: getVal('cfg_calendly'),
        whatsapp: {
          number: getVal('cfg_wa_number'),
          message: getVal('cfg_wa_message')
        }
      },
      social: {
        linkedin: { url: getVal('cfg_social_linkedin'), label: 'LinkedIn' },
        github: { url: getVal('cfg_social_github'), label: 'GitHub' },
        twitter: { url: getVal('cfg_social_twitter'), label: 'Twitter / X' },
        instagram: { url: getVal('cfg_social_instagram'), label: 'Instagram' },
        fiverr: { url: getVal('cfg_social_fiverr'), label: 'Fiverr' },
        upwork: { url: getVal('cfg_social_upwork'), label: 'Upwork' }
      },
      hero: {
        badge: getVal('cfg_hero_badge')
      }
    };

    if (getVal('cfg_author_name')) updates.author = { name: getVal('cfg_author_name'), jobTitle: getVal('cfg_author_title') };

    configStatus.textContent = 'Saving...';

    try {
      const res = await authFetch(API_BASE + '/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        configStatus.textContent = '✓ Saved';
        setTimeout(() => { configStatus.textContent = ''; }, 3000);
        await loadConfig();
      } else {
        configStatus.textContent = '✗ Failed to save';
      }
    } catch {
      configStatus.textContent = '✗ Server error';
    }
  };

  /* ============================================================
     RENDER MESSAGES
  ============================================================ */
  function renderMessages(messages) {
    if (!messages || !messages.length) {
      messagesList.innerHTML = '<div class="admin-loading"><div class="admin-empty-icon">✉</div>No messages yet</div>';
      return;
    }

    messagesList.innerHTML = messages.map(m => `
      <div class="admin-message-item">
        <div class="admin-message-header">
          <span class="admin-message-name">${esc(m.name || 'Unknown')}</span>
          <span class="admin-message-email">${esc(m.email || '')}</span>
          <span class="admin-message-date">${m.created_at ? new Date(m.created_at).toLocaleDateString() : ''}</span>
        </div>
        <div class="admin-message-body">${esc(m.message || '')}</div>
        <div class="admin-message-meta">
          ${m.service ? `<span>Service: ${esc(m.service)}</span>` : ''}
          ${m.budget ? `<span>Budget: ${esc(m.budget)}</span>` : ''}
          ${m.phone ? `<span>Phone: ${esc(m.phone)}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  const searchInput = document.getElementById('messagesSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      if (!q || !window._allMessages) {
        renderMessages(window._allMessages || []);
        return;
      }
      const filtered = window._allMessages.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.message || '').toLowerCase().includes(q) ||
        (m.service || '').toLowerCase().includes(q)
      );
      renderMessages(filtered);
    });
  }

  /* ============================================================
     TOAST NOTIFICATIONS
  ============================================================ */
  function addToast(message, type) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'success');
    const icon = type === 'error' ? '✕' : type === 'warning' ? '!' : '✓';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${esc(message)}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function confirmDialog(msg) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box">
          <div class="confirm-icon">!</div>
          <div class="confirm-msg">${esc(msg)}</div>
          <div class="confirm-actions">
            <button class="admin-btn admin-btn-secondary" id="confirmNo">Cancel</button>
            <button class="admin-btn admin-btn-danger" id="confirmYes">Delete</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('visible'));
      overlay.querySelector('#confirmYes').onclick = () => { overlay.remove(); resolve(true); };
      overlay.querySelector('#confirmNo').onclick = () => { overlay.remove(); resolve(false); };
      overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
    });
  }

  /* ============================================================
     UTILITIES
  ============================================================ */
  function esc(s) {
    const div = document.createElement('div');
    div.textContent = s || '';
    return div.innerHTML;
  }

  /* ============================================================
     INIT
  ============================================================ */
  loginBtn.addEventListener('click', login);
  passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  logoutBtn.addEventListener('click', logout);

  if (AUTH_TOKEN) {
    showDashboard();
  }

  function checkAuth() {
    if (!AUTH_TOKEN) return;
    authFetch(API_BASE + '/auth/verify').then(r => {
      if (!r.ok) logout();
    }).catch(() => {});
  }
  checkAuth();

})();
