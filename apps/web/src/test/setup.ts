import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetDb } from '../mocks/db'
import { server } from '../mocks/server'
import { resetTokenProvider } from '../shared/api/token-provider'
import { installForbiddenAuthClient } from './auth'

// An unhandled request means a test is hitting a route the contract mocks do
// not cover — fail loudly instead of silently reaching the network.
//
// MSW cannot police Supabase, which the SDK reaches on its own terms. That
// side is closed off differently: the real auth client is never installed
// during a test run at all. Anything that tries to use one without asking for
// a fake gets an error, not a socket.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  installForbiddenAuthClient()
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  // Mutations from one test must not leak into the next.
  resetDb()
  // A mounted AuthProvider installs a session-backed token provider, and a
  // fake auth client outlives the test that installed it. Both are global.
  resetTokenProvider()
  installForbiddenAuthClient()
})

afterAll(() => {
  server.close()
})
