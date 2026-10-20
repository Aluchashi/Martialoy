import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const marsCache = resolve(import.meta.dirname, '../../cache/mars')

const MIME: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.pmtiles': 'application/octet-stream',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
}

/**
 * Serves cache/mars at /mars in dev and preview, with HTTP range support so the
 * PMTiles reader can seek. The same directory is mounted by FastAPI in
 * production (see docs/PLAN.md section 2).
 */
function marsCachePlugin(): Plugin {
  const handle = (
    req: { url?: string; headers: { range?: string } },
    res: import('node:http').ServerResponse,
    next: (err?: unknown) => void,
  ) => {
    if (!req.url) return next()
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')
    const file = normalize(join(marsCache, rel))
    if (!file.startsWith(marsCache) || !existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain')
      res.end('Not cached yet: ' + rel)
      return
    }

    const size = statSync(file).size
    res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'no-cache')

    const range = req.headers.range
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range)
      if (!match) {
        res.statusCode = 416
        res.end()
        return
      }
      const start = match[1] ? Number(match[1]) : 0
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
      if (start > end || start >= size) {
        res.statusCode = 416
        res.setHeader('Content-Range', `bytes */${size}`)
        res.end()
        return
      }
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
      res.setHeader('Content-Length', String(end - start + 1))
      createReadStream(file, { start, end }).pipe(res)
      return
    }

    res.setHeader('Content-Length', String(size))
    createReadStream(file).pipe(res)
  }

  return {
    name: 'mars-cache',
    configureServer(server) {
      server.middlewares.use('/mars', handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/mars', handle)
    },
  }
}

export default defineConfig({
  plugins: [react(), marsCachePlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.MARTIALOY_API ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
})
