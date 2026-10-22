// Formato dos pacotes de dados trocados com relay/server.mjs:
// 0x01 | sessão (16 bytes) | IPv4 do servidor do jogo (4) | porta (2) | payload.
export const DATA = 0x01;
export const HEADER = 23;

export function encodeFrame(
  session: Buffer,
  address: string,
  port: number,
  payload: Uint8Array,
): Buffer {
  const header = Buffer.alloc(HEADER);
  header[0] = DATA;
  session.copy(header, 1);
  address.split(".").forEach((o, i) => (header[17 + i] = Number(o)));
  header.writeUInt16BE(port, 21);
  return Buffer.concat([header, payload]);
}

export function decodeFrame(buf: Buffer) {
  if (buf.length < HEADER || buf[0] !== DATA) return null;
  return {
    session: buf.subarray(1, 17),
    address: `${buf[17]}.${buf[18]}.${buf[19]}.${buf[20]}`,
    port: buf.readUInt16BE(21),
    payload: buf.subarray(HEADER),
  };
}
