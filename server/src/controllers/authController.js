import crypto from 'node:crypto'
import User from '../models/User.js'
import Address from '../models/Address.js'
import { asyncHandler } from '../utils/http.js'
import { clearAuthCookie, setAuthCookie } from '../middleware/auth.js'

const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, addresses: user.addresses || [] })
export const register = asyncHandler(async (req, res) => {
  const exists = await User.exists({ email: req.body.email.toLowerCase() })
  if (exists) return res.status(409).json({ message: 'An account already exists for this email.' })
  const user = await User.create(req.body); setAuthCookie(res, user); res.status(201).json({ user: publicUser(user) })
})
export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+password')
  if (!user || !user.isActive || !(await user.comparePassword(req.body.password))) return res.status(401).json({ message: 'Email or password is incorrect.' })
  setAuthCookie(res, user); res.json({ user: publicUser(user) })
})
export const logout = asyncHandler(async (req, res) => { clearAuthCookie(res); res.json({ message: 'You are signed out.' }) })
export const me = asyncHandler(async (req, res) => res.json({ user: publicUser(await User.findById(req.user._id)) }))
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, { name: req.body.name, phone: req.body.phone }, { new: true, runValidators: true })
  res.json({ user: publicUser(user) })
})
export const listAddresses = asyncHandler(async (req, res) => res.json({ addresses: await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 }) }))
export const createAddress = asyncHandler(async (req, res) => {
  if (req.body.isDefault) await Address.updateMany({ user: req.user._id }, { isDefault: false })
  const address = await Address.create({ ...req.body, user: req.user._id }); res.status(201).json({ address })
})
export const updateAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOne({ _id: req.params.id, user: req.user._id })
  if (!address) return res.status(404).json({ message: 'Address not found.' })
  if (req.body.isDefault) await Address.updateMany({ user: req.user._id, _id: { $ne: address._id } }, { isDefault: false })
  address.set(req.body)
  await address.save()
  res.json({ address })
})
export const deleteAddress = asyncHandler(async (req, res) => { const address = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id }); if (!address) return res.status(404).json({ message: 'Address not found.' }); res.json({ message: 'Address removed.' }) })
export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() })
  if (user) {
    const token = crypto.randomBytes(32).toString('hex')
    user.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex'); user.resetTokenExpires = Date.now() + 30 * 60 * 1000; await user.save()
    const base = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim()
    const link = `${base}/reset-password?token=${token}`
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.default.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
      await transporter.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to: user.email, subject: 'Reset your Atelier password', text: `Reset your password within 30 minutes: ${link}` })
    } else if (process.env.NODE_ENV !== 'production') console.info(`Password reset link for ${user.email}: ${link}`)
  }
  res.json({ message: 'If an account exists for that email, you will receive a password reset link.' })
})
export const resetPassword = asyncHandler(async (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(req.body.token).digest('hex')
  const user = await User.findOne({ resetTokenHash: tokenHash, resetTokenExpires: { $gt: new Date() } }).select('+password')
  if (!user) return res.status(400).json({ message: 'This reset link is invalid or has expired.' })
  user.password = req.body.password; user.resetTokenHash = undefined; user.resetTokenExpires = undefined; await user.save(); setAuthCookie(res, user); res.json({ user: publicUser(user) })
})
