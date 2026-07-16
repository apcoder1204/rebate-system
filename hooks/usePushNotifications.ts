import { useEffect, useRef } from 'react';
import { Notification } from '@/entities/Notification';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export function usePushNotifications(enabled: boolean) {
  const prevEnabled = useRef<boolean | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (prevEnabled.current === enabled) return;
    prevEnabled.current = enabled;

    if (enabled) {
      subscribe();
    } else {
      unsubscribe();
    }
  }, [enabled]);
}

async function subscribe() {
  try {
    const vapidKey = await Notification.getVapidPublicKey();
    const registration = await navigator.serviceWorker.ready;
    const permission = await window.Notification.requestPermission();
    if (permission !== 'granted') return;

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await Notification.savePushSubscription(existing.toJSON() as PushSubscriptionJSON);
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
    });
    await Notification.savePushSubscription(subscription.toJSON() as PushSubscriptionJSON);
  } catch (err) {
    console.warn('[push] subscribe failed:', err);
  }
}

async function unsubscribe() {
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await Notification.removePushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
  } catch (err) {
    console.warn('[push] unsubscribe failed:', err);
  }
}
