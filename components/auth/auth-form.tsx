'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth/auth-client'
import { rememberOfflineUser } from '@/lib/offline/database'

type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password' | 'reset-password'

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const params = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(params.get('token') ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const titles = {
    'sign-in': 'Welcome back',
    'sign-up': 'Create your Platter account',
    'forgot-password': 'Recover access',
    'reset-password': 'Choose a new password',
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const returnTo =
        params.get('returnTo')?.startsWith('/') &&
        !params.get('returnTo')?.startsWith('//')
          ? params.get('returnTo')!
          : '/lists'
      if (mode === 'sign-in') {
        const result = await authClient.signIn.email({ email, password })
        if (result.error) throw new Error(result.error.message)
        if (result.data?.user.id) rememberOfflineUser(result.data.user.id)
        router.push(returnTo)
        router.refresh()
      } else if (mode === 'sign-up') {
        const result = await authClient.signUp.email({ name, email, password })
        if (result.error) throw new Error(result.error.message)
        if (result.data?.user.id) rememberOfflineUser(result.data.user.id)
        router.push(returnTo)
        router.refresh()
      } else if (mode === 'forgot-password') {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (result.error) throw new Error(result.error.message)
        setMessage('If an account uses that email, a reset link is on its way.')
      } else {
        const result = await authClient.resetPassword({
          newPassword: password,
          token,
        })
        if (result.error) throw new Error(result.error.message)
        setMessage('Your password was reset. Sign in with the new password.')
        router.push('/sign-in')
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t complete that request.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="font-display text-3xl">{titles[mode]}</CardTitle>
        <CardDescription>
          {mode === 'sign-up'
            ? 'Use your email and a password to keep your lists private.'
            : mode === 'forgot-password'
              ? 'We’ll send a link without revealing whether an account exists.'
              : 'Platter keeps your recipes and shared lists ready when you return.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          {mode === 'sign-up' && (
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          )}
          {mode !== 'reset-password' && (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          )}
          {mode === 'reset-password' && (
            <div className="space-y-2">
              <Label htmlFor="token">Reset token</Label>
              <Input
                id="token"
                required
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </div>
          )}
          {mode !== 'forgot-password' && (
            <div className="space-y-2">
              <Label htmlFor="password">
                {mode === 'reset-password' ? 'New password' : 'Password'}
              </Label>
              <Input
                id="password"
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="text-success text-sm">
              {message}
            </p>
          )}
          <Button className="w-full" disabled={busy}>
            {busy
              ? 'Working…'
              : mode === 'sign-in'
                ? 'Sign in'
                : mode === 'sign-up'
                  ? 'Create account'
                  : mode === 'forgot-password'
                    ? 'Send reset link'
                    : 'Reset password'}
          </Button>
        </form>
        <div className="text-muted-foreground mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {mode === 'sign-in' && (
            <>
              <Link
                className="text-primary hover:underline"
                href="/forgot-password"
              >
                Forgot password?
              </Link>
              <Link className="text-primary hover:underline" href="/sign-up">
                Create an account
              </Link>
            </>
          )}
          {mode === 'sign-up' && (
            <Link className="text-primary hover:underline" href="/sign-in">
              Already have an account?
            </Link>
          )}
          {mode === 'forgot-password' && (
            <Link className="text-primary hover:underline" href="/sign-in">
              Return to sign in
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
