import { Request, Response } from 'express';
import { readQuery, writeQuery } from '../db/connection';
import { AuthRequest } from '../middleware/auth';

const DEFAULTS = {
  email_notifications: true,
  push_notifications: true,
  order_updates: true,
  contract_updates: true,
};

export async function getUserNotifPrefs(userId: string): Promise<typeof DEFAULTS> {
  try {
    const { rows } = await readQuery(
      'SELECT email_notifications, push_notifications, order_updates, contract_updates FROM user_notification_preferences WHERE user_id = $1',
      [userId]
    );
    return rows[0] ?? { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export const getPreferences = async (req: AuthRequest, res: Response) => {
  try {
    const prefs = await getUserNotifPrefs(req.user!.id);
    res.json(prefs);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load notification preferences' });
  }
};

export const updatePreferences = async (req: AuthRequest, res: Response) => {
  try {
    const { email_notifications, push_notifications, order_updates, contract_updates } = req.body;

    await writeQuery(
      `INSERT INTO user_notification_preferences
         (user_id, email_notifications, push_notifications, order_updates, contract_updates, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         email_notifications = EXCLUDED.email_notifications,
         push_notifications  = EXCLUDED.push_notifications,
         order_updates       = EXCLUDED.order_updates,
         contract_updates    = EXCLUDED.contract_updates,
         updated_at          = NOW()`,
      [
        req.user!.id,
        email_notifications ?? true,
        push_notifications ?? true,
        order_updates ?? true,
        contract_updates ?? true,
      ]
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
};

export const savePushSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint, p256dh, auth } = req.body;
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'endpoint, p256dh and auth are required' });
    }

    await writeQuery(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, endpoint) DO NOTHING`,
      [req.user!.id, endpoint, p256dh, auth]
    );

    res.status(201).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save push subscription' });
  }
};

export const removePushSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });

    await writeQuery(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [req.user!.id, endpoint]
    );

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to remove push subscription' });
  }
};

export const getVapidPublicKey = (_req: Request, res: Response) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Push notifications not configured' });
  res.json({ publicKey: key });
};
