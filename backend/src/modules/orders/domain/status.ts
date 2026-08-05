import type { OrderStatus } from '@chashka-coffee/contracts'

const allowedTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus) {
  return from === to || allowedTransitions[from].includes(to)
}
