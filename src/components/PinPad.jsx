import { useEffect, useState } from 'react';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

// Controlled by `resetSignal`: bump it (e.g. a counter) whenever the parent wants
// this pad's buffer cleared — after a successful entry, a mismatch, moving to the
// next phase of a setup flow, etc. Calls onComplete once with the 4 digits typed.
export default function PinPad({ onComplete, resetSignal, dotSize = 16, buttonSize = 60 }) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    setPin('');
  }, [resetSignal]);

  const press = (d) => {
    if (d === '') return;
    if (d === '⌫') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) onComplete(next);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              background: i < pin.length ? 'var(--accent)' : 'var(--input-bg)',
              transition: 'background 0.15s ease',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, width: '100%', maxWidth: 280, margin: '0 auto' }}>
        {DIGITS.map((d, i) => (
          <button
            key={i}
            type="button"
            disabled={d === ''}
            onClick={() => press(d)}
            style={{
              height: buttonSize,
              borderRadius: '50%',
              border: 'none',
              background: d === '' ? 'transparent' : 'var(--input-bg)',
              color: 'var(--text)',
              fontSize: 20,
              fontWeight: 700,
              cursor: d === '' ? 'default' : 'pointer',
            }}
          >
            {d}
          </button>
        ))}
      </div>
    </>
  );
}
