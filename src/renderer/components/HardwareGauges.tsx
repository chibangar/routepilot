import { useApp } from "../context";
import { useHardware } from "../use-hardware";
import { isEconomyMode } from "../../shared/performance";

// Medidores de processador, placa gráfica e memória.
export function HardwareGauges() {
  const { runtime, notify } = useApp();
  const economy = isEconomyMode(runtime?.store.settings);
  const { hardware } = useHardware(economy, notify);
  const memoryPercent =
    hardware && hardware.memoryTotalBytes > 0
      ? (hardware.memoryUsedBytes / hardware.memoryTotalBytes) * 100
      : null;

  return (
    <section className="dashboard-section hardware-section">
      <div className="hardware-gauges-grid">
        <div className="gauge-card">
          <div className="gauge-clock">
            {hardware?.cpuMhz ? `${hardware.cpuMhz} MHz` : "—"}
          </div>
          <div className="circular-gauge">
            <svg viewBox="0 0 100 100" className="gauge-svg">
              <circle cx="50" cy="50" r="42" className="gauge-bg" />
              <circle
                cx="50"
                cy="50"
                r="42"
                className="gauge-val cpu-val"
                style={{
                  strokeDasharray: "264",
                  strokeDashoffset: `${264 - (264 * (hardware?.cpuPercent ?? 0)) / 100}`,
                }}
              />
            </svg>
            <div className="gauge-center">
              <strong>
                {hardware?.cpuPercent != null
                  ? `${Math.round(hardware.cpuPercent)}%`
                  : "—"}
              </strong>
            </div>
          </div>
          <div className="gauge-label">
            <span>Processador</span>
          </div>
        </div>

        <div className="gauge-card">
          <div className="gauge-clock">
            {hardware?.gpuMhz ? `${hardware.gpuMhz} MHz` : "—"}
          </div>
          <div className="circular-gauge">
            <svg viewBox="0 0 100 100" className="gauge-svg">
              <circle cx="50" cy="50" r="42" className="gauge-bg" />
              <circle
                cx="50"
                cy="50"
                r="42"
                className="gauge-val gpu-val"
                style={{
                  strokeDasharray: "264",
                  strokeDashoffset: `${264 - (264 * (hardware?.gpuPercent ?? 0)) / 100}`,
                }}
              />
            </svg>
            <div className="gauge-center">
              <strong>
                {hardware?.gpuPercent != null
                  ? `${Math.round(hardware.gpuPercent)}%`
                  : "—"}
              </strong>
            </div>
          </div>
          <div className="gauge-label">
            <span>
              Placa Gráfica{hardware?.gpuPercent == null ? " (não medida)" : ""}
            </span>
          </div>
        </div>

        <div className="gauge-card ram-card">
          <div className="ram-card-top">
            <span className="ram-title">Memória RAM</span>
            <strong className="ram-stats">
              {hardware
                ? `${(hardware.memoryUsedBytes / 1073741824).toFixed(1)} GB / ${(
                    hardware.memoryTotalBytes / 1073741824
                  ).toFixed(1)} GB`
                : "—"}
            </strong>
          </div>

          <div className="ram-progress-track">
            <div
              className="ram-progress-fill"
              style={{ width: `${memoryPercent ?? 0}%` }}
            />
          </div>

          <div className="ram-card-bottom">
            <div className="ram-tag">
              <span className="dot dot-used" />
              <span>
                {memoryPercent !== null ? `${Math.round(memoryPercent)}%` : "—"}
              </span>
            </div>
            <div className="ram-tag">
              <span className="dot dot-free" />
              <span>
                {memoryPercent !== null
                  ? `${Math.round(100 - memoryPercent)}%`
                  : "—"}
              </span>
            </div>
            <span className="ram-total">
              {hardware
                ? `${Math.round(hardware.memoryTotalBytes / 1073741824)} GB`
                : "—"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
