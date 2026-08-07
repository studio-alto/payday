export default function PencilIcon({ color = 'var(--text-secondary)', accent = 'var(--accent)' }) {
  return (
    <div style={{ width: 14, height: 14, position: 'relative', transform: 'rotate(45deg)' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 5,
          height: 3,
          background: accent,
          borderRadius: '1px 1px 0 0',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 2.5,
          height: 6,
          background: color,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 9,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '2.5px solid transparent',
          borderRight: '2.5px solid transparent',
          borderTop: `3px solid ${color}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '1px solid transparent',
          borderRight: '1px solid transparent',
          borderTop: '2px solid var(--text)',
        }}
      />
    </div>
  );
}
