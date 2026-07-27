/**
 * Apply one search/replace to a file's content. Tries an exact substring match first, then a
 * line-based match that tolerates the near-misses models actually make — CRLF vs LF and trailing
 * whitespace — as long as the match is UNIQUE. Anything looser (leading-indent changes, ambiguous
 * matches) returns null, so an edit is never silently applied to the wrong place.
 *
 * Shared by the one-shot edit pass and the agentic `edit_file` tool.
 */
export function applySearchReplace(content: string, search: string, replace: string): string | null {
  const idx = content.indexOf(search)
  if (idx !== -1) {
    return content.slice(0, idx) + replace + content.slice(idx + search.length)
  }

  const fileLines = content.replace(/\r\n/g, '\n').split('\n')
  let searchLines = search.replace(/\r\n/g, '\n').split('\n')
  // A snippet copied "up to and including a newline" ends in an empty element — drop it so the
  // remaining lines can match mid-file.
  if (searchLines.length > 1 && searchLines[searchLines.length - 1] === '') searchLines = searchLines.slice(0, -1)
  if (searchLines.length === 0) return null

  const norm = (l: string) => l.replace(/[ \t]+$/g, '')
  const target = searchLines.map(norm)
  const matches: number[] = []
  for (let i = 0; i + target.length <= fileLines.length; i++) {
    let ok = true
    for (let j = 0; j < target.length; j++) {
      if (norm(fileLines[i + j]!) !== target[j]) {
        ok = false
        break
      }
    }
    if (ok) {
      matches.push(i)
      if (matches.length > 1) break // ambiguous — stop, we won't apply
    }
  }
  if (matches.length !== 1) return null

  const start = matches[0]!
  const replaceLines = replace.replace(/\r\n/g, '\n').split('\n')
  const result = [...fileLines.slice(0, start), ...replaceLines, ...fileLines.slice(start + target.length)]
  return result.join('\n')
}
