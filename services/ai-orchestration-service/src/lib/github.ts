const GITHUB_UA = 'Synaro/1.0 (AI git integration)'

type GithubUser = { login?: string }

async function githubFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<{ res: Response; data: Record<string, unknown> & { message?: string } }> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': GITHUB_UA,
      ...(init?.headers ?? {}),
    },
  })
  const raw = await res.text()
  let data: Record<string, unknown> & { message?: string } = {}
  try {
    data = raw ? (JSON.parse(raw) as typeof data) : {}
  } catch {
    data = { message: raw || res.statusText }
  }
  return { res, data }
}

function githubErrorMessage(res: Response, data: { message?: string }, context: string): string {
  const base = typeof data.message === 'string' && data.message.length > 0 ? data.message : res.statusText
  if (res.status === 401 || res.status === 403) {
    return `${context}: GitHub rejected the token (${res.status}). Disconnect and reconnect GitHub under Settings → Profile, and ensure the app has the repo scope.`
  }
  if (res.status === 404) {
    return `${context}: GitHub returned Not Found (${res.status}). Your GitHub token may be invalid or missing permission to create repositories. Reconnect GitHub under Settings → Profile.`
  }
  if (res.status === 422) {
    return `${context}: ${base} (${res.status})`
  }
  return `${context}: ${base} (HTTP ${res.status})`
}

async function getGithubLogin(accessToken: string): Promise<string> {
  const { res, data } = await githubFetch(accessToken, '/user')
  if (!res.ok) {
    throw new Error(githubErrorMessage(res, data, 'Could not verify GitHub account'))
  }
  const login = typeof data.login === 'string' ? data.login.trim() : ''
  if (!login) throw new Error('GitHub did not return a username for this token.')
  return login
}

function parseGithubOwnerRepoFromRemote(gitRemoteUrl: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(gitRemoteUrl.trim())
    if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const owner = parts[0]!.trim()
    const repo = parts[1]!.replace(/\.git$/i, '').replace(/\/+$/, '').trim()
    return owner && repo ? { owner, repo } : null
  } catch {
    return null
  }
}

function oauthScopes(res: Response): string[] {
  return (res.headers.get('x-oauth-scopes') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Fail fast with an actionable message when the stored OAuth token cannot push to this remote.
 * Public repos still require a token with push permission — visibility is not the issue.
 */
export async function verifyGithubPushAccess(
  accessToken: string,
  gitRemoteUrl: string,
): Promise<void> {
  const ref = parseGithubOwnerRepoFromRemote(gitRemoteUrl)
  if (!ref) throw new Error('Invalid GitHub repository URL.')

  const { res: userRes, data: userData } = await githubFetch(accessToken, '/user')
  if (!userRes.ok) {
    throw new Error(githubErrorMessage(userRes, userData, 'GitHub token check failed'))
  }
  const login = typeof userData.login === 'string' ? userData.login.trim() : ''
  const scopes = oauthScopes(userRes)
  const hasRepo = scopes.includes('repo') || scopes.includes('public_repo')
  if (scopes.length > 0 && !hasRepo) {
    throw new Error(
      `GitHub is connected as @${login || 'unknown'}, but Synaro was not granted the "repo" scope (granted: ${scopes.join(', ') || 'none'}). ` +
        'Open Settings → Profile, disconnect GitHub, connect again, and approve repository access.',
    )
  }

  const { res: repoRes, data: repoData } = await githubFetch(
    accessToken,
    `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`,
  )
  if (repoRes.status === 404) {
    throw new Error(
      `The linked GitHub account (@${login || 'unknown'}) cannot access ${ref.owner}/${ref.repo}. ` +
        `Connect the GitHub user that owns this repo or has write access (owner: @${ref.owner}).`,
    )
  }
  if (!repoRes.ok) {
    throw new Error(githubErrorMessage(repoRes, repoData, `Cannot access ${ref.owner}/${ref.repo}`))
  }

  const perms = repoData.permissions as { push?: boolean } | undefined
  if (!perms?.push) {
    if (login && login.toLowerCase() !== ref.owner.toLowerCase()) {
      throw new Error(
        `Synaro is connected as @${login}, but the repository is under @${ref.owner}. ` +
          `Pushes to ${ref.owner}/${ref.repo} require that account (or a collaborator with write access). ` +
          'Connect the correct GitHub user under Settings → Profile.',
      )
    }
    throw new Error(
      `GitHub account @${login || ref.owner} cannot push to ${ref.owner}/${ref.repo}. ` +
        'Disconnect and reconnect GitHub under Settings → Profile (approve all permissions). ' +
        'If the repo is in an organization with SSO, authorize Synaro for that org at github.com → Settings → Applications.',
    )
  }
}

/** Create a repository for the token owner (used during AI git flows; token is ephemeral). */
export async function createGithubRepository(
  accessToken: string,
  opts: { name: string; private?: boolean; description?: string },
): Promise<{ htmlUrl: string; cloneRepositoryUrl: string }> {
  const name = opts.name.trim().replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 100)
  if (!name) throw new Error('Invalid repository name')

  const login = await getGithubLogin(accessToken)

  const { res, data } = await githubFetch(accessToken, '/user/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      private: opts.private ?? false,
      description: opts.description?.trim() || undefined,
      auto_init: false,
    }),
  })

  if (res.status === 422) {
    const msg = String(data.message ?? '')
    const alreadyExists =
      msg.toLowerCase().includes('already exists') ||
      JSON.stringify(data).toLowerCase().includes('already exists')
    if (alreadyExists) {
      const htmlUrl = `https://github.com/${login}/${name}`
      return { htmlUrl, cloneRepositoryUrl: `https://github.com/${login}/${name}` }
    }
  }

  if (!res.ok) {
    throw new Error(githubErrorMessage(res, data, `Could not create repository "${name}"`))
  }

  const htmlUrl =
    typeof data.html_url === 'string' && data.html_url.trim()
      ? data.html_url.trim()
      : `https://github.com/${login}/${name}`

  const cloneRepositoryUrl = `https://github.com/${login}/${name}`
  return { htmlUrl, cloneRepositoryUrl }
}
