const express = require('express');
const router = express.Router();
const { getConfig, saveConfig, getDb } = require('./db');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_EXPIRY = '24h';

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '..', 'public', 'assets', file.mimetype.startsWith('video') ? 'videos' : 'images');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, Date.now() + '-' + uuidv4().slice(0, 8) + ext);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
});

/* ============================================================
   AUTH
============================================================ */
router.post('/auth', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin', iat: Date.now() }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid password' });
});

router.get('/auth/verify', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    jwt.verify(auth.split(' ')[1], JWT_SECRET);
    res.json({ valid: true });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/* ============================================================
   CONFIG
============================================================ */
router.get('/config', async (req, res) => {
  try {
    const config = await getConfig();
    if (config) return res.json(config);
    const cfgPath = path.join(__dirname, '..', 'config.json');
    if (fs.existsSync(cfgPath)) {
      return res.json(JSON.parse(fs.readFileSync(cfgPath, 'utf8')));
    }
    res.json({});
  } catch {
    res.status(500).json({ error: 'Failed to load config' });
  }
});

router.patch('/config', requireAuth, async (req, res) => {
  try {
    const updates = req.body;
    const current = await getConfig() || {};

    function deepMerge(a, b) {
      const result = { ...a };
      for (const k in b) {
        if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k]) {
          result[k] = deepMerge(a[k], b[k]);
        } else {
          result[k] = b[k];
        }
      }
      return result;
    }

    const merged = deepMerge(current, updates);
    const saved = await saveConfig(merged);

    if (saved) {
      res.json({ success: true });
    } else {
      const cfgPath = path.join(__dirname, '..', 'config.json');
      if (fs.existsSync(cfgPath)) {
        const fileCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        const finalCfg = deepMerge(fileCfg, updates);
        fs.writeFileSync(cfgPath, JSON.stringify(finalCfg, null, 2));
        return res.json({ success: true, note: 'Saved to local file' });
      }
      res.status(500).json({ error: 'Failed to save config' });
    }
  } catch {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

/* ============================================================
   CONTACT FORM
============================================================ */
const contactRateLimit = new Map();

router.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, service, budget, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const last = contactRateLimit.get(ip);
    if (last && now - last < 60000) {
      return res.status(429).json({ error: 'Please wait before sending another message' });
    }
    contactRateLimit.set(ip, now);
    if (contactRateLimit.size > 1000) contactRateLimit.clear();

    const db = getDb();
    let saved = false;

    if (db) {
      const { error } = await db.from('contacts').insert({
        name, email, phone: phone || '', service: service || '',
        budget: budget || '', message
      });
      if (!error) saved = true;
    }

    if (!saved) {
      const dataDir = path.join(__dirname, '..', 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      const logPath = path.join(dataDir, 'messages.json');
      let messages = [];
      try { messages = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch {}
      messages.push({ name, email, phone, service, budget, message, created_at: new Date().toISOString() });
      fs.writeFileSync(logPath, JSON.stringify(messages, null, 2));
    }

    try {
      const nodemailer = require('nodemailer');
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: process.env.CONTACT_EMAIL || email,
          subject: `New Inquiry from ${name}`,
          text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nService: ${service}\nBudget: ${budget}\n\nMessage:\n${message}`
        });
      }
    } catch {}

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/contact/admin', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (db) {
      const { data } = await db.from('contacts').select('*').order('created_at', { ascending: false }).limit(100);
      if (data) return res.json(data);
    }
    const logPath = path.join(__dirname, '..', 'data', 'messages.json');
    if (fs.existsSync(logPath)) {
      return res.json(JSON.parse(fs.readFileSync(logPath, 'utf8')));
    }
    res.json([]);
  } catch {
    res.json([]);
  }
});

/* ============================================================
   PROJECTS
============================================================ */
router.get('/projects', async (req, res) => {
  try {
    const db = getDb();
    if (db) {
      const { data } = await db.from('projects').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
      if (data) return res.json(data);
    }
    const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
    if (fs.existsSync(projectsPath)) {
      return res.json(JSON.parse(fs.readFileSync(projectsPath, 'utf8')));
    }
    res.json([]);
  } catch {
    res.json([]);
  }
});

router.post('/projects', requireAuth, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  try {
    const project = {
      title: req.body.title || 'Untitled',
      description: req.body.description || '',
      category: req.body.category || 'web',
      tags: typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : (req.body.tags || []),
      year: req.body.year || '',
      link: req.body.link || '#contact',
      featured: req.body.featured === 'true' || req.body.featured === true
    };

    if (req.files?.image?.[0]) {
      project.image = '/assets/images/' + req.files.image[0].filename;
    }
    if (req.files?.video?.[0]) {
      project.video = '/assets/videos/' + req.files.video[0].filename;
    }

    const db = getDb();
    if (db) {
      const { data } = await db.from('projects').insert(project).select().single();
      if (data) return res.json(data);
    }

    const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
    let projects = [];
    try { projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8')); } catch {}
    project.id = uuidv4();
    projects.unshift(project);
    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
    res.json(project);
  } catch {
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.put('/projects/:id', requireAuth, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  try {
    const updates = {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      tags: typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : (req.body.tags || []),
      year: req.body.year,
      link: req.body.link,
      featured: req.body.featured === 'true' || req.body.featured === true
    };

    if (req.files?.image?.[0]) updates.image = '/assets/images/' + req.files.image[0].filename;
    if (req.files?.video?.[0]) updates.video = '/assets/videos/' + req.files.video[0].filename;

    const db = getDb();
    if (db) {
      const { data } = await db.from('projects').update(updates).eq('id', req.params.id).select().single();
      if (data) return res.json(data);
    }

    const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
    let projects = [];
    try { projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8')); } catch {}
    const idx = projects.findIndex(p => p.id === req.params.id);
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], ...updates };
      fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
    }
    res.json(updates);
  } catch {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/projects/:id', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    if (db) {
      const { error } = await db.from('projects').delete().eq('id', req.params.id);
      if (!error) return res.json({ success: true });
    }

    const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
    let projects = [];
    try { projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8')); } catch {}
    projects = projects.filter(p => p.id !== req.params.id);
    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

/* ============================================================
   UPLOAD (general purpose)
============================================================ */
router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const basePath = req.file.mimetype.startsWith('video') ? '/assets/videos/' : '/assets/images/';
  res.json({ url: basePath + req.file.filename });
});

module.exports = router;
