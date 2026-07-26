import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetDb } from '../mocks/db'
import { server } from '../mocks/server'

// An unhandled request means a test is hitting a route the contract mocks do
// not cover — fail loudly instead of silently reaching the network.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  // Mutations from one test must not leak into the next.
  resetDb()
})

afterAll(() => {
  server.close()
})
