import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { after, before, test } from 'node:test'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod, mongoose, app, User

before(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'integration-test-secret-not-for-production'
  process.env.CLIENT_URL = 'http://localhost:5173'
  process.env.TAX_RATE = '0.05'
  process.env.SHIPPING_FLAT = '99'
  process.env.FREE_SHIPPING_FROM = '4999'
  process.env.RAZORPAY_KEY_ID = 'rzp_test_integration_key'
  process.env.RAZORPAY_KEY_SECRET = 'razorpay-test-secret'
  process.env.RAZORPAY_WEBHOOK_SECRET = 'razorpay-webhook-test-secret'
  mongod = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongod.getUri()
  ;({ default: mongoose } = await import('mongoose'))
  ;({ default: app } = await import('../src/app.js'))
  ;({ default: User } = await import('../src/models/User.js'))
  const { connectDB } = await import('../src/config/db.js')
  await connectDB()
  globalThis.mongoReady = true
})

after(async () => {
  globalThis.mongoReady = false
  await mongoose?.connection.close()
  await mongod?.stop()
})

test('customer, catalog, cart, checkout, and admin API flow', async () => {
  const api = request(app)

  await api.post('/api/webhooks/razorpay').send({ event: 'refund.processed' }).expect(400)
  const health = await api.get('/api/health').expect(200)
  assert.equal(health.body.database, 'connected')
  const config = await api.get('/api/config').expect(200)
  assert.equal(config.body.freeShippingFrom, 4999)
  assert.equal(config.body.currency, 'INR')
  assert.equal(config.body.razorpayEnabled, true)

  const invalidRegister = await api.post('/api/auth/register').send({ name: 'A', email: 'invalid', password: 'short' }).expect(400)
  assert.equal(invalidRegister.body.issues.length >= 2, true)

  await api.get('/api/cart').expect(401)
  await api.get('/api/admin/overview').expect(401)

  const registered = await api.post('/api/auth/register').send({ name: 'Test Customer', email: 'customer@example.test', password: 'securepass123' }).expect(201)
  const customerCookie = registered.headers['set-cookie'].find((value) => value.startsWith('atelier_token=')).split(';')[0]
  assert.match(registered.headers['set-cookie'].join(';'), /HttpOnly/i)
  assert.equal(registered.body.user.email, 'customer@example.test')
  assert.equal(Object.hasOwn(registered.body.user, 'password'), false)

  const storedCustomer = await User.findOne({ email: 'customer@example.test' }).select('+password')
  assert.notEqual(storedCustomer.password, 'securepass123')
  await api.get('/api/auth/me').set('Cookie', customerCookie).expect(200)
  await api.get('/api/admin/overview').set('Cookie', customerCookie).expect(403)
  await api.post('/api/auth/addresses').set('Cookie', customerCookie).set('Origin', 'https://attacker.example').send({ label: 'Home', fullName: 'Test Customer', phone: '9876543210', line1: '1 Test Street', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India', isDefault: true }).expect(403)
  const savedAddress = await api.post('/api/auth/addresses').set('Cookie', customerCookie).set('Origin', 'http://localhost:5173').send({ label: 'Home', fullName: 'Test Customer', phone: '9876543210', line1: '1 Test Street', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India', isDefault: true }).expect(201)
  const addresses = await api.get('/api/auth/addresses').set('Cookie', customerCookie).expect(200)
  assert.equal(addresses.body.addresses[0].isDefault, true)
  await api.patch('/api/auth/addresses/000000000000000000000001').set('Cookie', customerCookie).send({ isDefault: true }).expect(404)
  const addressesAfterMissingUpdate = await api.get('/api/auth/addresses').set('Cookie', customerCookie).expect(200)
  assert.equal(String(addressesAfterMissingUpdate.body.addresses[0]._id), String(savedAddress.body.address._id))
  assert.equal(addressesAfterMissingUpdate.body.addresses[0].isDefault, true)

  const admin = await User.create({ name: 'Test Admin', email: 'admin@example.test', password: 'securepass123', role: 'admin' })
  const jwt = (await import('jsonwebtoken')).default
  const adminCookie = `atelier_token=${jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' })}`
  await api.get('/api/admin/overview').set('Cookie', adminCookie).expect(200)
  await api.get('/api/admin/customers').set('Cookie', customerCookie).expect(403)
  const filteredCustomers = await api.get('/api/admin/customers?q=customer%40example.test&status=active&page=1').set('Cookie', adminCookie).expect(200)
  assert.equal(filteredCustomers.body.pagination.total, 1)
  assert.equal(filteredCustomers.body.pagination.page, 1)
  assert.equal(filteredCustomers.body.customers[0].email, 'customer@example.test')

  const contactResponse = await api.post('/api/contact').send({ name: 'Curious Shopper', email: 'hello@example.test', subject: 'A question about delivery', message: 'Could you please tell me when this item will arrive?' }).expect(201)
  assert.match(contactResponse.body.message, /Thanks for writing/)
  const newsletterResponse = await api.post('/api/newsletter').send({ email: 'news@example.test' }).expect(201)
  assert.match(newsletterResponse.body.message, /on the list/)
  await api.get('/api/admin/communications/messages').set('Cookie', customerCookie).expect(403)
  await api.get('/api/admin/communications/subscribers').set('Cookie', customerCookie).expect(403)
  const inbox = await api.get('/api/admin/communications/messages?status=new').set('Cookie', adminCookie).expect(200)
  assert.equal(inbox.body.newCount, 1)
  assert.equal(inbox.body.messages[0].email, 'hello@example.test')
  const messageId = inbox.body.messages[0]._id
  await api.patch(`/api/admin/communications/messages/${messageId}`).set('Cookie', adminCookie).send({ status: 'not-a-status' }).expect(400)
  await api.patch(`/api/admin/communications/messages/${messageId}`).set('Cookie', adminCookie).send({ status: 'read' }).expect(200)
  const subscribers = await api.get('/api/admin/communications/subscribers?status=active&q=news%40example.test').set('Cookie', adminCookie).expect(200)
  assert.equal(subscribers.body.pagination.total, 1)
  const subscriberId = subscribers.body.subscribers[0]._id
  await api.patch(`/api/admin/communications/subscribers/${subscriberId}`).set('Cookie', adminCookie).send({ isActive: false }).expect(200)
  assert.equal((await api.get('/api/admin/communications/subscribers?status=active').set('Cookie', adminCookie).expect(200)).body.pagination.total, 0)

  await api.post('/api/admin/coupons').set('Cookie', adminCookie).send({ code: 'TOO-MUCH', type: 'percent', value: 101 }).expect(400)
  const editableCoupon = await api.post('/api/admin/coupons').set('Cookie', adminCookie).send({ code: 'EDIT-ME', type: 'percent', value: 15, usageLimit: 10 }).expect(201)
  await api.patch(`/api/admin/coupons/${editableCoupon.body.coupon._id}`).set('Cookie', customerCookie).send({ value: 20 }).expect(403)
  const updatedCoupon = await api.patch(`/api/admin/coupons/${editableCoupon.body.coupon._id}`).set('Cookie', adminCookie).send({ value: 20, maxDiscount: 250, usageLimit: 12, expiresAt: '2027-11-07T00:00:00.000Z' }).expect(200)
  assert.equal(updatedCoupon.body.coupon.value, 20)
  assert.equal(updatedCoupon.body.coupon.maxDiscount, 250)
  assert.equal(updatedCoupon.body.coupon.usageLimit, 12)
  await api.patch(`/api/admin/coupons/${editableCoupon.body.coupon._id}`).set('Cookie', adminCookie).send({ value: 101 }).expect(400)
  const clearedCouponLimits = await api.patch(`/api/admin/coupons/${editableCoupon.body.coupon._id}`).set('Cookie', adminCookie).send({ maxDiscount: null, usageLimit: null, expiresAt: null }).expect(200)
  assert.equal(clearedCouponLimits.body.coupon.maxDiscount, null)
  assert.equal(clearedCouponLimits.body.coupon.usageLimit, null)
  assert.equal(clearedCouponLimits.body.coupon.expiresAt, null)
  const editableBanner = await api.post('/api/admin/banners').set('Cookie', adminCookie).send({ title: 'A new season', image: 'https://images.example.test/season.webp', placement: 'hero', href: '/shop' }).expect(201)
  await api.patch(`/api/admin/banners/${editableBanner.body.banner._id}`).set('Cookie', customerCookie).send({ title: 'Changed by customer' }).expect(403)
  const updatedBanner = await api.patch(`/api/admin/banners/${editableBanner.body.banner._id}`).set('Cookie', adminCookie).send({ title: 'A quieter season', isActive: false, sortOrder: 2 }).expect(200)
  assert.equal(updatedBanner.body.banner.title, 'A quieter season')
  assert.equal(updatedBanner.body.banner.isActive, false)

  const categoryResponse = await api.post('/api/admin/categories').set('Cookie', adminCookie).send({ name: 'Electronics', description: 'Test category' }).expect(201)
  const categoryId = categoryResponse.body.category._id
  const subcategoryResponse = await api.post('/api/admin/categories').set('Cookie', adminCookie).send({ name: 'Audio', parent: categoryId }).expect(201)
  await api.post('/api/admin/categories').set('Cookie', adminCookie).send({ name: 'Nested audio', parent: subcategoryResponse.body.category._id }).expect(400)
  await api.post('/api/admin/products').set('Cookie', adminCookie).send({ name: 'Invalid discount item', description: 'An integration product with an invalid sale price.', category: categoryId, price: 500, discountPrice: 600, stock: 1 }).expect(400)
  await api.post('/api/admin/products').set('Cookie', adminCookie).send({ name: 'Invalid variant item', description: 'An integration product with an invalid stock variant.', category: categoryId, price: 500, stock: 1, variants: [{ name: 'Small', stock: -1 }] }).expect(400)
  const productResponse = await api.post('/api/admin/products').set('Cookie', adminCookie).send({
    name: 'Test Headphones', description: 'A deliberately detailed integration test product.', sku: 'TEST-001',
    category: categoryId, brand: 'Atelier', price: 1000, discountPrice: 900, stock: 3,
    images: ['https://images.unsplash.com/photo-test'], featured: true, isAvailable: true,
  }).expect(201)
  const productId = productResponse.body.product._id
  await api.patch(`/api/admin/products/${productId}`).set('Cookie', adminCookie).send({ price: 500 }).expect(400)
  await api.patch(`/api/admin/products/${productId}`).set('Cookie', adminCookie).send({ discountPrice: null }).expect(200)
  await api.patch(`/api/admin/products/${productId}`).set('Cookie', adminCookie).send({ discountPrice: 900 }).expect(200)
  await api.patch(`/api/admin/products/${productId}`).set('Cookie', customerCookie).send({ price: 100 }).expect(403)
  const secondProduct = await api.post('/api/admin/products').set('Cookie', adminCookie).send({ name: 'Test Ceramic Cup', description: 'A second product for effective-price sorting checks.', sku: 'TEST-002', category: categoryId, subcategory: subcategoryResponse.body.category._id, price: 950, stock: 8 }).expect(201)
  await api.post('/api/admin/coupons').set('Cookie', adminCookie).send({ code: 'SAVE10', type: 'percent', value: 10, minSubtotal: 500, usageLimit: 5 }).expect(201)
  const priceSort = await api.get('/api/products?category=electronics&sort=price_asc').expect(200)
  assert.equal(priceSort.body.products[0]._id, productId)
  const subcategoryProducts = await api.get('/api/products?category=audio').expect(200)
  assert.equal(subcategoryProducts.body.products[0]._id, secondProduct.body.product._id)
  await api.get('/api/products?minPrice=900&maxPrice=100').expect(400)
  const { calculateTotals } = await import('../src/utils/pricing.js')
  process.env.FREE_SHIPPING_FROM = '1500'
  assert.equal(calculateTotals(1800).shipping, 0)
  process.env.FREE_SHIPPING_FROM = '4999'

  const cartResponse = await api.post('/api/cart/items').set('Cookie', customerCookie).send({ productId, quantity: 2 }).expect(201)
  assert.equal(cartResponse.body.items[0].quantity, 2)
  assert.equal(cartResponse.body.subtotal, 1800)
  await api.delete('/api/cart').set('Cookie', customerCookie).expect(200)
  assert.equal((await api.get('/api/cart').set('Cookie', customerCookie).expect(200)).body.items.length, 0)
  await api.post('/api/cart/items').set('Cookie', customerCookie).send({ productId, quantity: 2 }).expect(201)
  const appliedCoupon = await api.post('/api/cart/coupon').set('Cookie', customerCookie).send({ code: 'save10' }).expect(200)
  assert.equal(appliedCoupon.body.discount, 180)
  const persistedCart = await api.get('/api/cart').set('Cookie', customerCookie).expect(200)
  assert.equal(persistedCart.body.coupon.code, 'SAVE10')
  const configuredKeyId = process.env.RAZORPAY_KEY_ID
  delete process.env.RAZORPAY_KEY_ID
  await api.post('/api/orders').set('Cookie', customerCookie).send({ paymentMethod: 'razorpay', shippingAddress: { fullName: 'Test Customer', phone: '9876543210', line1: '1 Test Street', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India' } }).expect(503)
  assert.equal((await api.get('/api/cart').set('Cookie', customerCookie).expect(200)).body.items[0].quantity, 2)
  assert.equal((await (await import('../src/models/Product.js')).default.findById(productId)).stock, 3)
  process.env.RAZORPAY_KEY_ID = configuredKeyId
  await api.put(`/api/wishlist/${productId}`).set('Cookie', customerCookie).expect(200)
  const wishlist = await api.get('/api/wishlist').set('Cookie', customerCookie).expect(200)
  assert.equal(wishlist.body.products.length, 1)

  await api.post('/api/orders').set('Cookie', customerCookie).send({ shippingAddress: {}, paymentMethod: 'cod' }).expect(400)
  const orderResponse = await api.post('/api/orders').set('Cookie', customerCookie).send({
    paymentMethod: 'cod', shippingAddress: { fullName: 'Test Customer', phone: '9876543210', line1: '1 Test Street', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India' },
  }).expect(201)
  assert.equal(orderResponse.body.order.status, 'confirmed')
  assert.equal(orderResponse.body.order.total, 1800)
  await api.patch(`/api/admin/orders/${orderResponse.body.order._id}`).set('Cookie', adminCookie).send({ status: 'pending' }).expect(400)
  await api.post(`/api/products/${productId}/reviews`).set('Cookie', customerCookie).send({ rating: 5, title: 'Lovely sound', body: 'Clear audio and comfortable fit.' }).expect(403)
  assert.equal((await api.get(`/api/orders/${orderResponse.body.order._id}`).set('Cookie', customerCookie).expect(200)).body.order.orderNumber.startsWith('AT-'), true)
  assert.equal((await (await import('../src/models/Product.js')).default.findById(productId)).stock, 1)

  await api.post('/api/payments/razorpay/verify').set('Cookie', customerCookie).send({ razorpay_order_id: 'order_test', razorpay_payment_id: 'pay_test', razorpay_signature: 'invalid' }).expect(400)
  const shipped = await api.patch(`/api/admin/orders/${orderResponse.body.order._id}`).set('Cookie', adminCookie).send({ status: 'shipped', trackingNumber: 'TRACK-001', trackingUrl: 'https://tracking.example.test/TRACK-001' }).expect(200)
  assert.equal(shipped.body.order.trackingNumber, 'TRACK-001')
  const delivered = await api.patch(`/api/admin/orders/${orderResponse.body.order._id}`).set('Cookie', adminCookie).send({ status: 'delivered' }).expect(200)
  assert.equal(delivered.body.order.paymentStatus, 'paid')
  assert.equal((await (await import('../src/models/Product.js')).default.findById(productId)).soldCount, 2)
  assert.equal((await (await import('../src/models/Coupon.js')).default.findOne({ code: 'SAVE10' })).usedCount, 1)
  const createdReview = await api.post(`/api/products/${productId}/reviews`).set('Cookie', customerCookie).send({ rating: 5, title: 'Lovely sound', body: 'Clear audio and comfortable fit.' }).expect(201)
  const reviewId = createdReview.body.review._id
  assert.equal(createdReview.body.review.isVerifiedPurchase, true)
  await api.post(`/api/products/${productId}/reviews`).set('Cookie', customerCookie).send({ rating: 3, body: 'A second review should not be allowed.' }).expect(409)
  const adminReviews = await api.get('/api/admin/reviews?status=published').set('Cookie', adminCookie).expect(200)
  assert.equal(adminReviews.body.pagination.total, 1)
  assert.equal(adminReviews.body.reviews[0].order.orderNumber, orderResponse.body.order.orderNumber)
  await api.patch(`/api/admin/reviews/${reviewId}`).set('Cookie', customerCookie).send({ isPublished: false }).expect(403)
  await api.patch(`/api/admin/reviews/${reviewId}`).set('Cookie', adminCookie).send({ isPublished: false }).expect(200)
  let ratedProduct = await (await import('../src/models/Product.js')).default.findById(productId)
  assert.equal(ratedProduct.rating, 0)
  assert.equal(ratedProduct.reviewCount, 0)
  assert.equal((await api.get(`/api/products/${productId}/reviews`).expect(200)).body.reviews.length, 0)
  await api.patch(`/api/admin/reviews/${reviewId}`).set('Cookie', adminCookie).send({ isPublished: true }).expect(200)
  ratedProduct = await (await import('../src/models/Product.js')).default.findById(productId)
  assert.equal(ratedProduct.rating, 5)
  assert.equal(ratedProduct.reviewCount, 1)
  await api.post('/api/cart/items').set('Cookie', customerCookie).send({ productId, quantity: 1 }).expect(201)
  await api.post('/api/orders').set('Cookie', customerCookie).send({
    couponCode: 'NOT-A-REAL-COUPON', paymentMethod: 'cod', shippingAddress: { fullName: 'Test Customer', phone: '9876543210', line1: '1 Test Street', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India' },
  }).expect(400)
  assert.equal((await (await import('../src/models/Product.js')).default.findById(productId)).stock, 1)
  await api.delete('/api/cart').set('Cookie', customerCookie).expect(200)
  await api.post('/api/cart/items').set('Cookie', customerCookie).send({ productId, quantity: 1 }).expect(201)
  await api.post('/api/cart/coupon').set('Cookie', customerCookie).send({ code: 'SAVE10' }).expect(200)
  const cancelOrder = await api.post('/api/orders').set('Cookie', customerCookie).send({
    paymentMethod: 'cod', shippingAddress: { fullName: 'Test Customer', phone: '9876543210', line1: '1 Test Street', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India' },
  }).expect(201)
  assert.equal((await (await import('../src/models/Coupon.js')).default.findOne({ code: 'SAVE10' })).usedCount, 2)
  await api.post(`/api/orders/${cancelOrder.body.order._id}/cancel`).set('Cookie', customerCookie).send({ reason: 'Testing inventory restoration' }).expect(200)
  assert.equal((await (await import('../src/models/Coupon.js')).default.findOne({ code: 'SAVE10' })).usedCount, 1)
  const finalProduct = await (await import('../src/models/Product.js')).default.findById(productId)
  assert.equal(finalProduct.stock, 1)
  assert.equal(finalProduct.soldCount, 2)
  const finalOverview = (await api.get('/api/admin/overview').set('Cookie', adminCookie).expect(200)).body
  assert.equal(finalOverview.metrics.totalOrders, 2)
  assert.equal(finalOverview.metrics.revenue, 1800)
  assert.equal(finalOverview.bestSellers[0].soldCount, 2)

  await api.post('/api/cart/items').set('Cookie', customerCookie).send({ productId, quantity: 1 }).expect(201)
  const onlineOrder = await api.post('/api/orders').set('Cookie', customerCookie).send({
    paymentMethod: 'razorpay', shippingAddress: { fullName: 'Test Customer', phone: '9876543210', line1: '1 Test Street', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India' },
  }).expect(201)
  const Payment = (await import('../src/models/Payment.js')).default
  const payment = await Payment.findOne({ order: onlineOrder.body.order._id, provider: 'razorpay' })
  payment.providerOrderId = 'order_integration_test'
  await payment.save()
  const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update('order_integration_test|pay_integration_test').digest('hex')
  const verified = await api.post('/api/payments/razorpay/verify').set('Cookie', customerCookie).send({ razorpay_order_id: 'order_integration_test', razorpay_payment_id: 'pay_integration_test', razorpay_signature: signature }).expect(200)
  assert.equal(verified.body.order.paymentStatus, 'paid')
  assert.equal((await (await import('../src/models/Product.js')).default.findById(productId)).soldCount, 3)
  const paidOverview = (await api.get('/api/admin/overview').set('Cookie', adminCookie).expect(200)).body
  assert.equal(paidOverview.metrics.totalOrders, 3)
  assert.equal(paidOverview.metrics.revenue, 2844)

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID
  delete process.env.RAZORPAY_KEY_ID
  await api.patch(`/api/admin/orders/${onlineOrder.body.order._id}`).set('Cookie', adminCookie).send({ status: 'refunded' }).expect(503)
  process.env.RAZORPAY_KEY_ID = razorpayKeyId
  assert.equal((await api.get(`/api/orders/${onlineOrder.body.order._id}`).set('Cookie', customerCookie).expect(200)).body.order.paymentStatus, 'paid')
  const refundWebhook = { event: 'refund.processed', payload: { refund: { entity: { id: 'rf_integration_test', payment_id: 'pay_integration_test', status: 'processed' } } } }
  const refundWebhookBody = JSON.stringify(refundWebhook)
  const webhookSignature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(refundWebhookBody).digest('hex')
  await api.post('/api/webhooks/razorpay').set('Content-Type', 'application/json').set('x-razorpay-signature', webhookSignature).send(refundWebhookBody).expect(200)
  const refundedOrder = (await api.get(`/api/orders/${onlineOrder.body.order._id}`).set('Cookie', customerCookie).expect(200)).body.order
  assert.equal(refundedOrder.status, 'refunded')
  assert.equal(refundedOrder.paymentStatus, 'refunded')
  assert.equal(refundedOrder.refundStatus, 'processed')
  assert.equal((await (await import('../src/models/Product.js')).default.findById(productId)).stock, 1)
  assert.equal((await (await import('../src/models/Product.js')).default.findById(productId)).soldCount, 2)

  await api.post('/api/cart/items').set('Cookie', customerCookie).send({ productId: secondProduct.body.product._id, quantity: 1 }).expect(201)
  const latePaymentOrder = await api.post('/api/orders').set('Cookie', customerCookie).send({
    paymentMethod: 'razorpay', shippingAddress: { fullName: 'Test Customer', phone: '9876543210', line1: '1 Test Street', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India' },
  }).expect(201)
  const latePayment = await Payment.findOne({ order: latePaymentOrder.body.order._id, provider: 'razorpay' })
  latePayment.providerOrderId = 'order_cancelled_before_payment'
  await latePayment.save()
  const lateOrderDocument = await (await import('../src/models/Order.js')).default.findById(latePaymentOrder.body.order._id)
  lateOrderDocument.reservationExpiresAt = new Date(Date.now() - 1000)
  await lateOrderDocument.save()
  const { sweepExpiredReservations } = await import('../src/services/orderReservations.js')
  assert.equal(await sweepExpiredReservations(), 1)
  const lateSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update('order_cancelled_before_payment|pay_too_late').digest('hex')
  await api.post('/api/payments/razorpay/verify').set('Cookie', customerCookie).send({ razorpay_order_id: 'order_cancelled_before_payment', razorpay_payment_id: 'pay_too_late', razorpay_signature: lateSignature }).expect(409)
  assert.equal((await (await import('../src/models/Product.js')).default.findById(secondProduct.body.product._id)).stock, 8)
  const settledOverview = (await api.get('/api/admin/overview').set('Cookie', adminCookie).expect(200)).body
  assert.equal(settledOverview.metrics.totalOrders, 4)
  assert.equal(settledOverview.metrics.revenue, 1800)
  assert.equal(settledOverview.bestSellers[0].soldCount, 2)

  await api.delete('/api/cart').set('Cookie', customerCookie).expect(200)
  const sizeOnlyProduct = await api.post('/api/admin/products').set('Cookie', adminCookie).send({ name: 'Everyday Cotton Tee', description: 'A simple tee available in multiple sizes.', category: categoryId, price: 500, stock: 3, sizes: ['S', 'M'] }).expect(201)
  await api.post('/api/cart/items').set('Cookie', customerCookie).send({ productId: sizeOnlyProduct.body.product._id, size: 'XL', quantity: 1 }).expect(400)
  const selectedSizeCart = await api.post('/api/cart/items').set('Cookie', customerCookie).send({ productId: sizeOnlyProduct.body.product._id, size: 'M', quantity: 1 }).expect(201)
  assert.equal(selectedSizeCart.body.items[0].size, 'M')
  const sizeOrder = await api.post('/api/orders').set('Cookie', customerCookie).send({ paymentMethod: 'cod', shippingAddress: { fullName: 'Test Customer', phone: '9876543210', line1: '1 Test Street', city: 'Mumbai', state: 'Maharashtra', postalCode: '400001', country: 'India' } }).expect(201)
  assert.equal(sizeOrder.body.order.items[0].variant.size, 'M')
  await api.post(`/api/orders/${sizeOrder.body.order._id}/cancel`).set('Cookie', customerCookie).send({ reason: 'Testing size inventory release' }).expect(200)
  assert.equal((await (await import('../src/models/Product.js')).default.findById(sizeOnlyProduct.body.product._id)).stock, 3)
  const unavailableProduct = await api.post('/api/admin/products').set('Cookie', adminCookie).send({ name: 'Temporarily unavailable find', description: 'This item is kept visible on its own page but cannot be purchased.', category: categoryId, price: 700, stock: 4, isAvailable: false }).expect(201)
  const unavailableDetails = await api.get(`/api/products/${unavailableProduct.body.product.slug}`).expect(200)
  assert.equal(unavailableDetails.body.product.isAvailable, false)
  await api.post('/api/cart/items').set('Cookie', customerCookie).send({ productId: unavailableProduct.body.product._id, quantity: 1 }).expect(404)
})
