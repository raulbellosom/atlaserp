import { Component } from "react";
import { ApiErrorScreen } from "./ApiErrorScreen";

/**
 * ErrorBoundary
 *
 * Catches uncaught React render-time errors and displays the ApiErrorScreen.
 * Wraps the whole app (or a section) to prevent blank screens on runtime crashes.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info?.componentStack);
    // Stale-client recovery: a lazy chunk URL died because the server restarted
    // or a new deploy replaced hashed assets. Reload once to fetch fresh modules.
    const message = String(error?.message ?? error ?? "");
    const isChunkLoadError =
      /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
        message,
      );
    if (isChunkLoadError) {
      const lastReload = Number(sessionStorage.getItem("atlas-chunk-reload") ?? 0);
      if (Date.now() - lastReload > 10000) {
        sessionStorage.setItem("atlas-chunk-reload", String(Date.now()));
        window.location.reload();
      }
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <ApiErrorScreen
          error={this.state.error}
          onRetry={this.handleRetry}
          fullScreen={this.props.fullScreen ?? true}
          context={this.props.context}
        />
      );
    }
    return this.props.children;
  }
}
