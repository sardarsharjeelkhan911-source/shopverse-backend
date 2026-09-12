import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge, Button, ButtonDanger, ButtonGhost, Empty, Field, Input, Modal, Spinner, Table, cx, fmtDate } from "../components/ui";

interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
  productCount: number;
  createdAt: string;
}

export default function Brands() {
  const [items, setItems] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ editing: Brand | null } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", active: "true" });

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ items: Brand[] }>("/api/admin/brands", { pageSize: 100, includeInactive: "true" });
      setItems(d.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setForm({ name: "", description: "", active: "true" });
    setError("");
    setModal({ editing: null });
  }

  function openEdit(b: Brand) {
    setForm({ name: b.name, description: b.description ?? "", active: String(b.active) });
    setError("");
    setModal({ editing: b });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = { name: form.name, description: form.description || null, active: form.active === "true" };
      if (modal?.editing) await api.put(`/api/admin/brands/${modal.editing.id}`, payload);
      else await api.post("/api/admin/brands", payload);
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save fail");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(b: Brand) {
    await api.put(`/api/admin/brands/${b.id}`, { active: !b.active });
    load();
  }

  async function remove(b: Brand) {
    if (!confirm(`Delete brand "${b.name}"?`)) return;
    try {
      await api.del(`/api/admin/brands/${b.id}`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete fail");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Brands</h1>
        <Button onClick={openNew}>+ Add Brand</Button>
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="Koi brand nahi." />
      ) : (
        <Table headers={["Name", "Slug", "Products", "Status", "Created", "Actions"]}>
          {items.map((b) => (
            <tr key={b.id} className={cx(!b.active && "opacity-60")}>
              <td className="px-4 py-3 font-medium text-slate-800">{b.name}</td>
              <td className="px-4 py-3 text-slate-500">{b.slug}</td>
              <td className="px-4 py-3">{b.productCount}</td>
              <td className="px-4 py-3"><Badge tone={b.active ? "green" : "slate"}>{b.active ? "Active" : "Inactive"}</Badge></td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(b.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <ButtonGhost onClick={() => openEdit(b)}>Edit</ButtonGhost>
                  <ButtonGhost onClick={() => toggle(b)}>{b.active ? "Deactivate" : "Activate"}</ButtonGhost>
                  <ButtonDanger onClick={() => remove(b)}>Delete</ButtonDanger>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={!!modal} title={modal?.editing ? `Edit: ${modal.editing.name}` : "Add Brand"} onClose={() => setModal(null)}>
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
          <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Active">
            <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={form.active} onChange={(e) => setForm({ ...form, active: e.target.value })}>
              <option value="true">Yes</option><option value="false">No</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2">
            <ButtonGhost onClick={() => setModal(null)}>Cancel</ButtonGhost>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}