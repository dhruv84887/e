import mongoose from 'mongoose'

const subscriberSchema = new mongoose.Schema({ email: { type: String, required: true, unique: true, lowercase: true, trim: true }, isActive: { type: Boolean, default: true } }, { timestamps: true })
export default mongoose.model('Subscriber', subscriberSchema)
