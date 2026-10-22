import type { Hardware, Result } from "../shared/contracts";
export function createHardwareMonitor(
  read: () => Promise<Result<Hardware>>,
  update: (value: Hardware) => void,
  error: (message: string) => void,
  economy: boolean,
) {
  let disposed = false,
    active = false;
  let interval: ReturnType<typeof setInterval> | null = null;
  let pending: Promise<void> | null = null;
  const refresh = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    if (pending) return pending;
    const work = (async () => {
      try {
        const result = await read();
        if (disposed) return;
        if (result.ok) update(result.value);
        else error(result.error.message);
      } catch (e) {
        if (!disposed) error(String(e));
      }
    })();
    pending = work;
    void work.finally(() => {
      if (pending === work) pending = null;
    });
    return work;
  };
  const stop = () => {
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  };
  return {
    refresh,
    setActive(next: boolean) {
      if (disposed || active === next) return;
      active = next;
      stop();
      if (active && !economy) {
        void refresh();
        interval = setInterval(() => void refresh(), 5000);
      }
    },
    dispose() {
      disposed = true;
      stop();
    },
  };
}
