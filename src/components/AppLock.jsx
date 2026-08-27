import { useState } from 'react';
import { hashPin } from '../lib/pin';
import { STORAGE_KEY } from '../lib/storage';
import PinPad from './PinPad';

export default function AppLock({ pinHash, onUnlock }) {
  const [error, setError] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const handleComplete = async (pin) => {
    const hash = await hashPin(pin);
    if (hash === pinHash) {
      onUnlock();
    } else {
      setError(true);
      setResetSignal((n) => n + 1);
    }
  };

  const wipeAndReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'var(--page-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: 24,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--text)', letterSpacing: '-0.02em' }}>Payday está bloqueada</div>
        <div style={{ fontSize: 13, color: error ? 'var(--accent-text)' : 'var(--text-secondary)' }}>
          {error ? 'PIN incorrecto, intenta de nuevo' : 'Ingresa tu PIN'}
        </div>
      </div>

      <PinPad onComplete={handleComplete} resetSignal={resetSignal} dotSize={16} buttonSize={68} />

      {!confirmWipe ? (
        <button type="button" onClick={() => setConfirmWipe(true)} style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          ¿Olvidaste tu PIN?
        </button>
      ) : (
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: 16, maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text)', textAlign: 'center' }}>
            No hay forma de recuperar el PIN. La única opción es borrar los datos de esta app en este dispositivo. ¿Continuar?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={wipeAndReset}
              style={{ flex: 1, padding: 10, borderRadius: 12, background: 'var(--accent)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none' }}
            >
              Sí, borrar datos
            </button>
            <button
              type="button"
              onClick={() => setConfirmWipe(false)}
              style={{ flex: 1, padding: 10, borderRadius: 12, background: 'var(--input-bg)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
