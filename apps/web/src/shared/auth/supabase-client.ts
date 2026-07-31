/**
 * The single Supabase client.
 *
 * Authentication is the one thing that is never mocked: the organizer signs in
 * against the real Supabase project and gets back a real ES256 JWT, which is
 * exactly what the backend will validate against the project's public JWKS.
 * `VITE_USE_MOCKS` only governs the data layer.
 *
 * The client is created lazily rather than at module load. Importing this file
 * must stay free of side effects so the test suite — which substitutes the auth
 * client entirely — never constructs one, and so a missing configuration
 * surfaces as a handled error instead of a blank page during bootstrap.
 */
import { type SupabaseClient, createClient } from '@supabase/supabase-js'

/** Thrown when the environment does not describe a Supabase project. */
export class SupabaseConfigError extends Error {
  readonly name = 'SupabaseConfigError'
  /** Names of the variables that were missing or blank. */
  readonly missing: readonly string[]

  constructor(missing: readonly string[]) {
    super(
      `Supabase is not configured. Missing ${missing.join(' and ')} — copy ` +
        `apps/web/.env.example to apps/web/.env.local and fill in the project ` +
        `URL and anon key from Project Settings → API.`,
    )
    this.missing = missing
  }
}

let client: SupabaseClient | null = null

/** Reads a variable, treating a blank value the same as an absent one. */
function readEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined
}

/**
 * The process-wide client, built on first use and cached afterwards.
 *
 * @throws {SupabaseConfigError} when either variable is missing.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client !== null) return client

  const url = readEnv(import.meta.env.VITE_SUPABASE_URL)
  const anonKey = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY)

  const missing: string[] = []
  if (url === undefined) missing.push('VITE_SUPABASE_URL')
  if (anonKey === undefined) missing.push('VITE_SUPABASE_ANON_KEY')
  if (url === undefined || anonKey === undefined) throw new SupabaseConfigError(missing)

  client = createClient(url, anonKey, {
    auth: {
      // Survive a refresh, and keep the access token fresh on its own. Every
      // renewal reaches the app through `onAuthStateChange`, which is what
      // keeps the injected token provider current without any polling.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}
