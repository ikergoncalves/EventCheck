import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router'
import { describeAuthError } from '../../../shared/auth/auth-errors'
import { useAuth } from '../../../shared/auth/useAuth'
import { describedBy } from '../../../shared/ui/field-a11y'
import { Button, Field, FormAlert, Input } from '../../../shared/ui/form'
import { readIntendedRoute } from '../../../app/intended-route'
import { AuthCard } from '../components/AuthCard'
import { type LoginValues, loginSchema } from '../schemas'

export function LoginPage() {
  const { signIn, configError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  /** Whatever the server refused. Field problems never land here. */
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    const outcome = await signIn(values)
    if (!outcome.ok) {
      setFormError(describeAuthError(outcome.code))
      return
    }

    // Finish the journey the guard interrupted, rather than always landing on
    // the events list.
    void navigate(readIntendedRoute(location.state), { replace: true })
  })

  return (
    <AuthCard
      title="Sign in"
      subtitle="Access the events you organize."
      footer={
        <>
          No account yet?{' '}
          <Link to="/signup" className="font-medium text-emerald-700 hover:underline">
            Create one
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

          <Field id="password" label="Password" error={errors.password?.message} required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password !== undefined}
              aria-describedby={describedBy('password', { error: errors.password?.message })}
              {...register('password')}
            />
          </Field>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
