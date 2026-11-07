import Product from '../models/Product.js'
import Order from '../models/Order.js'
import Payment from '../models/Payment.js'
import Coupon from '../models/Coupon.js'

async function releaseInventory(order) {
  for (const item of order.items) {
    if (item.variant?._id) {
      await Product.updateOne({ _id: item.product, 'variants._id': item.variant._id }, { $inc: { stock: item.quantity, 'variants.$.stock': item.quantity } })
    } else {
      await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })
    }
  }
}

export async function expireOrderReservation(orderId, now = new Date()) {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: 'pending', paymentStatus: 'pending', reservationExpiresAt: { $lte: now } },
    { $set: { status: 'cancelled', paymentStatus: 'failed', cancellationReason: 'Online payment window expired' }, $unset: { reservationExpiresAt: 1 } },
    { new: true }
  )
  if (!order) return false
  await releaseInventory(order)
  if (order.couponCode) await Coupon.updateOne({ code: order.couponCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } })
  await Payment.updateMany({ order: order._id, provider: 'razorpay', status: 'created' }, { status: 'failed' })
  return true
}

export async function sweepExpiredReservations(now = new Date()) {
  const due = await Order.find({ status: 'pending', paymentStatus: 'pending', reservationExpiresAt: { $lte: now } }).select('_id').lean()
  let expired = 0
  for (const { _id } of due) if (await expireOrderReservation(_id, now)) expired += 1
  return expired
}
