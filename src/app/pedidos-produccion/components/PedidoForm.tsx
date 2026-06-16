"use client";

import { Trabajador, TIPOS, ORDEN_ESTADO } from "./types";

export interface PedidoFormValues {
  cliente: string;
  tipo: string;
  trabajador: string;
  estado: string;
  fecha_entrega: string;
  notas: string;
}

const inputCls =
  "w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brandit-orange transition min-h-[44px]";

const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5";

export default function PedidoForm({
  values,
  onChange,
  equipo,
}: {
  values: PedidoFormValues;
  onChange: (patch: Partial<PedidoFormValues>) => void;
  equipo: Trabajador[];
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
        <label className={labelCls}>Tipo de personalización</label>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map((t) => {
            const active = values.tipo === t.name;
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => onChange({ tipo: t.name })}
                style={active ? { background: t.bg, color: t.text, borderColor: t.dot } : {}}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition min-h-[44px] ${
                  active
                    ? ""
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                }`}
              >
                <span style={{ background: t.dot }} className="w-2.5 h-2.5 rounded-full shrink-0" />
                <span className="truncate">{t.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className={labelCls}>Trabajador asignado</label>
        <select
          value={values.trabajador}
          onChange={(e) => onChange({ trabajador: e.target.value })}
          className={inputCls}
        >
          <option value="">Sin asignar</option>
          {equipo.map((t) => (
            <option key={t.id} value={t.nombre}>
              {t.nombre}
            </option>
          ))}
        </select>
        {equipo.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
            Agrega trabajadores desde el botón “Equipo”.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Estado</label>
          <select
            value={values.estado}
            onChange={(e) => onChange({ estado: e.target.value })}
            className={inputCls}
          >
            {ORDEN_ESTADO.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Fecha de entrega</label>
          <input
            type="date"
            value={values.fecha_entrega}
            onChange={(e) => onChange({ fecha_entrega: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Notas</label>
        <textarea
          value={values.notas}
          onChange={(e) => onChange({ notas: e.target.value })}
          placeholder="Detalles, medidas, cantidades…"
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </div>
    </div>
  );
}
