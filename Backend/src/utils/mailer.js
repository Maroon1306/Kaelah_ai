import nodemailer from 'nodemailer'

let transporter = null

function getTransporter() {
  if (transporter) return transporter
  if (!process.env.SMTP_HOST) return null

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  })
  return transporter
}

export async function sendMail({ to, subject, html, text }) {
  const client = getTransporter()
  if (!client) {
    console.warn(`[mailer] SMTP non configuré — email à ${to} non envoyé ("${subject}")`)
    return { sent: false, reason: 'smtp_not_configured' }
  }

  await client.sendMail({
    from: `Kaelah AI <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  })
  return { sent: true }
}
