import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** Node mock layer, started once for the whole test suite. */
export const server = setupServer(...handlers)
