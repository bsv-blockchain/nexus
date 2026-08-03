#!/usr/bin/env node

import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// Simple MIME type mapping
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  return mimeTypes[ext] || 'application/octet-stream'
}

function getLocalIPv4() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name]
    for (const addr of addrs) {
      // Skip loopback and internal addresses
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address
      }
    }
  }
  return 'localhost'
}

const port = parseInt(process.env.PORT || '8099', 10)

const server = http.createServer((req, res) => {
  const startTime = Date.now()
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  // Normalize path
  let filePath
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(root, 'apps', 'harness', 'index.html')
  } else if (pathname === '/proof' || pathname === '/proof.html') {
    filePath = path.join(root, 'tools', 'proof.html')
  } else if (pathname.startsWith('/')) {
    // Try to serve from apps/harness/
    filePath = path.join(root, 'apps', 'harness', pathname)
  } else {
    filePath = path.join(root, pathname)
  }

  // Normalize the path to prevent directory traversal
  filePath = path.normalize(filePath)
  const harnessBase = path.join(root, 'apps', 'harness')
  const toolsBase = path.join(root, 'tools')

  // Only serve from apps/harness/ or tools/
  const isInHarness = filePath.startsWith(harnessBase)
  const isInTools = filePath.startsWith(toolsBase)

  if (!isInHarness && !isInTools) {
    const elapsed = Date.now() - startTime
    console.log(`${req.method} ${pathname} 404 ${elapsed}ms`)
    res.writeHead(404, {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/plain; charset=utf-8'
    })
    res.end('404 Not Found')
    return
  }

  fs.readFile(filePath, (err, data) => {
    const elapsed = Date.now() - startTime
    if (err) {
      console.log(`${req.method} ${pathname} 404 ${elapsed}ms`)
      res.writeHead(404, {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'text/plain; charset=utf-8'
      })
      res.end('404 Not Found')
      return
    }

    const contentType = getMimeType(filePath)
    console.log(`${req.method} ${pathname} 200 ${elapsed}ms`)
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    })
    res.end(data)
  })
})

server.listen(port, () => {
  const localIP = getLocalIPv4()
  console.log(`listening on http://localhost:${port}`)
  console.log(`LAN IP: http://${localIP}:${port}`)
})
