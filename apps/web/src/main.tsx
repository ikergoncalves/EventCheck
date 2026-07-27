import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './index.css'

/**
 * Starts the MSW worker when mocks are enabled.
 *
 * The environment flag is compared inline rather than through a helper so Vite
 * can replace it at build time; the branch then folds away and the dynamic
 * import below is dropped, keeping MSW, the handlers and the fixtures out of a
 * production bundle entirely.
 */
async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return

  const { worker } = await import('./mocks/browser')
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: false,
  })
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root was not found in index.html')

void enableMocking().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
