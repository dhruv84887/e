import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema({ order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true }, provider: { type: String, enum: ['razorpay', 'cod'], required: true }, providerOrderId: String, providerPaymentId: String, signature: String, refundId: String, refundStatus: { type: String, enum: ['none', 'pending', 'processed', 'failed'], default: 'none' }, amount: { type: Number, required: true }, currency: { type: String, default: 'INR' }, status: { type: String, enum: ['created', 'authorized', 'captured', 'failed', 'refunded'], default: 'created' }, raw: mongoose.Schema.Types.Mixed }, { timestamps: true })
export default mongoose.model('Payment', paymentSchema)
