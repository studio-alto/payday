import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';
import { makeData } from '../testUtils/fixtures';

const TODAY = new Date(2026, 8, 15); // Sep 15, 2026

function renderDashboard(data) {
  return render(<Dashboard data={data} setData={vi.fn()} onNavigate={vi.fn()} />);
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with no data at all, without crashing', () => {
    renderDashboard(makeData());
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.getByText('DISPONIBLE')).toBeInTheDocument();
  });

  // Regression test for a bug fixed earlier: both the DISPONIBLE tile and the
  // "Resumen general" Disponible row used to stay green even when the value was
  // negative, which read as "you're fine" when the opposite was true.
  it('shows DISPONIBLE in danger colors, in every place it appears, when it goes negative', () => {
    const data = makeData({
      incomes: [
        {
          id: 'i1',
          name: 'Turno',
          amount: 50000,
          date: '2026-09-10',
          type: 'normal',
          estado: 'confirmado',
          distribution: { ahorro: 0, tarjeta: 0, goalId: null },
        },
      ],
      expenses: [{ id: 'e1', name: 'Arriendo', amount: 100000, dueDay: 5, history: [] }],
    });
    renderDashboard(data);

    expect(screen.getByText('DISPONIBLE')).toHaveStyle({ color: 'var(--danger-text)' });
    const amounts = screen.getAllByText('$-50.000');
    expect(amounts.length).toBeGreaterThanOrEqual(2); // the tile, and the Resumen general row
    amounts.forEach((el) => expect(el).toHaveStyle({ color: 'var(--danger-text)' }));
  });

  it('shows DISPONIBLE in the normal (good) colors when it is positive', () => {
    const data = makeData({
      incomes: [
        {
          id: 'i1',
          name: 'Turno',
          amount: 200000,
          date: '2026-09-10',
          type: 'normal',
          estado: 'confirmado',
          distribution: { ahorro: 0, tarjeta: 0, goalId: null },
        },
      ],
      expenses: [{ id: 'e1', name: 'Arriendo', amount: 50000, dueDay: 5, history: [] }],
    });
    renderDashboard(data);

    // The tile and the Resumen general row each have their own "normal" (non-danger)
    // color by design (good-text vs accent-text) — what matters here is that
    // neither switches to danger-text the way both correctly do in the negative case.
    expect(screen.getByText('DISPONIBLE')).toHaveStyle({ color: 'var(--good-text)' });
    const amounts = screen.getAllByText('$150.000');
    expect(amounts.length).toBeGreaterThanOrEqual(2);
    amounts.forEach((el) => expect(el).not.toHaveStyle({ color: 'var(--danger-text)' }));
  });

  it('excludes archived cards and expenses from the current totals', () => {
    const data = makeData({
      cards: [
        { id: 'c1', name: 'Vieja', balance: 500000, nextPayment: '2026-10-01', minPayment: 0, history: [{ date: '2026-08-01', amount: 100 }], archived: true },
        { id: 'c2', name: 'Activa', balance: 200000, nextPayment: '2026-10-01', minPayment: 0, history: [] },
      ],
      expenses: [
        { id: 'e1', name: 'Cancelado', amount: 999999, dueDay: 5, history: [{ date: '2026-08-01', amount: 999999 }], archived: true },
        { id: 'e2', name: 'Activo', amount: 30000, dueDay: 5, history: [] },
      ],
    });
    renderDashboard(data);

    // Deudas total should be just the active card (200.000), not 700.000.
    expect(screen.getAllByText('$200.000').length).toBeGreaterThan(0);
    expect(screen.queryByText('$700.000')).not.toBeInTheDocument();
  });
});
