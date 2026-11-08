import { Router } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { v2 as cloudinary } from 'cloudinary'
import { protect, adminOnly } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { productSchema, productUpdateSchema, categorySchema } from '../validators/index.js'
import { asyncHandler } from '../utils/http.js'
import { overview, adminProducts, createProduct, updateProduct, deleteProduct, createCategory, updateCategory, deleteCategory, adminOrders, updateOrder, customers, customerDetails, updateCustomerStatus, adminReviews, contactMessages, updateContactMessage, adminSubscribers, updateSubscriber, coupons, createCoupon, updateCoupon, deleteCoupon, banners, createBanner, updateBanner, deleteBanner, moderateReview } from '../controllers/adminController.js'
import Category from '../models/Category.js'

const router = Router(), upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 }, fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|avif)$/.test(file.mimetype)) })
const couponCreateSchema = z.object({ code: z.string().trim().min(2).max(40), type: z.enum(['percent', 'fixed']), value: z.coerce.number().positive(), minSubtotal: z.coerce.number().min(0).optional(), maxDiscount: z.coerce.number().positive().optional(), usageLimit: z.coerce.number().int().positive().optional(), startsAt: z.coerce.date().optional(), expiresAt: z.coerce.date().optional(), isActive: z.boolean().optional() }).superRefine((coupon, context) => { if (coupon.type === 'percent' && coupon.value > 100) context.addIssue({ code: 'custom', path: ['value'], message: 'Percentage discounts cannot exceed 100%.' }) })
router.use(protect, adminOnly)
router.get('/overview', overview)
router.get('/products', adminProducts)
router.post('/products', validate(productSchema), createProduct)
router.patch('/products/:id', validate(productUpdateSchema), updateProduct)
router.delete('/products/:id', deleteProduct)
router.get('/categories', asyncHandler(async (req, res) => res.json({ categories: await Category.find().sort({ sortOrder: 1, name: 1 }).lean() })))
router.post('/categories', validate(categorySchema), createCategory)
router.patch('/categories/:id', validate(categorySchema.partial()), updateCategory)
router.delete('/categories/:id', deleteCategory)
router.get('/orders', adminOrders)
router.patch('/orders/:id', validate(z.object({ status: z.string(), trackingNumber: z.string().max(100).optional(), trackingUrl: z.string().url().optional() })), updateOrder)
router.get('/customers', customers)
router.get('/customers/:id', customerDetails)
router.patch('/customers/:id', validate(z.object({ isActive: z.boolean() })), updateCustomerStatus)
router.get('/reviews', adminReviews)
router.get('/communications/messages', contactMessages)
router.patch('/communications/messages/:id', validate(z.object({ status: z.enum(['new', 'read', 'resolved']) })), updateContactMessage)
router.get('/communications/subscribers', adminSubscribers)
router.patch('/communications/subscribers/:id', validate(z.object({ isActive: z.boolean() })), updateSubscriber)
router.get('/coupons', coupons)
router.post('/coupons', validate(couponCreateSchema), createCoupon)
router.patch('/coupons/:id', validate(z.object({ isActive: z.boolean().optional(), type: z.enum(['percent', 'fixed']).optional(), value: z.coerce.number().positive().optional(), minSubtotal: z.coerce.number().min(0).optional(), maxDiscount: z.union([z.null(), z.coerce.number().positive()]).optional(), expiresAt: z.union([z.null(), z.coerce.date()]).optional(), usageLimit: z.union([z.null(), z.coerce.number().int().positive()]).optional() })), updateCoupon)
router.delete('/coupons/:id', deleteCoupon)
router.get('/banners', banners)
router.post('/banners', validate(z.object({ title: z.string().trim().min(2), subtitle: z.string().optional(), image: z.string().url(), href: z.string().optional(), placement: z.enum(['hero', 'promo', 'collection']).optional(), isActive: z.boolean().optional(), sortOrder: z.coerce.number().optional(), startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional() })), createBanner)
router.patch('/banners/:id', validate(z.object({ title: z.string().optional(), subtitle: z.string().optional(), image: z.string().url().optional(), href: z.string().optional(), placement: z.enum(['hero', 'promo', 'collection']).optional(), isActive: z.boolean().optional(), sortOrder: z.coerce.number().optional(), startsAt: z.coerce.date().optional(), endsAt: z.coerce.date().optional() })), updateBanner)
router.delete('/banners/:id', deleteBanner)
router.patch('/reviews/:id', validate(z.object({ isPublished: z.boolean() })), moderateReview)
router.post('/upload', upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose a JPG, PNG, WebP or AVIF image under 6 MB.' })
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return res.status(503).json({ message: 'Image uploads are not configured. Add Cloudinary credentials to the server environment.' })
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET })
  const result = await new Promise((resolve, reject) => { const stream = cloudinary.uploader.upload_stream({ folder: 'atelier/products', resource_type: 'image', transformation: [{ width: 1800, height: 1800, crop: 'limit', quality: 'auto', fetch_format: 'auto' }] }, (error, uploaded) => error ? reject(error) : resolve(uploaded)); stream.end(req.file.buffer) })
  res.status(201).json({ url: result.secure_url, publicId: result.public_id })
}))
export default router
