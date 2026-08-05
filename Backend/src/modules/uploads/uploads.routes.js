import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import { upload } from '../../middleware/upload.js'
import { HttpError } from '../../middleware/errorHandler.js'
import * as uploadsService from './uploads.service.js'

export const uploadsRouter = Router()

uploadsRouter.use(requireAuth)

uploadsRouter.get('/', asyncHandler(async (req, res) => {
  if (!req.company) return res.json({ uploads: [] })
  res.json({ uploads: await uploadsService.listUploads(req.company.id) })
}))

uploadsRouter.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Aucun fichier reçu.')
  if (!req.company) throw new HttpError(400, 'Aucune entreprise associée à ce compte.')
  const record = await uploadsService.uploadFile(req.company.id, req.file)
  res.status(201).json({ upload: record })
}))
