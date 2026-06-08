import type { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from 'ws'

import { attachContainerInteractiveTerminal } from '../managers/docker-terminal.js'
import { verifyTerminalWsToken } from '../lib/terminal-ws-token.js'

type ResizeMessage = { type: 'resize'; cols: number; rows: number }

function parseResizeMessage(raw: string): ResizeMessage | null {
  try {
    const msg = JSON.parse(raw) as ResizeMessage
    if (msg.type !== 'resize') return null
    if (typeof msg.cols !== 'number' || typeof msg.rows !== 'number') return null
    return msg
  } catch {
    return null
  }
}

export const terminalWsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:id/terminal/ws', { websocket: true }, (connection, req) => {
    const ws = connection as WebSocket
    const environmentId = (req.params as { id: string }).id
    const tokenRaw = (req.query as { token?: string }).token
    const token = typeof tokenRaw === 'string' ? tokenRaw : ''

    const payload = verifyTerminalWsToken(token)
    if (!payload || payload.environmentId !== environmentId) {
      ws.close(4401, 'Unauthorized')
      return
    }

    let session: Awaited<ReturnType<typeof attachContainerInteractiveTerminal>> | null = null
    let cleaned = false

    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      session?.close()
      session = null
    }

    ws.on('close', cleanup)
    ws.on('error', cleanup)

    void (async () => {
      try {
        session = await attachContainerInteractiveTerminal(
          environmentId,
          (chunk) => {
            if (ws.readyState === ws.OPEN) ws.send(chunk)
          },
          (code) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(`\r\n\x1b[33m[session ended${code != null ? ` — exit ${code}` : ''}]\x1b[0m\r\n`)
              ws.close(1000, 'session ended')
            }
            cleanup()
          },
        )

        ws.on('message', (message: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
          if (!session) return
          if (!isBinary) {
            let text = ''
            if (typeof message === 'string') {
              text = message
            } else if (Buffer.isBuffer(message)) {
              text = message.toString('utf8')
            } else if (message instanceof ArrayBuffer) {
              text = Buffer.from(new Uint8Array(message)).toString('utf8')
            } else if (Array.isArray(message)) {
              text = Buffer.concat(message).toString('utf8')
            }
            if (text.trimStart().startsWith('{')) {
              const resize = parseResizeMessage(text)
              if (resize) {
                void session.resize(resize.cols, resize.rows).catch(() => {})
              }
              return
            }
          }
          let buf: Buffer
          if (Buffer.isBuffer(message)) {
            buf = message
          } else if (message instanceof ArrayBuffer) {
            buf = Buffer.from(new Uint8Array(message))
          } else if (Array.isArray(message)) {
            buf = Buffer.concat(message)
          } else {
            buf = Buffer.from(String(message))
          }
          session.write(buf)
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (ws.readyState === ws.OPEN) {
          ws.send(`\r\n\x1b[31m${msg}\x1b[0m\r\n`)
          ws.close(1011, msg)
        }
        cleanup()
      }
    })()
  })
}
