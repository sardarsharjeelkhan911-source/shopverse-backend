import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge, Button, ButtonDanger, ButtonGhost, Empty, Field, Input, Modal, Spinner, Table, cx, fmtDate } from "../components/ui";

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
  productCount: number;
  createdAt: string;
}

export default function Categories() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ editing: Category | null } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", active: "true" });

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ items: Category[] }>("/api/admin/categories", { pageSize: 100, includeInactive: "true" });
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

  function openEdit(c: Category) {
    setForm({ name: c.name, description: c.description ?? "", active: String(c.active) });
    setError("");
    setModal({ editing: c });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = { name: form.name, description: form.description || null, active: form.active === "true" };
      if (modal?.editing) await api.put(`/api/admin/categories/${modal.editing.id}`, payload);
      else await api.post("/api/admin/categories", payload);
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save fail");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(c: Category) {
    await api.put(`/api/admin/categories/${c.id}`, { active: !c.active });
    load();
  }

  async function remove(c: Category) {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try {
      await api.del(`/api/admin/categories/${c.id}`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete fail");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Categories</h1>
        <Button onClick={openNew}>+ Add Category</Button>
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="Koi category nahi." />
      ) : (
        <Table headers={["Name", "Slug", "Products", "Status", "Created", "Actions"]}>
          {items.map((c) => (
            <tr key={c.id} className={cx(!c.active && "opacity-60")}>
              <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
              <td className="px-4 py-3 text-slate-500">{c.slug}</td>
              <td className="px-4 py-3">{c.productCount}</td>
              <td className="px-4 py-3"><Badge tone={c.active ? "green" : "slate"}>{c.active ? "Active" : "Inactive"}</Badge></td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(c.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <ButtonGhost onClick={() => openEdit(c)}>Edit</ButtonGhost>
                  <ButtonGhost onClick={() => toggle(c)}>{c.active ? "Deactivate" : "Activate"}</ButtonGhost>
                  <ButtonDanger onClick={() => remove(c)}>Delete</ButtonDanger>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={!!modal} title={modal?.editing ? `Edit: ${modal.editing.name}` : "Add Category"} onClose={() => setModal(null)}>
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