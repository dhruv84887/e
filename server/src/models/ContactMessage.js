import mongoose from 'mongoose'

const contactSchema = new mongoose.Schema({ name: { type: String, required: true }, email: { type: String, required: true, lowercase: true }, subject: { type: String, required: true }, message: { type: String, required: true }, status: { type: String, enum: ['new', 'read', 'resolved'], default: 'new' } }, { timestamps: true })
export default mongoose.model('ContactMessage', contactSchema)
