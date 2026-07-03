import { api } from "./client.js";

export function getVapidPublicKey() {
  return api.get<{ publicKey: string }>("/push/public-key");
}

export function subscribePush(subscription: PushSubscriptionJSON) {
  return api.post<void>("/push/subscribe", subscription);
}
