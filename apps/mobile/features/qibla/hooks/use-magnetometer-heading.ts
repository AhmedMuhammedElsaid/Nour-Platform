// Device compass heading from the magnetometer. Mirrors the web
// use-device-heading hook, but reads expo-sensors instead of DeviceOrientation.
// The magnetometer reports **magnetic** north (geomagnetic declination is not
// corrected — see docs/adr/0009-expo-sensors-qibla.md); the exact axis offset is
// device-specific and only verifiable on hardware, matching the repo's standing
// "native sensors verify on-device" caveat.

import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Magnetometer, type MagnetometerMeasurement } from "expo-sensors";

const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

// Classic expo-sensors compass reduction: atan2 of the horizontal field,
// normalized to a 0–360 heading where 0 = magnetic north.
function toHeading({ x, y }: MagnetometerMeasurement): number {
  const rad = Math.atan2(y, x);
  return norm360((rad >= 0 ? rad : rad + 2 * Math.PI) * (180 / Math.PI));
}

export type MagnetometerHeading = {
  heading: number | null;
  available: boolean;
};

export function useMagnetometerHeading(): MagnetometerHeading {
  const [heading, setHeading] = useState<number | null>(null);
  const [available, setAvailable] = useState(false);
  // Dead-band so tiny magnetic jitter doesn't churn re-renders every 100ms.
  const lastRef = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let sub: ReturnType<typeof Magnetometer.addListener> | null = null;

      void Magnetometer.isAvailableAsync().then((ok) => {
        if (cancelled || !ok) return;
        setAvailable(true);
        Magnetometer.setUpdateInterval(100);
        sub = Magnetometer.addListener((data) => {
          const next = toHeading(data);
          const prev = lastRef.current;
          if (prev == null || Math.abs(next - prev) >= 2) {
            lastRef.current = next;
            setHeading(next);
          }
        });
      });

      return () => {
        cancelled = true;
        sub?.remove();
      };
    }, []),
  );

  return { heading, available };
}
