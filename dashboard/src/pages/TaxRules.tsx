import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge, Button, ButtonGhost, Empty, Field, Input, Modal, Pagination, Select, Spinner, Table, cx } from "../components/ui";

interface TaxRule {
  id: string;
  name: string;
  type: string;
  rate: number;
  fixedAmount: number | null;
  appliesTo: string;
  categoryId: string | null;
  productId: string | null;
  category?: { id: string; name: string } | null;
  product?: { id: string; name: string } | null;
  isInclusive: boolean;
  rounding: string;
  active: boolean;
  createdAt: string;
}

interface Product { id: string; name: string }
interface Category { id: string; name: string }

const emptyForm = {
  name: "",
  type: "PERCENT",
  rate: "17",
  fixedAmount: "",
  appliesTo: "ALL",
  categoryId: "",
  productId: "",
  isInclusive: "false",
  rounding: "ROUND_HALF_UP",
  active: "true",
};

export default function TaxRules() {
  const [items, setItems] = useState<TaxRule[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ editing: TaxRule | null } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ items: TaxRule[]; total: number }>("/api/admin/tax-rules", { page, pageSize: 20, search });
      setItems(d.items);
      setTotal(d.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  function loadRefs() {
    api.get<{ items: Product[] }>("/api/admin/products", { pageSize: 100 }).then((d) => setProducts(d.items)).catch(() => {});
    api.get<{ items: Category[] }>("/api/admin/categories", { pageSize: 100 }).then((d) => setCategories(d.items)).catch(() => {});
  }

  function openNew() {
    setForm(emptyForm);
    setError("");
    setModal({ editing: null });
    loadRefs();
  }

  function openEdit(t: TaxRule) {
    setForm({
      name: t.name,
      type: t.type,
      rate: String(t.rate),
      fixedAmount: t.fixedAmount == null ? "" : String(t.fixedAmount),
      appliesTo: t.appliesTo,
      categoryId: t.categoryId ?? "",
      productId: t.productId ?? "",
      isInclusive: String(t.isInclusive),
      rounding: t.rounding,
      active: String(t.active),
    });
    setError("");
    setModal({ editing: t });
    loadRefs();
  }

  function set(key: keyof typeof emptyForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    const payload: Record<string, unknown> = {
      name: form.name,
      type: form.type,
      rate: form.type === "PERCENT" ? Number(form.rate) || 0 : 0,
      fixedAmount: form.type === "FIXED" ? Number(form.fixedAmount) || 0 : null,
      appliesTo: form.appliesTo,
      categoryId: form.appliesTo === "CATEGORY" ? form.categoryId || null : null,
      productId: form.appliesTo === "PRODUCT" ? form.productId || null : null,
      isInclusive: form.isInclusive === "true",
      rounding: form.rounding,
      active: form.active === "true",
    };
    try {
      if (modal?.editing) await api.put(`/api/admin/tax-rules/${modal.editing.id}`, payload);
      else await api.post("/api/admin/tax-rules", payload);
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save fail");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(t: TaxRule) {
    await api.put(`/api/admin/tax-rules/${t.id}`, { active: !t.active });
    load();
  }

  async function remove(t: TaxRule) {
    if (!confirm(`Delete tax rule "${t.name}"?`)) return;
    try {
      await api.del(`/api/admin/tax-rules/${t.id}`);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete fail");
    }
  }

  const scope = (t: TaxRule) => (t.appliesTo === "ALL" ? "All" : t.appliesTo === "CATEGORY" ? t.category?.name ?? "Category" : t.product?.name ?? "Product");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Tax Rules</h1>
        <div className="flex gap-2"><Button onClick={openNew}>+ Add Rule</Button></div>
      </div>

      <Input className="max-w-xs" placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="Koi tax rule nahi." />
      ) : (
        <>
          <Table headers={["Name", "Type", "Value", "Applies to", "Inclusive", "Rounding", "Status", "Actions"]}>
            {items.map((t) => (
              <tr key={t.id} className={cx(!t.active && "opacity-60")}>
                <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                <td className="px-4 py-3"><Badge tone="sky">{t.type}</Badge></td>
                <td className="px-4 py-3">{t.type === "PERCENT" ? `${t.rate}%` : `${t.fixedAmount} PKR`}</td>
                <td className="px-4 py-3 text-slate-600">{scope(t)}</td>
                <td className="px-4 py-3"><Badge tone={t.isInclusive ? "amber" : "slate"}>{t.isInclusive ? "Inclusive" : "Exclusive"}</Badge></td>
                <td className="px-4 py-3 text-slate-500">{t.rounding.replace(/_/g, " ")}</td>
                <td className="px-4 py-3"><Badge tone={t.active ? "green" : "slate"}>{t.active ? "Active" : "Inactive"}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <ButtonGhost onClick={() => openEdit(t)}>Edit</ButtonGhost>
                    <ButtonGhost onClick={() => toggle(t)}>{t.active ? "Disable" : "Enable"}</ButtonGhost>
                    <ButtonGhost onClick={() => remove(t)}>Delete</ButtonGhost>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={20} total={total} onChange={setPage} />
        </>
      )}

      <Modal open={!!modal} title={modal?.editing ? `Edit: ${modal.editing.name}` : "Add Tax Rule"} onClose={() => setModal(null)}>
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Type" required>
              <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
                <option value="PERCENT">Percent</option>
                <option value="FIXED">Fixed amount</option>
              </Select>
            </Field>
            <Field label={form.type === "PERCENT" ? "Rate (%)" : "Fixed amount (PKR)"} required>
              <Input type="number" min="0" step="0.01" value={form.type === "PERCENT" ? form.rate : form.fixedAmount} onChange={(e) => set(form.type === "PERCENT" ? "rate" : "fixedAmount", e.target.value)} />
            </Field>
            <Field label="Applies to" required>
              <Select value={form.appliesTo} onChange={(e) => set("appliesTo", e.target.value)}>
                <option value="ALL">All products</option>
                <option value="CATEGORY">Category</option>
                <option value="PRODUCT">Product</option>
              </Select>
            </Field>
            {form.appliesTo === "CATEGORY" && (
              <Field label="Category" required>
                <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                  <option value="">Select...</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            )}
            {form.appliesTo === "PRODUCT" && (
              <Field label="Product" required>
                <Select value={form.productId} onChange={(e) => set("productId", e.target.value)}>
                  <option value="">Select...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Price includes tax">
              <Select value={form.isInclusive} onChange={(e) => set("isInclusive", e.target.value)}>
                <option value="false">No (add tax on top)</option>
                <option value="true">Yes (tax in price)</option>
              </Select>
            </Field>
            <Field label="Rounding">
              <Select value={form.rounding} onChange={(e) => set("rounding", e.target.value)}>
                <option value="ROUND_HALF_UP">Half up</option>
                <option value="ROUND_UP">Up</option>
                <option value="ROUND_DOWN">Down</option>
                <option value="NONE">None</option>
              </Select>
            </Field>
            <Field label="Active">
              <Select value={form.active} onChange={(e) => set("active", e.target.value)}>
                <option value="true">Yes</option><option value="false">No</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <ButtonGhost onClick={() => setModal(null)}>Cancel</ButtonGhost>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}