// ----------------------------------------------------------------------------- //
// notifications — thin cross-platform notification helper used by useTimer.     //
// Detects whether the app is running inside Tauri and routes to the native      //
// notification plugin (plugin:notification|notify) or falls back to the Web     //
// Notifications API. Exports requestNotificationPermission() and notify().      //
// ----------------------------------------------------------------------------- //
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted as pluginIsPermissionGranted,
  requestPermission as pluginRequestPermission,
} from "@tauri-apps/plugin-notification";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Browser: Web Notifications API.
 * Tauri: use the notification plugin so permission + delivery match the webview patch
 * (`plugin:notification|request_permission` / native `notify` via IPC).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in globalThis)) return false;

  if (isTauriRuntime()) {
    let granted = await pluginIsPermissionGranted();
    if (!granted) {
      const result = await pluginRequestPermission();
      granted = result === "granted";
    }
    return granted;
  }

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Timer completion alert.
 * In Tauri, call the plugin's native `notify` command directly. Do **not** gate on
 * `window.Notification.permission` — the WKWebView permission often stays `"default"`
 * or out of sync with macOS while `plugin:notification|notify` still posts a real toast.
 */
export async function notify(title: string, body: string): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await invoke("plugin:notification|notify", {
        options: { title, body },
      });
    } catch {
      // Invalid payload or capability; avoid breaking the timer flow
    }
    return;
  }

  if (!("Notification" in globalThis)) return;
  if (Notification.permission !== "granted") return;

  try {
    new Notification(title, {
      body,
      tag: "lockin-buddy-timer",
      silent: false,
    });
  } catch {
    // Invalid environment or options
  }
}
