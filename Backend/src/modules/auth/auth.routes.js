import { Router } from 'express'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { requireAuth } from '../../middleware/auth.js'
import * as authController from './auth.controller.js'

export const authRouter = Router()

authRouter.post('/register', asyncHandler(authController.register))
authRouter.post('/login', asyncHandler(authController.login))
authRouter.post('/refresh', asyncHandler(authController.refresh))
authRouter.post('/logout', asyncHandler(authController.logout))
authRouter.get('/me', requireAuth, asyncHandler(authController.me))
authRouter.put('/password', requireAuth, asyncHandler(authController.changePassword))
authRouter.post('/verify-email', requireAuth, asyncHandler(authController.verifyEmail))
authRouter.post('/resend-otp', requireAuth, asyncHandler(authController.resendOtp))
