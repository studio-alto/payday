import { useEffect, useState } from 'react';
import { useLocalData } from './lib/storage';
import Splash from './components/Splash';
import BottomNav from './components/BottomNav';
import Dashboard from './screens/Dashboard';
import Registrar from './screens/Registrar';
import Metas from './screens/Metas';
import Deudas from './screens/Deudas';
import Ingresos from './screens/Ingresos';
import Ajustes from './screens/Ajustes';

export default function App() {
  const [data, setData] = useLocalData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingIncome, setEditingIncome] = useState(null);
  const [splashFading, setSplashFading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Plain navigation always resets to "create" mode; only startEditIncome opens the form pre-filled.
  const navigate = (tab) => {
    setEditingIncome(null);
    setActiveTab(tab);
  };
  const startEditIncome = (income) => {
    setEditingIncome(income);
    setActiveTab('registrar');
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

  const requestInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <div
      data-theme={data.user.theme}
      style={{
        width: '100%',
        minHeight: '100%',
        background: 'var(--page-bg)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      {showSplash && <Splash fading={splashFading} />}

      <div className="app-scroll" style={{ width: '100%', maxWidth: 640, padding: '0 20px var(--nav-clearance) 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {activeTab === 'dashboard' && <Dashboard data={data} setData={setData} onNavigate={navigate} />}
        {activeTab === 'registrar' && (
          <Registrar data={data} setData={setData} onNavigate={navigate} editingIncome={editingIncome} onDoneEditing={() => setEditingIncome(null)} />
        )}
        {activeTab === 'metas' && <Metas data={data} setData={setData} />}
        {activeTab === 'tarjetas' && <Deudas data={data} setData={setData} />}
        {activeTab === 'ingresos' && <Ingresos data={data} setData={setData} onNavigate={navigate} onEdit={startEditIncome} />}
        {activeTab === 'config' && (
          <Ajustes data={data} setData={setData} canInstall={!!installPrompt} isInstalled={isInstalled} onInstall={requestInstall} />
        )}
      </div>

      <BottomNav activeTab={activeTab} onChange={navigate} />
    </div>
  );
}
