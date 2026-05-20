const ENV_SERVICE_URL = process.env.ENVIRONMENT_SERVICE_URL ?? 'http://localhost:3004'

export type EnvRow = { id: string; status: string; projectId: string }

/** Returns the RUNNING environment for a project, or null if none is active. */
export async function getActiveEnvironment(projectId: string): Promise<EnvRow | null> {
  const res = await fetch(
    `${ENV_SERVICE_URL}/api/environments?projectId=${encodeURIComponent(projectId)}`,
    { signal: AbortSignal.timeout(10_000) },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as EnvRow[]
  return rows.find((r) => r.status === 'RUNNING') ?? null
}

/** Lists all file paths in the container workspace (relative to workspace root). */
export async function listContainerFiles(envId: string): Promise<string[]> {
  const res = await fetch(
    `${ENV_SERVICE_URL}/api/environments/${encodeURIComponent(envId)}/workspace-files`,
    { signal: AbortSignal.timeout(30_000) },
  )
  if (!res.ok) return []
  const data = (await res.json()) as { paths?: string[] }
  return data.paths ?? []
}

/** Reads a single file from the container workspace. Returns null if unreadable. */
export async function readContainerFile(envId: string, filePath: string): Promise<string | null> {
  const res = await fetch(
    `${ENV_SERVICE_URL}/api/environments/${encodeURIComponent(envId)}/workspace-selection?path=${encodeURIComponent(filePath)}`,
    { signal: AbortSignal.timeout(30_000) },
  )
  if (!res.ok) return null
  const data = (await res.json()) as { content?: string | null; kind?: string }
  if (data.kind !== 'file') return null
  return data.content ?? null
}

/**
 * Writes a set of files into the container workspace via tar upload.
 * Paths in `changes` are relative to the workspace root.
 */
export async function writeContainerFiles(
  envId: string,
  changes: { path: string; content: string }[],
): Promise<void> {
  if (changes.length === 0) return
  const tar = buildTar(changes)
  const res = await fetch(
    `${ENV_SERVICE_URL}/api/environments/${encodeURIComponent(envId)}/workspace-upload`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(tar),
      signal: AbortSignal.timeout(120_000),
    },
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`File upload to container failed: ${text || res.status}`)
  }
}

// ---------------------------------------------------------------------------
// Minimal POSIX tar builder — no external dependencies needed.
// Each entry: 512-byte ustar header + data padded to 512-byte blocks.
// End-of-archive: two 512-byte zero blocks.
// ---------------------------------------------------------------------------

function buildTar(files: { path: string; content: string }[]): Buffer {
  const parts: Buffer[] = []

  for (const { path: filePath, content } of files) {
    const data = Buffer.from(content, 'utf-8')
    const header = Buffer.alloc(512, 0)

    // Truncate path to 99 chars (POSIX limit for the name field)
    const name = filePath.slice(0, 99)
    header.write(name, 0, 'ascii')
    header.write('0000644\0', 100, 'ascii')   // mode
    header.write('0000000\0', 108, 'ascii')   // uid
    header.write('0000000\0', 116, 'ascii')   // gid
    // size: 11 octal digits + null
    header.write(data.length.toString(8).padStart(11, '0') + '\0', 124, 'ascii')
    // mtime: 11 octal digits + null
    const mtime = Math.floor(Date.now() / 1000)
    header.write(mtime.toString(8).padStart(11, '0') + '\0', 136, 'ascii')
    // checksum placeholder — spaces so they contribute 8×0x20 to the sum
    header.fill(0x20, 148, 156)
    header[156] = 0x30  // typeflag '0' = regular file
    header.write('ustar\0', 257, 'ascii')     // magic
    header.write('00', 263, 'ascii')          // version

    // Checksum: unsigned sum of all 512 header bytes
    let sum = 0
    for (let i = 0; i < 512; i++) sum += header[i]
    // Write as 6 octal digits + null + space (standard format)
    header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii')

    parts.push(header)

    if (data.length > 0) {
      // Data padded to the next 512-byte boundary
      const padded = Buffer.alloc(Math.ceil(data.length / 512) * 512, 0)
      data.copy(padded)
      parts.push(padded)
    }
  }

  // End-of-archive: two zero blocks
  parts.push(Buffer.alloc(1024, 0))
  return Buffer.concat(parts)
}
