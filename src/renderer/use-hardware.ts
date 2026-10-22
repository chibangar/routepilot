import { useCallback, useEffect, useRef, useState } from "react";
import type { Hardware } from "../shared/contracts";
import { createHardwareMonitor } from "./hardware-monitor";
export function useHardware(
  economy: boolean,
  onError: (message: string) => void,
) {
  const [hardware, setHardware] = useState<Hardware | null>(null);
  const monitor = useRef<ReturnType<typeof createHardwareMonitor> | null>(null);
  useEffect(() => {
    if (!window.routepilot) return;
    const owner = createHardwareMonitor(
      () => window.routepilot.readHardware(),
      setHardware,
      onError,
      economy,
    );
    monitor.current = owner;
    const visibility = () =>
      owner.setActive(
        document.visibilityState === "visible" && document.hasFocus(),
      );
    visibility();
    void owner.refresh();
    window.addEventListener("focus", visibility);
    window.addEventListener("blur", visibility);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      owner.dispose();
      if (monitor.current === owner) monitor.current = null;
      window.removeEventListener("focus", visibility);
      window.removeEventListener("blur", visibility);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [economy, onError]);
  const refreshHardware = useCallback(
    () => monitor.current?.refresh() ?? Promise.resolve(),
    [],
  );
  return { hardware, refreshHardware };
}
