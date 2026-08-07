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
        {children}
      </div>
    </>
  );
}
