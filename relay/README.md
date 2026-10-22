# RoutePilot relay

Servidor de passagem para medir se um caminho através de um servidor teu é mais rápido do que a ligação direta ao servidor do jogo.

Esta versão **só mede**. Responde a dois pedidos UDP autenticados:

- `echo`: o RoutePilot mede o RTT entre o teu PC e o relay.
- `probe`: o relay faz ping ao destino do jogo e devolve o RTT entre o relay e o destino.

A rota via relay é estimada como `RTT(PC→relay) + RTT(relay→destino)`. O tráfego do jogo ainda não passa pelo relay; isso é o passo seguinte (túnel WireGuard + captura por processo).

## Requisitos

- VPS Linux (Ubuntu/Debian) perto dos servidores do jogo, por exemplo em São Paulo ou Miami.
- Node.js 20 ou mais recente e o comando `ping` (pacote `iputils-ping`).
- Porta UDP 7400 aberta na firewall do fornecedor.

## Instalação no VPS

```bash
sudo mkdir -p /opt/routepilot-relay
sudo cp server.mjs /opt/routepilot-relay/
openssl rand -hex 32
```

Guarda o token gerado. É o mesmo valor que colas no RoutePilot em **Definições → Servidores de passagem**.

`/etc/systemd/system/routepilot-relay.service`:

```ini
[Unit]
Description=RoutePilot relay
After=network-online.target

[Service]
Environment=RELAY_TOKEN=COLA_AQUI_O_TOKEN
Environment=RELAY_PORT=7400
ExecStart=/usr/bin/node /opt/routepilot-relay/server.mjs
DynamicUser=yes
Restart=on-failure
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now routepilot-relay
sudo ufw allow 7400/udp
```

## Segurança

- Pedidos sem assinatura HMAC válida são ignorados sem resposta.
- Cada pedido tem um nonce único e um carimbo de tempo (±30 s), o que impede repetições.
- Limite de 40 pedidos por IP a cada 10 s e no máximo 8 pings em simultâneo.
- O relay só aceita hostnames/IPs e chama `ping` sem shell.
- O relógio do PC e do VPS tem de estar certo (NTP); com mais de 30 s de diferença os pedidos são recusados.

## Teste local

```bash
RELAY_TOKEN=$(openssl rand -hex 32) node relay/server.mjs
```
