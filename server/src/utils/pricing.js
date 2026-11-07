import Coupon from '../models/Coupon.js'

export const money = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
export async function getCouponDiscount(code, subtotal) {
  if (!code) return { coupon: null, discount: 0 }
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase(), isActive: true })
  const now = new Date()
  if (!coupon || (coupon.startsAt && coupon.startsAt > now) || (coupon.expiresAt && coupon.expiresAt < now) || (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) || subtotal < coupon.minSubtotal) {
    const err = new Error('This coupon is invalid or does not apply to your order.'); err.status = 400; throw err
  }
  const amount = coupon.type === 'percent' ? subtotal * coupon.value / 100 : coupon.value
  return { coupon, discount: money(Math.min(amount, coupon.maxDiscount || amount, subtotal)) }
}
export function calculateTotals(subtotal, discount = 0) {
  const taxable = Math.max(0, subtotal - discount)
  const setting = (name, fallback) => {
    const value = Number(process.env[name] ?? fallback)
    return Number.isFinite(value) && value >= 0 ? value : fallback
  }
  const tax = money(taxable * setting('TAX_RATE', 0.05))
  const shipping = taxable >= setting('FREE_SHIPPING_FROM', 4999) ? 0 : setting('SHIPPING_FLAT', 99)
  return { subtotal: money(subtotal), discount: money(discount), tax, shipping, total: money(taxable + tax + shipping) }
}
