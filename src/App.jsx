import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocalData } from './lib/storage';
import { consumeDriveRedirect } from './lib/googleDrive';
import { setExchangeRates } from './lib/format';
import { fetchLiveExchangeRates } from './lib/exchangeRates';
import { todayISO } from './lib/dates';
import Splash from './components/Splash';
import Welcome from './components/Welcome';
import AppLock from './components/AppLock';
import BottomNav from './components/BottomNav';
import UpdateToast from './components/UpdateToast';
// Dashboard loads eagerly since it's the very first screen shown; every other
// screen is only fetched the moment the person actually navigates to it, so the
// initial bundle doesn't carry code (charts, forms, the debt simulator) for
// screens they might never open in a given session.
import Dashboard from './screens/Dashboard';
const Registrar = lazy(() => import('./screens/Registrar'));
const Metas = lazy(() => import('./screens/Metas'));
const MetaDetalle = lazy(() => import('./screens/MetaDetalle'));
const Deudas = lazy(() => import('./screens/Deudas'));
const DeudaDetalle = lazy(() => import('./screens/DeudaDetalle'));
const Ingresos = lazy(() => import('./screens/Ingresos'));
const Ajustes = lazy(() => import('./screens/Ajustes'));

// Must run before the first render — if Google just redirected back after a Drive
// connect, this parses the access token out of the URL hash (see
// lib/googleDrive.js) so activeTab's sessionStorage-based restore below and
// Ajustes' own hasValidToken() check both see it immediately, not one render late.
consumeDriveRedirect();

export default function App() {
  const [data, setData] = useLocalData();
  // Restores the tab after a Google Drive connect redirect (see
  // startDriveConnect in screens/Ajustes.jsx) reloads the whole app —
  // otherwise returning from Google would land back on Inicio.
  const [activeTab, setActiveTab] = useState(() => {
    const pending = sessionStorage.getItem('payday_return_tab');
    if (pending) sessionStorage.removeItem('payday_return_tab');
    return pending || 'dashboard';
  });
  const [editingIncome, setEditingIncome] = useState(null);
  const [viewingDebtId, setViewingDebtId] = useState(null);
  const [viewingGoalId, setViewingGoalId] = useState(null);
  const [splashFading, setSplashFading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const [locked, setLocked] = useState(() => !!data.user.appLockPin);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Re-lock the moment the app is hidden (tab switched, phone backgrounded), so the
  // lock screen is the first thing shown again — not a flash of the real data.
  useEffect(() => {
    if (!data.user.appLockPin) return;
    const onVisibility = () => {
      if (document.hidden) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [data.user.appLockPin]);

  // Plain navigation always resets to "create"/list mode; only startEditIncome and
  // viewDebtDetail open a screen pre-loaded with something specific.
  const navigate = (tab) => {
    setEditingIncome(null);
    setViewingDebtId(null);
    setViewingGoalId(null);
    setActiveTab(tab);
  };
  const startEditIncome = (income) => {
    setEditingIncome(income);
    setActiveTab('registrar');
  };
  const viewDebtDetail = (cardId) => {
    setViewingDebtId(cardId);
    setActiveTab('deuda-detalle');
  };
  const viewGoalDetail = (goalId) => {
    setViewingGoalId(goalId);
    setActiveTab('meta-detalle');
  };

  useEffect(() => {
    const fadeTimer = setTimeout(() => setSplashFading(true), 1600);
    const hideTimer = setTimeout(() => setShowSplash(false), 2200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Refreshes USD/EUR rates once per day, automatically, on whatever screen the
  // person opens the app to — no manual entry needed. Silently keeps the last known
  // rate if offline or the API is unreachable; Ajustes exposes a manual retry too.
  useEffect(() => {
    if (data.user.ratesUpdatedAt === todayISO()) return;
    let cancelled = false;
    fetchLiveExchangeRates()
      .then((rates) => {
        if (cancelled) return;
        setData((s) => ({ ...s, user: { ...s.user, ...rates, ratesUpdatedAt: todayISO() } }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishOnboarding = (backupEmail) => {
    setData((s) => ({ ...s, user: { ...s.user, onboarded: true, ...(backupEmail ? { backupEmail } : {}) } }));
  };

  const requestInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  // Set synchronously during render (not in an effect) so every screen's fmt() call
  // in this same pass already sees the current rate — no stale-then-refresh flicker.
  setExchangeRates({ USD: data.user.usdRate || 4000, EUR: data.user.eurRate || 4500 });

  return (
    <div
      data-theme={data.user.theme}
      style={{
        width: '100%',
        minHeight: '100vh',
        background: 'var(--page-bg)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      {showSplash && <Splash fading={splashFading} />}
      {!showSplash && !data.user.onboarded && <Welcome onFinish={finishOnboarding} />}
      {locked && data.user.appLockPin && <AppLock pinHash={data.user.appLockPin} onUnlock={() => setLocked(false)} />}
      <UpdateToast />

      <div className="app-scroll" style={{ width: '100%', maxWidth: 640, padding: '0 20px var(--nav-clearance) 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Suspense fallback={<div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Cargando…</div>}>
          {activeTab === 'dashboard' && <Dashboard data={data} setData={setData} onNavigate={navigate} />}
          {activeTab === 'registrar' && (
            <Registrar data={data} setData={setData} onNavigate={navigate} editingIncome={editingIncome} onDoneEditing={() => setEditingIncome(null)} />
          )}
          {activeTab === 'metas' && <Metas data={data} setData={setData} onViewDetail={viewGoalDetail} />}
          {activeTab === 'meta-detalle' && (
            <MetaDetalle data={data} setData={setData} goalId={viewingGoalId} onNavigate={navigate} onEditIncome={startEditIncome} />
          )}
          {activeTab === 'tarjetas' && <Deudas data={data} setData={setData} onViewDetail={viewDebtDetail} />}
          {activeTab === 'deuda-detalle' && <DeudaDetalle data={data} setData={setData} cardId={viewingDebtId} onNavigate={navigate} />}
          {activeTab === 'ingresos' && <Ingresos data={data} setData={setData} onNavigate={navigate} onEdit={startEditIncome} />}
          {activeTab === 'config' && (
            <Ajustes data={data} setData={setData} canInstall={!!installPrompt} isInstalled={isInstalled} onInstall={requestInstall} />
          )}
        </Suspense>
      </div>

      <BottomNav activeTab={activeTab} onChange={navigate} />
    </div>
  );
}
