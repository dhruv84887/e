import mongoose from 'mongoose'

const itemSchema = new mongoose.Schema({ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, variantId: mongoose.Schema.Types.ObjectId, color: String, quantity: { type: Number, min: 1, default: 1 } }, { _id: true })
const cartSchema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true }, items: [itemSchema], couponCode: String }, { timestamps: true })
export default mongoose.model('Cart', cartSchema)
