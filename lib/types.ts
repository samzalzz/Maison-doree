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
  category: string
  stock: number
  minimumStock: number
  photos: string[]
  isFeatured: boolean
  createdAt: Date
  updatedAt: Date
}

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

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'CANCELLED'

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

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'

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

export type DeliveryStatus =
  | 'UNASSIGNED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'CANCELLED'

export type LoyaltyCard = {
  id: string
  userId: string
  points: number
  totalSpent: number
  tier: 'BRONZE' | 'SILVER' | 'GOLD'
  createdAt: Date
}

export type Rating = {
  id: string
  userId: string
  orderId: string
  productId?: string
  type: 'PRODUCT' | 'DELIVERY'
  score: number
  comment?: string
  createdAt: Date
}

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

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type TicketMessage = {
  id: string
  ticketId: string
  userId: string
  message: string
  attachments: string[]
  createdAt: Date
}
