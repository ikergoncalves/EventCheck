/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the EventCheck API, without a trailing slash. */
  readonly VITE_API_BASE_URL?: string
  /** `'true'` starts the MSW mock layer instead of hitting a real backend. */
  readonly VITE_USE_MOCKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
