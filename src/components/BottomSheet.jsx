export default function BottomSheet({ onClose, children }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.45)', zIndex: 40 }}
      />
      <div
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: 'min(100%, 480px)',
          background: 'var(--card-bg)',
          borderRadius: '24px 24px 0 0',
          padding: 22,
          zIndex: 41,
          animation: 'slideUp 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'var(--input-bg)',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ×
        </button>
        {children}
      </div>
    </>
  );
}
