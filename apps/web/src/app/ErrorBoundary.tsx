import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorState } from '../shared/ui/states'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last line of defence for render-time crashes. Data-fetching failures are
 * handled per screen; this only catches what would otherwise blank the page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="mx-auto max-w-2xl p-8">
        <ErrorState
          title="The application crashed"
          description={error.message}
          onRetry={() => {
            this.setState({ error: null })
          }}
        />
      </div>
    )
  }
}
