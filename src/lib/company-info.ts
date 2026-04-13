// Datos de la empresa — usados en PDFs y documentos oficiales.
// Para editar: cambia los valores aquí y vuelve a pushear.
export const COMPANY = {
  name: "Confecciones Boston",
  legal_name: "Confecciones Boston, S.A.",
  ruc: "655-544-133465 DV13",
  phone: "(+507) 6615-6110",
  email: "levyd@gmail.com",
  address: "Vista Hermosa, Ciudad de Panamá",
};

// Formatea un número panameño a XXXX-XXXX
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length >= 10 && digits.startsWith("507")) {
    const local = digits.slice(3);
    if (local.length === 8) return `(+507) ${local.slice(0, 4)}-${local.slice(4)}`;
  }
  return String(raw);
}
