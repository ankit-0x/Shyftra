import { Component } from "react";
import { isChunkLoadError, reloadOnceForNewDeploy } from "../utils/reloadOnce";

// Plain <a>/<button> only: this can sit above the Router.
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) {
    console.error("UI error:", error, info?.componentStack);
    if (isChunkLoadError(error)) reloadOnceForNewDeploy();
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null }); // navigating away clears the error
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const stale = isChunkLoadError(this.state.error);
    return (
      <div role="alert" className="flex-1 flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-3">
        <h2 className="text-xl font-bold">{stale ? "A new version is available" : "Something went wrong"}</h2>
        <p className="text-base-content/60 text-sm max-w-sm">
          {stale ? "Please reload to get the latest version." : "This page hit an unexpected problem. Reloading usually fixes it."}
        </p>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>Reload</button>
          <a className="btn btn-ghost btn-sm" href="/">Go home</a>
        </div>
      </div>
    );
  }
}