import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BackupReminder from './BackupReminder';
import { makeData } from '../testUtils/fixtures';

describe('BackupReminder', () => {
  it('says "nunca" when there is no lastBackupAt yet', () => {
    render(<BackupReminder data={makeData()} setData={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByText('Nunca has respaldado tus datos')).toBeInTheDocument();
  });

  it('shows the number of days since the last backup otherwise', () => {
    const lastBackupAt = new Date(Date.now() - 20 * 86400000).toISOString();
    render(<BackupReminder data={makeData({ user: { lastBackupAt } })} setData={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByText('No has respaldado en 20 días')).toBeInTheDocument();
  });

  it('navigates to Ajustes → Datos when "Respaldar" is tapped', () => {
    const onNavigate = vi.fn();
    render(<BackupReminder data={makeData()} setData={vi.fn()} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Respaldar'));
    expect(sessionStorage.getItem('payday_return_section')).toBe('datos');
    expect(onNavigate).toHaveBeenCalledWith('config');
  });

  it('stamps backupReminderDismissedAt when closed, to snooze it', () => {
    const setData = vi.fn();
    render(<BackupReminder data={makeData()} setData={setData} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Cerrar recordatorio'));

    expect(setData).toHaveBeenCalledTimes(1);
    const result = setData.mock.calls[0][0](makeData());
    expect(result.user.backupReminderDismissedAt).toBeTruthy();
  });
});
