import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home' }, fullName: { type: String, required: true, trim: true }, phone: { type: String, required: true, trim: true },
  line1: { type: String, required: true, trim: true }, line2: { type: String, trim: true }, city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true }, postalCode: { type: String, required: true, trim: true }, country: { type: String, default: 'India' }, isDefault: { type: Boolean, default: false }
}, { timestamps: true })

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 }, email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, minlength: 8, select: false }, role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  phone: { type: String, trim: true }, addresses: [addressSchema], resetTokenHash: String, resetTokenExpires: Date, isActive: { type: Boolean, default: true }
}, { timestamps: true })

userSchema.pre('save', async function () { if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12) })
userSchema.index({ role: 1, isActive: 1, createdAt: -1 })
userSchema.methods.comparePassword = function (candidate) { return bcrypt.compare(candidate, this.password) }
export default mongoose.model('User', userSchema)
