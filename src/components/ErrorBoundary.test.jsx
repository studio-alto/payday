import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Bomb() {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // React (and this component's own componentDidCatch) log the caught error to
    // the console by design — silence it here so the test output isn't noisy,
    // without hiding a *real* unexpected console.error from a different bug.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>Todo bien</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Todo bien')).toBeInTheDocument();
  });

  it('shows the fallback screen instead of crashing when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(screen.getByText(/tus datos están guardados en este dispositivo/i)).toBeInTheDocument();
  });

  it('reveals the technical error message on demand, not by default', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.queryByText('boom')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Ver detalles técnicos'));
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('reloads the page when "Recargar la app" is tapped', () => {
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } });

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByText('Recargar la app'));
    expect(reload).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('only offers to wipe data after confirming, and clears the storage key when confirmed', () => {
    localStorage.setItem('payday-pwa-data-v1', '{"fake":true}');
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } });

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.queryByText('Borrar datos y reiniciar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('¿Sigue sin funcionar después de recargar?'));
    fireEvent.click(screen.getByText('Borrar datos y reiniciar'));

    expect(localStorage.getItem('payday-pwa-data-v1')).toBeNull();
    expect(reload).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });
});
