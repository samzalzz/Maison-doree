// Notification type enum — mirrors the Prisma NotificationType enum
export enum NotificationType {
  ORDER_PLACED = 'ORDER_PLACED',
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_DISPATCHED = 'ORDER_DISPATCHED',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  DELIVERY_ASSIGNED = 'DELIVERY_ASSIGNED',
  TICKET_RESPONSE = 'TICKET_RESPONSE',
  LOYALTY_POINTS_EARNED = 'LOYALTY_POINTS_EARNED',
}

// Channels a notification can be delivered through
export type NotificationChannel = 'EMAIL' | 'SMS' | 'IN_APP'

// Metadata that can be attached to a notification
export interface NotificationMetadata {
  orderId?: string
  deliveryId?: string
  ticketId?: string
  points?: number
  [key: string]: string | number | undefined
}

// Shape of data required to create and dispatch a notification
export interface NotificationPayload {
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata?: NotificationMetadata
  channels: NotificationChannel[]
}

// Shape returned by the API when listing notifications
export interface NotificationItem {
  id: string
  userId: string
  type: string
  title: string
  message: string
  metadata: NotificationMetadata | null
  channels: string[]
  read: boolean
  readAt: string | null
  createdAt: string
}

// API list response envelope
export interface NotificationsResponse {
  success: boolean
  data: NotificationItem[]
}
