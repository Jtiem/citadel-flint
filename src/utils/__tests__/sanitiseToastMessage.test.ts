import { describe, it, expect } from 'vitest'
import { sanitiseToastMessage } from '../sanitiseToastMessage'

describe('sanitiseToastMessage', () => {
  it('strips Unix absolute paths, leaving only the basename', () => {
    expect(sanitiseToastMessage('Error in /Users/justin/project/src/Button.tsx')).toBe(
      'Error in Button.tsx'
    )
  })

  it('strips deeply nested Unix paths', () => {
    expect(sanitiseToastMessage('Failed to read /home/user/workspace/app/components/Header.tsx')).toBe(
      'Failed to read Header.tsx'
    )
  })

  it('strips Windows absolute paths, leaving only the basename', () => {
    expect(sanitiseToastMessage('Error in C:\\Users\\justin\\project\\src\\Button.tsx')).toBe(
      'Error in Button.tsx'
    )
  })

  it('strips Windows paths with mixed depth', () => {
    expect(sanitiseToastMessage('File not found: D:\\workspace\\app\\index.ts')).toBe(
      'File not found: index.ts'
    )
  })

  it('caps messages longer than 120 characters with an ellipsis', () => {
    const long = 'A'.repeat(130)
    const result = sanitiseToastMessage(long)
    expect(result.length).toBe(120)
    expect(result.endsWith('...')).toBe(true)
  })

  it('leaves messages at exactly 120 characters unchanged', () => {
    const exact = 'B'.repeat(120)
    const result = sanitiseToastMessage(exact)
    expect(result).toBe(exact)
  })

  it('leaves short clean messages unchanged', () => {
    const msg = 'Could not connect to server.'
    expect(sanitiseToastMessage(msg)).toBe(msg)
  })

  it('handles empty string without throwing', () => {
    expect(sanitiseToastMessage('')).toBe('')
  })

  it('does not strip relative paths', () => {
    const msg = 'Error in src/Button.tsx'
    expect(sanitiseToastMessage(msg)).toBe(msg)
  })

  it('strips multiple paths in one message', () => {
    const msg = 'Diff between /a/b/c/old.tsx and /x/y/z/new.tsx'
    expect(sanitiseToastMessage(msg)).toBe('Diff between old.tsx and new.tsx')
  })
})
