import type {
  ORDER_STATUS,
  DELIVERY_STATUS,
  PAYMENT_STATUS,
  TICKET_STATUS,
  PRIORITY,
  RATING_TYPE,
  PRODUCT_CATEGORY,
} from './constants'

export type User = {
  id: string
  email: string
  role: 'CUSTOMER' | 'ADMIN' | 'DRIVER'
  profile?: UserProfile
  createdAt: Date
}

export type UserProfile = {
  id: string
  userId: string
  firstName?: string
  lastName?: string
  phone?: string
  address?: string
  city?: string
  zipCode?: string
  profilePhoto?: string
}

export type Product = {
  id: string
  name: string
  description?: string
  price: number
  category: typeof PRODUCT_CATEGORY[keyof typeof PRODUCT_CATEGORY]
  stock: number
  minimumStock: number
  photos: string[]
  isFeatured: boolean
  createdAt: Date
  updatedAt: Date
}

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS]

export type Order = {
  id: string
  orderNumber: string
  userId: string
  subtotal: number
  taxAmount: number
  totalPrice: number
  status: OrderStatus
  deliveryAddress: string
  deliveryCity: string
  deliveryZipCode: string
  items: OrderItem[]
  payment?: Payment
  delivery?: Delivery
  createdAt: Date
  updatedAt: Date
}

export type OrderItem = {
  id: string
  orderId: string
  productId: string
  product: Product
  quantity: number
  priceAtTime: number
  packaging?: string
  packagingPrice: number
}

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS]

export type Payment = {
  id: string
  orderId: string
  amount: number
  method: 'STRIPE' | 'CASH_ON_DELIVERY'
  status: PaymentStatus
  stripePaymentId?: string
  collectedAmount?: number
  createdAt: Date
}

export type DeliveryStatus = typeof DELIVERY_STATUS[keyof typeof DELIVERY_STATUS]

export type Delivery = {
  id: string
  orderId: string
  driverId?: string
  driver?: User
  status: DeliveryStatus
  currentLat?: number
  currentLng?: number
  locationUpdatedAt?: Date
  estimatedDelivery?: Date
  actualDelivery?: Date
  proofPhoto?: string
  createdAt: Date
}

export type LoyaltyCard = {
  id: string
  userId: string
  points: number
  totalSpent: number
  tier: 'BRONZE' | 'SILVER' | 'GOLD'
  createdAt: Date
}

export type RatingType = typeof RATING_TYPE[keyof typeof RATING_TYPE]

export type Rating = {
  id: string
  userId: string
  orderId: string
  productId?: string
  type: RatingType
  score: number
  comment?: string
  createdAt: Date
}

export type TicketStatus = typeof TICKET_STATUS[keyof typeof TICKET_STATUS]
export type Priority = typeof PRIORITY[keyof typeof PRIORITY]

export type Ticket = {
  id: string
  ticketNumber: string
  userId: string
  orderId?: string
  title: string
  description: string
  status: TicketStatus
  priority: Priority
  messages: TicketMessage[]
  attachments: string[]
  createdAt: Date
  resolvedAt?: Date
}

export type TicketMessage = {
  id: string
  ticketId: string
  userId: string
  message: string
  attachments: string[]
  createdAt: Date
}
