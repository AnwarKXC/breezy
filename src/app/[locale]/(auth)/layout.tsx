import { getCurrentServerSession } from '@/services/auth/serverSession'
import { redirect } from 'next/navigation'

export default async function AuthLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params

  // redirect() signals by throwing, so it must stay outside the try block —
  // inside it the catch swallowed NEXT_REDIRECT and an already-signed-in user
  // was left sitting on the login page.
  const session = await getCurrentServerSession().catch(() => null)

  if (session) {
    redirect(`/${locale}/reservations`)
  }

  return <>{children}</>
}
