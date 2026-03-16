/**
 * Database Migration Runner for WhatsApp Assistant Bot
 * 
 * This script checks and applies migrations to the user's database on app startup.
 * It ensures the database schema stays in sync with the app version.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Migration definitions - add new migrations here as the schema evolves
const MIGRATIONS = [
  {
    version: 1,
    name: 'add_google_oauth_login',
    description: 'Add googleId column for Google OAuth login',
    check: (db) => {
      // Check if googleId column exists in User table
      const columns = db.prepare("PRAGMA table_info(User)").all();
      return columns.some(col => col.name === 'googleId');
    },
    up: (db) => {
      // Make password nullable and add googleId
      // SQLite doesn't support ALTER COLUMN, but we can add new columns
      const columns = db.prepare("PRAGMA table_info(User)").all();
      
      // Add googleId if it doesn't exist
      if (!columns.some(col => col.name === 'googleId')) {
        db.exec("ALTER TABLE User ADD COLUMN googleId TEXT");
        console.log('  Added googleId column to User table');
      }
      
      // Create unique index on googleId if it doesn't exist
      try {
        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS User_googleId_key ON User(googleId)");
        console.log('  Created unique index on googleId');
      } catch (e) {
        // Index may already exist
      }
    },
  },
  {
    version: 2,
    name: 'add_voice_config_openai_fields',
    description: 'Add OpenAI TTS fields to VoiceConfig',
    check: (db) => {
      // Check if VoiceConfig table exists first
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='VoiceConfig'").all();
      if (tables.length === 0) return true; // Table doesn't exist yet, skip
      
      const columns = db.prepare("PRAGMA table_info(VoiceConfig)").all();
      return columns.some(col => col.name === 'openaiVoice');
    },
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(VoiceConfig)").all();
      const columnNames = columns.map(col => col.name);
      
      // Add OpenAI TTS columns if they don't exist
      if (!columnNames.includes('openaiVoice')) {
        db.exec("ALTER TABLE VoiceConfig ADD COLUMN openaiVoice TEXT DEFAULT 'nova'");
        console.log('  Added openaiVoice column to VoiceConfig table');
      }
      if (!columnNames.includes('openaiModel')) {
        db.exec("ALTER TABLE VoiceConfig ADD COLUMN openaiModel TEXT DEFAULT 'tts-1'");
        console.log('  Added openaiModel column to VoiceConfig table');
      }
      if (!columnNames.includes('openaiSpeed')) {
        db.exec("ALTER TABLE VoiceConfig ADD COLUMN openaiSpeed REAL DEFAULT 1.0");
        console.log('  Added openaiSpeed column to VoiceConfig table');
      }
      if (!columnNames.includes('callsEnabled')) {
        db.exec("ALTER TABLE VoiceConfig ADD COLUMN callsEnabled INTEGER DEFAULT 0");
        console.log('  Added callsEnabled column to VoiceConfig table');
      }
      if (!columnNames.includes('callWebhookUrl')) {
        db.exec("ALTER TABLE VoiceConfig ADD COLUMN callWebhookUrl TEXT");
        console.log('  Added callWebhookUrl column to VoiceConfig table');
      }
    },
  },
  {
    version: 3,
    name: 'add_voice_config_call_fields',
    description: 'Add Twilio call TTS provider, Polly voice, recording, greeting, system prompt, language columns to VoiceConfig',
    check: (db) => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='VoiceConfig'").all();
      if (tables.length === 0) return true;
      
      const columns = db.prepare("PRAGMA table_info(VoiceConfig)").all();
      return columns.some(col => col.name === 'callTtsProvider');
    },
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(VoiceConfig)").all();
      const columnNames = columns.map(col => col.name);
      
      if (!columnNames.includes('callGreeting')) {
        db.exec("ALTER TABLE VoiceConfig ADD COLUMN callGreeting TEXT");
        console.log('  Added callGreeting column');
      }
      if (!columnNames.includes('callSystemPrompt')) {
        db.exec("ALTER TABLE VoiceConfig ADD COLUMN callSystemPrompt TEXT");
        console.log('  Added callSystemPrompt column');
      }
      if (!columnNames.includes('callLanguage')) {
        db.exec("ALTER TABLE VoiceConfig ADD COLUMN callLanguage TEXT DEFAULT 'en-US'");
        console.log('  Added callLanguage column');
      }
      if (!columnNames.includes('callTtsProvider')) {
        db.exec("ALTER TABLE VoiceConfig ADD COLUMN callTtsProvider TEXT DEFAULT 'twilio'");
        console.log('  Added callTtsProvider column');
      }
      if (!columnNames.includes('callVoiceId')) {
        db.exec("ALTER TABLE VoiceConfig ADD COLUMN callVoiceId TEXT");
        console.log('  Added callVoiceId column');
      }
      if (!columnNames.includes('callPollyVoice')) {
        db.exec("ALTER TABLE VoiceConfig ADD COLUMN callPollyVoice TEXT DEFAULT 'Polly.Joanna-Neural'");
        console.log('  Added callPollyVoice column');
      }
      if (!columnNames.includes('callRecordingEnabled')) {
        db.exec("ALTER TABLE VoiceConfig ADD COLUMN callRecordingEnabled INTEGER DEFAULT 0");
        console.log('  Added callRecordingEnabled column');
      }
    },
  },
  {
    version: 4,
    name: 'add_call_log_analysis',
    description: 'Add analysis column to CallLog for AI call analysis',
    check: (db) => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='CallLog'").all();
      if (tables.length === 0) return true;
      
      const columns = db.prepare("PRAGMA table_info(CallLog)").all();
      return columns.some(col => col.name === 'analysis');
    },
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(CallLog)").all();
      if (!columns.some(col => col.name === 'analysis')) {
        db.exec("ALTER TABLE CallLog ADD COLUMN analysis TEXT");
        console.log('  Added analysis column to CallLog');
      }
    },
  },
];

/**
 * Run database migrations
 * @param {string} dbPath - Path to the SQLite database file
 * @returns {{ applied: number, skipped: number, errors: string[] }}
 */
function runMigrations(dbPath) {
  const result = { applied: 0, skipped: 0, errors: [] };
  
  if (!fs.existsSync(dbPath)) {
    console.log('Database not found, will be created from template');
    return result;
  }
  
  let db;
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    
    console.log(`Running migrations on: ${dbPath}`);
    
    // Create migrations tracking table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    for (const migration of MIGRATIONS) {
      console.log(`Checking migration ${migration.version}: ${migration.name}`);
      
      // Check if migration was already recorded
      const recorded = db.prepare("SELECT * FROM _migrations WHERE version = ?").get(migration.version);
      
      if (recorded) {
        console.log(`  Already applied (recorded)`);
        result.skipped++;
        continue;
      }
      
      // Check if migration is already applied (by checking schema)
      const alreadyApplied = migration.check(db);
      
      if (alreadyApplied) {
        console.log(`  Already applied (schema check), recording...`);
        db.prepare("INSERT INTO _migrations (version, name) VALUES (?, ?)").run(migration.version, migration.name);
        result.skipped++;
        continue;
      }
      
      // Apply the migration
      try {
        console.log(`  Applying migration...`);
        db.exec('BEGIN TRANSACTION');
        migration.up(db);
        db.prepare("INSERT INTO _migrations (version, name) VALUES (?, ?)").run(migration.version, migration.name);
        db.exec('COMMIT');
        console.log(`  Migration ${migration.version} applied successfully`);
        result.applied++;
      } catch (err) {
        db.exec('ROLLBACK');
        const errorMsg = `Migration ${migration.version} failed: ${err.message}`;
        console.error(`  ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }
    
    console.log(`Migrations complete: ${result.applied} applied, ${result.skipped} skipped, ${result.errors.length} errors`);
    
  } catch (err) {
    result.errors.push(`Database error: ${err.message}`);
    console.error('Migration runner error:', err);
  } finally {
    if (db) {
      db.close();
    }
  }
  
  return result;
}

// If run directly from command line
if (require.main === module) {
  const dbPath = process.argv[2];
  if (!dbPath) {
    console.error('Usage: node migrate.js <path-to-database>');
    process.exit(1);
  }
  const result = runMigrations(dbPath);
  process.exit(result.errors.length > 0 ? 1 : 0);
}

module.exports = { runMigrations, MIGRATIONS };
