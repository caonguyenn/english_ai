import { useState } from 'react';

interface AdminStudentData {
  id: string;
  name: string | null;
  email: string;
  xp_total: number;
  current_module_id: string | null;
  placement_band: number | null;
}

interface Module {
  id: string;
  title: string;
  order_index: number;
}

interface EditStudentFormProps {
  student: AdminStudentData;
  modules: Module[];
  onSave: (data: { xp_total?: number; current_module_id?: string; placement_band?: number }) => void;
  isSaving: boolean;
}

interface FormErrors {
  xp_total?: string;
  placement_band?: string;
}

export function EditStudentForm({ student, modules, onSave, isSaving }: EditStudentFormProps) {
  const [xpTotal, setXpTotal] = useState(String(student.xp_total));
  const [moduleId, setModuleId] = useState(String(student.current_module_id ?? ''));
  const [band, setBand] = useState(String(student.placement_band ?? ''));
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const next: FormErrors = {};

    const xp = Number(xpTotal);
    if (xpTotal === '' || isNaN(xp) || xp < 0) {
      next.xp_total = 'XP must be a number ≥ 0';
    }

    if (band !== '') {
      const b = Number(band);
      if (isNaN(b) || b < 0 || b > 9) {
        next.placement_band = 'Band must be between 0 and 9';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: { xp_total?: number; current_module_id?: string; placement_band?: number } = {};

    payload.xp_total = Number(xpTotal);
    if (moduleId !== '') payload.current_module_id = moduleId;
    if (band !== '') payload.placement_band = Number(band);

    onSave(payload);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--fg)',
    fontSize: '14px',
    outline: 'none',
  };

  const errorStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#F87171',
    marginTop: '4px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--muted)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: '20px',
  };

  const sortedModules = [...modules].sort((a, b) => a.order_index - b.order_index);

  return (
    <form onSubmit={handleSubmit}>
      <div style={fieldStyle}>
        <label style={labelStyle}>XP Total</label>
        <input
          type="number"
          min={0}
          value={xpTotal}
          onChange={(e) => setXpTotal(e.target.value)}
          style={{ ...inputStyle, borderColor: errors.xp_total ? '#F87171' : 'var(--border)' }}
        />
        {errors.xp_total && <div style={errorStyle}>{errors.xp_total}</div>}
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Current Module</label>
        <select
          value={moduleId}
          onChange={(e) => setModuleId(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="">— None —</option>
          {sortedModules.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.order_index}. {m.title}
            </option>
          ))}
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Placement Band (0–9)</label>
        <input
          type="number"
          min={0}
          max={9}
          step={0.5}
          value={band}
          onChange={(e) => setBand(e.target.value)}
          placeholder="e.g. 5.5"
          style={{ ...inputStyle, borderColor: errors.placement_band ? '#F87171' : 'var(--border)' }}
        />
        {errors.placement_band && <div style={errorStyle}>{errors.placement_band}</div>}
      </div>

      <button
        type="submit"
        disabled={isSaving}
        style={{
          padding: '10px 24px',
          background: isSaving ? 'var(--surface3)' : 'var(--accent)',
          color: 'var(--fg)',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: isSaving ? 'not-allowed' : 'pointer',
          opacity: isSaving ? 0.7 : 1,
        }}
      >
        {isSaving ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  );
}
