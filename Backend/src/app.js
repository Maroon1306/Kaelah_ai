import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { errorHandler } from './middleware/errorHandler.js'

import { authRouter } from './modules/auth/auth.routes.js'
import { profileRouter } from './modules/profile/profile.routes.js'
import { teamRouter } from './modules/team/team.routes.js'
import { conversationsRouter, chatRouter, actionsRouter } from './modules/conversations/conversations.routes.js'
import { connectorsRouter } from './modules/connectors/connectors.routes.js'
import { seoRouter, geoRouter } from './modules/seo/seo.routes.js'
import { analyticsRouter } from './modules/analytics/analytics.routes.js'
import { automationsRouter } from './modules/automations/automations.routes.js'
import { billingRouter, billingWebhookRouter } from './modules/billing/billing.routes.js'
import { webhooksRouter } from './modules/webhooks/webhooks.routes.js'
import { uploadsRouter } from './modules/uploads/uploads.routes.js'
import { reportsRouter } from './modules/reports/reports.routes.js'
import { agentRouter } from './modules/agent/agent.routes.js'
import { notificationsRouter } from './modules/notifications/push.routes.js'

export const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
app.use(cookieParser())

// Webhook routes need the raw request body for signature verification. The raw
// parser is scoped to the exact webhook path only (not the whole /api/billing
// prefix) so it doesn't swallow the body of the other JSON routes below.
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }), billingWebhookRouter)
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRouter)

app.use(express.json())

app.get('/health', (req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/profile', profileRouter)
app.use('/api/team', teamRouter)
app.use('/api/conversations', conversationsRouter)
app.use('/api/chat', chatRouter)
app.use('/api/actions', actionsRouter)
app.use('/api/connectors', connectorsRouter)
app.use('/api/seo', seoRouter)
app.use('/api/geo', geoRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/automations', automationsRouter)
app.use('/api/billing', billingRouter)
app.use('/api/uploads', uploadsRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/agent', agentRouter)
app.use('/api/notifications', notificationsRouter)

app.use((req, res) => res.status(404).json({ error: 'Route introuvable.' }))
app.use(errorHandler)
