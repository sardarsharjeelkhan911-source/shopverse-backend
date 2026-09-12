import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge, Button, ButtonGhost, Card, Empty, Field, Input, Modal, Pagination, Select, Spinner, Table, fmtDate, fmtMoney } from "../components/ui";

interface Movement {
  id: string;
  productId: string;
  product: { id: string; name: string; sku: string } | null;
  type: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  cost: number | null;
  reason: string | null;
  createdAt: string;
}

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
}

const TONE: Record<string, "green" | "rose" | "sky" | "amber"> = {
  IN: "green",
  OUT: "rose",
  ADJUST: "amber",
  SALE: "sky",
  PURCHASE: "green",
  RELEASE: "amber",
};

export default function Inventory() {
  const [items, setItems] = useState<Movement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [low, setLow] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; stock: number }[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ productId: "", type: "IN", quantity: "1", reason: "", cost: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ items: Movement[]; total: number }>("/api/admin/inventory/movements", {
        page,
        pageSize: 20,
        type: type || undefined,
      });
      setItems(d.items);
      setTotal(d.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, type]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get<{ items: LowStockItem[] }>("/api/admin/inventory/low-stock", { threshold: 10 }).then((d) => setLow(d.items)).catch(() => {});
  }, []);

  async function adjust() {
    setSaving(true);
    setError("");
    try {
      await api.post("/api/admin/inventory/adjust", {
        productId: form.productId,
        type: form.type,
        quantity: Number(form.quantity) || 0,
        reason: form.reason || undefined,
        cost: form.cost === "" ? undefined : Number(form.cost),
      });
      setAdjustOpen(false);
      setForm({ productId: "", type: "IN", quantity: "1", reason: "", cost: "" });
      load();
      api.get<{ items: LowStockItem[] }>("/api/admin/inventory/low-stock", { threshold: 10 }).then((d) => setLow(d.items)).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjust fail");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Inventory</h1>
        <Button onClick={() => { setError(""); setAdjustOpen(true); api.get<{ items: { id: string; name: string; sku: string; stock: number }[] }>("/api/admin/products", { pageSize: 100, includeInactive: "true" }).then((d) => setProducts(d.items)).catch(() => {}); }}>+ Adjust Stock</Button>
      </div>

      {low.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <h2 className="mb-2 text-sm font-semibold text-amber-800">Low stock alert ({low.length})</h2>
          <div className="flex flex-wrap gap-2">
            {low.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs shadow-sm">
                <span className="font-semibold">{p.name}</span>
                <Badge tone="rose">{p.stock} left</Badge>
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="flex gap-3">
        <Select className="max-w-44" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          {["IN", "OUT", "ADJUST", "SALE", "PURCHASE", "RELEASE"].map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="Koi movement nahi." />
      ) : (
        <>
          <Table headers={["Product", "Type", "Qty", "Stock", "Cost", "Reason", "Date"]}>
            {items.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{m.product?.name ?? "—"}</td>
                <td className="px-4 py-3"><Badge tone={TONE[m.type] ?? "slate"}>{m.type}</Badge></td>
                <td className="px-4 py-3 text-slate-700">{m.quantity}</td>
                <td className="px-4 py-3">{m.stockBefore} → <b>{m.stockAfter}</b></td>
                <td className="px-4 py-3 text-slate-600">{m.cost == null ? "—" : fmtMoney(m.cost)}</td>
                <td className="px-4 py-3 text-slate-500">{m.reason ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(m.createdAt)}</td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={20} total={total} onChange={setPage} />
        </>
      )}

      <Modal open={adjustOpen} title="Adjust Stock" onClose={() => setAdjustOpen(false)}>
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
          <Field label="Product" required>
            <Select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku}) — stock {p.stock}</option>
              ))}
            </Select>
          </Field>
          <Field label="Type" required>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="IN">IN (add stock)</option>
              <option value="OUT">OUT (remove stock)</option>
              <option value="ADJUST">ADJUST (set to qty)</option>
              <option value="PURCHASE">PURCHASE</option>
              <option value="RELEASE">RELEASE (restock)</option>
            </Select>
          </Field>
          <Field label="Quantity" required><Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
          <Field label="Reason"><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          <Field label="Cost per unit (PKR, optional)"><Input type="number" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <ButtonGhost onClick={() => setAdjustOpen(false)}>Cancel</ButtonGhost>
            <Button onClick={adjust} disabled={saving || !form.productId}>{saving ? "Saving..." : "Adjust"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}