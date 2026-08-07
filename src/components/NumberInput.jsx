export default function NumberInput({ value, onChange, placeholder, style, autoFocus }) {
  const displayValue = value === '' || value === undefined || value === null ? '' : Number(value).toLocaleString('es-CO');

  const handleChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    onChange({ target: { value: digitsOnly } });
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoFocus={autoFocus}
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      style={style}
    />
  );
}
