import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { razorpayWebhook } from '../controllers/webhookController.js'

const router = Router()
router.post('/razorpay', rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }), razorpayWebhook)
export default router
