import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/**
 * Browser mock layer.
 *
 * Only ever imported dynamically (see `src/main.tsx`), so MSW and the fixtures
 * stay out of the production bundle.
 */
export const worker = setupWorker(...handlers)
