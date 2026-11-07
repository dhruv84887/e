import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import { rateLimit } from 'express-rate-limit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import authRoutes from './routes/authRoutes.js'
import catalogRoutes from './routes/catalogRoutes.js'
import commerceRoutes from './routes/commerceRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import storeRoutes from './routes/storeRoutes.js'
import webhookRoutes from './routes/webhookRoutes.js'
import { errorHandler, notFound } from './middleware/errors.js'
import { requestOriginGuard } from './middleware/requestOrigin.js'

const app = express()
const clientOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim())
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(helmet({ crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], baseUri: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'self'"], imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://res.cloudinary.com', 'https://*.razorpay.com'], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'], scriptSrc: ["'self'", 'https://checkout.razorpay.com'], connectSrc: ["'self'", 'https://*.razorpay.com'], frameSrc: ["'self'", 'https://*.razorpay.com'] } } }))
app.use(cors({ origin: clientOrigins, credentials: true }))
app.use('/api', requestOriginGuard(clientOrigins))
app.use(express.json({ limit: '1mb', verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer) } }))
app.use(express.urlencoded({ extended: false, limit: '1mb' }))
app.use(cookieParser())
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'))
app.get('/api/health', (req, res) => res.json({ status: 'ok', database: globalThis.mongoReady ? 'connected' : 'disconnected', time: new Date().toISOString() }))
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false }), authRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api', catalogRoutes)
app.use('/api', storeRoutes)
app.use('/api', commerceRoutes)
app.use('/api/admin', adminRoutes)
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')
  app.use(express.static(clientDist, { index: false, setHeaders: (res, filePath) => {
    if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  } }))
  app.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => res.sendFile(path.join(clientDist, 'index.html'), (error) => { if (error) next(error) }))
}
app.use(notFound)
app.use(errorHandler)
export default app
