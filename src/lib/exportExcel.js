import writeXlsxFile from 'write-excel-file/browser';
import { dayTypeLabel, formatFullDate, isSameMonth, todayISO } from './dates';

// write-excel-file instead of exceljs: same real .xlsx output (styled header row,
// column widths, frozen header, money format), but its only dependency is fflate
// (a small zip library) instead of exceljs's much heavier tree — cuts this lazy
// chunk from ~930KB to a fraction of that, and drops exceljs's vulnerable
// transitive uuid/fast-uri versions along with it. The one feature lost is
// autoFilter (the dropdown arrows on the header row) — not available in this
// library; everything else (sorting, filtering by hand) still works in Excel.
const MONEY_FMT = '"$"#,##0';
const HEADER_STYLE = { backgroundColor: '#FF5A36', fontWeight: 'bold', textColor: '#FFFFFF' };

function headerCell(value) {
  return { type: String, value, ...HEADER_STYLE };
}
function textCell(value) {
  return { type: String, value: value || '' };
}
function moneyCell(value) {
  return { type: Number, value: value || 0, format: MONEY_FMT };
}
function numberCell(value) {
  return { type: Number, value: value || 0 };
}

// `moneyCols` is 1-based column numbers, same convention the old exceljs helper used.
function table(headers, colWidths, rows, moneyCols = []) {
  return {
    data: [
      headers.map(headerCell),
      ...rows.map((values) => values.map((v, i) => (moneyCols.includes(i + 1) ? moneyCell(v) : typeof v === 'number' ? numberCell(v) : textCell(v)))),
    ],
    columns: colWidths.map((width) => ({ width })),
    stickyRowsCount: 1,
  };
}

export async function buildSummaryWorkbook({ incomes, goals, cards, expenses, gastosVariables = [] }) {
  const confirmedIncomes = incomes.filter((i) => i.estado !== 'proyectado');
  const totalGanado = confirmedIncomes.reduce((a, i) => a + i.amount, 0);
  const totalAhorroMetas = goals.reduce((a, g) => a + g.current, 0);
  const totalAhorroLibre = confirmedIncomes.reduce(
    (a, i) => a + (!i.distribution.goalId ? i.distribution.ahorro || 0 : 0),
    0,
  );
  const totalDeuda = cards.reduce((a, c) => a + c.balance, 0);
  const totalGastosFijos = expenses.reduce((a, e) => a + e.amount, 0);
  const totalVariablesMes = gastosVariables.filter((g) => isSameMonth(g.date)).reduce((a, g) => a + g.amount, 0);

  // --- Resumen ---
  const resumenRows = [
    ['Total ganado (histórico)', totalGanado],
    ['Total ahorrado', totalAhorroMetas + totalAhorroLibre],
    ['Total en deudas pendientes', totalDeuda],
    ['Gastos fijos (mensual)', totalGastosFijos],
    ['Gastos variables (este mes)', totalVariablesMes],
  ];
  const resumenSheet = {
    sheet: 'Resumen',
    columns: [{ width: 30 }, { width: 18 }],
    data: [
      [{ type: String, value: 'Resumen Payday', fontWeight: 'bold', fontSize: 16, columnSpan: 2 }, null],
      [{ type: String, value: `Generado el ${formatFullDate(todayISO())}`, fontStyle: 'italic', textColor: '#888888' }, null],
      [],
      [headerCell('Concepto'), headerCell('Monto')],
      ...resumenRows.map(([label, value]) => [textCell(label), moneyCell(value)]),
    ],
  };

  // --- Ingresos ---
  const ingresosSheet = {
    sheet: 'Ingresos',
    ...table(
      ['Nombre', 'Fecha', 'Tipo de día', 'Monto', 'Ahorro', 'Deudas', 'Estado'],
      [24, 14, 14, 14, 12, 12, 14],
      incomes.map((i) => [
        i.name || dayTypeLabel(i.type),
        formatFullDate(i.date),
        dayTypeLabel(i.type),
        i.amount,
        i.distribution.ahorro || 0,
        i.distribution.tarjeta || 0,
        i.estado === 'proyectado' ? 'Proyectado' : 'Confirmado',
      ]),
      [4, 5, 6],
    ),
  };

  // --- Metas ---
  const metasSheet = {
    sheet: 'Metas',
    ...table(
      ['Nombre', 'Ahorrado', 'Objetivo', 'Progreso %'],
      [24, 16, 16, 14],
      goals.map((g) => [g.name, g.current, g.target, g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0]),
      [2, 3],
    ),
  };

  // --- Deudas ---
  const deudasSheet = {
    sheet: 'Deudas',
    ...table(
      ['Nombre', 'Tipo', 'Saldo', 'Tasa de interés % E.A.', 'Pago mínimo', 'Próximo pago'],
      [22, 18, 16, 18, 16, 16],
      cards.map((c) => [c.name, c.tipo || '', c.balance, c.interestRate || 0, c.minPayment || 0, formatFullDate(c.nextPayment)]),
      [3, 5],
    ),
  };

  // --- Gastos fijos ---
  const gastosSheet = {
    sheet: 'Gastos fijos',
    ...table(['Nombre', 'Categoría', 'Monto', 'Día de vencimiento'], [22, 18, 16, 18], expenses.map((e) => [e.name, e.categoria, e.amount, e.dueDay]), [3]),
  };

  const sheets = [resumenSheet, ingresosSheet, metasSheet, deudasSheet, gastosSheet];

  // --- Gastos variables ---
  if (gastosVariables.length > 0) {
    sheets.push({
      sheet: 'Gastos variables',
      ...table(
        ['Nombre', 'Categoría', 'Fecha', 'Monto'],
        [22, 18, 14, 16],
        gastosVariables.map((g) => [g.name || g.categoria, g.categoria, formatFullDate(g.date), g.amount]),
        [4],
      ),
    });
  }

  return writeXlsxFile(sheets).toBlob();
}
