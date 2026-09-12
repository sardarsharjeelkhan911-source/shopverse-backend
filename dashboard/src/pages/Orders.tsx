import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge, Button, ButtonGhost, Card, Empty, Field, Input, Modal, Pagination, Select, Spinner, Table, fmtDate, fmtMoney } from "../components/ui";

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const PAYMENT_STATUSES = ["PENDING", "PARTIAL", "PAID", "REFUNDED", "FAILED"];

const statusTone = (s: string) =>
  s === "DELIVERED" || s === "PAID" ? "green" : s === "CANCELLED" || s === "FAILED" ? "rose" : s === "PENDING" || s === "PARTIAL" ? "amber" : "sky";

interface OrderItem {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Payment {
  id: string;
  method: string;
  amount: number;
  reference: string | null;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  orderStatus: string;
  paymentStatus: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  itemCount: number;
  paymentMethod: string;
  createdAt: string;
  address?: { fullName: string; phone: string; line1: string; line2?: string | null; city: string; state?: string | null; postalCode?: string | null };
  items?: OrderItem[];
  payments?: Payment[];
  customer?: { id: string; name: string; email: string } | null;
}

export default function Orders() {
  const [items, setItems] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [payStatus, setPayStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState("");
  const [payForm, setPayForm] = useState({ method: "COD", amount: "", reference: "", status: "PAID" });
  const [statusError, setStatusError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ items: Order[]; total: number }>("/api/admin/orders", {
        page,
        pageSize: 20,
        search,
        orderStatus: status || undefined,
        paymentStatus: payStatus || undefined,
      });
      setItems(d.items);
      setTotal(d.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, status, payStatus, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(o: Order) {
    setSelected(o);
    setDetailLoading(true);
    try {
      const d = await api.get<Order>(`/api/admin/orders/${o.id}`);
      setSelected(d);
    } catch {
      /* keep list version */
    } finally {
      setDetailLoading(false);
    }
  }

  async function updateStatus(o: Order, orderStatus: string) {
    setBusy(true);
    setStatusError("");
    try {
      const d = await api.patch<Order>(`/api/admin/orders/${o.id}/status`, { orderStatus });
      setSelected(d);
      load();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Status update fail");
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment(o: Order) {
    setBusy(true);
    setPayError("");
    try {
      await api.post(`/api/admin/orders/${o.id}/payments`, {
        method: payForm.method,
        amount: Number(payForm.amount) || 0,
        reference: payForm.reference || undefined,
        status: payForm.status,
      });
      setPayOpen(false);
      setPayForm({ method: "COD", amount: "", reference: "", status: "PAID" });
      openDetail(o);
      load();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment record fail");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Orders</h1>

      <div className="flex flex-wrap gap-3">
        <Input className="max-w-56" placeholder="Search # / name / phone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Select className="max-w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select className="max-w-44" value={payStatus} onChange={(e) => { setPayStatus(e.target.value); setPage(1); }}>
          <option value="">All payments</option>
          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="Koi order nahi mila." />
      ) : (
        <>
          <Table headers={["Order #", "Customer", "Total", "Status", "Payment", "Date", ""]}>
            {items.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3 font-semibold text-indigo-600">{o.orderNumber}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{o.customerName}</div>
                  <div className="text-xs text-slate-400">{o.customerPhone}</div>
                </td>
                <td className="px-4 py-3 font-medium">{fmtMoney(o.grandTotal)}</td>
                <td className="px-4 py-3"><Badge tone={statusTone(o.orderStatus)}>{o.orderStatus}</Badge></td>
                <td className="px-4 py-3"><Badge tone={statusTone(o.paymentStatus)}>{o.paymentStatus}</Badge></td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(o.createdAt)}</td>
                <td className="px-4 py-3"><ButtonGhost onClick={() => openDetail(o)}>View</ButtonGhost></td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={20} total={total} onChange={setPage} />
        </>
      )}

      <Modal open={!!selected} title={selected ? `Order ${selected.orderNumber}` : ""} onClose={() => setSelected(null)} wide>
        {selected && (detailLoading ? (
          <Spinner label="Order load ho raha hai..." />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone={statusTone(selected.orderStatus)}>{selected.orderStatus}</Badge>
                <Badge tone={statusTone(selected.paymentStatus)}>{selected.paymentStatus}</Badge>
                <Badge tone="slate">{selected.paymentMethod}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {ORDER_STATUSES.filter((s) => s !== selected.orderStatus).map((s) => (
                  <ButtonGhost key={s} disabled={busy} onClick={() => updateStatus(selected, s)}>{s}</ButtonGhost>
                ))}
              </div>
            </div>
            {statusError && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{statusError}</div>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-600">Customer</h3>
                <div className="text-sm text-slate-700">{selected.customerName}</div>
                <div className="text-sm text-slate-500">{selected.customerEmail}</div>
                <div className="text-sm text-slate-500">{selected.customerPhone}</div>
              </Card>
              <Card className="p-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-600">Shipping Address</h3>
                {selected.address ? (
                  <div className="text-sm text-slate-700">
                    {selected.address.line1}
                    {selected.address.line2 ? `, ${selected.address.line2}` : ""}
                    <br />{selected.address.city}{selected.address.state ? `, ${selected.address.state}` : ""} {selected.address.postalCode ?? ""}
                  </div>
                ) : <div className="text-sm text-slate-400">—</div>}
              </Card>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Items</h3>
              <Table headers={["Product", "Variant", "Qty", "Unit", "Total"]}>
                {(selected.items ?? []).map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-2 font-medium">{it.productName}</td>
                    <td className="px-4 py-2">{it.variantName ?? "—"}</td>
                    <td className="px-4 py-2">{it.quantity}</td>
                    <td className="px-4 py-2">{fmtMoney(it.unitPrice)}</td>
                    <td className="px-4 py-2">{fmtMoney(it.total)}</td>
                  </tr>
                ))}
              </Table>
            </div>

            <div className="flex flex-wrap justify-end gap-6 text-sm">
              <div>Subtotal: <b>{fmtMoney(selected.subtotal)}</b></div>
              <div>Discount: <b className="text-rose-600">−{fmtMoney(selected.discountTotal)}</b></div>
              <div>Tax: <b>{fmtMoney(selected.taxTotal)}</b></div>
              <div className="text-base">Grand Total: <b className="text-indigo-700">{fmtMoney(selected.grandTotal)}</b></div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-600">Payments</h3>
                <Button onClick={() => setPayOpen(true)}>+ Record Payment</Button>
              </div>
              {(selected.payments ?? []).length === 0 ? (
                <Empty text="Koi payment record nahi." />
              ) : (
                <Table headers={["Method", "Amount", "Reference", "Status", "Paid At"]}>
                  {(selected.payments ?? []).map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2">{p.method}</td>
                      <td className="px-4 py-2 font-medium">{fmtMoney(p.amount)}</td>
                      <td className="px-4 py-2">{p.reference ?? "—"}</td>
                      <td className="px-4 py-2"><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                      <td className="px-4 py-2">{p.paidAt ? fmtDate(p.paidAt) : fmtDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          </div>
        ))}
      </Modal>

      <Modal open={payOpen} title="Record Payment" onClose={() => setPayOpen(false)}>
        <div className="space-y-4">
          {payError && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{payError}</div>}
          <Field label="Method" required>
            <Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              {["COD", "CARD", "BANK_TRANSFER", "JAZZCASH", "EASYPASA", "CASH"].map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Status" required>
            <Select value={payForm.status} onChange={(e) => setPayForm({ ...payForm, status: e.target.value })}>
              {["PAID", "PENDING", "FAILED", "REFUNDED"].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Amount (PKR)" required>
            <Input type="number" min="0" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
          </Field>
          <Field label="Reference">
            <Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="e.g. transaction id" />
          </Field>
          <div className="flex justify-end gap-2">
            <ButtonGhost onClick={() => setPayOpen(false)}>Cancel</ButtonGhost>
            <Button onClick={() => selected && recordPayment(selected)} disabled={busy}>{busy ? "Saving..." : "Record"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}