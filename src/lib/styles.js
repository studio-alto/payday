export const cardStyle = {
  background: 'var(--card-bg)',
  borderRadius: 24,
  padding: 20,
};

export const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-secondary)',
  letterSpacing: '0.06em',
};

export const fieldLabelStyle = {
  fontSize: 11,
  color: 'var(--text-secondary)',
  marginBottom: 6,
  fontWeight: 700,
};

export function textInputStyle(big = false) {
  return {
    width: '100%',
    padding: big ? 16 : 13,
    borderRadius: big ? 16 : 14,
    border: 'none',
    fontSize: big ? 22 : 16,
    fontWeight: big ? 800 : 400,
    background: 'var(--input-bg)',
    color: 'var(--text)',
    boxSizing: 'border-box',
  };
}

export function primaryButtonStyle(disabled = false) {
  return {
    height: 52,
    borderRadius: 26,
    background: disabled ? '#CFCFCF' : 'var(--text)',
    color: 'var(--page-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 15,
    cursor: disabled ? 'default' : 'pointer',
    width: '100%',
    border: 'none',
  };
}

export const secondaryButtonStyle = {
  height: 52,
  borderRadius: 26,
  background: 'var(--input-bg)',
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
  width: '100%',
  border: 'none',
};
