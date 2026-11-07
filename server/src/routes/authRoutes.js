import { Router } from 'express'
import { z } from 'zod'
import { protect } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { addressSchema, loginSchema, registerSchema } from '../validators/index.js'
import { register, login, logout, me, updateProfile, listAddresses, createAddress, updateAddress, deleteAddress, forgotPassword, resetPassword } from '../controllers/authController.js'

const router = Router()
router.post('/register', validate(registerSchema), register)
router.post('/login', validate(loginSchema), login)
router.post('/logout', logout)
router.post('/forgot-password', validate(z.object({ email: z.string().email() })), forgotPassword)
router.post('/reset-password', validate(z.object({ token: z.string().min(32), password: z.string().min(8).max(128) })), resetPassword)
router.get('/me', protect, me)
router.patch('/me', protect, validate(z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().max(20).optional() })), updateProfile)
router.get('/addresses', protect, listAddresses)
router.post('/addresses', protect, validate(addressSchema), createAddress)
router.patch('/addresses/:id', protect, validate(addressSchema.partial()), updateAddress)
router.delete('/addresses/:id', protect, deleteAddress)
export default router
