import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Registrar from './Registrar';
import { makeData } from '../testUtils/fixtures';

function renderRegistrar(data, overrides = {}) {
  const setData = vi.fn();
  const onNavigate = vi.fn();
  const onDoneEditing = vi.fn();
  render(
    <Registrar
      data={data}
      setData={setData}
      onNavigate={onNavigate}
      editingIncome={null}
      onDoneEditing={onDoneEditing}
      {...overrides}
    />,
  );
  return { setData, onNavigate, onDoneEditing };
}

describe('Registrar', () => {
  it('walks through all 4 steps and saves a confirmed income split between ahorro (to a goal) and disponible', async () => {
    const user = userEvent.setup();
    const data = makeData({
      user: { incomeMode: 'variable' },
      goals: [{ id: 'g1', name: 'Fondo', target: 1000000, current: 0, history: [] }],
    });
    const { setData, onNavigate } = renderRegistrar(data);

    // Step 1: monto
    await user.type(screen.getByPlaceholderText('¿Cuánto ganaste?'), '100000');
    await user.click(screen.getByText('Continuar'));

    // Step 2: ahorro -> 20%, assigned to the one goal
    await user.click(screen.getByText('20%'));
    await user.click(screen.getByText('Fondo'));
    await user.click(screen.getByText('Continuar'));

    // Step 3: deudas -> leave at 0%
    await user.click(screen.getByText('Continuar'));

    // Step 4: resumen -> guardar
    await user.click(screen.getByText('Guardar'));

    expect(setData).toHaveBeenCalledTimes(1);
    // setData is called with a functional updater — apply it to the fixture state
    // the same way React would, to get the actual resulting state.
    const result = setData.mock.calls[0][0](data);

    expect(result.incomes).toHaveLength(1);
    const income = result.incomes[0];
    expect(income.amount).toBe(100000);
    expect(income.estado).toBe('confirmado');
    expect(income.distribution.ahorro).toBe(20000);
    expect(income.distribution.goalId).toBe('g1');

    // applyIncomeEffects should have actually moved the ahorro onto the goal.
    expect(result.goals[0].current).toBe(20000);
    expect(result.goals[0].history).toHaveLength(1);

    expect(onNavigate).toHaveBeenCalledWith('dashboard');
  });

  it('routes a portion of the income into debt via the snowball method', async () => {
    const user = userEvent.setup();
    const data = makeData({
      user: { incomeMode: 'variable', debtMethod: 'bola_nieve' },
      cards: [{ id: 'c1', name: 'Visa', balance: 50000, minPayment: 0, nextPayment: '2026-10-01', history: [] }],
    });
    const { setData } = renderRegistrar(data);

    await user.type(screen.getByPlaceholderText('¿Cuánto ganaste?'), '100000');
    await user.click(screen.getByText('Continuar'));
    await user.click(screen.getByText('Continuar')); // skip ahorro (0%)
    await user.click(screen.getByText('30%')); // 30% a deudas = 30.000
    await user.click(screen.getByText('Continuar'));
    await user.click(screen.getByText('Guardar'));

    const result = setData.mock.calls[0][0](data);
    const income = result.incomes[0];
    // The card only owed 50.000, but the waterfall never overshoots a card's
    // balance — all 30.000 fit, so it's fully applied here.
    expect(income.distribution.tarjeta).toBe(30000);
    expect(result.cards[0].balance).toBe(20000);
    expect(result.cards[0].history).toHaveLength(1);
  });

  it('does not apply ahorro/deudas yet for an income marked as futuro (not yet received)', async () => {
    const user = userEvent.setup();
    const data = makeData({
      user: { incomeMode: 'variable' },
      cards: [{ id: 'c1', name: 'Visa', balance: 50000, minPayment: 0, nextPayment: '2026-10-01', history: [] }],
    });
    const { setData } = renderRegistrar(data);

    await user.type(screen.getByPlaceholderText('¿Cuánto ganaste?'), '100000');
    await user.click(screen.getByText('Es un ingreso futuro'));
    await user.click(screen.getByText('Continuar'));
    await user.click(screen.getByText('Continuar'));
    await user.click(screen.getByText('30%'));
    await user.click(screen.getByText('Continuar'));
    await user.click(screen.getByText('Guardar'));

    const result = setData.mock.calls[0][0](data);
    const income = result.incomes[0];
    expect(income.estado).toBe('proyectado');
    // Planned, but not yet moved onto the card — that only happens on confirm.
    expect(result.cards[0].balance).toBe(50000);
    expect(result.cards[0].history).toHaveLength(0);
  });
});
