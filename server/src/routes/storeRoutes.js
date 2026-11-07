import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'
import { asyncHandler } from '../utils/http.js'
import Banner from '../models/Banner.js'
import Subscriber from '../models/Subscriber.js'
import ContactMessage from '../models/ContactMessage.js'
import Review from '../models/Review.js'
import { storeCurrencyCode } from '../utils/storeConfig.js'

const router = Router()
router.get('/config', (req, res) => {
  const currency = storeCurrencyCode()
  const numberSetting = (name, fallback) => {
    const value = Number(process.env[name] ?? fallback)
    return Number.isFinite(value) && value >= 0 ? value : fallback
  }
  res.json({
    name: process.env.STORE_NAME || 'Atelier', logoUrl: process.env.STORE_LOGO_URL || '',
    primaryColor: /^#[0-9a-f]{6}$/i.test(process.env.STORE_PRIMARY_COLOR || '') ? process.env.STORE_PRIMARY_COLOR : '#353d32',
    accentColor: /^#[0-9a-f]{6}$/i.test(process.env.STORE_ACCENT_COLOR || '') ? process.env.STORE_ACCENT_COLOR : '#b87860',
    currency, taxRate: numberSetting('TAX_RATE', 0.05), shippingFlat: numberSetting('SHIPPING_FLAT', 99),
    freeShippingFrom: numberSetting('FREE_SHIPPING_FROM', 4999), razorpayEnabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET), email: process.env.STORE_EMAIL || 'hello@atelier.store',
    phone: process.env.STORE_PHONE || '+91 98765 43210', address: process.env.STORE_ADDRESS || 'Mumbai, India',
    instagramUrl: process.env.STORE_INSTAGRAM_URL || 'https://www.instagram.com/'
  })
})
router.get('/banners', asyncHandler(async (req, res) => { const now = new Date(); const banners = await Banner.find({ isActive: true, $and: [{ $or: [{ startsAt: null }, { startsAt: { $lte: now } }] }, { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] }] }).sort({ sortOrder: 1 }).lean(); res.json({ banners }) }))
router.get('/reviews', asyncHandler(async (req, res) => { const reviews = await Review.find({ isPublished: true }).populate('user', 'name').populate('product', 'name slug').sort({ createdAt: -1 }).limit(4).lean(); res.json({ reviews }) }))
router.post('/newsletter', validate(z.object({ email: z.string().email() })), asyncHandler(async (req, res) => { await Subscriber.updateOne({ email: req.body.email.toLowerCase() }, { $set: { isActive: true }, $setOnInsert: { email: req.body.email.toLowerCase() } }, { upsert: true }); res.status(201).json({ message: 'You’re on the list. Look out for a note from us soon.' }) }))
router.post('/contact', validate(z.object({ name: z.string().trim().min(2).max(100), email: z.string().email(), subject: z.string().trim().min(2).max(160), message: z.string().trim().min(10).max(5000) })), asyncHandler(async (req, res) => { await ContactMessage.create(req.body); res.status(201).json({ message: 'Thanks for writing. Our team will get back to you shortly.' }) }))
export default router
