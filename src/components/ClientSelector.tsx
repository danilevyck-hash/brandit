"use client";

import { useState, useEffect } from "react";
import { Client } from "@/lib/supabase";

type Props = {
  selectedClientId: number | null;
  onSelect: (client: Client) => void;
};

export default function ClientSelector({ selectedClientId, onSelect }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/clients")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setClients(d); });
  }, []);

  async function createClient() {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, phone: newPhone, email: newEmail }),
    });
    const client = await res.json();
    if (client.id) {
      setClients(prev => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));
      onSelect(client);
      setShowNew(false);
      setNewName("");
      setNewPhone("");
      setNewEmail("");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Cliente</label>
      <div className="flex gap-2">
        <select
          value={selectedClientId ?? ""}
          onChange={e => {
            const c = clients.find(c => c.id === Number(e.target.value));
            if (c) onSelect(c);
          }}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange outline-none bg-white"
        >
          <option value="">Seleccionar cliente...</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowNew(!showNew)}
          className="px-4 py-2.5 bg-brandit-orange text-white rounded-xl text-sm font-medium hover:bg-brandit-orange/90 transition-colors"
        >
          + Nuevo
        </button>
      </div>

      {showNew && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
          <input
            placeholder="Nombre del cliente *"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange outline-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Teléfono"
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange outline-none"
            />
            <input
              placeholder="Email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brandit-orange/20 focus:border-brandit-orange outline-none"
            />
          </div>
          <button
            type="button"
            onClick={createClient}
            disabled={saving || !newName.trim()}
            className="w-full bg-brandit-orange text-white font-medium py-2.5 rounded-xl text-sm hover:bg-brandit-orange/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Crear Cliente"}
          </button>
        </div>
      )}
    </div>
  );
}
