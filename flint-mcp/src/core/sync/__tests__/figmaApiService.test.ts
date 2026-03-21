import { describe, it, expect } from 'vitest'
import { FigmaApiService, FigmaApiError, RateLimitError } from '../figmaApiService.js'
import type { FigmaHttpClient } from '../types.js'

const noSleep = async () => {} // zero-delay for tests

function mockClient(responses: Array<{ status: number; body: unknown }>): FigmaHttpClient {
    let callIndex = 0
    const handler = async () => {
        const resp = responses[callIndex++] ?? responses[responses.length - 1]
        return { status: resp.status, json: async () => resp.body }
    }
    return { get: handler, post: handler }
}

describe('FigmaApiService', () => {
    describe('getFileVariables', () => {
        it('returns variables on success', async () => {
            const body = { status: 200, error: false, meta: { variables: {}, variableCollections: {} } }
            const svc = new FigmaApiService(mockClient([{ status: 200, body }]), noSleep)
            const result = await svc.getFileVariables('file-key', 'token')
            expect(result).toEqual(body)
        })

        it('throws FigmaApiError on 403', async () => {
            const svc = new FigmaApiService(mockClient([{ status: 403, body: { message: 'Forbidden' } }]), noSleep)
            await expect(svc.getFileVariables('fk', 'tok')).rejects.toThrow(FigmaApiError)
        })

        it('retries on 429 with backoff then succeeds', async () => {
            const successBody = { status: 200, error: false, meta: { variables: {}, variableCollections: {} } }
            const client = mockClient([
                { status: 429, body: {} },
                { status: 200, body: successBody },
            ])
            const svc = new FigmaApiService(client, noSleep)
            const result = await svc.getFileVariables('fk', 'tok')
            expect(result).toEqual(successBody)
        })

        it('retries on 500 server error then succeeds', async () => {
            const successBody = { status: 200, error: false, meta: { variables: {}, variableCollections: {} } }
            const client = mockClient([
                { status: 500, body: { message: 'Internal' } },
                { status: 200, body: successBody },
            ])
            const svc = new FigmaApiService(client, noSleep)
            const result = await svc.getFileVariables('fk', 'tok')
            expect(result).toEqual(successBody)
        })

        it('throws after max retries on persistent 429', async () => {
            let callCount = 0
            const client: FigmaHttpClient = {
                async get() {
                    callCount++
                    return { status: 429, json: async () => ({}) }
                },
                async post() {
                    return { status: 429, json: async () => ({}) }
                },
            }
            const svc = new FigmaApiService(client, noSleep)
            await expect(svc.getFileVariables('fk', 'tok')).rejects.toThrow(RateLimitError)
            expect(callCount).toBe(3)
        })

        it('does not retry on 403 client error', async () => {
            let callCount = 0
            const client: FigmaHttpClient = {
                async get() {
                    callCount++
                    return { status: 403, json: async () => ({ message: 'Forbidden' }) }
                },
                async post() {
                    return { status: 403, json: async () => ({ message: 'Forbidden' }) }
                },
            }
            const svc = new FigmaApiService(client, noSleep)
            await expect(svc.getFileVariables('fk', 'tok')).rejects.toThrow(FigmaApiError)
            expect(callCount).toBe(1) // no retries
        })
    })

    describe('updateFileVariables', () => {
        it('returns response on success', async () => {
            const body = { status: 200, error: false, meta: { variables: {} } }
            const svc = new FigmaApiService(mockClient([{ status: 200, body }]), noSleep)
            const result = await svc.updateFileVariables('fk', 'tok', { variables: [] })
            expect(result).toEqual(body)
        })

        it('throws on 400 without retrying', async () => {
            const client = mockClient([{ status: 400, body: { message: 'Bad request' } }])
            const svc = new FigmaApiService(client, noSleep)
            await expect(svc.updateFileVariables('fk', 'tok', { variables: [] })).rejects.toThrow(FigmaApiError)
        })

        it('retries on 429 for POST requests', async () => {
            const successBody = { status: 200, error: false, meta: { variables: {} } }
            const client = mockClient([
                { status: 429, body: {} },
                { status: 200, body: successBody },
            ])
            const svc = new FigmaApiService(client, noSleep)
            const result = await svc.updateFileVariables('fk', 'tok', { variables: [] })
            expect(result).toEqual(successBody)
        })
    })
})
