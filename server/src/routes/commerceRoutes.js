import { Router } from 'express'
import { z } from 'zod'
import { protect } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { checkoutSchema } from '../validators/index.js'
import { readCart, clearCart, addCartItem, updateCartItem, removeCartItem, applyCoupon, removeCoupon, readWishlist, toggleWishlist, createOrder, listMyOrders, getMyOrder, cancelMyOrder, createRazorpayOrder, verifyRazorpayPayment } from '../controllers/commerceController.js'

const router = Router()
router.use(protect)
router.get('/cart', readCart)
router.delete('/cart', clearCart)
router.post('/cart/items', validate(z.object({ productId: z.string(), variantId: z.string().optional(), size: z.string().trim().max(100).optional(), color: z.string().trim().max(100).optional(), quantity: z.coerce.number().int().min(1).max(50).default(1) })), addCartItem)
router.patch('/cart/items/:itemId', validate(z.object({ quantity: z.coerce.number().int().min(1).max(50) })), updateCartItem)
router.delete('/cart/items/:itemId', removeCartItem)
router.post('/cart/coupon', validate(z.object({ code: z.string().trim().min(2).max(40) })), applyCoupon)
router.delete('/cart/coupon', removeCoupon)
router.get('/wishlist', readWishlist)
router.put('/wishlist/:productId', toggleWishlist)
router.post('/orders', validate(checkoutSchema), createOrder)
router.get('/orders', listMyOrders)
router.get('/orders/:id', getMyOrder)
router.post('/orders/:id/cancel', validate(z.object({ reason: z.string().max(300).optional() })), cancelMyOrder)
router.post('/orders/:id/razorpay', createRazorpayOrder)
router.post('/payments/razorpay/verify', validate(z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() })), verifyRazorpayPayment)
export default router
