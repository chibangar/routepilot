// Gera assets/icon.ico e docs/icon-*.png a partir de assets/logo.svg.
// Uso: npx electron scripts/render-icon.cjs
const { app, BrowserWindow } = require("electron");
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const svg = readFileSync(join(root, "assets/logo.svg"), "utf8");
const sizes = [16, 24, 32, 48, 64, 128, 256];

function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(png.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.png)]);
}

// Desenha o SVG num canvas de cada tamanho dentro de uma janela escondida.
const renderInPage = `(async (svg, sizes) => {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const img = new Image();
  img.src = url;
  await img.decode();
  return sizes.map((size) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, size, size);
    return c.toDataURL("image/png");
  });
})`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 300, height: 300 });
  await win.loadURL("data:text/html,<html><body></body></html>");
  const urls = await win.webContents.executeJavaScript(
    `${renderInPage}(${JSON.stringify(svg)}, ${JSON.stringify(sizes)})`,
  );
  const images = sizes.map((size, i) => ({
    size,
    png: Buffer.from(urls[i].split(",")[1], "base64"),
  }));
  for (const { size, png } of images)
    if (size === 256 || size === 64) writeFileSync(join(root, `docs/icon-${size}.png`), png);
  win.destroy();
  writeFileSync(join(root, "assets/icon.ico"), ico(images.filter((i) => [16, 24, 32, 48, 256].includes(i.size))));
  console.log("Ícones gerados:", images.map((i) => i.size).join(", "));
  app.quit();
});
