import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import { HttpError } from '../../middleware/errorHandler.js'
import * as seoService from './seo.service.js'

export const seoRouter = Router()

seoRouter.use(requireAuth)

seoRouter.post('/analyze', asyncHandler(async (req, res) => {
  const { url } = req.body
  if (!url) throw new HttpError(400, 'Une URL est requise.')
  const result = await seoService.analyzeUrl(url)
  res.json(result)
}))

seoRouter.post('/optimize', asyncHandler(async (req, res) => {
  const { url } = req.body
  if (!url) throw new HttpError(400, 'Une URL est requise.')
  const result = await seoService.optimizePage(url)
  res.json(result)
}))

export const geoRouter = Router()
geoRouter.use(requireAuth)
geoRouter.post('/optimize', asyncHandler(async (req, res) => {
  const { url } = req.body
  if (!url) throw new HttpError(400, 'Une URL est requise.')
  const result = await seoService.optimizeForGeo(url)
  res.json(result)
}))
