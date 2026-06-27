import dns from 'dns'

const MAX_OUTPUT_BYTES = 50_000
const TIMEOUT_MS = 10_000

function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true

  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return true // non-IPv4 — block to be safe

  const [a, b] = parts
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  )
}

async function assertPublicUrl(rawUrl: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https protocols are allowed')
  }

  const hostname = parsed.hostname

  // Block bare private IPs provided directly
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Regex.test(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('SSRF: private IP address not allowed')
    return
  }

  // Resolve hostname and check the resolved IP
  const { address } = await dns.promises.lookup(hostname)
  if (isPrivateIp(address)) {
    throw new Error('SSRF: hostname resolves to a private IP address')
  }
}

async function readBodySafe(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return await res.text()

  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
    if (total > MAX_OUTPUT_BYTES) {
      reader.cancel()
      const partial = Buffer.concat(chunks).toString('utf8', 0, MAX_OUTPUT_BYTES)
      return partial + '\n[truncated: response exceeded 50KB]'
    }
  }

  return Buffer.concat(chunks).toString('utf8')
}

export async function httpGet(url: string): Promise<string> {
  try {
    await assertPublicUrl(url)
  } catch (err) {
    return `Error: ${String(err)}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Synaro-AgentRunner/1.0' },
      signal: controller.signal,
      redirect: 'follow',
    })

    const body = await readBodySafe(res)
    return `HTTP ${res.status} ${res.statusText}\n\n${body}`
  } catch (err) {
    if ((err as Error).name === 'AbortError') return 'Error: HTTP GET timed out'
    return `Error: ${String(err)}`
  } finally {
    clearTimeout(timer)
  }
}

export async function httpPost(
  url: string,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<string> {
  try {
    await assertPublicUrl(url)
  } catch (err) {
    return `Error: ${String(err)}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Synaro-AgentRunner/1.0',
        ...Object.fromEntries(
          Object.entries(headers ?? {}).filter(
            ([k]) => !['cookie', 'authorization', 'set-cookie'].includes(k.toLowerCase()),
          ),
        ),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      redirect: 'follow',
    })

    const responseBody = await readBodySafe(res)
    return `HTTP ${res.status} ${res.statusText}\n\n${responseBody}`
  } catch (err) {
    if ((err as Error).name === 'AbortError') return 'Error: HTTP POST timed out'
    return `Error: ${String(err)}`
  } finally {
    clearTimeout(timer)
  }
}
