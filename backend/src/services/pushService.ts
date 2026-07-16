import webpush from 'web-push';
import { readQuery, writeQuery } from '../db/connection';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:noreply@cctvpoint.org',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url = '/'
): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  let rows: any[];
  try {
    const result = await readQuery(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );
    rows = result.rows;
  } catch {
    return;
  }

  const payload = JSON.stringify({ title, body, url });

  for (const sub of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired or invalid — clean up silently
        writeQuery('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]).catch(() => {});
      }
    }
  }
}
