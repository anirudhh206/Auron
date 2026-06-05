"use client";

type PushPlugin = typeof import("@capacitor/push-notifications").PushNotifications;

// Capacitor local-notifications scheduling API (subset we use)
interface CapacitorLocalScheduler {
  createChannel?: (opts: { id: string; name: string; importance: number; sound: string; vibration: boolean }) => Promise<void>;
  schedule?:      (opts: { notifications: Array<{ id: number; title: string; body: string; channelId: string; schedule: { at: Date } }> }) => Promise<void>;
}

let _push: PushPlugin | null = null;

/** Lazy-load the Capacitor plugin only in native context */
async function getPush(): Promise<PushPlugin | null> {
  if (typeof window === "undefined") return null; // SSR guard

  // Check if running inside Capacitor (not browser)
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return null;

  if (!_push) {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    _push = PushNotifications;
  }
  return _push;
}

// ─── Initialise (call once on app mount) ─────────────────────────────────────
export async function initNotifications(): Promise<void> {
  const push = await getPush();
  if (!push) return;

  try {
    // Request permission
    const { receive } = await push.requestPermissions();
    if (receive !== "granted") return;

    // Register with FCM/APNs
    await push.register();

    // Log registration token (send to your backend to store per user)
    push.addListener("registration", (token) => {
      console.log("[Notifications] FCM token:", token.value);
      // TODO: POST token to your backend to store per wallet address
    });

    push.addListener("registrationError", (err) => {
      console.error("[Notifications] Registration error:", err);
    });

    // Handle tap on notification (foreground + background)
    push.addListener("pushNotificationActionPerformed", (action) => {
      console.log("[Notifications] Action performed:", action.notification.data);
    });
  } catch (err) {
    console.error("[Notifications] Init failed:", err);
  }
}

// ─── Local notifications (shown immediately, no server needed) ───────────────

/** Show a local notification for a successful transaction */
export async function notifyTxSuccess(action: string, detail: string): Promise<void> {
  const push = await getPush();
  if (!push) return;

  const scheduler = push as unknown as CapacitorLocalScheduler;
  try {
    await scheduler.createChannel?.({
      id: "auron-tx",
      name: "Transactions",
      importance: 4, // HIGH
      sound: "default",
      vibration: true,
    });

    await scheduler.schedule?.({
      notifications: [
        {
          id: Date.now(),
          title: `✅ ${humaniseAction(action)}`,
          body: detail,
          channelId: "auron-tx",
          schedule: { at: new Date(Date.now() + 100) }, // near-instant
        },
      ],
    });
  } catch {
    // Local notifications might need @capacitor/local-notifications — silently skip
  }
}

/** Show a local notification for a failed transaction */
export async function notifyTxFailed(action: string, reason: string): Promise<void> {
  const push = await getPush();
  if (!push) return;

  const scheduler = push as unknown as CapacitorLocalScheduler;
  try {
    await scheduler.schedule?.({
      notifications: [
        {
          id: Date.now(),
          title: `❌ ${humaniseAction(action)} failed`,
          body: reason,
          channelId: "auron-tx",
          schedule: { at: new Date(Date.now() + 100) },
        },
      ],
    });
  } catch {
    // Silently skip — not critical path
  }
}


// ─── Helpers ──────────────────────────────────────────────────────────────────
function humaniseAction(action: string): string {
  const map: Record<string, string> = {
    transfer: "Transfer sent",
    transfer_sol: "SOL sent",
    transfer_usdc: "USDC sent",
    stamp_agreement: "Agreement stamped",
    lock_savings: "Savings locked",
    stamp_ownership: "Ownership proved",
  };
  return map[action] ?? "Transaction complete";
}
