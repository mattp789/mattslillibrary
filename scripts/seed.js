// scripts/seed.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../lib/db');

async function seed() {
  const { ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error('Set ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_PASSWORD env vars before seeding');
    process.exit(1);
  }
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const { rowCount } = await pool.query(
    `INSERT INTO users (email, username, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [ADMIN_EMAIL, ADMIN_USERNAME, hash]
  );
  console.log(rowCount ? `Admin ${ADMIN_USERNAME} created` : 'Admin already exists');
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
