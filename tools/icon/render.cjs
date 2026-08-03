// Rasterise assets/icon.svg with the Electron already in node_modules — no librsvg,
// Inkscape or ImageMagick required, and it renders with the same engine that will draw
// the icon in the desktop shell.
//
//   node_modules/.bin/electron tools/icon/render.cjs [--size 1024] [--out assets/icon.png]
//
// Also emits a contact sheet of small sizes, because an app icon that only works at
// 1024 is not an app icon.
'use strict'

const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback
}

const ROOT = path.resolve(__dirname, '../..')
const SVG = path.join(ROOT, 'assets/icon.svg')
const SIZE = Number(arg('size', '1024'))
const OUT = path.resolve(ROOT, arg('out', 'assets/icon.png'))
const SHEET = path.resolve(ROOT, arg('sheet', 'assets/icon-sizes.png'))

const svg = fs.readFileSync(SVG, 'utf8')
const b64 = Buffer.from(svg).toString('base64')

function page(html) {
  return 'data:text/html;base64,' + Buffer.from(html).toString('base64')
}

async function shoot(win, html, width, height, out) {
  await win.loadURL(page(html))
  // One frame is not always enough for gradients to be composited.
  await new Promise((r) => setTimeout(r, 350))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width, height })
  fs.writeFileSync(out, image.toPNG())
  console.log(`wrote ${out} (${width}×${height})`)
}

app.whenReady().then(async () => {
  const full = `<body style="margin:0;background:#000">
    <img src="data:image/svg+xml;base64,${b64}" style="width:${SIZE}px;height:${SIZE}px;display:block">
  </body>`

  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  await shoot(win, full, SIZE, SIZE, OUT)
  win.destroy()

  // Contact sheet: the sizes that actually decide whether a mark works.
  const sizes = [180, 120, 87, 60, 40]
  const gap = 24
  const sheetW = sizes.reduce((a, s) => a + s + gap, gap)
  const sheetH = sizes[0] + gap * 2
  const row = sizes
    .map(
      (s) =>
        `<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end">
           <img src="data:image/svg+xml;base64,${b64}" style="width:${s}px;height:${s}px;border-radius:${Math.round(
             s * 0.2237
           )}px;display:block">
         </div>`
    )
    .join('')
  const sheet = `<body style="margin:0;background:#8a8a8a;display:flex;gap:${gap}px;align-items:flex-end;padding:${gap}px;box-sizing:border-box;height:${sheetH}px">${row}</body>`

  const win2 = new BrowserWindow({
    width: sheetW,
    height: sheetH,
    show: false,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  await shoot(win2, sheet, sheetW, sheetH, SHEET)
  win2.destroy()

  app.quit()
})
