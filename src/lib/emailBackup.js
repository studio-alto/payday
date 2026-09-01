import emailjs from '@emailjs/browser';
import { todayISO, formatFullDate } from './dates';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export const emailBackupConfigured = !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

// Sends the full backup as plain text in the email body (not an attachment) —
// EmailJS's free tier doesn't support attachments, only paid plans do. To
// restore, the user copies this text back into the app's "pegar para
// restaurar" field. See README for the one-time account setup this depends on
// (service, template, public key).
export async function sendBackupEmail(data, toEmail) {
  if (!emailBackupConfigured) {
    throw new Error('EmailJS no está configurado todavía (faltan las variables VITE_EMAILJS_*).');
  }
  const payload = {
    user: data.user,
    incomes: data.incomes,
    goals: data.goals,
    cards: data.cards,
    expenses: data.expenses,
    gastosVariables: data.gastosVariables,
    exportedAt: todayISO(),
  };
  const json = JSON.stringify(payload, null, 2);

  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email: toEmail,
      fecha: formatFullDate(todayISO()),
      backup_json: json,
    },
    { publicKey: PUBLIC_KEY },
  );
}
