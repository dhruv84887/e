import { Router } from 'express'
import { z } from 'zod'
import { protect } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { listCategories, listProducts, suggestions, getProduct, listReviews, createReview } from '../controllers/catalogController.js'

const router = Router()
router.get('/categories', listCategories)
router.get('/products/suggestions', suggestions)
router.get('/products', listProducts)
router.get('/products/:slug', getProduct)
router.get('/products/:productId/reviews', listReviews)
router.post('/products/:productId/reviews', protect, validate(z.object({ rating: z.coerce.number().int().min(1).max(5), title: z.string().trim().max(120).optional(), body: z.string().trim().min(3).max(2000) })), createReview)
export default router
