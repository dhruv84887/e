import 'dotenv/config'
import mongoose from 'mongoose'
import slugify from 'slugify'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectDB } from './config/db.js'
import Category from './models/Category.js'
import Product from './models/Product.js'
import User from './models/User.js'

const categoryData = [
  { name: 'Technology', description: 'Thoughtful tools for the way we live now.', image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1000&q=85' },
  { name: 'Home & Living', description: 'Considered pieces for slower, softer days.', image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85' },
  { name: 'Clothing', description: 'Everyday essentials with a longer life.', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=85' },
  { name: 'Accessories', description: 'The little details that make it yours.', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85' },
  { name: 'Beauty', description: 'Daily rituals, made a little more special.', image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1000&q=85' },
  { name: 'Sports & Outdoors', description: 'Get outside. Stay curious.', image: 'https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1000&q=85' }
]
const productData = [
  { name: 'Studio Wireless Headphones', sku: 'AT-TECH-001', description: 'Rich, balanced sound wrapped in soft memory foam. A considered companion for every playlist and every quiet moment.', price: 8490, compareAtPrice: 9990, discountPrice: 8490, brand: 'Aural', stock: 24, featured: true, isNewArrival: true, category: 'Technology', image: 'photo-1505740420928-5e560c06d30e', color: 'Warm clay' },
  { name: 'Everyday Ceramic Set', sku: 'AT-HOME-002', description: 'A set of two hand-finished stoneware cups with a tactile matte glaze. Made for the first coffee and the last tea.', price: 1890, brand: 'Form & Field', stock: 42, featured: true, category: 'Home & Living', image: 'photo-1514228742587-6b1558fcca3d', color: 'Oat' },
  { name: 'Canvas Weekend Tote', sku: 'AT-ACC-003', description: 'Room for the long way home. Made from sturdy organic cotton canvas with a roomy interior pocket.', price: 1290, compareAtPrice: 1590, discountPrice: 1290, brand: 'Common Goods', stock: 18, featured: true, category: 'Accessories', image: 'photo-1544816155-12df9643f363', color: 'Natural' },
  { name: 'Architect Desk Lamp', sku: 'AT-HOME-004', description: 'A beautifully balanced lamp with warm dimmable light and a weighted, powder-coated base.', price: 4290, brand: 'Good Measure', stock: 15, featured: true, category: 'Home & Living', image: 'photo-1507473885765-e6ed057f782c', color: 'Ivory' },
  { name: 'Daily Essential Serum', sku: 'AT-BEAU-005', description: 'A lightweight, fragrance-free botanical serum that leaves skin calm, hydrated and comfortable.', price: 1690, brand: 'Ritual No. 4', stock: 36, isNewArrival: true, category: 'Beauty', image: 'photo-1608248543803-ba4f8c70ae0b', color: 'Clear' },
  { name: 'Field Notes Watch', sku: 'AT-ACC-006', description: 'A quiet, easy-to-read face paired with a soft recycled strap. Made to go with everything.', price: 5490, brand: 'Northline', stock: 12, featured: true, category: 'Accessories', image: 'photo-1523275335684-37898b6baf30', color: 'Olive' },
  { name: 'Soft Form Knit', sku: 'AT-CLO-007', description: 'A relaxed, breathable knit with a beautifully soft hand feel. An easy layer for all year round.', price: 2990, brand: 'Common Goods', stock: 20, isNewArrival: true, category: 'Clothing', image: 'photo-1576566588028-4147f3842f27', color: 'Stone', sizes: ['S', 'M', 'L', 'XL'] },
  { name: 'Move Easy Training Mat', sku: 'AT-SPORT-008', description: 'A grippy, supportive natural rubber mat with an easy-carry strap for movement wherever you are.', price: 2490, brand: 'Sunday Supply', stock: 27, category: 'Sports & Outdoors', image: 'photo-1592432678016-e910b452f9a2', color: 'Sage' }
]

export async function seedDemoData() {
  const categories = new Map()
  for (const data of categoryData) {
    const category = await Category.findOneAndUpdate({ slug: slugify(data.name, { lower: true, strict: true }) }, { ...data, slug: slugify(data.name, { lower: true, strict: true }), isActive: true }, { new: true, upsert: true, setDefaultsOnInsert: true })
    categories.set(data.name, category._id)
  }
  for (const data of productData) {
    const { category, image, color, ...fields } = data
    const doc = { ...fields, slug: slugify(data.name, { lower: true, strict: true }), category: categories.get(category), colors: [color], images: [{ url: `https://images.unsplash.com/${image}?auto=format&fit=crop&w=900&q=85`, alt: data.name }], isAvailable: true, isActive: true, specifications: { material: category === 'Home & Living' ? 'Stoneware' : 'Thoughtfully selected materials', care: 'Made for everyday use' } }
    await Product.findOneAndUpdate({ sku: data.sku }, doc, { upsert: true, new: true, setDefaultsOnInsert: true })
  }
  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    const email = process.env.SEED_ADMIN_EMAIL.toLowerCase()
    let admin = await User.findOne({ email }).select('+password')
    if (!admin) {
      admin = new User({
        email,
        name: process.env.SEED_ADMIN_NAME || 'Store Admin',
        password: process.env.SEED_ADMIN_PASSWORD,
        role: 'admin',
        isActive: true
      })
    } else {
      admin.role = 'admin'
      admin.isActive = true
    }
    await admin.save()
  }
  console.info(`Seeded ${categoryData.length} categories and ${productData.length} products.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await connectDB()
    await seedDemoData()
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}
