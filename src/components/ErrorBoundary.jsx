import { Component } from 'react';
import { STORAGE_KEY } from '../lib/storage';

// Best-effort read of the saved theme, straight from localStorage — this renders
// instead of <App>, which is what normally sets `data-theme` on its own root div,
// so without this the fallback below would have no theme vars to draw from at all
// (they're scoped to `[data-theme='...']` in index.css, not :root) and show up
// unstyled regardless of which theme the person actually has picked.
function readTheme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const theme = raw && JSON.parse(raw)?.user?.theme;
    return theme === 'oscuro' ? 'oscuro' : 'light';
  } catch {
    return 'light';
  }
}

// Class component because React only exposes error boundaries via
// getDerivedStateFromError/componentDidCatch — there's no hook equivalent. Catches
// a render crash anywhere below it and shows a reassuring screen instead of a blank
// white one: everything already autosaves to localStorage on every change (see
// lib/storage.js), so a crash here doesn't lose anything already registered.
export default class ErrorBoundary extends Component {
  state = { error: null, showDetails: false, confirmWipe: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Payday crashed:', error, info?.componentStack);
  }

  reload = () => window.location.reload();
  toggleDetails = () => this.setState((s) => ({ showDetails: !s.showDetails }));
  askWipe = () => this.setState({ confirmWipe: true });
  cancelWipe = () => this.setState({ confirmWipe: false });
  // Last-resort escape hatch for the case reloading alone can't fix: the crash is
  // caused by something logically wrong in the saved data itself (not corrupted
  // JSON — loadInitial() already recovers from that — but a shape a screen can't
  // render), so reloading would hit the exact same crash forever without this.
  wipeAndReload = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // best-effort only
    }
    window.location.reload();
  };

  render() {
    const { error, showDetails, confirmWipe } = this.state;
    if (!error) return this.props.children;

    return (
      <div data-theme={readTheme()}>
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            background: 'var(--page-bg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, maxWidth: 340 }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text)', letterSpacing: '-0.02em' }}>Algo salió mal</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Payday tuvo un error inesperado. Tus datos están guardados en este dispositivo — no se perdió nada. Intenta
              recargar la app.
            </div>
          </div>

          <button
            type="button"
            onClick={this.reload}
            style={{
              width: '100%',
              maxWidth: 280,
              height: 48,
              borderRadius: 24,
              background: 'var(--text)',
              color: 'var(--page-bg)',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Recargar la app
          </button>

          <button
            type="button"
            onClick={this.toggleDetails}
            style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
          >
            {showDetails ? 'Ocultar detalles técnicos' : 'Ver detalles técnicos'}
          </button>
          {showDetails && (
            <div
              style={{
                background: 'var(--card-bg)',
                borderRadius: 12,
                padding: 12,
                maxWidth: 340,
                maxHeight: 160,
                overflow: 'auto',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                {error.message}
              </div>
            </div>
          )}

          {!confirmWipe ? (
            <button
              type="button"
              onClick={this.askWipe}
              style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
            >
              ¿Sigue sin funcionar después de recargar?
            </button>
          ) : (
            <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 16, maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>
                Puede que algo en tus datos guardados esté causando el error. Borrarlos lo soluciona, pero perderías todo
                lo registrado en este dispositivo — hazlo solo si ya tienes un respaldo, o como último recurso.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={this.wipeAndReload}
                  style={{ flex: 1, padding: 10, borderRadius: 12, background: 'var(--danger)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none' }}
                >
                  Borrar datos y reiniciar
                </button>
                <button
                  type="button"
                  onClick={this.cancelWipe}
                  style={{ flex: 1, padding: 10, borderRadius: 12, background: 'var(--input-bg)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}
