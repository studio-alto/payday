// Like NumberInput, but also accepts a decimal part — es-CO style, so "," is
// the decimal separator and "." is the thousands grouping shown live as the
// person types (e.g. typing "180000,5" displays as "180.000,5"). The value
// passed to onChange is a plain JS-parseable string ("180000.5"), so it works
// with Number(...) the same way every other amount field in the app does.
export default function MoneyInput({ value, onChange, placeholder, style, autoFocus }) {
  const raw = value === undefined || value === null ? '' : String(value);

  const formatDisplay = (r) => {
    if (r === '') return '';
    const [intPart, decPart] = r.split('.');
    const groupedInt = (intPart || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (decPart === undefined) return groupedInt;
    return `${groupedInt},${decPart}`;
  };

  const handleChange = (e) => {
    // Keep digits and commas only — the thousands dots are re-derived on every
    // render, so any dot in the typed value is just old display, not new input.
    let cleaned = e.target.value.replace(/[^\d,]/g, '');
    const firstComma = cleaned.indexOf(',');
    if (firstComma !== -1) {
      cleaned = cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, '');
    }
    const [intPart, decPart] = cleaned.split(',');
    const next = decPart === undefined ? intPart : `${intPart}.${decPart.slice(0, 2)}`;
    onChange({ target: { value: next } });
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      value={formatDisplay(raw)}
      onChange={handleChange}
      placeholder={placeholder}
      style={style}
    />
  );
}
