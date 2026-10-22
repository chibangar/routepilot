# Verificação — RoutePilot 1.1.0

Data: 22 de outubro de 2026. Host: Windows x64, Node.js 24.20.0. Projeto independente da REA.

## Evidência executada

- Suíte Vitest: 34 testes, incluindo validação, persistência, orçamento de bytes, métricas, parsing PT/EN, cancelamento, processos, seleção automática, retenção após falha e recuperação da gravação.
- `npm run typecheck`: executado sem erros.
- `npm run build`: compilação de Electron/preload/React concluída. Vite apresenta avisos sobre diretivas `use client` da dependência de ícones; a aplicação é exclusivamente cliente e o arranque real foi testado.
- `npm run test:smoke`: aplicação Electron real com perfil temporário. Criação pela interface, ping real de `127.0.0.1` com 3/3 respostas, traceroute até ao loopback, cancelamento ativo, histórico, exportação JSON/CSV, definições, ajuda, viewport mínimo e reinício.
- Encerramento durante ping ativo: sessão cancelada preservada em disco; sem erros de JavaScript no renderer.
- `node scripts/boundaries.mjs`: seleção automática real entre `0.0.0.0` (falha local) e `127.0.0.1`; rótulo final mantém o destino observado. Edição invalida traceroute anterior. JSON corrompido preservado. Falha real de escrita, bloqueio de nova sessão e recuperação após restaurar o ficheiro.
- Capturas da aplicação em `docs/screenshots/`; inspeção visual do painel inicial e diagrama de caminho. O contentor principal tem scroll próprio.
- Revisão independente do código: seis problemas encontrados, reproduzidos e corrigidos — orçamento de persistência, posse da sessão não guardada, identidade do destino exibido, normalização de IPv6, classificação de falhas desconhecidas do ping e concorrência nas tentativas de recuperação.

Os logs estruturados de cada execução de smoke ficam em `.work/`, fora do controlo de versões. Não se tratam de evidência do funcionamento do ExitLag.

## Distribuição

A distribuição foi validada com o smoke completo sobre `delivery/win-unpacked/RoutePilot.exe`. O invólucro portátil `delivery/RoutePilot-1.1.0-Windows.exe` foi também iniciado: ping real ao loopback com 3/3 respostas, histórico persistido e encerramento com código zero. O processo principal no ASAR corresponde por SHA-256 ao último compilado. O resultado final, tamanho e SHA-256 do executável estão em `delivery/verification.json`.

## Cobertura e limitações

Loopback foi medido; não foi realizado um benchmark de ligação a servidores de jogos, nem uma comparação com ExitLag. Não há evidência de redução de ping, encaminhamento ou multipath. Não foram provisionados relays.

PT/EN e variantes de IPv6 foram verificados em testes de parser. O Windows deste host devolve as saídas reais em inglês; não foi executado um segundo Windows em português. Parsers desconhecidos falham explicitamente.

Resultados sem resposta foram exercitados em testes de parser e métricas; a falha local de `0.0.0.0` foi observada na aplicação real. A rede física não foi desligada durante a verificação. Nenhum teste demonstra comportamento com todos os possíveis antivírus, políticas empresariais, servidores ou versões de Windows.

O diálogo nativo de exportação é substituído apenas na instância automatizada. O caminho de IPC, a exportação e os ficheiros são reais; não houve interação manual com o diálogo do Windows durante esse teste.

Sem assinatura de editor. Auditoria de dependências de produção: zero alertas. Oito alertas moderados na cadeia transitiva de desenvolvimento do electron-builder foram registados; nenhum `audit fix --force` foi aplicado.

Custos de CPU, pico de memória da família de processos, tokens e comparações frio/quente não foram medidos. Os resultados aqui documentados são verificação funcional, não medições de desempenho.

## Atualização 1.1.0 — deteção de instalações

- Botão Aplicações → Detetar jogos instalados, com seleção explícita e fontes Steam/Epic/GOG. Bibliotecas Steam adicionais persistem após reinício.
- Consulta real do registo Windows e manifestos locais: sete entradas Steam observadas no disco E:, incluindo jogos e ferramentas/componentes. Não foram importadas para o perfil normal durante o teste.
- Deteção, seleção pela interface, importação, prevenção de duplicados, ausência de destinos inventados, IDs inválidos recusados e persistência da biblioteca adicional verificados no executável empacotado. A biblioteca adicional usada na importação automatizada é uma fixture de teste, não uma instalação real.
- Fixtures de Steam/Epic/GOG verificam KeyValues, Unicode, JSON inválido, caminhos indevidos, executável desconhecido e cancelamento. Não havia instalações reais Epic/GOG observadas neste host.
- Regressões adicionais verificam identidade estável após mover um jogo, limite partilhado de 64 bibliotecas em ficheiros reais e separação de stdout/stderr em processos reais.
- Revisão da funcionalidade corrigiu identidade dependente do caminho, cancelamento no ciclo de bibliotecas, limite contornado por raízes adicionais e truncagem de registos GOG sem aviso. A truncagem GOG com mais de 512 registos foi verificada por inspeção da origem; não foi criada uma instalação real com essa dimensão.
- A saída estruturada do PowerShell é lida pelo stdout UTF-8; o stderr é conservado separadamente. A correção foi reproduzida com a mensagem CLIXML de preparação dos módulos deste Windows e testada num subprocesso real.
- Nova distribuição portátil executada e fechada com código zero, com diagnóstico real de loopback. SHA-256 e tamanho registados em delivery/verification-1.1.0.json.
