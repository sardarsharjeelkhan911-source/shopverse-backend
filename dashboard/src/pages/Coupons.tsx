import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge, Button, ButtonGhost, Empty, Field, Input, Modal, Pagination, Select, Spinner, Table, fmtDate } from "../components/ui";

interface Coupon {
  id: string;
  code: string;
  type: string;
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  product: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  active: boolean;
  usages: number;
  createdAt: string;
}

interface Product { id: string; name: string }
interface Category { id: string; name: string }

const emptyForm = {
  code: "",
  type: "PERCENT",
  value: "",
  minOrderAmount: "",
  maxDiscount: "",
  startsAt: "",
  expiresAt: "",
  usageLimit: "",
  perCustomerLimit: "",
  productId: "",
  categoryId: "",
  active: "true",
};

export default function Coupons() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ editing: Coupon | null } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ items: Coupon[]; total: number }>("/api/admin/coupons", { page, pageSize: 20, search });
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

  function openEdit(c: Coupon) {
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      minOrderAmount: c.minOrderAmount == null ? "" : String(c.minOrderAmount),
      maxDiscount: c.maxDiscount == null ? "" : String(c.maxDiscount),
      startsAt: c.startsAt ? c.startsAt.slice(0, 16) : "",
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 16) : "",
      usageLimit: c.usageLimit == null ? "" : String(c.usageLimit),
      perCustomerLimit: c.perCustomerLimit == null ? "" : String(c.perCustomerLimit),
      productId: c.product?.id ?? "",
      categoryId: c.category?.id ?? "",
      active: String(c.active),
    });
    setError("");
    setModal({ editing: c });
    loadRefs();
  }

  function set(key: keyof typeof emptyForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    const toDT = (v: string) => (v === "" ? null : new Date(v).toISOString());
    const payload: Record<string, unknown> = {
      code: form.code,
      type: form.type,
      value: Number(form.value) || 0,
      minOrderAmount: form.minOrderAmount === "" ? null : Number(form.minOrderAmount),
      maxDiscount: form.maxDiscount === "" ? null : Number(form.maxDiscount),
      startsAt: form.startsAt ? toDT(form.startsAt) : null,
      expiresAt: form.expiresAt ? toDT(form.expiresAt) : null,
      usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit),
      perCustomerLimit: form.perCustomerLimit === "" ? null : Number(form.perCustomerLimit),
      productId: form.productId || null,
      categoryId: form.categoryId || null,
      active: form.active === "true",
    };
    try {
      if (modal?.editing) await api.put(`/api/admin/coupons/${modal.editing.id}`, payload);
      else await api.post("/api/admin/coupons", payload);
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save fail");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(c: Coupon) {
    await api.put(`/api/admin/coupons/${c.id}`, { active: !c.active });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Coupons</h1>
        <Button onClick={openNew}>+ Add Coupon</Button>
      </div>

      <Input className="max-w-xs" placeholder="Search coupon code..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="Koi coupon nahi." />
      ) : (
        <>
          <Table headers={["Code", "Type", "Value", "Limits", "Expires", "Usages", "Status", "Actions"]}>
            {items.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-semibold text-indigo-600">{c.code}</td>
                <td className="px-4 py-3"><Badge tone="sky">{c.type}</Badge></td>
                <td className="px-4 py-3">
                  {c.type === "PERCENT" ? `${c.value}%` : `${c.value} PKR`}
                  {c.maxDiscount && <div className="text-xs text-slate-400">max {c.maxDiscount}</div>}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.minOrderAmount ? `min ${c.minOrderAmount}` : "—"}
                  {c.usageLimit ? <div className="text-xs text-slate-400">limit {c.usageLimit}</div> : null}
                </td>
                <td className="px-4 py-3 text-slate-500">{c.expiresAt ? fmtDate(c.expiresAt) : "Never"}</td>
                <td className="px-4 py-3">{c.usages}</td>
                <td className="px-4 py-3"><Badge tone={c.active ? "green" : "slate"}>{c.active ? "Active" : "Inactive"}</Badge></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <ButtonGhost onClick={() => openEdit(c)}>Edit</ButtonGhost>
                    <ButtonGhost onClick={() => toggle(c)}>{c.active ? "Disable" : "Enable"}</ButtonGhost>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={20} total={total} onChange={setPage} />
        </>
      )}

      <Modal open={!!modal} title={modal?.editing ? `Edit: ${modal.editing.code}` : "Add Coupon"} onClose={() => setModal(null)}>
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" required><Input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="SAVE10" /></Field>
            <Field label="Type" required>
              <Select value={form.type} onChange={(e) => set("type", e.target.value)}>
                <option value="PERCENT">Percent</option>
                <option value="FIXED">Fixed amount</option>
                <option value="FREE_SHIPPING">Free shipping</option>
              </Select>
            </Field>
            <Field label="Value" required><Input type="number" min="0" value={form.value} onChange={(e) => set("value", e.target.value)} /></Field>
            <Field label="Min order amount"><Input type="number" min="0" value={form.minOrderAmount} onChange={(e) => set("minOrderAmount", e.target.value)} /></Field>
            <Field label="Max discount"><Input type="number" min="0" value={form.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} /></Field>
            <Field label="Usage limit"><Input type="number" min="0" value={form.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} /></Field>
            <Field label="Per-customer limit"><Input type="number" min="0" value={form.perCustomerLimit} onChange={(e) => set("perCustomerLimit", e.target.value)} /></Field>
            <Field label="Active">
              <Select value={form.active} onChange={(e) => set("active", e.target.value)}>
                <option value="true">Yes</option><option value="false">No</option>
              </Select>
            </Field>
            <Field label="Product restriction">
              <Select value={form.productId} onChange={(e) => set("productId", e.target.value)}>
                <option value="">All products</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Category restriction">
              <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Starts at"><Input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Field>
            <Field label="Expires at"><Input type="datetime-local" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} /></Field>
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