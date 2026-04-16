// ---------------------------------------------------------------------------- //
// useDetectionSession — opens a WebSocket to the backend /ws endpoint and      //
// translates face-detection state changes (LOCKED_IN / DISTRACTED / ALERT /    //
// AWAY) into strike callbacks and locked-in confirmations. Starts/stops the    //
// backend camera session via POST /session/start and /session/stop. Accepts    //
// { enabled, onStrike, onLockedIn } and cleans up all connections on unmount.  //
// ---------------------------------------------------------------------------- //
import { useEffect, useRef } from "react";

type BackendState = "LOCKED_IN" | "DISTRACTED" | "ALERT" | "AWAY" | "UNKNOWN";

const API_BASE_URL = import.meta.env.VITE_LOCKIN_API_URL ?? "http://localhost:8000";
const WS_URL = `${API_BASE_URL.replace(/^http/, "ws")}/ws`;

async function postSession(path: "/session/start" | "/session/stop") {
  try {
    await fetch(`${API_BASE_URL}${path}`, { method: "POST" });
  } catch {
    // Keep the UI usable even if the backend is offline.
  }
}

export function useDetectionSession({
  enabled,
  onStrike,
  onLockedIn,
}: {
  enabled: boolean;
  onStrike: (strikeCount: number) => void;
  onLockedIn: () => void;
}) {
  const onStrikeRef = useRef(onStrike);
  const onLockedInRef = useRef(onLockedIn);
  const strikeCountRef = useRef(0);
  const alertConsumedRef = useRef(false);

  useEffect(() => {
    onStrikeRef.current = onStrike;
  }, [onStrike]);

  useEffect(() => {
    onLockedInRef.current = onLockedIn;
  }, [onLockedIn]);

  useEffect(() => {
    if (!enabled) {
      strikeCountRef.current = 0;
      alertConsumedRef.current = false;
      return;
    }

    strikeCountRef.current = 0;
    alertConsumedRef.current = false;

    const ws = new WebSocket(WS_URL);

    // Start the camera session only after the socket is accepted, so the server
    // already has this client in _ws_clients before any ALERT broadcasts.
    ws.onopen = () => {
      void postSession("/session/start");
    };

    ws.onmessage = (event: MessageEvent) => {
      void (async () => {
        try {
          const raw =
            typeof event.data === "string"
              ? event.data
              : await (event.data as Blob).text();
          const payload = JSON.parse(raw) as { state?: BackendState };
          const state = payload.state;
          if (!state) return;

          if (state === "ALERT") {
            if (alertConsumedRef.current || strikeCountRef.current >= 3) return;
            alertConsumedRef.current = true;
            strikeCountRef.current += 1;
            onStrikeRef.current(strikeCountRef.current);
            return;
          }

          alertConsumedRef.current = false;

          if (state === "LOCKED_IN") {
            onLockedInRef.current();
          }
        } catch {
          // Ignore malformed websocket payloads.
        }
      })();
    };

    return () => {
      strikeCountRef.current = 0;
      alertConsumedRef.current = false;

      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }

      void postSession("/session/stop");
    };
  }, [enabled]);
}
