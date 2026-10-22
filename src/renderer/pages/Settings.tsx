import { useEffect, useState } from "react";
import {
  Check,
  Globe,
  ShieldCheck,
  SlidersHorizontal,
  Route,
  Activity,
  FolderOpen,
  Info,
} from "lucide-react";
import { useApp } from "../context";
import { PageHeading, SectionTitle } from "../components/UI";
import { RelaySettings } from "../components/RelaySettings";
import type { Settings } from "../../shared/contracts";
import { isEconomyMode } from "../../shared/performance";
export function SettingsPage() {
  const { runtime, act, refresh, notify } = useApp();
  const [settings, setSettings] = useState<Settings>({
    sampleCount: 20,
    timeoutMs: 1000,
    intervalMs: 1000,
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (runtime) setSettings(runtime.store.settings);
  }, [runtime]);
  return (
    <>
      <PageHeading
        eyebrow="À TUA MEDIDA"
        title="Definições"
        subtitle="Ajusta os diagnósticos. Mantém o controlo dos teus dados."
      />
      <SectionTitle>Desempenho e diagnósticos</SectionTitle>
      <form
        className="panel settings-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            const result = await act(() =>
              window.routepilot.saveSettings(settings),
            );
            if (result) {
              await refresh();
              notify("Definições guardadas.");
            }
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="settings-intro">
          <div className="hardware-icon">
            <SlidersHorizontal size={23} />
          </div>
          <div>
            <h3>Uma medição que se adapta a ti</h3>
            <p>Estas definições aplicam-se às próximas sessões de ping.</p>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <h3>Modo económico</h3>
            <p>
              Ativo por defeito. Desativa animações decorativas e atualizações
              contínuas do sistema. Usa Atualizar sistema no início para
              consultar CPU e memória.
            </p>
          </div>
          <label className="economy-toggle">
            <input
              type="checkbox"
              aria-label="Modo económico"
              checked={isEconomyMode(settings)}
              onChange={(event) =>
                setSettings({ ...settings, economyMode: event.target.checked })
              }
            />
            <span>{isEconomyMode(settings) ? "Ativo" : "Desativado"}</span>
          </label>
        </div>
        <div className="setting-row">
          <div>
            <h3>Número de sondas</h3>
            <p>Entre 1 e 120 sondas por sessão.</p>
          </div>
          <input
            aria-label="Número de sondas"
            type="number"
            min="1"
            max="120"
            required
            value={settings.sampleCount}
            onChange={(e) =>
              setSettings({ ...settings, sampleCount: Number(e.target.value) })
            }
          />
        </div>
        <div className="setting-row">
          <div>
            <h3>Tempo de espera por resposta</h3>
            <p>Entre 250 e 5000 milissegundos por sonda.</p>
          </div>
          <div className="input-unit">
            <input
              aria-label="Tempo de espera"
              type="number"
              min="250"
              max="5000"
              required
              value={settings.timeoutMs}
              onChange={(e) =>
                setSettings({ ...settings, timeoutMs: Number(e.target.value) })
              }
            />
            <span>ms</span>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <h3>Intervalo entre sondas</h3>
            <p>Pausa de 250 a 10000 milissegundos após cada sonda.</p>
          </div>
          <div className="input-unit">
            <input
              aria-label="Intervalo entre sondas"
              type="number"
              min="250"
              max="10000"
              required
              value={settings.intervalMs}
              onChange={(e) =>
                setSettings({ ...settings, intervalMs: Number(e.target.value) })
              }
            />
            <span>ms</span>
          </div>
        </div>
        <RelaySettings
          relays={settings.relays ?? []}
          onChange={(relays) => setSettings({ ...settings, relays })}
        />
        <div className="settings-footer">
          <button type="submit" className="button primary" disabled={saving}>
            <Check size={17} />
            {saving ? "A guardar…" : "Guardar definições"}
          </button>
        </div>
      </form>
      <SectionTitle>Dados e privacidade</SectionTitle>
      <div className="panel settings-panel">
        <div className="setting-row">
          <div>
            <h3>
              <FolderOpen size={17} />
              Armazenamento local
            </h3>
            <p>
              Configurações, sessões e cópia de segurança do último estado
              válido.
            </p>
            <code className="data-path">
              {runtime?.dataPath ?? "A carregar…"}
            </code>
          </div>
          <span className="tag">Neste PC</span>
        </div>
        <div className="setting-row">
          <div>
            <h3>Retenção do histórico</h3>
            <p>
              São preservadas até 200 sessões recentes, dentro do limite de 16
              MiB. Exporta o histórico para conservar uma cópia.
            </p>
          </div>
          <strong>200 sessões / 16 MiB</strong>
        </div>
        <div className="setting-row">
          <div>
            <h3>
              <ShieldCheck size={17} />
              Sem telemetria
            </h3>
            <p>
              A aplicação não envia os teus dados para serviços de análise. Os
              diagnósticos contactam os destinos que escolhes.
            </p>
          </div>
        </div>
      </div>
      <div className="note-strip">
        <Info size={18} />
        <p>
          RoutePilot não altera o DNS, a firewall, os adaptadores ou as rotas do
          Windows. Não há túnel ou relay configurado nesta versão.
        </p>
      </div>
    </>
  );
}
export function Help() {
  const { navigate } = useApp();
  return (
    <>
      <PageHeading
        eyebrow="COMPREENDER PARA MELHORAR"
        title="A tua rede, sem mistérios."
        subtitle="Um guia rápido para ler os resultados com confiança."
      />
      <div className="help-grid">
        {[
          {
            icon: Activity,
            title: "Ping e estabilidade",
            text: "O RTT é o tempo de ida e volta de uma sonda ICMP. O mínimo mostra a resposta mais rápida; a média resume as respostas recebidas.",
          },
          {
            icon: SlidersHorizontal,
            title: "O que significa jitter?",
            text: "É a média das diferenças absolutas entre RTTs de respostas consecutivas. Os pares separados por falhas são excluídos; uma única resposta não permite calcular jitter.",
          },
          {
            icon: Globe,
            title: "Sondas sem resposta",
            text: "A percentagem refere-se às sondas ICMP enviadas sem resposta válida. Pode indicar perda, filtragem ou bloqueio. Não prova perda de pacotes no jogo.",
          },
          {
            icon: Route,
            title: "Ler um traceroute",
            text: "Cada salto representa uma resposta observada pelo tracert.exe. Um salto sem resposta permanece desconhecido. O destino só é confirmado quando responde no último salto.",
          },
        ].map((item) => (
          <section className="panel help-card" key={item.title}>
            <div className="hardware-icon">
              <item.icon size={23} />
            </div>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
          </section>
        ))}
      </div>
      <SectionTitle>Começar em três passos</SectionTitle>
      <section className="panel guide-panel">
        {[
          [
            "01",
            "Adiciona uma aplicação",
            "Dá-lhe um nome e, se quiseres, associa o executável. Este não será executado.",
          ],
          [
            "02",
            "Configura os teus destinos",
            "Indica hostnames ou IPs conhecidos. A seleção automática compara até três sondas por destino, com cobertura parcial quando há falhas.",
          ],
          [
            "03",
            "Observa e compara",
            "Inicia uma sessão, vê o caminho e consulta o histórico. Mantém as mesmas condições para comparar resultados.",
          ],
        ].map(([n, title, text]) => (
          <div className="guide-step" key={n}>
            <span>{n}</span>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </div>
        ))}
        <button
          className="button primary"
          onClick={() => navigate("connections")}
        >
          Ir para as aplicações
        </button>
      </section>
      <SectionTitle>Limites que deves conhecer</SectionTitle>
      <section className="panel help-limits">
        <p>
          As medições ICMP não equivalem ao ping de uma sessão de jogo. Alguns
          destinos bloqueiam estas sondas. O caminho pode variar entre sondas e
          protocolos.
        </p>
        <p>
          Quando o Windows devolve «&lt;1 ms», não fornece o valor exato.
          RoutePilot apresenta «&lt;1» e usa 0,5 ms como estimativa nos
          cálculos. A saída original fica disponível na evidência da sessão.
        </p>
        <p>
          Esta versão faz diagnóstico local. Otimização e encaminhamento de
          tráfego exigem relays e um túnel próprios, que ainda não estão
          implementados. Não há garantia de redução de ping.
        </p>
        <p>
          O traceroute tem limite de 20 saltos e 45 segundos. A comparação
          automática serve apenas para os destinos configurados; a ordem de
          configuração resolve empates.
        </p>
      </section>
    </>
  );
}
