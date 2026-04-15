from __future__ import annotations

import threading
import time
from typing import Any

try:
    import serial
    from serial import SerialException, SerialTimeoutException
except ImportError:  # pragma: no cover - depends on optional dependency
    serial = None
    SerialException = OSError
    SerialTimeoutException = TimeoutError


class WaterTrigger:
    def __init__(
        self,
        port: str = "COM5",
        baud: int = 115200,
        timeout: float = 2.0,
        write_timeout: float = 2.0,
        settle_seconds: float = 2.0,
        enabled: bool = False,
    ):
        self._port = port
        self._baud = baud
        self._timeout = timeout
        self._write_timeout = write_timeout
        self._settle_seconds = settle_seconds
        self._enabled = enabled

        self._serial_lock = threading.Lock()
        self._state_lock = threading.Lock()
        self._ser = None
        self._last_error: str | None = None
        self._last_logged_failure: str | None = None

    def connect(self) -> dict[str, Any]:
        already_connected = False
        with self._state_lock:
            if self.connected:
                already_connected = True

        if already_connected:
            return self._result(ok=True)

        if not self._enabled:
            return self._result(ok=False, error="Water trigger is disabled.")

        if serial is None:
            error = "pyserial is not installed."
            self._set_error(error)
            self._log_failure_once(error)
            return self._result(ok=False, error=error)

        try:
            ser = serial.Serial(
                self._port,
                self._baud,
                timeout=self._timeout,
                write_timeout=self._write_timeout,
            )
            time.sleep(self._settle_seconds)
            if hasattr(ser, "reset_input_buffer"):
                ser.reset_input_buffer()
        except (SerialException, OSError, ValueError) as exc:
            error = f"Could not open water trigger port {self._port}: {exc}"
            self._set_error(error)
            self._log_failure_once(error)
            return self._result(ok=False, error=error)

        with self._state_lock:
            if self.connected:
                try:
                    ser.close()
                except Exception:
                    pass
                already_connected = True
            else:
                self._ser = ser
                self._last_error = None
                self._last_logged_failure = None

        if already_connected:
            return self._result(ok=True)

        print(f"[WaterTrigger] Connected to {self._port} at {self._baud} baud.")
        return self._result(ok=True)

    def reconnect(self) -> dict[str, Any]:
        self.close()
        return self.connect()

    def press(self) -> dict[str, Any]:
        if not self._enabled:
            return self._result(ok=False, error="Water trigger is disabled.")

        with self._serial_lock:
            with self._state_lock:
                ser = self._ser if self.connected else None

            if ser is None:
                error = f"Water trigger is not connected on {self._port}."
                self._set_error(error)
                self._log_failure_once(error)
                return self._result(ok=False, error=error)

            try:
                ser.write(b"PRESS\n")
                if hasattr(ser, "flush"):
                    ser.flush()
            except (SerialException, SerialTimeoutException, OSError, ValueError) as exc:
                error = f"Failed to write water trigger command on {self._port}: {exc}"
                self._mark_disconnected(error)
                self._log_failure_once(error)
                return self._result(ok=False, error=error)

        with self._state_lock:
            self._last_error = None
            self._last_logged_failure = None
        return self._result(ok=True)

    def close(self):
        with self._state_lock:
            ser = self._ser
            self._ser = None

        if ser is not None:
            try:
                ser.close()
            except Exception as exc:
                error = f"Failed to close water trigger port {self._port}: {exc}"
                self._set_error(error)
                self._log_failure_once(error)

    @property
    def connected(self) -> bool:
        return self._ser is not None and bool(getattr(self._ser, "is_open", False))

    def status(self) -> dict[str, Any]:
        with self._state_lock:
            return {
                "enabled": self._enabled,
                "connected": self.connected,
                "port": self._port,
                "error": self._last_error,
            }

    def _result(self, ok: bool, error: str | None = None) -> dict[str, Any]:
        status = self.status()
        return {
            "ok": ok,
            "enabled": status["enabled"],
            "connected": status["connected"],
            "error": error,
        }

    def _set_error(self, error: str):
        with self._state_lock:
            self._last_error = error

    def _mark_disconnected(self, error: str):
        with self._state_lock:
            ser = self._ser
            self._ser = None
            self._last_error = error
        if ser is not None:
            try:
                ser.close()
            except Exception:
                pass

    def _log_failure_once(self, error: str):
        with self._state_lock:
            if self._last_logged_failure == error:
                return
            self._last_logged_failure = error
        print(f"[WaterTrigger] {error}")
