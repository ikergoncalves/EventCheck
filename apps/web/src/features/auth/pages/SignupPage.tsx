import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { describeAuthError } from '../../../shared/auth/auth-errors'
import { useAuth } from '../../../shared/auth/useAuth'
import { describedBy } from '../../../shared/ui/field-a11y'
import { Button, Field, FormAlert, Input } from '../../../shared/ui/form'
import { DEFAULT_AUTHENTICATED_ROUTE } from '../../../app/intended-route'
import { AuthCard } from '../components/AuthCard'
import { type SignupValues, signupSchema } from '../schemas'

export function SignupPage() {
  const { signUp, configError } = useAuth()
  const navigate = useNavigate()

  const [formError, setFormError] = useState<string | null>(null)
  /**
   * Set when the sign-up succeeded but returned no session.
   *
   * A Supabase project with e-mail confirmation enabled answers exactly that
   * way, and it is the one outcome that is neither a failure nor a way in.
   * Without a state of its own the organizer is left staring at a form that
   * just cleared itself, with no idea whether anything happened.
   */
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    const outcome = await signUp({ email: values.email, password: values.password })
    if (!outcome.ok) {
      setFormError(describeAuthError(outcome.code))
      return
    }

    if (outcome.session === null) {
      setAwaitingConfirmation(values.email)
      return
    }

    void navigate(DEFAULT_AUTHENTICATED_ROUTE, { replace: true })
  })

  if (awaitingConfirmation !== null) {
    return (
      <AuthCard
        title="Confirm your e-mail"
        footer={
          <Link to="/login" className="font-medium text-emerald-700 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div role="status" className="flex flex-col items-center gap-3 py-2 text-center">
          <MailCheck aria-hidden className="size-8 text-emerald-600" />
          <p className="text-sm text-slate-700">
            We sent a confirmation link to <strong>{awaitingConfirmation}</strong>. Open it to
            activate your account, then sign in.
          </p>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start organizing events with QR Code check-in."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-emerald-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {configError !== null ? (
        <FormAlert>{configError}</FormAlert>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
          {formError && <FormAlert>{formError}</FormAlert>}

          <Field id="email" label="E-mail" error={errors.email?.message} required>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={errors.email !== undefined}
              aria-describedby={describedBy('email', { error: errors.email?.message })}
              {...register('email')}
            />
          </Field>

          <Field
            id="password"
            label="Password"
            error={errors.password?.message}
            hint="At least 8 characters."
            required
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password !== undefined}
              aria-describedby={describedBy('password', {
                error: errors.password?.message,
                hint: 'At least 8 characters.',
              })}
              {...register('password')}
            />
          </Field>

          <Field
            id="confirmPassword"
            label="Repeat password"
            error={errors.confirmPassword?.message}
            required
          >
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword !== undefined}
              aria-describedby={describedBy('confirmPassword', {
                error: errors.confirmPassword?.message,
              })}
              {...register('confirmPassword')}
            />
          </Field>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
