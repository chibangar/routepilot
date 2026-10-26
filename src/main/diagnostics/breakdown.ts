import type {
  BreakdownHop,
  ConnectionKind,
  BreakdownSegment,
  MonitorTarget,
  PingBreakdown,
} from "../../shared/contracts";
import {
  LOCATIONS,
  cableMs,
  expectedMs,
  nearestPop,
  placeForPop,
  popForTarget,
  type Coords,
  type PingLocation,
} from "../../shared/pop-locations";
import { probeHost } from "./ping";
import { traceHost } from "./trace";

const HOP_PROBES = 3;
const TARGET_PROBES = 10;
const CONCURRENCY = 5;

export type HopPoint = { ttl: number; address: string; ms: number };
export type Measured = {
  location: PingLocation;
  connection: ConnectionKind;
  origin?: Coords | null;
  target: MonitorTarget;
  points: HopPoint[];
  totalMs: number;
  medianMs: number;
  lossPct: number;
  traceComplete: boolean;
};

const isPrivate = (ip: string) =>
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
const r1 = (v: number) => Math.round(v * 10) / 10;
const ms = (v: number) => `${Math.round(v)} ms`;

// Divide o ping até ao servidor em casa, operadora, cabo ilha→continente e
// continente→servidor. Routers intermédios atrasam as respostas ICMP, por
// isso cada salto vale o menor RTT entre ele e os seguintes.
export function analyse(m: Measured): PingBreakdown {
  const total = m.totalMs;
  const pts = [...m.points].sort((a, b) => a.ttl - b.ttl);
  const eff: number[] = [];
  let floor = total;
  for (let i = pts.length - 1; i >= 0; i--) {
    floor = Math.min(floor, pts[i].ms);
    eff[i] = floor;
  }
  const at = (i: number) => (i < pts.length ? eff[i] : total);

  // Casa: o router (1.º salto, IP privado) e um eventual segundo router logo
  // a seguir, na mesma gama privada e quase sem atraso. As operadoras também
  // usam IPs privados (normalmente 10.x), que já não contam como casa.
  let homeIdx = -1;
  const block = (ip: string) => ip.split(".").slice(0, ip.startsWith("10.") ? 1 : 2).join(".");
  while (
    homeIdx + 1 < pts.length &&
    pts[homeIdx + 1].ttl === homeIdx + 2 &&
    isPrivate(pts[homeIdx + 1].address) &&
    (homeIdx < 0 ||
      (block(pts[homeIdx + 1].address) === block(pts[0].address) &&
        eff[homeIdx + 1] - eff[homeIdx] < 2))
  )
    homeIdx++;
  const homeMs = homeIdx >= 0 ? eff[homeIdx] : null;

  const place = LOCATIONS[m.location];
  const popCode = popForTarget(m.target.id);
  const server = popCode ? placeForPop(popCode) : null;
  const cableExpected = place.island ? r1(cableMs(m.location, m.origin)) : null;

  // O cabo é o primeiro salto grande depois de sair de casa.
  let cableAt: number | null = null;
  if (cableExpected !== null) {
    const threshold = Math.max(6, cableExpected * 0.5);
    for (let i = Math.max(homeIdx + 1, 1); i <= pts.length; i++) {
      if (at(i) - at(i - 1) >= threshold) {
        cableAt = i;
        break;
      }
    }
  }

  const home = homeMs ?? 0;
  const segments: BreakdownSegment[] = [];
  if (homeMs !== null)
    segments.push({ part: "casa", label: "Casa (PC → router)", ms: r1(homeMs) });
  let cable: number | null = null;
  if (cableAt !== null) {
    const before = at(cableAt - 1);
    const after = at(cableAt);
    cable = r1(after - before);
    segments.push(
      { part: "operadora", label: "Operadora na ilha", ms: r1(Math.max(0, before - home)) },
      { part: "cabo", label: "Cabo ilha → continente", ms: cable },
      { part: "continente", label: "Continente → servidor", ms: r1(Math.max(0, total - after)) },
    );
  } else {
    segments.push({ part: "caminho", label: "Operadora → servidor", ms: r1(Math.max(0, total - home)) });
  }

  const hops: BreakdownHop[] = pts.map((p, i) => ({
    ttl: p.ttl,
    address: p.address,
    ms: r1(eff[i]),
    part:
      i <= homeIdx
        ? "casa"
        : cableAt === null
          ? "caminho"
          : i < cableAt
            ? "operadora"
            : "continente",
  }));

  const expected = server ? expectedMs(m.location, server, m.origin) : null;
  const excess = expected === null ? null : r1(total - expected);
  // Em Wi-Fi bom o router responde em 2–6 ms; por cabo em 1–2 ms.
  const wifi = m.connection === "wifi";
  const homeBad = homeMs !== null && homeMs > (wifi ? 8 : 5);
  // O que sobra depois de descontar o atraso a mais de casa é culpa da rota.
  const routeExcess = excess === null ? null : excess - Math.max(0, home - 2);
  const routeBad =
    routeExcess !== null && expected !== null && routeExcess > Math.max(20, expected * 0.5);
  const serverName = server?.name ?? null;
  const where = serverName ?? "o servidor";

  const verdict: PingBreakdown["verdict"] =
    homeBad && homeMs! >= total * 0.25 && (!routeBad || homeMs! >= routeExcess!)
      ? "casa"
      : routeBad
        ? "rota"
        : place.island
          ? "distancia"
          : "bom";
  // Das ilhas, o ping nunca fica abaixo do tempo do cabo até ao continente.
  const wrongPlace = cableExpected !== null && total < cableExpected * 0.8;
  const headline = wrongPlace
    ? "O ping medido não bate com a localização escolhida."
    : verdict === "casa"
      ? `${ms(homeMs!)} dos teus ${ms(total)} ficam dentro de casa, antes de chegar ao router.`
      : verdict === "rota"
        ? `O teu ping está ${ms(excess!)} acima do que a distância até ${where} justifica (~${ms(expected!)}).`
        : verdict === "distancia"
          ? cable !== null
            ? `O teu ping vem sobretudo da distância: o cabo até ao continente soma ~${ms(cable)} e isso não se consegue tirar.`
            : `A partir ${place.name === "Açores" ? "dos Açores" : "da Madeira"}, o mínimo realista até ${where} é ~${ms(expected ?? total)}. Estás perto disso.`
          : expected !== null
            ? `O teu ping está perto do mínimo possível até ${where} (~${ms(expected)}).`
            : "O teu ping não mostra nenhum problema evidente.";

  const advice: string[] = [];
  if (wrongPlace)
    advice.push(
      `Um ping de ${ms(total)} não é possível ${place.name === "Açores" ? "a partir dos Açores" : "a partir da Madeira"}: só o cabo até ao continente demora ~${ms(cableExpected)}. Confirma a localização escolhida (ou a tua ligação já sai pelo continente, por exemplo por VPN).`,
    );
  if (homeMs === null)
    advice.push("O router não respondeu ao traceroute, por isso não foi possível separar a parte de casa.");
  else if (homeBad)
    advice.push(
      wifi
        ? `Em casa perdes ${ms(homeMs)} (Wi-Fi bom fica em 2–6 ms). Liga-te à rede de 5 GHz, aproxima o PC do router e evita paredes pelo meio. Se puderes, um cabo de rede resolve de vez.`
        : `Mesmo por cabo, o router demora ${ms(homeMs)} (o normal é 1–2 ms). Reinicia o router, vê se alguém está a fazer downloads e faz o Teste da rede de casa na página Rede.`,
    );
  if (cableAt !== null) {
    const isp = at(cableAt - 1) - home;
    if (isp > 10)
      advice.push(
        `A rede da operadora na ilha soma ${ms(isp)} antes do cabo. Fibra costuma ter muito menos atraso do que ADSL, 4G/5G ou satélite.`,
      );
    advice.push(
      `O cabo submarino até ao continente soma ${ms(cable!)} (o esperado é ~${ms(cableExpected!)}). Esta parte é física: nenhuma app, VPN ou relay a consegue baixar.` +
        (cable! > cableExpected! * 2 + 10
          ? " Está bem acima do esperado: pode ser congestão na operadora. Repete o teste a outra hora."
          : ""),
    );
  } else if (place.island && !wrongPlace)
    advice.push(
      "Não foi possível ver o salto do cabo (alguns routers não respondem ao traceroute), por isso a divisão ilha/continente não está disponível.",
    );
  if (routeBad)
    advice.push(
      `Estás ${ms(excess!)} acima do esperado. Repete o teste a horas diferentes: se só acontece à noite é congestão da operadora; se acontece sempre, a rota dá uma volta. Mostra este resultado à operadora ou testa um relay em Lisboa ou Madrid (Definições → Servidores de passagem, depois Comparar rotas no jogo).`,
    );
  if (m.target.id.startsWith("cs2-") && expected !== null) {
    const near = nearestPop(m.location, m.origin);
    if (placeForPop(near.code) !== server && expected - near.ms > 10)
      advice.push(
        `${near.place.name} fica mais perto de ti (~${ms(near.ms)} estimados contra ~${ms(expected)}). No CS2, ativa o modo Automático para jogares no servidor com menor ping.`,
      );
  }
  if (m.medianMs - total > 10)
    advice.push(
      `O ping varia: mínimo ${ms(total)}, típico ${ms(m.medianMs)}. ` +
        (wifi
          ? "Em Wi-Fi isto é normalmente interferência: usa 5 GHz e fica perto do router."
          : "Por cabo isto vem normalmente de alguém a usar a internet (bufferbloat); faz o Teste da rede de casa na página Rede."),
    );
  if (m.lossPct > 0)
    advice.push(
      `${m.lossPct}% das sondas ao servidor ficaram sem resposta. Pode ser só o servidor a ignorar pings; confirma com o Monitor ao vivo.`,
    );
  if (!wrongPlace && (verdict === "bom" || (verdict === "distancia" && !homeBad && !routeBad)))
    advice.push(
      wifi
        ? "Não há muito mais a ganhar: joga no servidor mais perto e, em Wi-Fi, usa 5 GHz perto do router."
        : "Não há muito mais a ganhar: joga sempre no servidor mais perto.",
    );

  return {
    measuredAt: new Date().toISOString(),
    location: m.location,
    connection: m.connection,
    exactLocation: !!m.origin,
    target: { id: m.target.id, label: m.target.label, host: m.target.host },
    serverName,
    totalMs: r1(total),
    medianMs: r1(m.medianMs),
    lossPct: m.lossPct,
    segments,
    hops,
    expectedMs: expected,
    cableExpectedMs: cableExpected,
    excessMs: excess,
    verdict,
    headline,
    advice,
    traceComplete: m.traceComplete,
  };
}

async function pings(host: string, n: number, signal: AbortSignal) {
  const out: (number | null)[] = [];
  for (let i = 0; i < n && !signal.aborted; i++) {
    const s = await probeHost(host, 1000, signal);
    out.push(s.status === "reply" ? s.rttMs : null);
  }
  return out;
}

export async function runBreakdown(
  target: MonitorTarget,
  location: PingLocation,
  connection: ConnectionKind,
  origin: Coords | null,
  signal: AbortSignal,
  onProgress: (step: string) => void,
): Promise<PingBreakdown> {
  onProgress("A seguir o caminho até ao servidor (até 45 s)…");
  const trace = await traceHost(
    { id: target.id, label: target.label.slice(0, 80), host: target.host },
    signal,
  );
  if (signal.aborted) throw new Error("Cancelado.");
  if (!trace.ok) throw new Error(trace.error.message);
  const hops = trace.value.hops.filter(
    (h): h is typeof h & { address: string } =>
      h.status === "reply" && h.address !== null && h.address !== target.host,
  );

  onProgress(`A medir os ${hops.length} routers do caminho…`);
  const points: HopPoint[] = [];
  let next = 0;
  const worker = async () => {
    while (next < hops.length && !signal.aborted) {
      const h = hops[next++];
      const values = (await pings(h.address, HOP_PROBES, signal)).filter(
        (v): v is number => v !== null,
      );
      const best = Math.min(...values, h.rttMs ?? Infinity);
      if (Number.isFinite(best)) points.push({ ttl: h.ttl, address: h.address, ms: best });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  onProgress("A medir o servidor…");
  const samples = await pings(target.host, TARGET_PROBES, signal);
  if (signal.aborted) throw new Error("Cancelado.");
  const okSamples = samples.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (!okSamples.length)
    throw new Error("O servidor não respondeu ao ping. Experimenta outro servidor da lista.");
  return analyse({
    location,
    connection,
    origin,
    target,
    points,
    totalMs: okSamples[0],
    medianMs: okSamples[Math.floor(okSamples.length / 2)],
    lossPct: Math.round(((samples.length - okSamples.length) / samples.length) * 100),
    traceComplete: trace.value.complete,
  });
}
