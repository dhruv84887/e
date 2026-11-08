import slugify from 'slugify'
import Razorpay from 'razorpay'
import Product from '../models/Product.js'
import Category from '../models/Category.js'
import Order from '../models/Order.js'
import User from '../models/User.js'
import Address from '../models/Address.js'
import Coupon from '../models/Coupon.js'
import Banner from '../models/Banner.js'
import Review from '../models/Review.js'
import Payment from '../models/Payment.js'
import ContactMessage from '../models/ContactMessage.js'
import Subscriber from '../models/Subscriber.js'
import { asyncHandler, escapeRegex } from '../utils/http.js'
import { countOrderSale, uncountOrderSale } from '../utils/sales.js'
import { completeOrderRefund } from '../services/orderRefunds.js'

const makeSlug = (name) => slugify(name, { lower: true, strict: true })
export const overview = asyncHandler(async (req, res) => {
  const [revenue, totalOrders, totalCustomers, totalProducts, pendingOrders, lowStock, recentOrders, dailySales, bestSellers, categoryPerformance] = await Promise.all([
    Order.aggregate([{ $match: { paymentStatus: 'paid', status: { $nin: ['cancelled', 'refunded'] } } }, { $group: { _id: null, value: { $sum: '$total' } } }]),
    Order.countDocuments(), User.countDocuments({ role: 'customer' }), Product.countDocuments({ isActive: true }), Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'processing'] } }), Product.find({ isActive: true, stock: { $lte: 5 } }).select('name sku stock').sort({ stock: 1 }).limit(8).lean(),
    Order.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(8).lean(),
    Order.aggregate([{ $match: { paymentStatus: 'paid', createdAt: { $gte: new Date(Date.now() - 29 * 86400000) }, status: { $nin: ['cancelled', 'refunded'] } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Product.find({ isActive: true }).sort({ soldCount: -1 }).limit(5).select('name soldCount price images').lean(),
    Order.aggregate([{ $match: { paymentStatus: 'paid', status: { $nin: ['cancelled', 'refunded'] } } }, { $unwind: '$items' }, { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'product' } }, { $unwind: '$product' }, { $lookup: { from: 'categories', localField: 'product.category', foreignField: '_id', as: 'category' } }, { $unwind: '$category' }, { $group: { _id: '$category.name', units: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } } } }, { $sort: { revenue: -1 } }])
  ])
  res.json({ metrics: { revenue: revenue[0]?.value || 0, totalOrders, totalCustomers, totalProducts, pendingOrders, lowStockCount: lowStock.length }, lowStock, recentOrders, dailySales, bestSellers, categoryPerformance })
})
export const adminProducts = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(100, Number(req.query.limit) || 25), q = String(req.query.q || '')
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const filter = q ? { $or: [{ name: new RegExp(escaped, 'i') }, { sku: new RegExp(escaped, 'i') }] } : {}
  const [products, total] = await Promise.all([Product.find(filter).populate('category', 'name').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Product.countDocuments(filter)])
  res.json({ products, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
})
export const createProduct = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.body.category, parent: null, isActive: true })
  if (!category) return res.status(400).json({ message: 'Choose an active top-level category.' })
  if (req.body.subcategory) {
    const child = await Category.exists({ _id: req.body.subcategory, parent: category._id, isActive: true })
    if (!child) return res.status(400).json({ message: 'Choose an active subcategory in the selected category.' })
  }
  const data = { ...req.body, sku: req.body.sku?.trim() || undefined, slug: makeSlug(req.body.name), images: (req.body.images || []).map((image) => typeof image === 'string' ? { url: image, alt: req.body.name } : image) }
  const product = await Product.create(data); res.status(201).json({ product })
})
export const updateProduct = asyncHandler(async (req, res) => {
  const existing = await Product.findById(req.params.id)
  if (!existing) return res.status(404).json({ message: 'Product not found.' })
  const categoryId = req.body.category ?? existing.category
  const subcategoryId = req.body.subcategory === undefined ? existing.subcategory : req.body.subcategory
  const category = await Category.findOne({ _id: categoryId, parent: null, isActive: true })
  if (!category) return res.status(400).json({ message: 'Choose an active top-level category.' })
  if (subcategoryId && !await Category.exists({ _id: subcategoryId, parent: category._id, isActive: true })) return res.status(400).json({ message: 'Choose an active subcategory in the selected category.' })
  const nextPrice = req.body.price === undefined ? existing.price : Number(req.body.price)
  const nextDiscount = req.body.discountPrice === undefined ? existing.discountPrice : req.body.discountPrice
  if (nextDiscount != null && Number(nextDiscount) > nextPrice) return res.status(400).json({ message: 'Discount price cannot be higher than the regular price.' })
  const data = { ...req.body, sku: req.body.sku === undefined ? undefined : req.body.sku.trim() || undefined, images: req.body.images?.map((image) => typeof image === 'string' ? { url: image, alt: req.body.name || existing.name } : image) }
  if (req.body.name) data.slug = makeSlug(req.body.name)
  const product = await Product.findByIdAndUpdate(existing._id, data, { new: true, runValidators: true })
  res.json({ product })
})
export const deleteProduct = asyncHandler(async (req, res) => { const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }); if (!product) return res.status(404).json({ message: 'Product not found.' }); res.json({ message: 'Product archived.' }) })
export const createCategory = asyncHandler(async (req, res) => {
  if (req.body.parent && !await Category.exists({ _id: req.body.parent, parent: null, isActive: true })) return res.status(400).json({ message: 'Subcategories must belong to an active top-level category.' })
  const category = await Category.create({ ...req.body, slug: makeSlug(req.body.name) })
  res.status(201).json({ category })
})
export const updateCategory = asyncHandler(async (req, res) => {
  const existing = await Category.findById(req.params.id)
  if (!existing) return res.status(404).json({ message: 'Category not found.' })
  if (req.body.parent) {
    if (String(req.body.parent) === String(existing._id)) return res.status(400).json({ message: 'A category cannot be its own parent.' })
    if (!await Category.exists({ _id: req.body.parent, parent: null, isActive: true })) return res.status(400).json({ message: 'Subcategories must belong to an active top-level category.' })
    if (await Category.exists({ parent: existing._id, isActive: true })) return res.status(409).json({ message: 'Move this category’s subcategories before changing its parent.' })
  }
  const data = { ...req.body }
  if (data.name) data.slug = makeSlug(data.name)
  const category = await Category.findByIdAndUpdate(existing._id, data, { new: true, runValidators: true })
  res.json({ category })
})
export const deleteCategory = asyncHandler(async (req, res) => { const [used, hasChildren] = await Promise.all([Product.exists({ $or: [{ category: req.params.id }, { subcategory: req.params.id }], isActive: true }), Category.exists({ parent: req.params.id, isActive: true })]); if (used) return res.status(409).json({ message: 'Move or archive the products in this category before removing it.' }); if (hasChildren) return res.status(409).json({ message: 'Move or archive this category’s subcategories first.' }); const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }); if (!category) return res.status(404).json({ message: 'Category not found.' }); res.json({ message: 'Category archived.' }) })
export const adminOrders = asyncHandler(async (req, res) => { const page = Math.max(1, Number(req.query.page) || 1), limit = 25; const [orders, total] = await Promise.all([Order.find(req.query.status ? { status: req.query.status } : {}).populate('user', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Order.countDocuments(req.query.status ? { status: req.query.status } : {})]); res.json({ orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }) })
export const updateOrder = asyncHandler(async (req, res) => {
  const transitions = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    processing: ['shipped', 'delivered', 'cancelled', 'refunded'],
    shipped: ['delivered', 'refunded'],
    delivered: ['refunded'],
    cancelled: [],
    refunded: []
  }
  const nextStatus = req.body.status
  if (!Object.hasOwn(transitions, nextStatus)) return res.status(400).json({ message: 'Invalid order status.' })
  const order = await Order.findById(req.params.id)
  if (!order) return res.status(404).json({ message: 'Order not found.' })
  const statusChanged = nextStatus !== order.status
  if (statusChanged && !transitions[order.status]?.includes(nextStatus)) return res.status(400).json({ message: `An order cannot move from ${order.status} to ${nextStatus}.` })
  if (statusChanged && order.refundStatus === 'pending' && ['processing', 'shipped', 'delivered'].includes(nextStatus)) return res.status(409).json({ message: 'Fulfillment is paused while Razorpay confirms the refund.' })
  if (statusChanged && order.paymentMethod === 'razorpay' && order.paymentStatus !== 'paid' && !['cancelled', 'refunded'].includes(nextStatus)) return res.status(400).json({ message: 'Online payment must be confirmed before fulfillment.' })

  if (statusChanged && nextStatus === 'refunded') {
    if (order.paymentStatus !== 'paid') return res.status(400).json({ message: 'Only paid orders can be refunded.' })
    if (order.refundStatus === 'pending' || order.refundStatus === 'processed') return res.status(409).json({ message: 'A refund is already in progress or complete.' })
    if (order.paymentMethod === 'cod') {
      const payment = await Payment.findOne({ order: order._id, provider: 'cod', status: 'captured' })
      if (!payment) return res.status(409).json({ message: 'The cash payment has not been recorded.' })
      await completeOrderRefund(order, payment)
      return res.json({ order })
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({ message: 'Razorpay refunds are not configured. Add the server test or live keys first.' })
    const payment = await Payment.findOne({ order: order._id, provider: 'razorpay', status: 'captured', providerPaymentId: { $type: 'string' } }).sort({ createdAt: -1 })
    if (!payment) return res.status(409).json({ message: 'A captured Razorpay payment was not found for this order.' })
    const gateway = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET })
    let refund
    try {
      refund = await gateway.payments.refund(payment.providerPaymentId, {
        amount: Math.round(order.total * 100), receipt: order.orderNumber, notes: { orderNumber: order.orderNumber }
      })
    } catch {
      return res.status(502).json({ message: 'Razorpay could not start this refund. Check the payment in Razorpay before retrying.' })
    }
    if (!['pending', 'processed', 'failed'].includes(refund.status)) return res.status(502).json({ message: 'Razorpay returned an unknown refund status.' })
    payment.refundId = refund.id
    payment.refundStatus = refund.status
    payment.raw = { ...(payment.raw || {}), refund }
    if (refund.status === 'processed') {
      await completeOrderRefund(order, payment, refund)
    } else {
      order.refundStatus = refund.status
      await Promise.all([order.save(), payment.save()])
      if (refund.status === 'failed') return res.status(502).json({ message: 'Razorpay declined the refund. Review the payment and retry after resolving the issue.' })
    }
    return res.json({ order, refund: { id: refund.id, status: refund.status } })
  }

  if (statusChanged && nextStatus === 'cancelled') {
    if (order.paymentStatus === 'paid') return res.status(400).json({ message: 'Refund the paid order before cancelling it.' })
    for (const item of order.items) {
      if (item.variant?._id) await Product.updateOne({ _id: item.product, 'variants._id': item.variant._id }, { $inc: { stock: item.quantity, 'variants.$.stock': item.quantity } })
      else await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
    }
    if (order.couponCode) await Coupon.updateOne({ code: order.couponCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } })
    order.paymentStatus = 'failed'
    await Payment.updateMany({ order: order._id, status: { $in: ['created', 'authorized'] } }, { status: 'failed' })
  }
  order.status = nextStatus
  if (req.body.trackingNumber !== undefined) order.trackingNumber = req.body.trackingNumber
  if (req.body.trackingUrl !== undefined) order.trackingUrl = req.body.trackingUrl
  if (statusChanged && nextStatus === 'delivered') {
    order.deliveredAt = new Date()
    if (order.paymentMethod === 'cod') {
      order.paymentStatus = 'paid'
      await Payment.updateOne({ order: order._id, provider: 'cod' }, { status: 'captured' })
    }
  }
  if (order.paymentStatus === 'paid') await countOrderSale(order)
  await order.save()
  res.json({ order })
})
export const customers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = 25
  const filter = { role: 'customer' }
  if (req.query.status === 'active') filter.isActive = true
  if (req.query.status === 'inactive') filter.isActive = false
  const q = String(req.query.q || '').trim()
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: rx }, { email: rx }] }
  const [users, total] = await Promise.all([
    User.find(filter).select('name email phone isActive createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter)
  ])
  const ids = users.map((u) => u._id), counts = await Order.aggregate([{ $match: { user: { $in: ids }, status: { $nin: ['cancelled', 'refunded'] } } }, { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0] } } } }])
  const byUser = new Map(counts.map((c) => [String(c._id), c]))
  res.json({ customers: users.map((u) => ({ ...u, ...(byUser.get(String(u._id)) || { orders: 0, spent: 0 }) })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
})
export const customerDetails = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, role: 'customer' }).select('name email phone addresses isActive createdAt')
  if (!user) return res.status(404).json({ message: 'Customer not found.' })
  const rawPage = Number(req.query.page || 1)
  if (!Number.isInteger(rawPage) || rawPage < 1) return res.status(400).json({ message: 'Page must be a positive whole number.' })
  const page = rawPage, limit = 10, filter = { user: user._id }
  const [orders, total, addresses] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
    Address.find({ user: user._id }).sort({ isDefault: -1, createdAt: -1 }).lean()
  ])
  res.json({ customer: user, addresses, orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
})
export const updateCustomerStatus = asyncHandler(async (req, res) => {
  const customer = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'customer' },
    { $set: { isActive: req.body.isActive } },
    { new: true, runValidators: true }
  ).select('name email isActive')
  if (!customer) return res.status(404).json({ message: 'Customer not found.' })
  res.json({ customer })
})
export const adminReviews = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = 25
  const filter = req.query.status === 'published' ? { isPublished: true } : req.query.status === 'hidden' ? { isPublished: false } : {}
  const [reviews, total] = await Promise.all([
    Review.find(filter).populate('user', 'name email').populate('product', 'name slug').populate('order', 'orderNumber').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Review.countDocuments(filter)
  ])
  res.json({ reviews, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
})
export const contactMessages = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = 25
  const status = ['new', 'read', 'resolved'].includes(String(req.query.status)) ? String(req.query.status) : ''
  const filter = status ? { status } : {}
  const [messages, total, newCount] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ContactMessage.countDocuments(filter), ContactMessage.countDocuments({ status: 'new' })
  ])
  res.json({ messages, newCount, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
})
export const updateContactMessage = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true })
  if (!message) return res.status(404).json({ message: 'Contact message not found.' })
  res.json({ message })
})
export const adminSubscribers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = 50
  const status = String(req.query.status || '')
  const filter = {}
  if (status === 'active') filter.isActive = true
  if (status === 'inactive') filter.isActive = false
  const q = String(req.query.q || '').trim()
  if (q) filter.email = new RegExp(escapeRegex(q), 'i')
  const [subscribers, total] = await Promise.all([
    Subscriber.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Subscriber.countDocuments(filter)
  ])
  res.json({ subscribers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
})
export const updateSubscriber = asyncHandler(async (req, res) => {
  const subscriber = await Subscriber.findByIdAndUpdate(req.params.id, { isActive: req.body.isActive }, { new: true, runValidators: true })
  if (!subscriber) return res.status(404).json({ message: 'Subscriber not found.' })
  res.json({ subscriber })
})
export const coupons = asyncHandler(async (req, res) => res.json({ coupons: await Coupon.find().sort({ createdAt: -1 }).lean() }))
export const createCoupon = asyncHandler(async (req, res) => { const coupon = await Coupon.create({ ...req.body, code: req.body.code.toUpperCase() }); res.status(201).json({ coupon }) })
export const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id)
  if (!coupon) return res.status(404).json({ message: 'Coupon not found.' })
  const nextType = req.body.type ?? coupon.type, nextValue = req.body.value ?? coupon.value
  if (nextType === 'percent' && nextValue > 100) return res.status(400).json({ message: 'Percentage discounts cannot exceed 100%.' })
  if (req.body.usageLimit != null && req.body.usageLimit < coupon.usedCount) return res.status(409).json({ message: 'The usage limit cannot be lower than the number of times this coupon has already been used.' })
  Object.assign(coupon, req.body)
  await coupon.save()
  res.json({ coupon })
})
export const deleteCoupon = asyncHandler(async (req, res) => { const coupon = await Coupon.findByIdAndDelete(req.params.id); if (!coupon) return res.status(404).json({ message: 'Coupon not found.' }); res.json({ message: 'Coupon removed.' }) })
export const banners = asyncHandler(async (req, res) => res.json({ banners: await Banner.find().sort({ sortOrder: 1, createdAt: -1 }).lean() }))
export const createBanner = asyncHandler(async (req, res) => { const banner = await Banner.create(req.body); res.status(201).json({ banner }) })
export const updateBanner = asyncHandler(async (req, res) => { const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); if (!banner) return res.status(404).json({ message: 'Banner not found.' }); res.json({ banner }) })
export const deleteBanner = asyncHandler(async (req, res) => { const banner = await Banner.findByIdAndDelete(req.params.id); if (!banner) return res.status(404).json({ message: 'Banner not found.' }); res.json({ message: 'Banner removed.' }) })
export const moderateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id)
  if (!review) return res.status(404).json({ message: 'Review not found.' })
  review.isPublished = req.body.isPublished
  await review.save()
  const [rating] = await Review.aggregate([{ $match: { product: review.product, isPublished: true } }, { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }])
  await Product.updateOne({ _id: review.product }, { rating: rating ? Math.round(rating.average * 10) / 10 : 0, reviewCount: rating?.count || 0 })
  res.json({ review })
})
