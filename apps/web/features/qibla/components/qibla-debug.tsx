"use client";

import { useEffect, useState } from "react";

// Temporary on-device diagnostic for the "compass points the wrong way" report.
// Attaches its own listeners (does not touch useDeviceHeading) so it can never
// perturb the production compass. Gated behind ?debug=1 — removed once the
// on-device readout tells us calibration vs. a real convention bug.

type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

type RawReading = {
  webkitCompassHeading: number | null;
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute: boolean;
  screenAngle: number;
};

function computeHeading(r: RawReading): number | null {
  if (typeof r.webkitCompassHeading === "number") {
    return norm360(r.webkitCompassHeading);
  }
  if (r.absolute && typeof r.alpha === "number") {
    return norm360(360 - r.alpha + r.screenAngle);
  }
  return null;
}

export function QiblaDebug({ bearing }: { bearing: number }) {
  const [enabled, setEnabled] = useState(false);
  const [reading, setReading] = useState<RawReading | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEnabled(params.has("debug"));
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    function handle(event: DeviceOrientationEvent): void {
      const e = event as CompassEvent;
      setReading({
        webkitCompassHeading:
          typeof e.webkitCompassHeading === "number" ? e.webkitCompassHeading : null,
        alpha: e.alpha,
        beta: e.beta,
        gamma: e.gamma,
        absolute: e.absolute,
        screenAngle:
          typeof screen !== "undefined" && screen.orientation ? screen.orientation.angle : 0,
      });
    }

    window.addEventListener("deviceorientationabsolute", handle);
    window.addEventListener("deviceorientation", handle);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handle);
      window.removeEventListener("deviceorientation", handle);
    };
  }, [enabled]);

  if (!enabled) return null;

  const heading = reading ? computeHeading(reading) : null;
  const delta = heading != null ? norm360(heading - bearing) : null;

  return (
    <div
      className="mt-4 rounded-lg border border-border bg-surface-2 p-3 text-xs text-text-2"
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <p className="mb-2 font-medium text-text">Qibla sensor debug</p>
      {reading ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
          <dt>webkitCompassHeading</dt>
          <dd>{reading.webkitCompassHeading ?? "—"}</dd>
          <dt>alpha</dt>
          <dd>{reading.alpha?.toFixed(1) ?? "—"}</dd>
          <dt>beta</dt>
          <dd>{reading.beta?.toFixed(1) ?? "—"}</dd>
          <dt>gamma</dt>
          <dd>{reading.gamma?.toFixed(1) ?? "—"}</dd>
          <dt>absolute</dt>
          <dd>{String(reading.absolute)}</dd>
          <dt>screen.orientation.angle</dt>
          <dd>{reading.screenAngle}</dd>
          <dt>computed heading</dt>
          <dd>{heading?.toFixed(1) ?? "—"}</dd>
          <dt>bearing (target)</dt>
          <dd>{bearing.toFixed(1)}</dd>
          <dt>delta (heading − bearing)</dt>
          <dd>{delta?.toFixed(1) ?? "—"}</dd>
        </dl>
      ) : (
        <p>No orientation event received yet.</p>
      )}
    </div>
  );
}
