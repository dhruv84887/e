import mongoose from 'mongoose'

export async function connectDB() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required. Copy .env.example and configure MongoDB.')
  mongoose.set('strictQuery', true)
  await mongoose.connect(process.env.MONGODB_URI)
  console.info(`MongoDB connected: ${mongoose.connection.name}`)
}
