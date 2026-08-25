import { dayTypeLabel, formatFullDate, todayISO } from './dates';

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function csvRow(values) {
  return values.map(csvEscape).join(',') + '\r\n';
}

// One CSV file with a section per data type (Excel/Numbers/Sheets read this natively;
// the leading BOM keeps accented characters from garbling when opened in Excel).
export function buildSummaryCsv({ incomes, goals, cards, expenses }) {
  let csv = '﻿';
  csv += csvRow([`Resumen Payday`, formatFullDate(todayISO())]);
  csv += '\r\n';

  csv += csvRow(['INGRESOS']);
  csv += csvRow(['Nombre', 'Fecha', 'Tipo de día', 'Monto', 'Ahorro', 'Deudas', 'Estado']);
  incomes.forEach((i) => {
    csv += csvRow([
      i.name || dayTypeLabel(i.type),
      formatFullDate(i.date),
      dayTypeLabel(i.type),
      i.amount,
      i.distribution.ahorro || 0,
      i.distribution.tarjeta || 0,
      i.estado === 'proyectado' ? 'Proyectado' : 'Confirmado',
    ]);
  });
  csv += '\r\n';

  csv += csvRow(['METAS']);
  csv += csvRow(['Nombre', 'Ahorrado', 'Objetivo', 'Progreso %']);
  goals.forEach((g) => {
    csv += csvRow([g.name, g.current, g.target, Math.min(100, Math.round((g.current / g.target) * 100))]);
  });
  csv += '\r\n';

  csv += csvRow(['DEUDAS']);
  csv += csvRow(['Nombre', 'Tipo', 'Saldo', 'Tasa de interés % E.A.', 'Pago mínimo', 'Próximo pago']);
  cards.forEach((c) => {
    csv += csvRow([c.name, c.tipo || '', c.balance, c.interestRate || 0, c.minPayment || 0, formatFullDate(c.nextPayment)]);
  });
  csv += '\r\n';

  csv += csvRow(['GASTOS FIJOS']);
  csv += csvRow(['Nombre', 'Categoría', 'Monto', 'Día de vencimiento']);
  expenses.forEach((e) => {
    csv += csvRow([e.name, e.categoria, e.amount, e.dueDay]);
  });

  return csv;
}
