"use client";

export interface RecordatorioFormValues {
  cliente: string;
  monto: string;
  fecha_prometida: string;
  nota: string;
}

const inputCls =
  "w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brandit-orange transition min-h-[44px]";

const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5";

export default function RecordatorioForm({
  values,
  onChange,
}: {
  values: RecordatorioFormValues;
  onChange: (patch: Partial<RecordatorioFormValues>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>
          Cliente <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={values.cliente}
          onChange={(e) => onChange({ cliente: e.target.value })}
          placeholder="Nombre del cliente"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Monto ($)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={values.monto}
          onChange={(e) => onChange({ monto: e.target.value })}
          placeholder="Opcional"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>
          Fecha prometida <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={values.fecha_prometida}
          onChange={(e) => onChange({ fecha_prometida: e.target.value })}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Nota</label>
        <textarea
          value={values.nota}
          onChange={(e) => onChange({ nota: e.target.value })}
          placeholder="Opcional"
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </div>
    </div>
  );
}
