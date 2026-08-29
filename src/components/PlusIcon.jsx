export default function PlusIcon({ color = 'white', size = 16 }) {
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: color, transform: 'translateY(-50%)', borderRadius: 1 }} />
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: color, transform: 'translateX(-50%)', borderRadius: 1 }} />
    </div>
  );
}
