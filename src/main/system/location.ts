import type { GeoFix } from "../../shared/contracts";
import { runPsJson } from "./powershell";

// Localização do Windows (GPS, Wi-Fi ou rede, conforme o PC). Não sai do PC.
// Espera até 10 s pela primeira posição; "denied" quando está desligada.
const WINDOWS_SCRIPT = `
Add-Type -AssemblyName System.Device
$w = New-Object System.Device.Location.GeoCoordinateWatcher([System.Device.Location.GeoPositionAccuracy]::High)
[void]$w.TryStart($false, [TimeSpan]::FromSeconds(10))
$deadline = (Get-Date).AddSeconds(10)
while (($w.Status -ne 'Ready') -and ($w.Permission -ne 'Denied') -and ((Get-Date) -lt $deadline)) { Start-Sleep -Milliseconds 200 }
$c = $w.Position.Location
$o = [ordered]@{ permission = [string]$w.Permission; status = [string]$w.Status }
if (-not $c.IsUnknown) { $o.lat = $c.Latitude; $o.lon = $c.Longitude; if (-not [double]::IsNaN($c.HorizontalAccuracy)) { $o.acc = $c.HorizontalAccuracy } }
$w.Stop()
[pscustomobject]$o | ConvertTo-Json -Compress`;

// Só usado quando a pessoa escolhe a localização aproximada: envia o IP.
const INTERNET_URL =
  "https://ipwho.is/?fields=success,latitude,longitude,city,region,country_code";

export class LocationError extends Error {
  constructor(
    message: string,
    readonly code: "location_off" | "location_failed",
  ) {
    super(message);
  }
}

const valid = (lat: unknown, lon: unknown): lat is number =>
  typeof lat === "number" &&
  typeof lon === "number" &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180;

export async function locate(method: GeoFix["source"], signal: AbortSignal): Promise<GeoFix> {
  if (method === "windows") {
    const r = await runPsJson<{
      permission?: string;
      status?: string;
      lat?: number;
      lon?: number;
      acc?: number;
    }>(WINDOWS_SCRIPT, signal);
    if (r && valid(r.lat, r.lon))
      return {
        lat: r.lat,
        lon: r.lon!,
        accuracyM: typeof r.acc === "number" ? Math.round(r.acc) : null,
        source: "windows",
        place: null,
      };
    throw new LocationError(
      r?.permission === "Denied" || r?.status === "Disabled"
        ? "A localização do Windows está desligada."
        : "O Windows não conseguiu encontrar a tua localização.",
      "location_off",
    );
  }
  const res = await fetch(INTERNET_URL, { signal });
  const j = (await res.json().catch(() => null)) as {
    success?: boolean;
    latitude?: number;
    longitude?: number;
    city?: string;
    region?: string;
  } | null;
  if (!res.ok || !j?.success || !valid(j.latitude, j.longitude))
    throw new LocationError("Não foi possível estimar a localização pela internet.", "location_failed");
  return {
    lat: j.latitude,
    lon: j.longitude!,
    accuracyM: null,
    source: "internet",
    place: [j.city, j.region].filter((v) => typeof v === "string" && v).join(", ") || null,
  };
}
