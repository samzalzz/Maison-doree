// ---------------------------------------------------------------------------
// Email template builder — Maison Dorée
// Each function returns an object with subject, plain-text, and HTML content
// for use with nodemailer.
// ---------------------------------------------------------------------------

export interface EmailTemplate {
  subject: string
  text: string
  html: string
}

// ---------------------------------------------------------------------------
// Order confirmation
// ---------------------------------------------------------------------------

export function orderConfirmationEmail(
  orderNumber: string,
  totalPrice: number,
): EmailTemplate {
  return {
    subject: `Commande confirmée #${orderNumber}`,
    text: `Votre commande ${orderNumber} pour ${totalPrice} DH a été confirmée. Vous recevrez une notification de livraison bientôt.`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:Arial,sans-serif;background:#f9f5ef;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <h1 style="color:#92400e;margin-top:0;">Maison Dorée</h1>
    <h2 style="color:#374151;">Commande confirmée</h2>
    <p style="color:#6b7280;">Merci pour votre commande !</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Numéro de commande</td>
        <td style="padding:8px 0;font-weight:bold;color:#111827;">#${orderNumber}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Total</td>
        <td style="padding:8px 0;font-weight:bold;color:#111827;">${totalPrice} DH</td>
      </tr>
    </table>
    <p style="color:#6b7280;">Vous recevrez une notification dès que votre commande sera en route.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="font-size:12px;color:#9ca3af;">© Maison Dorée — Pâtisseries Marocaines</p>
  </div>
</body>
</html>`,
  }
}

// ---------------------------------------------------------------------------
// Delivery in progress notification
// ---------------------------------------------------------------------------

export function deliveryNotificationEmail(
  driverName: string,
  estimatedTime: string,
): EmailTemplate {
  return {
    subject: 'Votre commande est en cours de livraison',
    text: `${driverName} est en route avec votre commande. Livraison estimée : ${estimatedTime}.`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:Arial,sans-serif;background:#f9f5ef;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <h1 style="color:#92400e;margin-top:0;">Maison Dorée</h1>
    <h2 style="color:#374151;">Livraison en cours</h2>
    <p style="color:#6b7280;">Bonne nouvelle ! Votre commande est en route.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Livreur</td>
        <td style="padding:8px 0;font-weight:bold;color:#111827;">${driverName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Heure estimée</td>
        <td style="padding:8px 0;font-weight:bold;color:#111827;">${estimatedTime}</td>
      </tr>
    </table>
    <p style="color:#6b7280;">Assurez-vous d'être disponible pour réceptionner votre commande.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="font-size:12px;color:#9ca3af;">© Maison Dorée — Pâtisseries Marocaines</p>
  </div>
</body>
</html>`,
  }
}

// ---------------------------------------------------------------------------
// Loyalty points earned notification
// ---------------------------------------------------------------------------

export function loyaltyPointsEmail(
  points: number,
  balance: number,
): EmailTemplate {
  return {
    subject: `${points} points de fidélité gagnés !`,
    text: `Félicitations ! Vous avez gagné ${points} points de fidélité. Votre solde actuel est de ${balance} points.`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:Arial,sans-serif;background:#f9f5ef;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <h1 style="color:#92400e;margin-top:0;">Maison Dorée</h1>
    <h2 style="color:#374151;">Points de fidélité gagnés !</h2>
    <p style="color:#6b7280;">Merci pour votre fidélité.</p>
    <div style="background:#fef3c7;border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
      <p style="font-size:36px;font-weight:bold;color:#92400e;margin:0;">+${points}</p>
      <p style="color:#92400e;margin:4px 0 0;">points gagnés</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding:8px 0;color:#6b7280;">Solde actuel</td>
        <td style="padding:8px 0;font-weight:bold;color:#111827;">${balance} points</td>
      </tr>
    </table>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="font-size:12px;color:#9ca3af;">© Maison Dorée — Pâtisseries Marocaines</p>
  </div>
</body>
</html>`,
  }
}

// ---------------------------------------------------------------------------
// Generic notification email (fallback for all other notification types)
// ---------------------------------------------------------------------------

export function genericNotificationEmail(
  title: string,
  message: string,
): EmailTemplate {
  return {
    subject: title,
    text: message,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family:Arial,sans-serif;background:#f9f5ef;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <h1 style="color:#92400e;margin-top:0;">Maison Dorée</h1>
    <h2 style="color:#374151;">${title}</h2>
    <p style="color:#6b7280;">${message}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="font-size:12px;color:#9ca3af;">© Maison Dorée — Pâtisseries Marocaines</p>
  </div>
</body>
</html>`,
  }
}
