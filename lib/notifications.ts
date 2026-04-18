// ---------------------------------------------------------------------------
// Core notification logic — Maison Dorée
// Handles creating DB records and dispatching via email / in-app channels.
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db/prisma'
import nodemailer from 'nodemailer'
import {
  NotificationPayload,
  NotificationType,
} from '@/lib/types/notification'
import {
  orderConfirmationEmail,
  loyaltyPointsEmail,
  genericNotificationEmail,
} from '@/lib/email-templates'

// ---------------------------------------------------------------------------
// SMTP transporter (configured via environment variables)
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE
// ---------------------------------------------------------------------------

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
})

// ---------------------------------------------------------------------------
// createNotification
// Persists a notification record and fans out to configured delivery channels.
// ---------------------------------------------------------------------------

export async function createNotification(
  payload: NotificationPayload,
): Promise<{ id: string }> {
  // Persist to DB
  const notification = await prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      metadata: payload.metadata ?? {},
      channels: payload.channels,
    },
    select: { id: true },
  })

  // Fan-out — fire and forget (errors are caught internally)
  if (payload.channels.includes('EMAIL')) {
    sendEmailNotification(payload).catch((err) =>
      console.error('[notifications] email send failed:', err),
    )
  }

  // SMS channel placeholder (Phase 3 — Twilio integration)
  if (payload.channels.includes('SMS')) {
    // TODO: implement SMS via Twilio
  }

  return notification
}

// ---------------------------------------------------------------------------
// sendEmailNotification — internal helper
// ---------------------------------------------------------------------------

async function sendEmailNotification(
  payload: NotificationPayload,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { email: true },
  })

  if (!user?.email) return

  // Build template based on notification type
  let template = genericNotificationEmail(payload.title, payload.message)

  if (payload.type === NotificationType.ORDER_CONFIRMED && payload.metadata?.orderId) {
    // Fetch order details for a richer template
    const order = await prisma.order.findUnique({
      where: { id: payload.metadata.orderId },
      select: { orderNumber: true, totalPrice: true },
    })
    if (order) {
      template = orderConfirmationEmail(
        order.orderNumber,
        Number(order.totalPrice),
      )
    }
  }

  if (
    payload.type === NotificationType.LOYALTY_POINTS_EARNED &&
    payload.metadata?.points !== undefined
  ) {
    const loyaltyCard = await prisma.loyaltyCard.findUnique({
      where: { userId: payload.userId },
      select: { points: true },
    })
    template = loyaltyPointsEmail(
      payload.metadata.points as number,
      loyaltyCard?.points ?? 0,
    )
  }

  await transporter.sendMail({
    from: process.env.SMTP_USER ?? 'noreply@maisondoree.com',
    to: user.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  })
}

// ---------------------------------------------------------------------------
// triggerOrderNotification
// Called by order status update routes when the status changes.
// ---------------------------------------------------------------------------

export async function triggerOrderNotification(
  orderId: string,
  status: string,
  userId: string,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, totalPrice: true },
  })

  if (!order) return

  const notificationMap: Record<
    string,
    { title: string; message: string; type: NotificationType }
  > = {
    CONFIRMED: {
      type: NotificationType.ORDER_CONFIRMED,
      title: 'Commande confirmée',
      message: `Votre commande #${order.orderNumber} a été confirmée.`,
    },
    DISPATCHED: {
      type: NotificationType.ORDER_DISPATCHED,
      title: 'Commande en livraison',
      message: `Votre commande #${order.orderNumber} est en cours de livraison.`,
    },
    DELIVERED: {
      type: NotificationType.ORDER_DELIVERED,
      title: 'Commande livrée',
      message: `Votre commande #${order.orderNumber} a été livrée avec succès.`,
    },
    PLACED: {
      type: NotificationType.ORDER_PLACED,
      title: 'Commande passée',
      message: `Votre commande #${order.orderNumber} a bien été enregistrée.`,
    },
  }

  const notifData = notificationMap[status]
  if (!notifData) return

  // Respect user email preferences
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: { emailOrders: true },
  })

  const channels: NotificationPayload['channels'] = ['IN_APP']
  if (pref?.emailOrders !== false) {
    channels.push('EMAIL')
  }

  await createNotification({
    userId,
    type: notifData.type,
    title: notifData.title,
    message: notifData.message,
    metadata: { orderId },
    channels,
  })
}

// ---------------------------------------------------------------------------
// triggerLoyaltyNotification
// Called after loyalty points are awarded.
// ---------------------------------------------------------------------------

export async function triggerLoyaltyNotification(
  userId: string,
  points: number,
  newBalance: number,
): Promise<void> {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: { emailLoyalty: true },
  })

  const channels: NotificationPayload['channels'] = ['IN_APP']
  if (pref?.emailLoyalty !== false) {
    channels.push('EMAIL')
  }

  await createNotification({
    userId,
    type: NotificationType.LOYALTY_POINTS_EARNED,
    title: `${points} points de fidélité gagnés !`,
    message: `Nouveau solde : ${newBalance} points`,
    metadata: { points },
    channels,
  })
}

// ---------------------------------------------------------------------------
// triggerDeliveryNotification
// Called when a delivery is assigned to a driver.
// ---------------------------------------------------------------------------

export async function triggerDeliveryNotification(
  userId: string,
  deliveryId: string,
  driverName: string,
): Promise<void> {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: { emailDelivery: true },
  })

  const channels: NotificationPayload['channels'] = ['IN_APP']
  if (pref?.emailDelivery !== false) {
    channels.push('EMAIL')
  }

  await createNotification({
    userId,
    type: NotificationType.DELIVERY_ASSIGNED,
    title: 'Livreur assigné',
    message: `${driverName} a été assigné à votre livraison.`,
    metadata: { deliveryId },
    channels,
  })
}
