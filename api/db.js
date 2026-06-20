const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;

function getDb() {
  if (!supabase && supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
  }
  return supabase;
}

async function getConfig() {
  const db = getDb();
  if (db) {
    const { data } = await db.from('site_config').select('config').eq('id', 1).single();
    if (data) return data.config;
  }
  try {
    const fs = require('fs');
    const path = require('path');
    const cfgPath = path.join(__dirname, '..', 'config.json');
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    }
  } catch {}
  return null;
}

async function saveConfig(config) {
  const db = getDb();
  if (db) {
    const { error } = await db.from('site_config').upsert({ id: 1, config, updated_at: new Date() });
    if (!error) return true;
  }
  return false;
}

module.exports = { getDb, getConfig, saveConfig };
