import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, trim: true }, image: String, parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  isActive: { type: Boolean, default: true }, sortOrder: { type: Number, default: 0 }
}, { timestamps: true })
categorySchema.index({ parent: 1, isActive: 1, sortOrder: 1 })
export default mongoose.model('Category', categorySchema)
