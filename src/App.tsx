import { Component, Suspense, lazy, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Skeleton } from '@/components/ui'
import Landing from '@/pages/Landing'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Explore = lazy(() => import('@/pages/Explore'))
const ChallengeArena = lazy(() => import('@/pages/ChallengeArena'))
const ChallengeDetail = lazy(() => import('@/pages/ChallengeDetail'))
const CreateChallenge = lazy(() => import('@/pages/CreateChallenge'))
const Launchpad = lazy(() => import('@/pages/Launchpad'))
const ProposeProject = lazy(() => import('@/pages/ProposeProject'))
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'))
const InnovationBoard = lazy(() => import('@/pages/InnovationBoard'))
const Proof = lazy(() => import('@/pages/Proof'))
const Profile = lazy(() => import('@/pages/Profile'))
const Leaderboard = lazy(() => import('@/pages/Leaderboard'))
const Activity = lazy(() => import('@/pages/Activity'))
const Settings = lazy(() => import('@/pages/Settings'))
const NotFound = lazy(() => import('@/pages/NotFound'))

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ORVEX UI error', error, info.componentStack)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-2xl font-bold text-mist-100">Something went wrong</h1>
        <p className="max-w-sm text-sm text-mist-400">The page hit an unexpected error. Your funds and onchain data are not affected.</p>
        <button type="button" className="btn-primary" onClick={() => window.location.assign('/app')}>
          Reload ORVEX
        </button>
      </div>
    )
  }
}

/** All routes. Exported so the integration tests can mount it inside a memory router. */
export function AppRoutes() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-64" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="explore" element={<Explore />} />
              <Route path="arena" element={<ChallengeArena />} />
              <Route path="arena/new" element={<CreateChallenge />} />
              <Route path="arena/:id" element={<ChallengeDetail />} />
              <Route path="launchpad" element={<Launchpad />} />
              <Route path="launchpad/new" element={<ProposeProject />} />
              <Route path="launchpad/:id" element={<ProjectDetail />} />
              <Route path="board" element={<InnovationBoard />} />
              <Route path="proof" element={<Proof />} />
              <Route path="profile" element={<Profile />} />
              <Route path="profile/:address" element={<Profile />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="activity" element={<Activity />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
