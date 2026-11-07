import mongoose from 'mongoose'

const variantSchema = new mongoose.Schema({ name: { type: String, required: true }, sku: String, price: Number, stock: { type: Number, default: 0 }, options: { type: Map, of: String } }, { _id: true })
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 180 }, slug: { type: String, unique: true, lowercase: true },
  sku: { type: String, unique: true, sparse: true, uppercase: true, trim: true }, description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 }, compareAtPrice: { type: Number, min: 0 }, discountPrice: { type: Number, min: 0, validate: { validator(value) { return value == null || value <= (this.price ?? value) }, message: 'The discounted price must not be higher than the regular price.' } },
  images: [{ url: String, alt: String }], category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null }, brand: { type: String, trim: true, index: true },
  stock: { type: Number, required: true, min: 0, default: 0 }, variants: [variantSchema], sizes: [String], colors: [String], specifications: { type: Map, of: String },
  rating: { type: Number, min: 0, max: 5, default: 0 }, reviewCount: { type: Number, default: 0 }, soldCount: { type: Number, default: 0 },
  featured: { type: Boolean, default: false }, isNewArrival: { type: Boolean, default: false }, isAvailable: { type: Boolean, default: true }, isActive: { type: Boolean, default: true }
}, { timestamps: true })
productSchema.index({ name: 'text', brand: 'text', description: 'text' })
productSchema.index({ category: 1, isActive: 1, price: 1, createdAt: -1 })
export default mongoose.model('Product', productSchema)
