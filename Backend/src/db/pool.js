import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL is not set — the API will fail on any DB query until it is configured in Backend/.env')
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
})

// Neon (like most serverless Postgres) drops idle connections; without this
// handler, that drop surfaces as an uncaught 'error' event on the pool and
// crashes the whole process. pg recycles the broken client automatically —
// this only needs to stop the crash.
pool.on('error', (err) => {
  console.error('[db] idle client error (connection recycled):', err.message)
})

export async function query(text, params) {
  return pool.query(text, params)
}
