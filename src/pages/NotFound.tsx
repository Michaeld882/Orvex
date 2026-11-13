import { Link } from 'react-router-dom'
import { LogoMark } from '@/components/Logo'

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <LogoMark size={72} className="opacity-70" />
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-mist-100">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-mist-400">That route does not exist. Head back to the dashboard.</p>
      <Link to="/app" className="btn-primary mt-6">
        Go to dashboard
      </Link>
    </div>
  )
}
