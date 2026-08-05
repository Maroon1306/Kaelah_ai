import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to Backend/.env before running migrations.')
    process.exit(1)
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  const { rows: applied } = await pool.query('SELECT name FROM _migrations')
  const appliedNames = new Set(applied.map((r) => r.name))

  for (const file of files) {
    if (appliedNames.has(file)) continue
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`Applied migration: ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`Failed migration: ${file}`)
      throw err
    } finally {
      client.release()
    }
  }

  console.log('Migrations up to date.')
  await pool.end()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
