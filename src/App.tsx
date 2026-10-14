import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { DocumentProvider, useDocument } from './state/DocumentContext'
import { AnnotationProvider } from './state/AnnotationContext'
import { FilePickerProvider, useFilePicker } from './components/FilePicker'
import { LoadStatus } from './components/LoadStatus'
import { EmptyState } from './components/EmptyState'
import { Button } from './components/ui/Button'
import { DashboardPage } from './pages/DashboardPage'
import { ViewerPage } from './pages/ViewerPage'
import { PresentPage } from './pages/PresentPage'
import { checkBrowserSupport } from './lib/features'

export default function App() {
  const support = checkBrowserSupport()
  if (!support.supported) return <UnsupportedBrowser missing={support.missing} />

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ErrorBoundary>
        <DocumentProvider>
          <AnnotationProvider>
          <FilePickerProvider>
            <OpenNavigator />
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/viewer" element={<ViewerPage />} />
              <Route path="/present" element={<PresentPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <GlobalLoadStatus />
          </FilePickerProvider>
          </AnnotationProvider>
        </DocumentProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

/** When a new document finishes opening, show it in the viewer. */
function OpenNavigator() {
  const { doc } = useDocument()
  const navigate = useNavigate()
  const location = useLocation()
  const lastId = useRef<string | null>(null)
  useEffect(() => {
    if (!doc || doc.id === lastId.current) return
    lastId.current = doc.id
    if (location.pathname !== '/viewer') navigate('/viewer')
  }, [doc, location.pathname, navigate])
  return null
}

function GlobalLoadStatus() {
  const openPicker = useFilePicker()
  return <LoadStatus onChooseAnother={openPicker} />
}

function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      body="That address doesn’t exist in FolioView."
      actions={<Link to="/" className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-canvas">Go to dashboard</Link>}
    />
  )
}

function UnsupportedBrowser({ missing }: { missing: string[] }) {
  return (
    <EmptyState
      icon="alert"
      tone="warning"
      title="This browser can’t run FolioView"
      body={
        <>
          <p>
            FolioView needs a recent version of Chrome, Edge, Firefox or Safari (Safari 17.4 or newer). Please update your
            browser or open this page in another one.
          </p>
          <p className="mt-3 text-xs text-ink/50" data-testid="unsupported-missing">Missing: {missing.join(', ')}</p>
        </>
      }
    />
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FolioView crashed', error, info.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <EmptyState
        icon="alert"
        tone="warning"
        title="Something went wrong"
        body="The viewer hit an unexpected error. Reloading the page usually fixes it — you’ll need to open your PDF again."
        actions={<Button variant="primary" onClick={() => window.location.assign(import.meta.env.BASE_URL)}>Reload FolioView</Button>}
      />
    )
  }
}
