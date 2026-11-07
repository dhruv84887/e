import crypto from 'node:crypto'
import Razorpay from 'razorpay'
import Cart from '../models/Cart.js'
import Wishlist from '../models/Wishlist.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'
import Payment from '../models/Payment.js'
import Coupon from '../models/Coupon.js'
import { asyncHandler } from '../utils/http.js'
import { calculateTotals, getCouponDiscount } from '../utils/pricing.js'
import { countOrderSale } from '../utils/sales.js'
import { expireOrderReservation } from '../services/orderReservations.js'
import { storeCurrencyCode } from '../utils/storeConfig.js'

const effectivePrice = (product, variant) => Number(variant?.price ?? product.discountPrice ?? product.price)
async function getCart(userId) {
  let cart = await Cart.findOne({ user: userId }).populate('items.product')
  if (!cart) cart = await Cart.create({ user: userId, items: [] })
  const items = cart.items.filter((item) => item.product && item.product.isActive).map((item) => {
    const product = item.product, variant = item.variantId ? product.variants.id(item.variantId) : null
    return { id: item._id, product, variantId: item.variantId, size: item.size, color: item.color, variant, quantity: item.quantity, unitPrice: effectivePrice(product, variant), lineTotal: effectivePrice(product, variant) * item.quantity }
  })
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  let discount = 0
  if (cart.couponCode) { try { ({ discount } = await getCouponDiscount(cart.couponCode, subtotal)) } catch { cart.couponCode = undefined; await cart.save() } }
  return { cart, items, ...calculateTotals(subtotal, discount), ...(cart.couponCode ? { coupon: { code: cart.couponCode, discount } } : {}) }
}
async function clearCartIfOrderMatches(userId, order) {
  const cart = await Cart.findOne({ user: userId })
  if (!cart || cart.items.length !== order.items.length || String(cart.couponCode || '') !== String(order.couponCode || '')) return
  const matches = order.items.every((ordered) => cart.items.some((item) =>
    String(item.product) === String(ordered.product) &&
    String(item.variantId || '') === String(ordered.variant?._id || '') &&
    (!item.size || String(item.size) === String(ordered.variant?.size || '')) &&
    String(item.color || '') === String(ordered.variant?.color || '') &&
    item.quantity === ordered.quantity
  ))
  if (matches) { cart.items = []; cart.couponCode = undefined; await cart.save() }
}
export const readCart = asyncHandler(async (req, res) => res.json(await getCart(req.user._id)))
export const clearCart = asyncHandler(async (req, res) => {
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] }, $unset: { couponCode: 1 } })
  res.json({ message: 'Your bag is clear.' })
})
export const addCartItem = asyncHandler(async (req, res) => {
  const { productId, variantId, size, color, quantity = 1 } = req.body
  const product = await Product.findOne({ _id: productId, isActive: true, isAvailable: true })
  if (!product) return res.status(404).json({ message: 'This product is no longer available.' })
  const variant = variantId ? product.variants.id(variantId) : null
  if (variantId && !variant) return res.status(400).json({ message: 'That product option is no longer available.' })
  const variantSize = variant?.options?.get('size')
  const selectedSize = String(size || variantSize || '').trim()
  if (selectedSize && !variant && !product.sizes.includes(selectedSize)) return res.status(400).json({ message: 'Choose a valid size for this product.' })
  if (selectedSize && variantSize && selectedSize !== variantSize) return res.status(400).json({ message: 'That size does not match the selected product option.' })
  const available = variant ? Math.min(variant.stock, product.stock) : product.stock
  const cart = await Cart.findOneAndUpdate({ user: req.user._id }, { $setOnInsert: { user: req.user._id } }, { upsert: true, new: true })
  const item = cart.items.find((i) => String(i.product) === String(productId) && String(i.variantId || '') === String(variantId || '') && String(i.size || '') === selectedSize && String(i.color || '') === String(color || ''))
  if ((item?.quantity || 0) + Number(quantity) > available) return res.status(400).json({ message: `Only ${available} available in stock.` })
  if (item) item.quantity += Number(quantity); else cart.items.push({ product: product._id, variantId: variant?._id, size: selectedSize || undefined, color, quantity: Number(quantity) })
  await cart.save(); res.status(201).json(await getCart(req.user._id))
})
export const updateCartItem = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product')
  const item = cart?.items.id(req.params.itemId); if (!item) return res.status(404).json({ message: 'Cart item not found.' })
  const product = item.product, variant = item.variantId ? product.variants.id(item.variantId) : null
  if (Number(req.body.quantity) > (variant ? Math.min(variant.stock, product.stock) : product.stock)) return res.status(400).json({ message: 'Requested quantity exceeds available stock.' })
  item.quantity = Number(req.body.quantity); await cart.save(); res.json(await getCart(req.user._id))
})
export const removeCartItem = asyncHandler(async (req, res) => { const cart = await Cart.findOne({ user: req.user._id }); if (cart) { cart.items.pull(req.params.itemId); await cart.save() } res.json(await getCart(req.user._id)) })
export const applyCoupon = asyncHandler(async (req, res) => {
  const { cart, items } = await getCart(req.user._id), subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0)
  const { coupon, discount } = await getCouponDiscount(req.body.code, subtotal); cart.couponCode = coupon.code; await cart.save(); res.json({ ...(await getCart(req.user._id)), coupon: { code: coupon.code, discount } })
})
export const removeCoupon = asyncHandler(async (req, res) => { await Cart.updateOne({ user: req.user._id }, { $unset: { couponCode: 1 } }); res.json(await getCart(req.user._id)) })

export const readWishlist = asyncHandler(async (req, res) => { const wishlist = await Wishlist.findOne({ user: req.user._id }).populate('products').lean(); res.json({ products: (wishlist?.products || []).filter((p) => p?.isActive) }) })
export const toggleWishlist = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.productId, isActive: true }); if (!product) return res.status(404).json({ message: 'Product not found.' })
  let wishlist = await Wishlist.findOne({ user: req.user._id }); if (!wishlist) wishlist = await Wishlist.create({ user: req.user._id, products: [] })
  const found = wishlist.products.some((id) => String(id) === String(product._id))
  if (found) wishlist.products.pull(product._id); else wishlist.products.addToSet(product._id)
  await wishlist.save(); res.json({ added: !found, products: await Product.find({ _id: { $in: wishlist.products }, isActive: true }).lean() })
})

async function reserveItem(item) {
  const qty = item.quantity
  const query = item.variantId ? { _id: item.product, isActive: true, stock: { $gte: qty }, variants: { $elemMatch: { _id: item.variantId, stock: { $gte: qty } } } } : { _id: item.product, isActive: true, stock: { $gte: qty } }
  const update = item.variantId ? { $inc: { stock: -qty, 'variants.$.stock': -qty } } : { $inc: { stock: -qty } }
  return Product.findOneAndUpdate(query, update, { new: true })
}
async function releaseItems(items, delta = 1) {
  for (const item of items) {
    const qty = item.quantity * delta
    if (item.variantId) await Product.updateOne({ _id: item.product, 'variants._id': item.variantId }, { $inc: { stock: qty, 'variants.$.stock': qty } })
    else await Product.updateOne({ _id: item.product }, { $inc: { stock: qty } })
  }
}
export const createOrder = asyncHandler(async (req, res) => {
  if (req.body.paymentMethod === 'razorpay' && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)) return res.status(503).json({ message: 'Online payments are not configured yet. Please choose cash on delivery or contact the store.' })
  const { cart, items } = await getCart(req.user._id)
  if (!items.length) return res.status(400).json({ message: 'Your cart is empty.' })
  const reserved = []
  let createdOrder = null, couponUsed = null
  try {
    const snapshot = []
    for (const item of items) {
      const product = await Product.findById(item.product._id)
      if (!product?.isActive || !product.isAvailable) throw Object.assign(new Error(`${item.product.name} is no longer available.`), { status: 400 })
      const variant = item.variantId ? product.variants.id(item.variantId) : null
      const unitPrice = effectivePrice(product, variant)
      const updated = await reserveItem({ product: product._id, variantId: item.variantId, quantity: item.quantity })
      if (!updated) throw Object.assign(new Error(`${product.name} does not have enough stock.`), { status: 400 })
      reserved.push({ product: product._id, variantId: item.variantId, quantity: item.quantity })
      const variantDetails = variant ? { _id: String(variant._id), ...Object.fromEntries(variant.options || []), ...(item.size ? { size: item.size } : {}), ...(item.color ? { color: item.color } : {}) } : (item.size || item.color) ? { ...(item.size ? { size: item.size } : {}), ...(item.color ? { color: item.color } : {}) } : null
      snapshot.push({ product: product._id, name: product.name, image: product.images?.[0]?.url || product.images?.[0] || '', sku: variant?.sku || product.sku, variant: variantDetails, quantity: item.quantity, unitPrice })
    }
    const subtotal = snapshot.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const { coupon, discount } = await getCouponDiscount(req.body.couponCode || cart.couponCode, subtotal)
    const totals = calculateTotals(subtotal, discount)
    createdOrder = await Order.create({ orderNumber: `AT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`, user: req.user._id, items: snapshot, shippingAddress: req.body.shippingAddress, ...totals, couponCode: coupon?.code, paymentMethod: req.body.paymentMethod, status: req.body.paymentMethod === 'cod' ? 'confirmed' : 'pending', reservationExpiresAt: req.body.paymentMethod === 'razorpay' ? new Date(Date.now() + 30 * 60 * 1000) : undefined })
    if (coupon) {
      const now = new Date()
      const consumed = await Coupon.findOneAndUpdate({
        _id: coupon._id,
        isActive: true,
        minSubtotal: { $lte: subtotal },
        $and: [
          { $or: [{ usageLimit: { $exists: false } }, { usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
          { $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: now } }] }
        ]
      }, { $inc: { usedCount: 1 } }, { new: true })
      if (!consumed) throw Object.assign(new Error('This coupon is no longer available for your order.'), { status: 400 })
      couponUsed = consumed._id
    }
    await Payment.create({ order: createdOrder._id, provider: req.body.paymentMethod === 'cod' ? 'cod' : 'razorpay', amount: totals.total, status: req.body.paymentMethod === 'cod' ? 'authorized' : 'created' })
    if (req.body.paymentMethod === 'cod') { cart.items = []; cart.couponCode = undefined; await cart.save() }
    return res.status(201).json({ order: createdOrder })
  } catch (err) { if (createdOrder) { await Payment.deleteMany({ order: createdOrder._id }).catch(() => {}); await Order.deleteOne({ _id: createdOrder._id }).catch(() => {}) } if (couponUsed) await Coupon.updateOne({ _id: couponUsed }, { $inc: { usedCount: -1 } }).catch(() => {}); await releaseItems(reserved).catch(() => {}); throw err }
})
export const listMyOrders = asyncHandler(async (req, res) => { const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean(); res.json({ orders }) })
export const getMyOrder = asyncHandler(async (req, res) => { const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).lean(); if (!order) return res.status(404).json({ message: 'Order not found.' }); res.json({ order }) })
export const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
  if (!order) return res.status(404).json({ message: 'Order not found.' })
  if (!['pending', 'confirmed'].includes(order.status) || order.paymentStatus === 'paid') return res.status(400).json({ message: 'This order can no longer be cancelled online.' })
  order.status = 'cancelled'; order.reservationExpiresAt = undefined; order.cancellationReason = String(req.body.reason || '').slice(0, 300); await order.save()
  await releaseItems(order.items.map((i) => ({ product: i.product, variantId: i.variant?._id, quantity: i.quantity })))
  await Payment.updateMany({ order: order._id, provider: 'razorpay', status: 'created' }, { status: 'failed' })
  if (order.couponCode) await Coupon.updateOne({ code: order.couponCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } })
  res.json({ order })
})
export const createRazorpayOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id })
  if (!order || order.paymentMethod !== 'razorpay' || order.status !== 'pending') return res.status(404).json({ message: 'Pending online payment order not found.' })
  if (order.reservationExpiresAt && order.reservationExpiresAt <= new Date()) { await expireOrderReservation(order._id); return res.status(409).json({ message: 'The payment window expired. Your reserved stock is back in your bag; please place a new order.' }) }
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: 'Online payments are not configured yet. Please choose cash on delivery or contact the store.' })
  const gateway = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
  let payment = await Payment.findOne({ order: order._id, provider: 'razorpay', status: 'created', providerOrderId: { $type: 'string' } }).sort({ createdAt: -1 })
  if (!payment) {
    let result
    try { result = await gateway.orders.create({ amount: Math.round(order.total * 100), currency: storeCurrencyCode(), receipt: order.orderNumber }) }
    catch { return res.status(502).json({ message: 'Razorpay could not start checkout. Your bag is safe; you can retry this payment.' }) }
    payment = await Payment.create({ order: order._id, provider: 'razorpay', providerOrderId: result.id, amount: order.total, currency: result.currency })
  }
  res.json({ keyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: payment.providerOrderId, amount: Math.round(payment.amount * 100), currency: payment.currency, orderNumber: order.orderNumber, prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone } })
})
export const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
  if (!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: 'Online payments are not configured.' })
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex')
  const a = Buffer.from(expected), b = Buffer.from(String(razorpay_signature || ''))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ message: 'Payment verification failed.' })
  const payment = await Payment.findOne({ providerOrderId: razorpay_order_id, provider: 'razorpay' })
  if (!payment) return res.status(404).json({ message: 'Payment record not found.' })
  const order = await Order.findOne({ _id: payment.order, user: req.user._id })
  if (!order) return res.status(404).json({ message: 'Order not found.' })
  if (order.status === 'cancelled' || order.status === 'refunded') return res.status(409).json({ message: 'This order is no longer awaiting payment.' })
  if (payment.status === 'captured') {
    if (payment.providerPaymentId === razorpay_payment_id && order.paymentStatus === 'paid') return res.json({ order })
    return res.status(409).json({ message: 'A payment has already been recorded for this order.' })
  }
  if (order.status !== 'pending' || payment.status !== 'created') return res.status(409).json({ message: 'This order is no longer awaiting payment.' })
  const now = new Date()
  if (order.reservationExpiresAt && order.reservationExpiresAt <= now) { await expireOrderReservation(order._id, now); return res.status(409).json({ message: 'The payment window expired. This order can no longer be paid.' }) }
  const paidOrder = await Order.findOneAndUpdate({ _id: order._id, user: req.user._id, status: 'pending', paymentStatus: 'pending', reservationExpiresAt: { $gt: now } }, { $set: { paymentStatus: 'paid', status: 'confirmed' }, $unset: { reservationExpiresAt: 1 } }, { new: true })
  if (!paidOrder) return res.status(409).json({ message: 'This order is no longer awaiting payment.' })
  payment.providerPaymentId = razorpay_payment_id; payment.signature = razorpay_signature; payment.status = 'captured'; await payment.save()
  await countOrderSale(paidOrder); await paidOrder.save()
  await clearCartIfOrderMatches(req.user._id, paidOrder)
  res.json({ order: paidOrder })
})
