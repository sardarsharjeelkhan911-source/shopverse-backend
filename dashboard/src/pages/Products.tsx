import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button, ButtonGhost, ButtonDanger, Badge, Empty, Field, Input, Modal, Pagination, Select, Spinner, Table, Textarea, cx, fmtMoney } from "../components/ui";

interface Category {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  buyingPrice: number;
  sellingPrice: number;
  salePrice: number | null;
  stock: number;
  minStock: number;
  unit: string;
  active: boolean;
  featured: boolean;
  taxExempt: boolean;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  brandId: string | null;
  brand: { id: string; name: string } | null;
  images: { id: string; url: string; sortOrder: number }[];
  description?: string | null;
  shortDescription?: string | null;
  tags?: string | null;
}

const emptyForm = {
  name: "",
  sku: "",
  sellingPrice: "",
  buyingPrice: "0",
  salePrice: "",
  stock: "0",
  minStock: "5",
  unit: "piece",
  categoryId: "",
  brandId: "",
  description: "",
  shortDescription: "",
  featured: "false",
  active: "true",
  taxExempt: "false",
  imageUrls: [] as string[],
  mainImageIndex: "0",
};

export default function Products() {
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ items: Product[]; total: number }>("/api/admin/products", {
        page,
        pageSize: 20,
        search,
        categoryId: categoryId || undefined,
        includeInactive: "true",
      });
      setItems(d.items);
      setTotal(d.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get<{ items: Category[] }>("/api/admin/categories", { pageSize: 100, includeInactive: "true" }).then((d) => setCategories(d.items)).catch(() => {});
    api.get<{ items: Brand[] }>("/api/admin/brands", { pageSize: 100, includeInactive: "true" }).then((d) => setBrands(d.items)).catch(() => {});
  }, []);

  function startCreate() {
    setForm(emptyForm);
    setError("");
    setCreating(true);
  }

  function startEdit(p: Product) {
    setForm({
      name: p.name,
      sku: p.sku,
      sellingPrice: String(p.sellingPrice),
      buyingPrice: String(p.buyingPrice),
      salePrice: p.salePrice == null ? "" : String(p.salePrice),
      stock: String(p.stock),
      minStock: String(p.minStock),
      unit: p.unit,
      categoryId: p.categoryId ?? "",
      brandId: p.brandId ?? "",
      description: p.description ?? "",
      shortDescription: p.shortDescription ?? "",
      featured: String(p.featured),
      active: String(p.active),
      taxExempt: String(p.taxExempt),
      imageUrls: p.images.map((i) => i.url),
      mainImageIndex: p.images.length ? "0" : "0",
    });
    setError("");
    setEditing(p);
  }

  function set<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    const payload = {
      name: form.name,
      sku: form.sku,
      sellingPrice: Number(form.sellingPrice) || 0,
      buyingPrice: Number(form.buyingPrice) || 0,
      salePrice: form.salePrice === "" ? null : Number(form.salePrice),
      stock: Number(form.stock) || 0,
      minStock: Number(form.minStock) || 0,
      unit: form.unit,
      categoryId: form.categoryId || null,
      brandId: form.brandId || null,
      description: form.description || null,
      shortDescription: form.shortDescription || null,
      featured: form.featured === "true",
      active: form.active === "true",
      taxExempt: form.taxExempt === "true",
      imageUrls: form.imageUrls,
      mainImageIndex: Number(form.mainImageIndex) || 0,
    };
    try {
      if (editing) await api.put(`/api/admin/products/${editing.id}`, payload);
      else await api.post("/api/admin/products", payload);
      setCreating(false);
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product save fail");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Product) {
    await api.put(`/api/admin/products/${p.id}`, { active: !p.active });
    load();
  }

  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"? (Soft delete)`)) return;
    await api.del(`/api/admin/products/${p.id}`);
    load();
  }

  const low = (p: Product) => p.stock <= p.minStock;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Products</h1>
        <Button onClick={startCreate}>+ Add Product</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input className="max-w-xs" placeholder="Search by name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Select className="max-w-56" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="Koi product nahi mila." />
      ) : (
        <>
          <Table
            headers={["Product", "SKU", "Category", "Prices", "Stock", "Status", "Actions"]}
          >
            {items.map((p) => (
              <tr key={p.id} className={cx(!p.active && "opacity-60")}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.slug}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{p.sku}</td>
                <td className="px-4 py-3 text-slate-600">{p.category?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{fmtMoney(p.sellingPrice)}</div>
                  {p.salePrice != null && p.salePrice < p.sellingPrice && (
                    <div className="text-xs text-emerald-600">{fmtMoney(p.salePrice)}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={low(p) ? "rose" : p.stock === 0 ? "amber" : "green"}>{p.stock} {p.unit}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={p.active ? "green" : "slate"}>{p.active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <ButtonGhost onClick={() => startEdit(p)}>Edit</ButtonGhost>
                    <ButtonGhost onClick={() => toggleActive(p)}>{p.active ? "Deactivate" : "Activate"}</ButtonGhost>
                    <ButtonDanger onClick={() => remove(p)}>Delete</ButtonDanger>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={20} total={total} onChange={setPage} />
        </>
      )}

      <Modal open={creating || !!editing} title={editing ? `Edit: ${editing.name}` : "Add Product"} onClose={() => { setCreating(false); setEditing(null); }} wide>
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="SKU" required><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
            <Field label="Category">
              <Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Brand">
              <Select value={form.brandId} onChange={(e) => set("brandId", e.target.value)}>
                <option value="">None</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Selling Price (PKR)" required><Input type="number" min="0" value={form.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} /></Field>
            <Field label="Buying Price (PKR)"><Input type="number" min="0" value={form.buyingPrice} onChange={(e) => set("buyingPrice", e.target.value)} /></Field>
            <Field label="Sale Price (PKR)"><Input type="number" min="0" value={form.salePrice} placeholder="Optional" onChange={(e) => set("salePrice", e.target.value)} /></Field>
            <Field label="Unit">
              <Select value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                {["piece", "box", "pack", "kg", "g", "liter", "ml", "meter", "set"].map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </Field>
            <Field label="Stock"><Input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} /></Field>
            <Field label="Min Stock"><Input type="number" min="0" value={form.minStock} onChange={(e) => set("minStock", e.target.value)} /></Field>
            <Field label="Featured">
              <Select value={form.featured} onChange={(e) => set("featured", e.target.value)}>
                <option value="false">No</option><option value="true">Yes</option>
              </Select>
            </Field>
            <Field label="Active">
              <Select value={form.active} onChange={(e) => set("active", e.target.value)}>
                <option value="true">Yes</option><option value="false">No</option>
              </Select>
            </Field>
            <Field label="Tax Exempt">
              <Select value={form.taxExempt} onChange={(e) => set("taxExempt", e.target.value)}>
                <option value="false">No</option><option value="true">Yes</option>
              </Select>
            </Field>
          </div>
          <Field label="Short Description"><Input value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} /></Field>
          <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <ButtonGhost onClick={() => { setCreating(false); setEditing(null); }}>Cancel</ButtonGhost>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}