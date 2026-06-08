import { describe, expect, it } from 'vitest'
import { classifyTaskIntent } from './task-intent.js'

describe('classifyTaskIntent', () => {
  it('detects git-only create and push', () => {
    const intent = classifyTaskIntent(
      'create a git project on this app and commit and push it',
      false,
      'itecify',
    )
    expect(intent.mode).toBe('git_only')
    expect(intent.gitAction).toBe('create_repo_push')
    expect(intent.repoName).toBe('itecify')
  })

  it('detects commit push for linked repo', () => {
    const intent = classifyTaskIntent('commit and push my changes', true)
    expect(intent.mode).toBe('git_only')
    expect(intent.gitAction).toBe('commit_push')
  })

  it('returns code for normal feature requests', () => {
    const intent = classifyTaskIntent('add a login page with email and password', false)
    expect(intent.mode).toBe('code')
  })
})
