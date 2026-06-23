(() => {
  'use strict';

  /* ============================================================
     CONFIG LOADING (instant from embedded JSON, cached in localStorage)
  ============================================================ */
  let CONFIG = null;

  function loadConfig() {
    const CACHE_KEY = 'devfolio_config';
    const CACHE_AGE = 30 * 60 * 1000;

    const embedded = document.getElementById('config-data');
    if (embedded) {
      try {
        CONFIG = JSON.parse(embedded.textContent);
        return CONFIG;
      } catch {}
    }

    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_AGE) {
          CONFIG = data;
          return CONFIG;
        }
      } catch {}
    }

    fetch('/config.json?_=' + Date.now())
      .then(r => r.ok ? r.json() : null)
      .then(cfg => {
        if (cfg) {
          CONFIG = cfg;
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: cfg, ts: Date.now() }));
          document.querySelector('html').setAttribute('data-content-loaded', 'true');
          renderAll();
        }
      })
      .catch(() => {});

    return CONFIG;
  }

  /* ============================================================
     DOM REFS
  ============================================================ */
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => [...(p || document).querySelectorAll(s)];

  /* ============================================================
     1. PAGE LOADER
  ============================================================ */
  function initLoader() {
    const loader = document.getElementById('loader');
    if (!loader) return;
    const fill = document.getElementById('loaderFill');
    const pct = document.getElementById('loaderPct');
    let progress = 0;
    let interval;

    if (window._opencode_preview) {
      loader?.remove();
      return;
    }

    interval = setInterval(() => {
      const step = Math.random() * 10 + 3;
      progress = Math.min(progress + step, 90);
      if (fill) fill.style.width = progress + '%';
      if (pct) pct.textContent = Math.floor(progress) + '%';
    }, 100);

    function finish() {
      clearInterval(interval);
      if (fill) fill.style.width = '100%';
      if (pct) pct.textContent = '100%';
      setTimeout(() => loader.classList.add('hidden'), 400);
    }

    if (document.readyState === 'complete') {
      finish();
    } else {
      window.addEventListener('load', finish);
      setTimeout(finish, 5000);
    }
  }

  /* ============================================================
     2. CUSTOM CURSOR
  ============================================================ */
  function initCursor() {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const cursor = document.getElementById('cursor');
    const cursorRing = document.getElementById('cursorRing');
    if (!cursor || !cursorRing) return;

    let mouseX = 0, mouseY = 0;
    let ringX = 0, ringY = 0;
    let rafId = null;
    let idleTimer = null;
    let moving = false;

    const cHalf = 6, ringHalf = 18;

    function tick() {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      cursor.style.transform = `translate(${mouseX - cHalf}px, ${mouseY - cHalf}px)`;
      cursorRing.style.transform = `translate(${ringX - ringHalf}px, ${ringY - ringHalf}px)`;
      if (moving) rafId = requestAnimationFrame(tick);
    }

    document.addEventListener('mousemove', e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!moving) {
        moving = true;
        rafId = requestAnimationFrame(tick);
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { moving = false; }, 500);
    }, { passive: true });

    document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
    document.addEventListener('mouseup', () => cursor.classList.remove('clicking'));

    const hoverSelector = 'a, button, .service-card, .project-card, .tool-chip, .faq-q, .pricing-card, .testimonial-card';
    document.querySelectorAll(hoverSelector).forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.classList.add('hover');
        cursorRing.classList.add('hover');
      });
      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('hover');
        cursorRing.classList.remove('hover');
      });
    });
  }

  /* ============================================================
     3. MAGNETIC BUTTONS
  ============================================================ */
  function initMagnetic() {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    document.querySelectorAll('.magnetic').forEach(el => {
      el.addEventListener('mousemove', e => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) * 0.25;
        const dy = (e.clientY - cy) * 0.25;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  /* ============================================================
     4. PARTICLE CANVAS (optimized)
  ============================================================ */
  function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { canvas.remove(); return; }

    const ctx = canvas.getContext('2d');
    let W, H, particles = [];
    let rafId = null;
    let isVisible = true;
    let isMobile = window.innerWidth < 768;

    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      isMobile = W < 768;
    }
    resize();
    window.addEventListener('resize', resize);

    const COLORS = ['rgba(123,110,246,', 'rgba(34,211,238,', 'rgba(249,115,22,'];
    const count = isMobile ? 18 : 35;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.3 + 0.3,
        vx: (Math.random() - 0.5) * (isMobile ? 0.2 : 0.3),
        vy: (Math.random() - 0.5) * (isMobile ? 0.2 : 0.3),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: Math.random() * 0.35 + 0.08
      });
    }

    let skipFrame = false;
    function draw() {
      if (!isVisible) {
        rafId = requestAnimationFrame(draw);
        return;
      }
      skipFrame = !skipFrame;
      if (skipFrame) { rafId = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + p.alpha + ')';
        ctx.fill();
      }
      rafId = requestAnimationFrame(draw);
    }
    draw();

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible && !rafId) { rafId = requestAnimationFrame(draw); }
    }, { threshold: 0 });
    observer.observe(canvas);
  }

  /* ============================================================
     5. NAV SCROLL
  ============================================================ */
  function initNavScroll() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }

  /* ============================================================
     6. MOBILE MENU
  ============================================================ */
  function initMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenu');
    if (!hamburger || !mobileMenu) return;

    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.contains('open');
      hamburger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', !isOpen);
      document.body.style.overflow = isOpen ? '' : 'hidden';
    });

    document.querySelectorAll('.mm-link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        hamburger.classList.remove('open');
        mobileMenu.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        hamburger.focus();
      }
    });
  }

  /* ============================================================
     7. SMOOTH SCROLL
  ============================================================ */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const href = a.getAttribute('href');
        if (href === '#') return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /* ============================================================
     8. REVEAL ON SCROLL
  ============================================================ */
  function initReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  /* ============================================================
     9. SKILL BARS
  ============================================================ */
  function initSkillBars() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.skill-fill').forEach(bar => bar.classList.add('animated'));
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    document.querySelectorAll('#skills').forEach(el => observer.observe(el));
  }

  /* ============================================================
     10. ANIMATED COUNTERS
  ============================================================ */
  function animateCounter(el) {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix || '';
    let start = null;
    const duration = 1600;

    function step(timestamp) {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target + suffix;
    }
    requestAnimationFrame(step);
  }

  function initCounters() {
    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.stat-num').forEach(animateCounter);
          statsObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) statsObserver.observe(heroStats);
  }

  /* ============================================================
     11. PROJECT FILTER TABS
  ============================================================ */
  function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;

        document.querySelectorAll('.project-card').forEach(card => {
          const cat = card.dataset.cat || 'all';
          const show = filter === 'all' || cat === filter;
          card.style.transition = 'opacity 0.4s, transform 0.4s';
          if (show) {
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
            card.style.pointerEvents = '';
          } else {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            card.style.pointerEvents = 'none';
          }
        });
      });
    });
  }

  /* ============================================================
     12. FAQ ACCORDION
  ============================================================ */
  function initFaq() {
    document.querySelectorAll('.faq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const isOpen = item.dataset.open === 'true';
        const wasOpen = isOpen;

        document.querySelectorAll('.faq-item').forEach(i => {
          i.dataset.open = 'false';
          const qBtn = i.querySelector('.faq-q');
          if (qBtn) qBtn.setAttribute('aria-expanded', 'false');
        });

        if (!wasOpen) {
          item.dataset.open = 'true';
          btn.setAttribute('aria-expanded', 'true');
        }
      });

      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('role', 'button');
    });
  }

  /* ============================================================
     13. CONTACT FORM
  ============================================================ */
  function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    const btn = document.getElementById('formSubmitBtn');
    const success = document.getElementById('formSuccess');
    const errorGlobal = document.getElementById('formErrorGlobal');

    function showError(inputId, message) {
      const errorEl = document.getElementById(inputId + 'Error');
      const input = document.getElementById(inputId);
      if (!errorEl) return;
      errorEl.textContent = message;
      errorEl.classList.toggle('visible', !!message);
      if (input) input.classList.toggle('error', !!message);
    }

    function clearErrors() {
      ['fname', 'femail', 'fmessage'].forEach(id => showError(id, ''));
      if (errorGlobal) errorGlobal.classList.remove('visible');
    }

    function shakeBtn(el) {
      el.style.animation = 'none';
      el.offsetHeight;
      el.style.animation = 'shake 0.4s ease';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const name = document.getElementById('fname').value.trim();
      const email = document.getElementById('femail').value.trim();
      const phone = document.getElementById('fphone').value.trim();
      const service = document.getElementById('fservice').value;
      const budget = document.getElementById('fbudget').value;
      const message = document.getElementById('fmessage').value.trim();

      let hasError = false;

      if (!name) {
        showError('fname', 'Please enter your name');
        hasError = true;
      }
      if (!email) {
        showError('femail', 'Please enter your email');
        hasError = true;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError('femail', 'Please enter a valid email');
        hasError = true;
        document.getElementById('femail').focus();
      }
      if (!message) {
        showError('fmessage', 'Please describe your project');
        hasError = true;
      }

      if (hasError) {
        shakeBtn(btn);
        return;
      }

      btn.textContent = 'Sending...';
      btn.disabled = true;

      try {
        const payload = { name, email, phone, service, budget, message };
        let sent = false;

        try {
          const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? '/api/contact'
            : '/api/contact';
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) sent = true;
        } catch {}

        if (!sent) {
          const mailto = CONFIG?.contact?.email || 'hello@yourname.com';
          const subject = encodeURIComponent('New Project Inquiry from ' + name);
          const body = encodeURIComponent(
            `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nService: ${service}\nBudget: ${budget}\n\nMessage:\n${message}`
          );
          window.open(`mailto:${mailto}?subject=${subject}&body=${body}`, '_blank');
        }

        btn.style.display = 'none';
        if (success) {
          success.style.display = 'block';
          success.style.animation = 'fadeUp 0.5s ease forwards';
        }

        setTimeout(() => {
          btn.style.display = 'block';
          btn.textContent = 'Send Message →';
          btn.disabled = false;
          if (success) success.style.display = 'none';
          document.getElementById('fname').value = '';
          document.getElementById('femail').value = '';
          document.getElementById('fphone').value = '';
          document.getElementById('fservice').value = '';
          document.getElementById('fbudget').value = '';
          document.getElementById('fmessage').value = '';
          clearErrors();
        }, 5000);

      } catch (err) {
        if (errorGlobal) {
          errorGlobal.textContent = 'Something went wrong. Please email me directly at ' + (CONFIG?.contact?.email || 'hello@yourname.com');
          errorGlobal.classList.add('visible');
        }
        btn.textContent = 'Send Message →';
        btn.disabled = false;
      }
    });
  }

  /* ============================================================
     14. MARQUEE (CSS-based, pause with class)
  ============================================================ */
  function initMarquee() {
    const track = document.querySelector('.marquee-track');
    if (!track) return;

    track.addEventListener('mouseenter', () => track.classList.add('paused'));
    track.addEventListener('mouseleave', () => track.classList.remove('paused'));
  }

  /* ============================================================
     15. TILT EFFECT (desktop only)
  ============================================================ */
  function initTilt() {
    if (window.matchMedia('(pointer: fine)').matches) {
      document.querySelectorAll('.project-card, .service-card').forEach(card => {
        card.addEventListener('mousemove', e => {
          const rect = card.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const rx = ((e.clientY - cy) / rect.height) * 6;
          const ry = ((e.clientX - cx) / rect.width) * -6;
          card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
        });
        card.addEventListener('mouseleave', () => {
          card.style.transform = '';
        });
      });
    }
  }

  /* ============================================================
     16. ACTIVE NAV LINK ON SCROLL
  ============================================================ */
  function initActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(a => {
            const isCurrent = a.getAttribute('href') === '#' + id;
            a.style.color = isCurrent ? 'var(--text)' : '';
            a.setAttribute('aria-current', isCurrent ? 'section' : 'false');
          });
        }
      });
    }, { threshold: 0.3 });

    sections.forEach(s => observer.observe(s));
  }

  /* ============================================================
     17. CURRENT YEAR
  ============================================================ */
  function setCurrentYear() {
    const el = document.getElementById('currentYear');
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ============================================================
     18. MOBILE CTA BAR
  ============================================================ */
  function initMobileCta() {
    if (window.matchMedia('(min-width: 769px)').matches) return;
    if (!CONFIG) return;

    const email = CONFIG.contact?.email || 'hello@yourname.com';
    const whatsapp = CONFIG.contact?.whatsapp;

    const bar = document.createElement('div');
    bar.className = 'mobile-cta-bar';
    bar.innerHTML = `
      <a href="mailto:${email}" class="mcta-btn mcta-secondary">📧 Email</a>
      ${whatsapp?.number ? `<a href="https://wa.me/${whatsapp.number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(whatsapp.message || '')}" target="_blank" rel="noopener" class="mcta-btn mcta-primary">💬 WhatsApp</a>` : ''}
      <a href="#contact" class="mcta-btn mcta-primary">Let's Talk →</a>
    `;
    document.body.appendChild(bar);
  }

  /* ============================================================
     RENDER FUNCTIONS (config-driven)
  ============================================================ */
  function renderServices() {
    const grid = document.getElementById('servicesGrid');
    if (!grid || !CONFIG?.services) return;
    grid.innerHTML = CONFIG.services.map((s, i) => `
      <div class="service-card reveal${i > 0 ? ' reveal-delay-' + i : ''}">
        <div class="service-card-num">${s.id}</div>
        <span class="service-icon" data-accent="${s.accent}" aria-hidden="true">${getIcon(s.icon)}</span>
        <div class="service-name">${s.name}</div>
        <div class="service-desc">${s.description}</div>
        <div class="service-tags">${s.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
        <div class="service-arrow" aria-hidden="true">→</div>
      </div>
    `).join('');
  }

  function renderProjects() {
    const grid = document.getElementById('projectsGrid');
    if (!grid || !CONFIG?.work?.projects) return;
    grid.innerHTML = CONFIG.work.projects.map((p, i) => `
      <div class="project-card${p.featured ? ' featured' : ''} reveal${i > 0 ? ' reveal-delay-' + i : ''}" data-cat="${p.category}">
        <div class="project-visual pv${i + 1}">
          ${p.image ? `<img src="${p.image}" alt="${p.title}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">` : ''}
          ${p.video ? `<video src="${p.video}" muted loop playsinline style="width:100%;height:100%;object-fit:cover;" loading="lazy"></video>` : ''}
          ${!p.image && !p.video ? getMockVisual(p.featured) : ''}
          <div class="project-overlay">
            <a href="${p.link || '#contact'}" class="overlay-btn magnetic">View Case Study →</a>
          </div>
        </div>
        <div class="project-info">
          <div class="project-tags">${p.tags.map(t => `<span class="ptag">${t}</span>`).join('')}</div>
          <h3 class="project-title">${p.title}</h3>
          <p class="project-desc">${p.description}</p>
          <div class="project-meta">
            <span>${p.year}</span>
            <a href="${p.link || '#contact'}" class="project-link">Open Project →</a>
          </div>
        </div>
      </div>
    `).join('');
  }

  function getMockVisual(featured) {
    if (featured) {
      return `<div class="project-visual-inner"><div class="project-visual-grid"><div class="mock-card accent tall"></div><div class="mock-card" style="background:rgba(34,211,238,0.1);border-color:rgba(34,211,238,0.2);"></div><div class="mock-card"></div><div class="mock-card accent"></div><div style="grid-column:span 2;background:rgba(255,255,255,0.04);border-radius:8px;height:40px;border:1px solid rgba(255,255,255,0.06);"></div></div></div>`;
    }
    return '';
  }

  function renderProcess() {
    const container = document.getElementById('processSteps');
    if (!container || !CONFIG?.process?.steps) return;
    container.innerHTML = CONFIG.process.steps.map((s, i) => `
      <div class="process-step reveal${i > 0 ? ' reveal-delay-' + i : ''}">
        <div class="step-num">${s.id}</div>
        <div class="step-icon" aria-hidden="true">${getIcon(s.icon)}</div>
        <h3 class="step-title">${s.title}</h3>
        <p class="step-desc">${s.description}</p>
        ${i < CONFIG.process.steps.length - 1 ? '<div class="step-connector"></div>' : ''}
      </div>
    `).join('');
  }

  function renderSkills() {
    const container = document.getElementById('skillGroups');
    if (!container || !CONFIG?.skills?.groups) return;

    container.innerHTML = CONFIG.skills.groups.map(g => `
      <div class="skill-group reveal">
        <div class="skill-group-title">${g.title}</div>
        ${g.items.map(s => `
          <div class="skill-item">
            <div class="skill-row"><span class="skill-name">${s.name}</span><span class="skill-pct">${s.percentage}%</span></div>
            <div class="skill-bar"><div class="skill-fill" style="--w:${s.percentage / 100}"></div></div>
          </div>
        `).join('')}
      </div>
    `).join('');

    const tools = document.getElementById('toolsGrid');
    if (tools && CONFIG.skills.tools) {
      tools.innerHTML = CONFIG.skills.tools.map(t => `
        <div class="tool-chip magnetic">
          <span class="tool-chip-icon" aria-hidden="true">${getIcon(t.icon)}</span>
          <span class="tool-chip-name">${t.name}</span>
        </div>
      `).join('');
    }

    const timeline = document.getElementById('timeline');
    if (timeline && CONFIG.experience) {
      timeline.innerHTML = CONFIG.experience.map(e => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-body">
            <span class="timeline-date">${e.period}</span>
            <h4 class="timeline-role">${e.role}</h4>
            <p class="timeline-org">${e.org}</p>
          </div>
        </div>
      `).join('');
    }
  }

  function renderTestimonials() {
    const grid = document.getElementById('testimonialsGrid');
    if (!grid || !CONFIG?.testimonials?.items) return;

    grid.innerHTML = CONFIG.testimonials.items.map((t, i) => `
      <div class="testimonial-card reveal${i > 0 ? ' reveal-delay-' + i : ''}">
        <div class="testimonial-stars" aria-label="5 out of 5 stars">★★★★★</div>
        <span class="quote-mark" aria-hidden="true">"</span>
        <p class="testimonial-text">${t.text}</p>
        <div class="testimonial-author">
          <div class="author-avatar" data-color="${t.avatarColor}" aria-hidden="true">${t.avatar}</div>
          <div>
            <span class="author-name">${t.author}</span>
            <span class="author-role">${t.role}</span>
          </div>
        </div>
      </div>
    `).join('');

    const statContainer = document.getElementById('testimonialsStat');
    if (statContainer && CONFIG.testimonials.stats) {
      statContainer.innerHTML = CONFIG.testimonials.stats.map(s => `
        <div class="tstat">
          <span class="tstat-num">${s.value}</span>
          <span class="tstat-label">${s.label}</span>
        </div>
      `).join('');
    }
  }

  function renderPricing() {
    const grid = document.getElementById('pricingGrid');
    if (!grid || !CONFIG?.pricing?.plans) return;

    grid.innerHTML = CONFIG.pricing.plans.map((p, i) => `
      <div class="pricing-card${p.featured ? ' featured' : ''} reveal${i > 0 ? ' reveal-delay-' + i : ''}">
        ${p.featured ? '<div class="pricing-badge">Most Popular</div>' : ''}
        <div class="pricing-header">
          <div class="pricing-name">${p.name}</div>
          <div class="pricing-price">${p.price}${p.period ? `<span>${p.period}</span>` : ''}</div>
          <div class="pricing-desc">${p.description}</div>
        </div>
        <ul class="pricing-features">
          ${p.features.map(f => `
            <li class="${f.included ? '' : 'dim'}">
              <span class="${f.included ? 'pf-check' : 'pf-x'}">${f.included ? '✓' : '✗'}</span>
              ${f.text}
            </li>
          `).join('')}
        </ul>
        <a href="#contact" class="pricing-btn${p.featured ? ' pricing-btn-primary' : ''} magnetic">${p.cta}</a>
      </div>
    `).join('');
  }

  function renderFaq() {
    const grid = document.getElementById('faqGrid');
    if (!grid || !CONFIG?.faq) return;

    grid.innerHTML = CONFIG.faq.map((f, i) => `
      <div class="faq-item reveal${i % 2 === 1 ? ' reveal-delay-1' : ''}" data-open="false">
        <button class="faq-q" aria-expanded="false">
          ${f.question}
          <span class="faq-icon" aria-hidden="true">+</span>
        </button>
        <div class="faq-a"><p>${f.answer}</p></div>
      </div>
    `).join('');
  }

  function renderHero() {
    const hero = CONFIG?.hero;
    if (!hero) return;

    if (hero.badge) {
      const badgeEl = document.getElementById('badgeText');
      if (badgeEl) badgeEl.textContent = hero.badge;
    }

    if (hero.title && hero.title.length) {
      const titleEl = document.getElementById('heroTitle');
      if (titleEl) {
        let html = '';
        hero.title.forEach(part => {
          if (part.type === 'normal') html += `<span class="line">${part.text}</span>`;
          else if (part.type === 'highlight') html += `<span class="line"><span class="highlight">${part.text}</span> That</span>`;
          else if (part.type === 'outline') html += `<span class="line"><span class="outline">${part.text}</span></span>`;
        });
        titleEl.innerHTML = html;
      }
    }

    if (hero.description) {
      const descEl = document.getElementById('heroDesc');
      if (descEl) descEl.innerHTML = hero.description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }

    const actions = document.getElementById('heroActions');
    if (actions && hero.buttons) {
      actions.innerHTML = hero.buttons.map(b => `
        <a href="${b.href}" class="${b.type === 'primary' ? 'btn-primary' : 'btn-secondary'} magnetic">
          <span>${b.label}</span>
          ${b.arrow ? `<span class="btn-arrow" aria-hidden="true">${b.arrow}</span>` : ''}
        </a>
      `).join('');
    }

    const stats = document.getElementById('heroStats');
    if (stats && hero.stats) {
      stats.innerHTML = hero.stats.map(s => `
        <div class="stat">
          <span class="stat-num" data-target="${s.target}" data-suffix="${s.suffix}">0</span>
          <span class="stat-label">${s.label}</span>
        </div>
      `).join('');
    }
  }

  function renderMarquee() {
    const track = document.getElementById('marqueeTrack');
    if (!track || !CONFIG?.marquee?.items) return;
    const items = CONFIG.marquee.items;
    const doubled = [...items, ...items];
    track.innerHTML = doubled.map(item => `
      <span class="marquee-item">${item}<span class="marquee-dot" aria-hidden="true"></span></span>
    `).join('');
  }

  function renderTrusted() {
    const label = document.getElementById('trustedLabel');
    const logos = document.getElementById('trustedLogos');
    if (label && CONFIG?.trusted?.label) label.textContent = CONFIG.trusted.label;
    if (logos && CONFIG?.trusted?.brands) {
      logos.innerHTML = CONFIG.trusted.brands.map(b => `<div class="trusted-logo">${b}</div>`).join('');
    }
  }

  function renderContact() {
    const container = document.getElementById('contactDetails');
    if (!container || !CONFIG?.contact) return;
    const c = CONFIG.contact;
    const s = CONFIG.social || {};
    let html = '';

    if (c.email) {
      html += `
        <div class="contact-detail reveal">
          <div class="contact-detail-icon" aria-hidden="true">📧</div>
          <div>
            <div class="contact-detail-label">Email</div>
            <div class="contact-detail-value"><a href="mailto:${c.email}">${c.email}</a></div>
          </div>
        </div>`;
    }

    if (s.upwork?.url) {
      html += `
        <div class="contact-detail reveal reveal-delay-1">
          <div class="contact-detail-icon" aria-hidden="true">💼</div>
          <div>
            <div class="contact-detail-label">Upwork</div>
            <div class="contact-detail-value"><a href="${s.upwork.url}" target="_blank" rel="noopener">${s.upwork.label}</a></div>
          </div>
        </div>`;
    }

    if (c.responseTime) {
      html += `
        <div class="contact-detail reveal reveal-delay-2">
          <div class="contact-detail-icon" aria-hidden="true">⏱️</div>
          <div>
            <div class="contact-detail-label">Response Time</div>
            <div class="contact-detail-value">${c.responseTime}</div>
          </div>
        </div>`;
    }

    container.innerHTML = html;

    const platforms = ['linkedin', 'github', 'twitter', 'instagram', 'fiverr', 'upwork'];
    const socialContainer = document.getElementById('socialLinks');
    if (socialContainer) {
      socialContainer.innerHTML = platforms
        .filter(p => s[p]?.url)
        .map((p, i) => `
          <a href="${s[p].url}" class="social-link magnetic" title="${s[p].label}" target="_blank" rel="noopener" aria-label="${s[p].label}">${getSocialSvg(p)}</a>
        `).join('');
    }

    const footerSocial = document.getElementById('footerSocialLinks');
    if (footerSocial) {
      const footerPlatforms = ['linkedin', 'github', 'twitter', 'fiverr'];
      footerSocial.innerHTML = footerPlatforms
        .filter(p => s[p]?.url)
        .map(p => `
          <a href="${s[p].url}" class="social-link magnetic" title="${s[p].label}" target="_blank" rel="noopener" aria-label="${s[p].label}">${getSocialSvg(p)}</a>
        `).join('');
    }
  }

  function renderFilters() {
    const container = document.getElementById('workFilters');
    if (!container || !CONFIG?.work?.filters) return;
    const filterMap = { 'All': 'all', 'Web Dev': 'web', 'AI / Automation': 'ai', 'Design': 'design', 'Video': 'video' };
    container.innerHTML = CONFIG.work.filters.map(f => `
      <button class="filter-btn${f === 'All' ? ' active' : ''}" data-filter="${filterMap[f] || f.toLowerCase()}" role="tab" aria-selected="${f === 'All'}">${f}</button>
    `).join('');
  }

  /* ============================================================
     ICON MAPPING
  ============================================================ */
  function getIcon(name) {
    const icons = {
      globe: '🌐',
      bot: '🤖',
      palette: '🎨',
      video: '🎬',
      search: '🔍',
      map: '🗺️',
      zap: '⚡',
      rocket: '🚀',
      link: '🔗',
      package: '📦',
      diamond: '🔷',
      cloud: '☁️'
    };
    return icons[name] || '✨';
  }

  function getSocialSvg(platform) {
    const svgs = {
      linkedin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
      github: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>',
      twitter: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
      instagram: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
      fiverr: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M0 0v24h24V0H0zm14.543 5.543v4.229h1.886v1.886h-1.886v4.457c0 .656.533.754.943.754h.943v1.886h-1.886c-1.748 0-2.829-.952-2.829-2.829v-4.268H9.6V9.772h1.114V7.372c0-.96.638-1.829 1.943-1.829h1.886z"/></svg>',
      upwork: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.561 13.158c-1.102 0-2.135-.467-3.074-1.227l.228-.944.052-.211c.444-1.773.785-3.024 1.885-3.024 1.07 0 1.853 1.055 1.853 2.571 0 1.216-.482 2.835-.944 2.835zM10.828 7.067c.396 1.016 1.08 3.596 1.517 5.088l-.376.193c-.317-.882-.667-1.93-1.027-3.052l-.135.07c-.655 1.657-1.133 2.824-1.9 4.486-.634-1.335-1.274-2.86-1.907-4.355l-.373.186c-.343 1.183-.68 2.227-1.031 3.195C5.165 14.314 4.413 15.1 3.66 15.1c-.617 0-1.1-.437-1.1-1.29 0-2.262 3.419-6.521 4.819-8.403H4.545L2.973 9.938l-.102.164c-1.247 1.878-2.154 3.544-2.154 5.024 0 1.389.87 2.284 2.098 2.284 1.32 0 2.278-.835 3.396-1.996.471-.47.932-1.053 1.401-1.733l.124.48c.769 2.091 1.606 3.664 2.969 3.664 1.023 0 1.852-.695 2.706-1.971.219.687.56 1.254 1.089 1.678 1.164 1.03 2.867 1.394 4.227 1.394 2.277 0 4.211-1.184 4.211-3.354 0-2.422-2.266-4.155-4.226-4.155z"/></svg>'
    };
    return svgs[platform] || '';
  }

  /* ============================================================
     METADATA UPDATE (SEO)
  ============================================================ */
  function updateMetadata() {
    if (!CONFIG) return;
    const site = CONFIG.site || {};
    const author = CONFIG.author || {};

    if (site.title) document.title = site.title;
    if (site.description) {
      let meta = document.querySelector('meta[name="description"]');
      if (meta) meta.content = site.description;
      let og = document.querySelector('meta[property="og:description"]');
      if (og) og.content = site.description;
      let twitter = document.querySelector('meta[name="twitter:description"]');
      if (twitter) twitter.content = site.description;
    }
    if (site.url) {
      let canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.href = site.url;
      let ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl) ogUrl.content = site.url;
    }
    if (site.themeColor) {
      let theme = document.querySelector('meta[name="theme-color"]');
      if (theme) theme.content = site.themeColor;
    }

    // Update JSON-LD structured data
    const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
    ldScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'Person') {
          if (author.name) data.name = author.name;
          if (author.jobTitle) data.jobTitle = author.jobTitle;
          if (site.description) data.description = site.description;
          if (site.url) data.url = site.url;
          const social = CONFIG.social || {};
          data.sameAs = Object.values(social).filter(s => s?.url).map(s => s.url);
        }
        if (data['@type'] === 'WebSite') {
          if (site.title) data.name = site.title;
          if (site.url) data.url = site.url;
          if (site.description) data.description = site.description;
        }
        script.textContent = JSON.stringify(data, null, 2);
      } catch {}
    });
  }

  /* ============================================================
     RENDER ALL (called after config loaded)
  ============================================================ */
  function renderAll() {
    if (!CONFIG) return;
    updateMetadata();
    document.querySelector('html').setAttribute('data-content-loaded', 'true');
    renderHero();
    renderMarquee();
    renderTrusted();
    renderServices();
    renderFilters();
    renderProjects();
    renderProcess();
    renderSkills();
    renderTestimonials();
    renderPricing();
    renderFaq();
    renderContact();
    initFilters();
    initMobileCta();
    initCounters();
    initSkillBars();
    initReveal();
  }

  /* ============================================================
     INITIALIZATION
  ============================================================ */
  document.addEventListener('DOMContentLoaded', () => {
    const hasConfig = loadConfig();

    initLoader();
    initCursor();
    initMagnetic();
    initParticles();
    initNavScroll();
    initMobileMenu();
    initSmoothScroll();
    initReveal();
    initSkillBars();
    initCounters();
    initFaq();
    initContactForm();
    initMarquee();
    initTilt();
    initActiveNav();
    setCurrentYear();

    if (CONFIG) {
      renderAll();
    }
  });

})();
