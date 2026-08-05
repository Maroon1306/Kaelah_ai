import { v2 as cloudinary } from 'cloudinary'
import { pool } from '../../db/pool.js'
import { HttpError } from '../../middleware/errorHandler.js'

let configured = false

function ensureConfigured() {
  if (configured) return
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new HttpError(503, "Cloudinary n'est pas configuré côté serveur (CLOUDINARY_* manquants).")
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
  configured = true
}

function streamUpload(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'auto' }, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
    stream.end(buffer)
  })
}

export async function uploadFile(companyId, file) {
  ensureConfigured()
  const result = await streamUpload(file.buffer, `kaelah/${companyId}`)

  const { rows } = await pool.query(
    'INSERT INTO uploads (company_id, file_name, file_url, file_type) VALUES ($1, $2, $3, $4) RETURNING *',
    [companyId, file.originalname, result.secure_url, file.mimetype]
  )
  return rows[0]
}

export async function listUploads(companyId) {
  const { rows } = await pool.query('SELECT * FROM uploads WHERE company_id = $1 ORDER BY created_at DESC', [companyId])
  return rows
}
