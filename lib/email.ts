import 'server-only'
import { SITE_URL } from '@/lib/site'

/**
 * Transactional email via Resend's REST API (no SDK needed). Best effort:
 * never throws, so a mail problem can't fail a payment or a review. Without
 * RESEND_API_KEY it only logs (local dev, previews).
 *
 *   RESEND_API_KEY      secret
 *   EMAIL_FROM          e.g. "TourHunts <hello@tourhunts.com>" (verified domain)
 *   ADMIN_NOTIFY_EMAIL  where review requests go
 */

export async function sendEmail(opts: { to: string | null | undefined; subject: string; text: string }): Promise<void> {
  const to = opts.to?.trim()
  if (!to) return
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.info(`[email] (not sent, no RESEND_API_KEY) to=${to} subject="${opts.subject}"`)
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'TourHunts <noreply@tourhunts.com>',
        to: [to],
        subject: opts.subject,
        text: opts.text,
      }),
    })
    if (!res.ok) console.warn(`[email] send failed ${res.status}: ${(await res.text()).slice(0, 200)}`)
  } catch (e) {
    console.warn('[email] send failed', (e as Error)?.message ?? e)
  }
}

export const adminEmail = () => process.env.ADMIN_NOTIFY_EMAIL || null

export const link = (path: string) => `${SITE_URL}${path}`
