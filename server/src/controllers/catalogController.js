import Product from '../models/Product.js'
import Category from '../models/Category.js'
import Review from '../models/Review.js'
import Order from '../models/Order.js'
import { asyncHandler, escapeRegex } from '../utils/http.js'

export const listCategories = asyncHandler(async (req, res) => {
  const filter = req.query.all === 'true' && req.user?.role === 'admin' ? {} : { isActive: true }
  const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean()
  res.json({ categories: categories.map((c) => ({ ...c, children: categories.filter((child) => String(child.parent) === String(c._id)) })).filter((c) => !c.parent) })
})
export const listProducts = asyncHandler(async (req, res) => {
  const rawPage = Number(req.query.page || 1), rawLimit = Number(req.query.limit || 12)
  if (!Number.isInteger(rawPage) || rawPage < 1 || !Number.isInteger(rawLimit) || rawLimit < 1) return res.status(400).json({ message: 'Page and page size must be positive whole numbers.' })
  const page = rawPage, limit = Math.min(48, rawLimit)
  const filter = { isActive: true, isAvailable: true }
  if (req.query.q) { const rx = new RegExp(escapeRegex(String(req.query.q).trim()), 'i'); filter.$or = [{ name: rx }, { brand: rx }, { description: rx }] }
  if (req.query.category) { const cat = await Category.findOne({ $or: [{ slug: req.query.category }, ...(String(req.query.category).match(/^[a-f\d]{24}$/i) ? [{ _id: req.query.category }] : [])], isActive: true }); if (cat) { if (cat.parent) filter.subcategory = cat._id; else filter.category = cat._id } else filter.category = null }
  if (req.query.subcategory) filter.subcategory = req.query.subcategory
  if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
    const min = req.query.minPrice === undefined ? undefined : Number(req.query.minPrice)
    const max = req.query.maxPrice === undefined ? undefined : Number(req.query.maxPrice)
    if ((min !== undefined && (!Number.isFinite(min) || min < 0)) || (max !== undefined && (!Number.isFinite(max) || max < 0)) || (min !== undefined && max !== undefined && min > max)) return res.status(400).json({ message: 'Enter a valid price range.' })
    const visiblePrice = { $ifNull: ['$discountPrice', '$price'] }
    const priceRules = []
    if (min !== undefined) priceRules.push({ $gte: [visiblePrice, min] })
    if (max !== undefined) priceRules.push({ $lte: [visiblePrice, max] })
    filter.$expr = priceRules.length === 1 ? priceRules[0] : { $and: priceRules }
  }
  if (req.query.rating !== undefined) {
    const rating = Number(req.query.rating)
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) return res.status(400).json({ message: 'Rating must be between 0 and 5.' })
    filter.rating = { $gte: rating }
  }
  if (req.query.inStock === 'true') filter.stock = { $gt: 0 }
  if (req.query.featured === 'true') filter.featured = true
  if (req.query.newArrivals === 'true') filter.isNewArrival = true
  const sortMap = { popular: { soldCount: -1, rating: -1 }, newest: { createdAt: -1 }, rating: { rating: -1 }, relevance: { featured: -1, soldCount: -1 } }
  const sort = String(req.query.sort || 'relevance')
  const productsQuery = sort === 'price_asc' || sort === 'price_desc'
    ? Product.aggregate([
      { $match: filter },
      { $addFields: { effectivePrice: { $ifNull: ['$discountPrice', '$price'] } } },
      { $sort: { effectivePrice: sort === 'price_asc' ? 1 : -1, _id: 1 } },
      { $skip: (page - 1) * limit }, { $limit: limit }, { $project: { effectivePrice: 0 } },
      { $lookup: { from: Category.collection.name, localField: 'category', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    ])
    : Product.find(filter).populate('category', 'name slug').sort(sortMap[sort] || sortMap.relevance).skip((page - 1) * limit).limit(limit).lean()
  const [products, total] = await Promise.all([productsQuery, Product.countDocuments(filter)])
  res.json({ products, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
})
export const suggestions = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (q.length < 2) return res.json({ suggestions: [] })
  const rx = new RegExp(escapeRegex(q), 'i')
  const suggestions = await Product.find({ isActive: true, isAvailable: true, $or: [{ name: rx }, { brand: rx }] }).select('name slug brand price discountPrice images').limit(6).lean()
  res.json({ suggestions })
})
export const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true }).populate('category', 'name slug').populate('subcategory', 'name slug').lean()
  if (!product) return res.status(404).json({ message: 'Product not found.' })
  const reviews = await Review.find({ product: product._id, isPublished: true }).populate('user', 'name').sort({ createdAt: -1 }).limit(12).lean()
  res.json({ product, reviews })
})
export const listReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId, isPublished: true }).populate('user', 'name').sort({ createdAt: -1 }).limit(30)
  res.json({ reviews })
})
export const createReview = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId); if (!product) return res.status(404).json({ message: 'Product not found.' })
  const order = await Order.findOne({ user: req.user._id, status: 'delivered', 'items.product': product._id }).select('_id')
  if (!order) return res.status(403).json({ message: 'Reviews are available after this piece has been delivered to you.' })
  if (await Review.exists({ product: product._id, user: req.user._id })) return res.status(409).json({ message: 'You have already reviewed this piece.' })
  const review = await Review.create({ ...req.body, product: product._id, user: req.user._id, order: order._id, isVerifiedPurchase: true })
  const [aggregate] = await Review.aggregate([{ $match: { product: product._id, isPublished: true } }, { $group: { _id: null, rating: { $avg: '$rating' }, count: { $sum: 1 } } }])
  await Product.updateOne({ _id: product._id }, { rating: Math.round(aggregate.rating * 10) / 10, reviewCount: aggregate.count })
  res.status(201).json({ review })
})
