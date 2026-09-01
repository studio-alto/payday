import ExcelJS from 'exceljs';
import { dayTypeLabel, formatFullDate, isSameMonth, todayISO } from './dates';

// All stored amounts are plain COP numbers (screens convert to USD/EUR only for
// display via fmt()) — export them as-is with a peso-style thousands format so the
// numbers stay usable in formulas instead of being baked into a display string.
const MONEY_FMT = '"$"#,##0';
const ACCENT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF5A36' } };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true };

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = ACCENT_FILL;
    cell.alignment = { vertical: 'middle' };
  });
  row.height = 20;
}

function setColumnWidths(sheet, widths) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });
}

function addTable(sheet, headers, colWidths, rows, moneyCols = []) {
  const headerRow = sheet.addRow(headers);
  styleHeaderRow(headerRow);
  rows.forEach((values) => {
    const row = sheet.addRow(values);
    moneyCols.forEach((col) => {
      row.getCell(col).numFmt = MONEY_FMT;
    });
  });
  setColumnWidths(sheet, colWidths);
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function buildSummaryWorkbook({ incomes, goals, cards, expenses, gastosVariables = [] }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Payday';
  wb.created = new Date();

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
  const resumen = wb.addWorksheet('Resumen');
  resumen.mergeCells('A1:B1');
  resumen.getCell('A1').value = 'Resumen Payday';
  resumen.getCell('A1').font = { bold: true, size: 16 };
  resumen.getCell('A2').value = `Generado el ${formatFullDate(todayISO())}`;
  resumen.getCell('A2').font = { italic: true, color: { argb: 'FF888888' } };
  resumen.addRow([]);
  styleHeaderRow(resumen.addRow(['Concepto', 'Monto']));
  [
    ['Total ganado (histórico)', totalGanado],
    ['Total ahorrado', totalAhorroMetas + totalAhorroLibre],
    ['Total en deudas pendientes', totalDeuda],
    ['Gastos fijos (mensual)', totalGastosFijos],
    ['Gastos variables (este mes)', totalVariablesMes],
  ].forEach(([label, value]) => {
    const row = resumen.addRow([label, value]);
    row.getCell(2).numFmt = MONEY_FMT;
  });
  setColumnWidths(resumen, [30, 18]);

  // --- Ingresos ---
  const ingresosSheet = wb.addWorksheet('Ingresos');
  addTable(
    ingresosSheet,
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
  );

  // --- Metas ---
  const metasSheet = wb.addWorksheet('Metas');
  addTable(
    metasSheet,
    ['Nombre', 'Ahorrado', 'Objetivo', 'Progreso %'],
    [24, 16, 16, 14],
    goals.map((g) => [g.name, g.current, g.target, g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0]),
    [2, 3],
  );

  // --- Deudas ---
  const deudasSheet = wb.addWorksheet('Deudas');
  addTable(
    deudasSheet,
    ['Nombre', 'Tipo', 'Saldo', 'Tasa de interés % E.A.', 'Pago mínimo', 'Próximo pago'],
    [22, 18, 16, 18, 16, 16],
    cards.map((c) => [c.name, c.tipo || '', c.balance, c.interestRate || 0, c.minPayment || 0, formatFullDate(c.nextPayment)]),
    [3, 5],
  );

  // --- Gastos fijos ---
  const gastosSheet = wb.addWorksheet('Gastos fijos');
  addTable(
    gastosSheet,
    ['Nombre', 'Categoría', 'Monto', 'Día de vencimiento'],
    [22, 18, 16, 18],
    expenses.map((e) => [e.name, e.categoria, e.amount, e.dueDay]),
    [3],
  );

  // --- Gastos variables ---
  if (gastosVariables.length > 0) {
    const variablesSheet = wb.addWorksheet('Gastos variables');
    addTable(
      variablesSheet,
      ['Nombre', 'Categoría', 'Fecha', 'Monto'],
      [22, 18, 14, 16],
      gastosVariables.map((g) => [g.name || g.categoria, g.categoria, formatFullDate(g.date), g.amount]),
      [4],
    );
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
