import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconWarning } from './territory/icons';

function Fallback({ onReset }) {
  const { t } = useTranslation();
  return (
    <div className="territory-page error-boundary" role="alert">
      <div className="surface-card empty-state">
        <span className="empty-state-icon is-warn"><IconWarning size={28} /></span>
        <h2>{t('errorBoundary.title')}</h2>
        <p className="territory-muted">{t('errorBoundary.body')}</p>
        <div className="territory-actions">
          <button type="button" className="territory-btn btn-primary" onClick={() => { onReset(); window.history.back(); }}>
            {t('errorBoundary.back')}
          </button>
          <button type="button" className="territory-btn" onClick={() => window.location.reload()}>
            {t('errorBoundary.reload')}
          </button>
        </div>
      </div>
    </div>
  );
}

// Catches a render crash in one page so the rest of the app (header, navigation) stays usable.
// Pass `resetKey` (e.g. pathname + search): when it changes after a crash, the page is tried again.
// A healthy page is never remounted by it, so typing into a URL-backed filter keeps focus.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = () => this.setState({ error: null });
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.reset();
  }

  render() {
    if (this.state.error) return <Fallback onReset={this.reset} />;
    return this.props.children;
  }
}
