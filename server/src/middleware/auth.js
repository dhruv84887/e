import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const secureCookie = () => process.env.COOKIE_SECURE === 'true' || (process.env.COOKIE_SECURE !== 'false' && (process.env.NODE_ENV === 'production' || process.env.COOKIE_SAME_SITE === 'none'))
const sameSiteCookie = () => process.env.COOKIE_SAME_SITE || 'lax'
const cookieOptions = () => ({ httpOnly: true, secure: secureCookie(), sameSite: sameSiteCookie(), path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 })
export function setAuthCookie(res, user) {
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
  res.cookie('atelier_token', token, cookieOptions())
}
export function clearAuthCookie(res) { res.clearCookie('atelier_token', { httpOnly: true, secure: secureCookie(), sameSite: sameSiteCookie(), path: '/' }) }
export async function protect(req, res, next) {
  try {
    const token = req.cookies?.atelier_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null)
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' })
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(payload.id).select('-password -resetTokenHash -resetTokenExpires')
    if (!user || !user.isActive) return res.status(401).json({ message: 'Your session is no longer active.' })
    req.user = user
    next()
  } catch { res.status(401).json({ message: 'Your session has expired. Please sign in again.' }) }
}
export function adminOnly(req, res, next) { if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access required.' }); next() }
