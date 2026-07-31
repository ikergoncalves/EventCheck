/**
 * Validation for the access screens.
 *
 * These rules are the app's own — the API contract says nothing about
 * credentials, because credentials never reach the API. Supabase is the only
 * thing that ever sees them.
 */
import { z } from 'zod'

/** Supabase's own default floor. Matching it keeps the error client-side. */
const MIN_PASSWORD_LENGTH = 8

export const loginSchema = z.object({
  email: z.email('Enter a valid e-mail address.'),
  // Deliberately not length-checked on sign-in: an existing account may predate
  // any rule we set here, and "too short" is not the answer to a wrong password.
  password: z.string().min(1, 'Enter your password.'),
})

export type LoginValues = z.infer<typeof loginSchema>

export const signupSchema = z
  .object({
    email: z.email('Enter a valid e-mail address.'),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`),
    confirmPassword: z.string().min(1, 'Repeat your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'The two passwords do not match.',
    path: ['confirmPassword'],
  })

export type SignupValues = z.infer<typeof signupSchema>
