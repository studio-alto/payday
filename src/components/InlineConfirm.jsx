export default function InlineConfirm({ message, onConfirm, onCancel, confirmLabel = 'Sí', cancelLabel = 'No' }) {
  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 14,
        background: 'var(--input-bg)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text)' }}>{message}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onConfirm} style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer' }}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
