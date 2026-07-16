import { apiRequest } from "@/src/api/client";

export type NotificationPreferences = {
  email_notifications: boolean;
  push_notifications: boolean;
  order_updates: boolean;
  contract_updates: boolean;
};

export const Notification = {
  async getPreferences(): Promise<NotificationPreferences> {
    return apiRequest('/notifications/preferences');
  },

  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
    await apiRequest('/notifications/preferences', { method: 'PUT', body: JSON.stringify(prefs) });
  },

  async getVapidPublicKey(): Promise<string> {
    const { publicKey } = await apiRequest('/notifications/vapid-public-key');
    return publicKey;
  },

  async savePushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
    const keys = subscription.keys as { p256dh: string; auth: string };
    await apiRequest('/notifications/push-subscription', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      }),
    });
  },

  async removePushSubscription(endpoint: string): Promise<void> {
    await apiRequest('/notifications/push-subscription', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    });
  },
};
