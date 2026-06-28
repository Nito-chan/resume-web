const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const SCHEMA = require('./schema');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'outreach.db');

let db = null;

class PreparedStatement {
  constructor(sql) {
    this.sql = sql;
    this.dbInst = db;
  }

  run(...params) {
    this.dbInst.run(this.sql, params);
    saveDb();
    const rowidResult = this.dbInst.exec("SELECT last_insert_rowid() as id");
    const rowid = rowidResult[0]?.values[0][0];
    return { lastInsertRowid: rowid !== undefined ? Number(rowid) : 0 };
  }

  get(...params) {
    const stmt = this.dbInst.prepare(this.sql);
    if (!stmt) return undefined;
    stmt.bind(params);
    if (stmt.step()) {
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      stmt.free();
      return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
    }
    stmt.free();
    return undefined;
  }

  all(...params) {
    const stmt = this.dbInst.prepare(this.sql);
    if (!stmt) return [];
    stmt.bind(params);
    const results = [];
    const cols = stmt.getColumnNames();
    while (stmt.step()) {
      const vals = stmt.get();
      results.push(Object.fromEntries(cols.map((c, i) => [c, vals[i]])));
    }
    stmt.free();
    return results;
  }
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function seedDefaults() {
  const defaultSettings = {
    'cleaning_initial_template': `Hi {name},

I came across {company} in {city} and noticed you might not have a website yet.

We recently built a professional cleaning service website that's been helping them get significantly more online bookings — check it out: {demo_link}

Would you be open to a quick chat about what we could do for {company}?

Best,
Nito`,
    'cleaning_followup1_template': `Hey {name},

Just following up on my last message. I'd love to show you what a professional website could do for {company}'s growth in {city}.

The demo is still live at {demo_link} — let me know if you're interested.

Best,
Nito`,
    'cleaning_followup2_template': `Hi {name},

Wanted to reach out one more time. We have capacity next week to start on new projects, and I think {company} could really benefit from a modern website.

Check out the demo: {demo_link}

Let me know,
Nito`,
    'cleaning_closing_template': `Last message from me, {name}.

If you ever want to grow {company} online with a professional website, feel free to reach out anytime. Wishing you all the best.

Demo: {demo_link}

Cheers,
Nito`,
    'cleaning_instagram_template': `Hey {name}! 👋

I came across {company} and saw you guys don't have a website yet. We just built this cleaning site for a client — check it out: {demo_link}

Would love to help {company} get online and start getting more bookings. Let me know! 🙌`,
    'dental_initial_template': `Hi {name},

I came across {company} in {city} and noticed your online presence could use some improvement.

We recently built a modern dental website that's helping a clinic get significantly more online bookings and patient inquiries — check it out: {demo_link2}

Here's another example we designed: {demo_link}

Would you be open to a quick chat about what we could do for {company}?

Best,
Nito`,
    'dental_followup1_template': `Hey {name},

Just following up on my last message. I'd love to show you what a professional dental website could do for {company}'s patient growth in {city}.

The latest project is still live at {demo_link2} — and we have another at {demo_link}. Let me know if you're interested.

Best,
Nito`,
    'dental_followup2_template': `Hi {name},

Wanted to reach out one more time. We have capacity next week to start on new projects, and I think {company} could really benefit from a modern website that attracts more patients.

Check out our latest work: {demo_link2} — and another example here: {demo_link}

Let me know,
Nito`,
    'dental_closing_template': `Last message from me, {name}.

If you ever want to grow {company} online with a professional dental website, feel free to reach out anytime. Wishing you all the best.

Demos: {demo_link2} / {demo_link}

Cheers,
Nito`,
    'dental_instagram_template': `Hey {name}! 👋

I came across {company} and saw your online presence could use a refresh. We've built dental clinic websites like these — check them out:
{demo_link2}
{demo_link}

Would love to help {company} attract more patients online. Let me know! 🙌`
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    try {
      db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    } catch (e) {}
  }
}

function runMigrations() {
  const migrations = [
    "ALTER TABLE leads ADD COLUMN niche TEXT DEFAULT 'cleaning'",
    "ALTER TABLE campaigns ADD COLUMN niche TEXT DEFAULT 'cleaning'"
  ];
  for (const sql of migrations) {
    try { db.run(sql); } catch (e) {}
  }
}

async function initDb() {
  if (db) return db;

  const SQL = await initSqlJs();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  const statements = SCHEMA.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    try { db.run(stmt + ';'); } catch (e) {}
  }

  runMigrations();

  seedDefaults();
  saveDb();

  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return {
    prepare(sql) {
      return new PreparedStatement(sql);
    },
    run(sql, params) {
      const result = db.run(sql, params || []);
      saveDb();
      return result;
    },
    exec(sql) {
      return db.exec(sql);
    }
  };
}

function close() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

module.exports = { initDb, getDb, close };
