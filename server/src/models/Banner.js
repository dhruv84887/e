import mongoose from 'mongoose'

const bannerSchema = new mongoose.Schema({ title: { type: String, required: true }, subtitle: String, image: { type: String, required: true }, href: String, placement: { type: String, enum: ['hero', 'promo', 'collection'], default: 'promo' }, isActive: { type: Boolean, default: true }, sortOrder: { type: Number, default: 0 }, startsAt: Date, endsAt: Date }, { timestamps: true })
export default mongoose.model('Banner', bannerSchema)
