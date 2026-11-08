import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema({ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, name: String, image: String, sku: String, variant: mongoose.Schema.Types.Mixed, quantity: Number, unitPrice: Number }, { _id: true })
const addressSnapshot = new mongoose.Schema({ label: String, fullName: String, phone: String, line1: String, line2: String, city: String, state: String, postalCode: String, country: String }, { _id: false })
const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, index: true }, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, items: [orderItemSchema],
  shippingAddress: { type: addressSnapshot, required: true }, subtotal: Number, discount: { type: Number, default: 0 }, tax: Number, shipping: Number, total: Number,
  couponCode: String, paymentMethod: { type: String, enum: ['cod', 'razorpay'], required: true }, paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  refundStatus: { type: String, enum: ['none', 'pending', 'processed', 'failed'], default: 'none' },
  status: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'], default: 'pending', index: true },
  trackingNumber: String, trackingUrl: String, cancellationReason: String, deliveredAt: Date, salesCountedAt: Date, reservationExpiresAt: Date
}, { timestamps: true })
orderSchema.index({ status: 1, paymentStatus: 1, reservationExpiresAt: 1 })
orderSchema.index({ user: 1, createdAt: -1, _id: -1 })
orderSchema.index({ status: 1, createdAt: -1, _id: -1 })
orderSchema.index({ createdAt: -1, _id: -1 })
export default mongoose.model('Order', orderSchema)
