import { describe, expect, it } from 'vitest'
import { errorMessage, isNetworkError } from '../src/lib/utils'

describe('network errors', () => {
  it('recognizes browser and Supabase network failures', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('Load failed'))).toBe(true)
    expect(isNetworkError(new Error('NetworkError when attempting to fetch resource.'))).toBe(true)
    expect(isNetworkError(new Error('duplicate key value violates unique constraint'))).toBe(false)
  })

  it('shows an actionable message instead of the raw fetch error', () => {
    const message = errorMessage(new TypeError('Failed to fetch'))
    expect(message).toContain('No pudimos conectar')
    expect(message).not.toContain('Failed to fetch')
  })

  it('keeps meaningful server errors intact', () => {
    expect(errorMessage(new Error('La compra ya fue completada'))).toBe('La compra ya fue completada')
  })
})
