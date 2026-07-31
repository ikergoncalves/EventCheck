/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the EventCheck API, without a trailing slash. */
  readonly VITE_API_BASE_URL?: string
  /** `'true'` starts the MSW mock layer instead of hitting a real backend. */
  readonly VITE_USE_MOCKS?: string
  /** Supabase project URL, e.g. `https://abcdefgh.supabase.co`. Public. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase publishable anon key. Public — bounded by row-level security. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
