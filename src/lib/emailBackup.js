import emailjs from '@emailjs/browser';
import { todayISO, formatFullDate } from './dates';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export const emailBackupConfigured = !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

function toBase64(str) {
  // btoa only handles Latin1, so escape the UTF-8 string first (accented names,
  // ñ, etc. in income/goal/debt names would otherwise break the encoding).
  return btoa(unescape(encodeURIComponent(str)));
}

// Sends the full backup as a JSON attachment via EmailJS — see README for the
// one-time account setup this depends on (service, template, public key).
export async function sendBackupEmail(data, toEmail) {
  if (!emailBackupConfigured) {
    throw new Error('EmailJS no está configurado todavía (faltan las variables VITE_EMAILJS_*).');
  }
  const payload = { user: data.user, incomes: data.incomes, goals: data.goals, cards: data.cards, expenses: data.expenses, exportedAt: todayISO() };
  const json = JSON.stringify(payload, null, 2);

  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email: toEmail,
      fecha: formatFullDate(todayISO()),
      attachment: [{ name: `payday-datos-${todayISO()}.json`, data: toBase64(json) }],
    },
    { publicKey: PUBLIC_KEY },
  );
}
