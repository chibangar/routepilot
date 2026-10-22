// Corre a verificação de rede real neste PC: npx esbuild scripts/network-check-live.mts --bundle --platform=node --format=esm --outfile=... e correr com node
import { runNetworkCheck } from "../src/main/diagnostics/network-check";

const result = await runNetworkCheck(new AbortController().signal, (s) =>
  console.log(s),
);
console.log(JSON.stringify(result, null, 2));
