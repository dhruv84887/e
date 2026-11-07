import Product from '../models/Product.js'

export async function countOrderSale(order) {
  if (order.salesCountedAt) return
  for (const item of order.items) {
    await Product.updateOne({ _id: item.product }, { $inc: { soldCount: item.quantity } })
  }
  order.salesCountedAt = new Date()
}

export async function uncountOrderSale(order) {
  if (!order.salesCountedAt) return
  for (const item of order.items) {
    await Product.updateOne({ _id: item.product, soldCount: { $gte: item.quantity } }, { $inc: { soldCount: -item.quantity } })
  }
  order.salesCountedAt = undefined
}
