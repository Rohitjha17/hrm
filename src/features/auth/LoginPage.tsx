import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { useAuth } from './auth-context'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FieldError } from '@/components/ui/FieldError'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { HealthBadge } from '@/features/health/HealthBadge'
import { useToast } from '@/components/ui/toast-context'

const LoginSchema = z.object({
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
})
type LoginValues = z.infer<typeof LoginSchema>

interface LocationState {
  from?: { pathname?: string }
}

export function LoginPage() {
  const { session, loading, signIn, sendPasswordReset } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (loading) return <FullPageSpinner />
  if (session) {
    const to = (location.state as LocationState | null)?.from?.pathname ?? '/'
    return <Navigate to={to} replace />
  }

  async function onSubmit(values: LoginValues) {
    setSubmitError(null)
    const { error } = await signIn(values.email, values.password)
    if (error) {
      setSubmitError('Invalid email or password.')
      return
    }
    const to = (location.state as LocationState | null)?.from?.pathname ?? '/'
    navigate(to, { replace: true })
  }

  async function onForgotPassword() {
    const email = getValues('email')
    if (!email) {
      setSubmitError('Enter your email above, then tap “Forgot password”.')
      return
    }
    const { error } = await sendPasswordReset(email)
    if (error) toast.error('Could not send reset email', error)
    else toast.success('Password reset email sent', 'Check your inbox for the link.')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Building2 className="size-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">HRMS</h1>
          <p className="mt-1 text-sm text-slate-600">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          noValidate
          data-testid="login-form"
        >
          {submitError && (
            <div
              role="alert"
              data-testid="login-error"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {submitError}
            </div>
          )}

          <div className="mb-4">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              data-testid="login-email"
              invalid={!!errors.email}
              {...register('email')}
            />
            <FieldError message={errors.email?.message} />
          </div>

          <div className="mb-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              data-testid="login-password"
              invalid={!!errors.password}
              {...register('password')}
            />
            <FieldError message={errors.password?.message} />
          </div>

          <div className="mb-4 text-right">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
              data-testid="forgot-password"
            >
              Forgot password?
            </button>
          </div>

          <Button
            type="submit"
            className="w-full"
            loading={isSubmitting}
            data-testid="login-submit"
          >
            Sign in
          </Button>
        </form>

        <div className="mt-6 flex justify-center">
          <HealthBadge />
        </div>
      </div>
    </div>
  )
}
