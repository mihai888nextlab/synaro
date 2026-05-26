import { describe, expect, it } from 'vitest'
import {
  formatConventionalCommit,
  parseConventionalCommitResponse,
} from './generate-commit-message.js'

describe('formatConventionalCommit', () => {
  it('formats header with scope and body', () => {
    const msg = formatConventionalCommit({
      type: 'feat',
      scope: 'auth',
      breaking: false,
      description: 'add session refresh',
      body: 'Supports rotating tokens on each login.',
      footers: ['Refs: #12'],
    })
    expect(msg).toBe(
      'feat(auth): add session refresh\n\nSupports rotating tokens on each login.\n\nRefs: #12',
    )
  })

  it('marks breaking changes with !', () => {
    const msg = formatConventionalCommit({
      type: 'feat',
      scope: 'api',
      breaking: true,
      description: 'remove legacy export',
      body: '',
      footers: [],
    })
    expect(msg.startsWith('feat(api)!: remove legacy export')).toBe(true)
  })
})

describe('parseConventionalCommitResponse', () => {
  it('parses JSON from the model', () => {
    const parts = parseConventionalCommitResponse(
      JSON.stringify({
        type: 'fix',
        scope: null,
        breaking: false,
        description: 'correct navbar overlap',
        body: 'Fixes mobile layout regression.',
        footers: [],
      }),
    )
    expect(parts?.type).toBe('fix')
    expect(formatConventionalCommit(parts!)).toContain('fix: correct navbar overlap')
  })
})
