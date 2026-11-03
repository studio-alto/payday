import { useRef, useState } from 'react';
import { cardStyle, labelStyle } from '../lib/styles';
import { isValidBackup, summarizeBackup, applyRestoredBackup } from '../lib/backup';
import FixedHeader from '../components/FixedHeader';
import InlineConfirm from '../components/InlineConfirm';
import Toast from '../components/Toast';

const actionRowStyle = {
  padding: 12,
  borderRadius: 14,
  background: 'var(--input-bg)',
  textAlign: 'center',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text)',
  cursor: 'pointer',
  border: 'none',
  width: '100%',
};

// "X ingresos, Y metas, Z deudas, ..." — every field that matters, not just three of
// them, so a preview never silently hides part of what a restore would bring in.
function summaryLine(s) {
  return [
    `${s.incomes} ${s.incomes === 1 ? 'ingreso' : 'ingresos'}`,
    `${s.goals} ${s.goals === 1 ? 'meta' : 'metas'}`,
    `${s.cards} ${s.cards === 1 ? 'deuda' : 'deudas'}`,
    `${s.expenses} ${s.expenses === 1 ? 'gasto fijo' : 'gastos fijos'}`,
    `${s.gastosVariables} ${s.gastosVariables === 1 ? 'gasto variable' : 'gastos variables'}`,
    `${s.sueldosFijos} ${s.sueldosFijos === 1 ? 'sueldo fijo' : 'sueldos fijos'}`,
  ].join(', ');
}

export default function RestaurarDatos({ setData, onNavigate }) {
  const [toast, setToast] = useState(null);
  const goBack = () => {
    sessionStorage.setItem('payday_return_section', 'general');
    onNavigate('config');
  };
  const finishRestore = (parsed) => {
    const summary = summarizeBackup(parsed);
    setData((s) => applyRestoredBackup(parsed, s.user));
    setToast(`✓ Datos restaurados. Tienes ${summaryLine(summary)}.`);
  };

  // --- 1. Importar archivo JSON ---
  const fileInputRef = useRef(null);
  const [filePreview, setFilePreview] = useState(null); // { parsed, summary }
  const [fileError, setFileError] = useState('');
  const [confirmFileImport, setConfirmFileImport] = useState(false);

  const readAndPreview = (text) => {
    try {
      const parsed = JSON.parse(text);
      if (!isValidBackup(parsed)) {
        setFileError('Este archivo no tiene el formato de un respaldo de Payday.');
        setFilePreview(null);
        return;
      }
      setFileError('');
      setFilePreview({ parsed, summary: summarizeBackup(parsed) });
    } catch {
      setFileError('No se pudo leer ese archivo. Revisa que sea un respaldo exportado por Payday.');
      setFilePreview(null);
    }
  };
  const triggerFilePick = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => readAndPreview(reader.result);
    reader.readAsText(file);
  };
  const confirmImportFile = () => {
    finishRestore(filePreview.parsed);
    setFilePreview(null);
    setConfirmFileImport(false);
  };

  // --- 2. Borrar todo ---
  const [wipeStep, setWipeStep] = useState(0);
  const wipeAll = () => {
    setData((s) => ({ ...s, incomes: [], goals: [], cards: [], expenses: [], gastosVariables: [], sueldosFijos: [] }));
    setWipeStep(0);
    setToast('✓ Listo, borraste todos tus datos. Empiezas de cero.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 'var(--header-h, 88px)' }}>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <FixedHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={goBack}
            style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 700, color: 'var(--accent-text)', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
          >
            ‹ Ajustes
          </button>
          <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--text)', letterSpacing: '-0.02em' }}>Restaurar datos</div>
        </div>
      </FixedHeader>

      {/* 1. Importar archivo JSON */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={labelStyle}>IMPORTAR ARCHIVO JSON</div>
        <input type="file" ref={fileInputRef} accept="application/json" onChange={handleFileChange} style={{ display: 'none' }} />
        <button type="button" onClick={triggerFilePick} style={actionRowStyle}>
          Elegir archivo de respaldo
        </button>

        {fileError && <div style={{ fontSize: 12, color: 'var(--danger-text)' }}>{fileError}</div>}

        {filePreview && (
          <div style={{ background: 'var(--input-bg)', borderRadius: 14, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>Contiene {summaryLine(filePreview.summary)}.</div>
            {!confirmFileImport ? (
              <button type="button" onClick={() => setConfirmFileImport(true)} style={{ ...actionRowStyle, background: 'var(--accent)', color: 'white' }}>
                Restaurar
              </button>
            ) : (
              <InlineConfirm
                message="¿Reemplazar mis datos actuales con este archivo? No se puede deshacer."
                confirmLabel="Sí, reemplazar"
                cancelLabel="Cancelar"
                onConfirm={confirmImportFile}
                onCancel={() => setConfirmFileImport(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* 2. Borrar todo y empezar de cero */}
      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={labelStyle}>BORRAR TODO Y EMPEZAR DE CERO</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Borra tus ingresos, metas, deudas y gastos. Tus ajustes (moneda, tema, PIN, etc.) se conservan.
        </div>
        {wipeStep === 0 && (
          <button type="button" onClick={() => setWipeStep(1)} style={{ ...actionRowStyle, background: 'var(--danger)', color: 'white' }}>
            Eliminar todos mis datos
          </button>
        )}
        {wipeStep === 1 && (
          <InlineConfirm
            message="No se puede deshacer. ¿Seguro que quieres eliminar todos tus datos?"
            confirmLabel="Sí, seguir"
            cancelLabel="Cancelar"
            onConfirm={() => setWipeStep(2)}
            onCancel={() => setWipeStep(0)}
          />
        )}
        {wipeStep === 2 && (
          <InlineConfirm
            message="Última confirmación: se borrará todo para siempre, sin forma de recuperarlo. ¿Confirmas?"
            confirmLabel="Sí, borrar todo"
            cancelLabel="Cancelar"
            onConfirm={wipeAll}
            onCancel={() => setWipeStep(0)}
          />
        )}
      </div>
    </div>
  );
}
