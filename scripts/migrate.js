// scripts/migrate.js
require('dotenv').config();
const pool = require('../lib/db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email         TEXT UNIQUE NOT NULL,
        username      TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'user',
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT role_check CHECK (role IN ('user', 'admin'))
      );

      CREATE TABLE IF NOT EXISTS books (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_shared   BOOLEAN NOT NULL DEFAULT FALSE,
        title       TEXT NOT NULL,
        word_count  INTEGER NOT NULL DEFAULT 0,
        has_warning BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS progress (
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        word_index  INTEGER NOT NULL DEFAULT 0,
        wpm         INTEGER NOT NULL DEFAULT 300,
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, book_id)
      );

      CREATE INDEX IF NOT EXISTS books_owner_idx  ON books(owner_id);
      CREATE INDEX IF NOT EXISTS books_shared_idx ON books(is_shared);
      CREATE INDEX IF NOT EXISTS progress_user_idx ON progress(user_id);
    `);
    console.log('Migration complete');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
