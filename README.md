# RoutePilot

Aplicação desktop para Windows, em português, para organizar aplicações e observar ligações de rede. Projeto independente, inspirado nas referências visuais fornecidas, sem dependência do ExitLag ou de uma conta.

## Abrir a aplicação

Executar `delivery/RoutePilot-1.7.0-Windows.exe`. A distribuição portátil extrai os seus ficheiros para uma pasta temporária; configurações e histórico ficam na pasta de dados do utilizador. Não requer Node.js para utilização.

1. Adicionar uma aplicação e dar-lhe um nome. Associar um `.exe` é opcional; esse ficheiro não é executado.
2. Configurar um ou mais hostnames/IPs conhecidos. Não colar URLs.
3. Iniciar o diagnóstico ou analisar o caminho. O botão **Testar ligação local** usa `127.0.0.1`, para verificar o funcionamento neste computador.
4. Consultar o histórico e exportar CSV ou JSON. O JSON inclui as amostras, saídas originais e sondas de seleção automática.

## Detetar jogos instalados

Em **Aplicações → Detetar jogos instalados**, procura registos Steam, Epic Games e GOG. Seleciona os itens que pretendes importar. A aplicação mostra nome, origem e pasta; pode também identificar um executável declarado pelo fornecedor. Não procura executáveis recursivamente nem os executa.

O botão **Escolher biblioteca** permite selecionar uma pasta que contenha `steamapps`. Até 16 bibliotecas adicionais ficam guardadas nas definições locais e são reutilizadas após reiniciar. Jogos importados mantêm a origem e ficam sem destinos de rede inventados. Entradas já adicionadas são identificadas; a identidade de fornecedor/jogo é independente da localização.

Os registos Steam também incluem ferramentas, servidores dedicados e componentes partilhados. Uma pasta existente com manifesto é um candidato; isto não comprova que a instalação esteja completa ou que o jogo inicie. Outros launchers e jogos sem registo continuam disponíveis pela adição manual.

A deteção lê apenas registos e pastas locais conhecidas/escolhidas; não altera os launchers ou jogos. Limites por procura: 512 candidatos, 64 bibliotecas Steam, 4096 entradas de diretório, 1 MiB por manifesto e 64 MiB de manifestos no total. A leitura tem prazo cooperativo de 20 segundos, além dos 10 segundos máximos da consulta do registo. Limites, erros e cancelamento são apresentados como cobertura parcial.

## Funcionalidades

- Biblioteca pesquisável com criação, edição e remoção de aplicações.
- Destinos manuais ou comparação automática com até três sondas por destino; menor RTT médio entre destinos com resposta, com desempate pela ordem configurada.
- Sessões de ping reais com mínimo, média, jitter, sondas sem resposta e gráfico.
- Traceroute real com saltos respondentes, desconhecidos e evidência original.
- Histórico local, exportação e cópia de segurança do estado anterior válido.
- Utilização real de CPU e memória; GPU não medida.
- Cancelamento de diagnósticos e encerramento com limpeza dos processos filhos.
- Dados inválidos preservados. Uma falha ao guardar retém a sessão em memória, bloqueia a substituição e apresenta a opção de tentar novamente.

## Como interpretar os resultados

RTT é a ida e volta de uma sonda **ICMP**, não a latência medida dentro do jogo. Ausência de resposta pode indicar filtragem/bloqueio e não prova perda de pacotes no jogo. Erros do processo ou de interpretação são apresentados como erros e não como sondas perdidas.

Jitter é a média das diferenças absolutas entre RTTs de respostas consecutivas, sem atravessar timeouts/erros. Sem pares de respostas, permanece desconhecido. Quando o Windows devolve `<1 ms`, a aplicação conserva essa saída e usa `0,5 ms` como estimativa nos cálculos; não conhece a medição exata.

Traceroute não garante o caminho usado pelo jogo. O destino só é confirmado se responder no último salto observado. Caminhos parciais, cancelados e respostas desconhecidas são identificados.

## CS2: servidor com menor ping

Na página do Counter-Strike 2, o painel **Servidores do CS2** mede os datacenters oficiais da Valve (lista `GetSDRConfig` da Steam) e mostra o ping de cada um. O interruptor **Automático** instala, com um pedido de administrador, a tarefa agendada `RoutePilot CS2`: ao iniciar sessão e a cada 6 horas mede todos os datacenters, mantém ativo o de menor ping (mais os que estão até +10 ms) e bloqueia os restantes na Firewall do Windows, só para UDP, no grupo `RoutePilot CS2`. O script elevado fica em `%ProgramData%/RoutePilot` (só administradores o alteram) e lê do pedido apenas o modo e códigos de datacenter; os IPs vêm sempre da Valve. **Remover do Windows** apaga tarefa, regras e script.

## LoL: região mais perto

Na página do League of Legends, o painel **Servidor do LoL mais perto de ti** mede o RTT até à cidade do datacenter de cada região (lista da wiki oficial: EUW Amesterdão, EUNE Frankfurt, NA Chicago, BR São Paulo…). Como a Riot não responde a ICMP, a medição usa relays da Valve na mesma cidade, ou na mais próxima quando não há (marcado como aproximado). No LoL o servidor é a região da conta, por isso a app recomenda a região e não altera a firewall.

## Onde está o meu ping?

No topo da página **Rede**, escolhe onde estás (Continente, Madeira ou Açores) e o servidor (datacenter do CS2 ou região do LoL). O RoutePilot faz um traceroute, mede cada router do caminho e divide o ping em **casa** (PC → router), **operadora na ilha**, **cabo ilha → continente** e **continente → servidor** (no continente: casa e operadora → servidor). Como os routers intermédios atrasam as respostas ICMP, cada salto vale o menor RTT entre ele e os seguintes. O cabo é o primeiro salto grande depois de sair de casa.

O resultado compara o ping com o **mínimo realista** para a distância (fibra a ~100 km de ida e volta por ms, +60% de percurso e 5 ms de acesso; das ilhas, via Lisboa) e dá conselhos: Wi-Fi/router lento, operadora lenta na ilha, cabo acima do esperado, rota com desvio (sugere repetir a outras horas, falar com a operadora ou testar um relay), servidor do CS2 mais perto e ping instável. Também avisa quando o ping medido é impossível para a localização escolhida. São estimativas: o traceroute não garante o caminho do tráfego do jogo.

## Verificar a minha rede

A página **Rede** identifica Wi-Fi/cabo e sinal, mede o router, o ping com a ligação parada e durante download/upload (servidores de teste da Cloudflare, ~100–500 MB) e dá uma nota de bufferbloat com conselhos.

## Desempenho, Traffic Shaper e Multi-Internet

- **Desempenho** (nova página): plano de energia (`powercfg`, sem administrador), Modo de Jogo (`HKCU\Software\Microsoft\GameBar`), prioridade alta para processos de jogos conhecidos e lista das apps que mais memória usam, com opção de as fechar (processos do sistema protegidos).
- **Traffic Shaper**: limites de upload por app com `New-NetQosPolicy` (prefixo `RoutePilot - `, administrador). Só limita o upload; o download depende do router.
- **Multi-Internet** (página Rede): lista as ligações com gateway, mede o ping em cada uma (`ping -S`) e define a preferida pela métrica da interface (administrador). "Voltar ao automático" repõe `AutomaticMetric`.
- **Monitor ao vivo** (página Rede): uma sonda por segundo até ao router, à internet, a um datacenter do CS2 ou à cidade de uma região do LoL, com média, jitter, picos e perdas.

## Comparar rotas com relays próprios

Em **Definições → Servidores de passagem** podes registar servidores teus que corram `relay/server.mjs` (instruções em [relay/README.md](relay/README.md)). Na página de cada jogo, **Comparar rotas** mede o ping direto e o caminho estimado via cada relay (PC→relay + relay→destino), e indica qual é mais rápido. Os pedidos são UDP assinados com HMAC; o token fica guardado em `state.json` neste PC.

**A aplicação não encaminha o tráfego dos jogos.** O relay (`relay/server.mjs`) já sabe reencaminhar UDP, mas o cliente de túnel no Windows ainda não existe. Não altera DNS, rotas globais, adaptadores ou drivers; a firewall só é alterada pelo modo automático do CS2, quando o ativas.

## Dados e limites

A localização exata aparece em **Definições → Armazenamento local**, normalmente `%APPDATA%/RoutePilot`. `state.json` contém o estado e `state.json.bak` a cópia anterior. Fechar a aplicação antes de manipular esses ficheiros.

- Até 64 aplicações, 16 destinos por aplicação e 120 sondas por sessão.
- Até 200 sessões recentes, dentro de um orçamento de 16 MiB; a retenção remove as mais antigas antes de guardar. Exportar para preservar um histórico maior.
- Timeout de ping: 250–5000 ms; pausa após cada sonda: 250–10000 ms.
- Traceroute: 20 saltos, 500 ms por sonda e 45 segundos de duração máxima.
- Apenas um diagnóstico de rede ativo por vez.
- Perfil alternativo: `RoutePilot.exe --user-data-dir="C:/caminho/para/perfil"`, com diretório previamente criado.

Não há telemetria. Diagnósticos contactam os destinos escolhidos e podem provocar consultas DNS do Windows. O histórico não copia o ambiente do processo nem o conteúdo de executáveis.

## Desenvolvimento

Toolchain usado: Node.js 24.20.0 e npm 11.19.0. Dependências fixadas em `package-lock.json`.

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm start
npm run test:smoke
node scripts/boundaries.mjs
node scripts/discovery-smoke.mjs
npm run dist:win
node scripts/smoke.mjs --packaged
```

`npm run build` compila o processo principal, preload e interface. `dist:win` produz a distribuição portátil e `delivery/win-unpacked/RoutePilot.exe`. O ícone pode ser regenerado com `scripts/create-icon.ps1` no PowerShell.

O smoke usa perfis isolados em `.work/`, mede apenas o loopback e substitui o diálogo de exportação na instância de teste para guardar os ficheiros de verificação. Não modifica o perfil normal. A suíte de limites confirma também falhas de gravação reais e recuperação.

O executável local não tem assinatura digital de um editor. `npm audit --omit=dev` foi verificado sem alertas; a cadeia de ferramentas de empacotamento apresenta oito alertas moderados derivados de `sprintf-js` transitivo. Esses pacotes pertencem ao desenvolvimento, não ao código distribuído. Não foi aplicado um downgrade automático da ferramenta para silenciar o relatório.

Ver [docs/verification.md](docs/verification.md) para o alcance da validação executada e as limitações.
