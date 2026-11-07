import Product from '../models/Product.js'
import Coupon from '../models/Coupon.js'
import { uncountOrderSale } from '../utils/sales.js'

async function restoreReservedInventory(order) {
  for (const item of order.items) {
    if (item.variant?._id) {
      await Product.updateOne({ _id: item.product, 'variants._id': item.variant._id }, { $inc: { stock: item.quantity, 'variants.$.stock': item.quantity } })
    } else {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
    }
  }
}

export async function completeOrderRefund(order, payment, refund) {
  if (order.refundStatus === 'processed') return
  const shouldRestock = ['pending', 'confirmed', 'processing'].includes(order.status)
  if (shouldRestock) {
    await restoreReservedInventory(order)
    if (order.couponCode) await Coupon.updateOne({ code: order.couponCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } })
  }
  order.status = 'refunded'
  order.paymentStatus = 'refunded'
  order.refundStatus = 'processed'
  payment.refundId = refund?.id || payment.refundId
  payment.refundStatus = 'processed'
  payment.status = 'refunded'
  if (refund) payment.raw = { ...(payment.raw || {}), refund }
  await uncountOrderSale(order)
  await Promise.all([order.save(), payment.save()])
}
