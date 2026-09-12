import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge, ButtonGhost, Card, Empty, Input, Modal, Pagination, Select, Spinner, Table, fmtDate, fmtMoney } from "../components/ui";

interface RecentOrder {
  id: string;
  orderNumber: string;
  grandTotal: number;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE" | "BLOCKED";
  totalSpent: number;
  orderCount: number;
  createdAt: string;
  lastOrderAt: string | null;
}

interface CustomerDetail extends Customer {
  addresses: { id: string; line1: string; line2?: string | null; city: string; isDefault: boolean }[];
  recentOrders: RecentOrder[];
}

const statusTone = (s: string) => (s === "ACTIVE" ? "green" : s === "BLOCKED" ? "rose" : "slate");

export default function Customers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ items: Customer[]; total: number }>("/api/admin/customers", {
        page,
        pageSize: 20,
        search,
        status: status || undefined,
      });
      setItems(d.items);
      setTotal(d.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(c: Customer) {
    setDetailLoading(true);
    setDetail(c as CustomerDetail);
    try {
      const d = await api.get<CustomerDetail>(`/api/admin/customers/${c.id}`);
      setDetail(d);
    } catch {
      /* keep */
    } finally {
      setDetailLoading(false);
    }
  }

  async function changeStatus(c: Customer, status: string) {
    try {
      await api.patch(`/api/admin/customers/${c.id}/status`, { status });
      load();
      if (detail?.id === c.id) openDetail(c);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Customers</h1>

      <div className="flex flex-wrap gap-3">
        <Input className="max-w-64" placeholder="Search name / email / phone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Select className="max-w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLOCKED">Blocked</option>
        </Select>
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="Koi customer nahi." />
      ) : (
        <>
          <Table headers={["Name", "Email / Phone", "Orders", "Spent", "Status", "Joined", ""]}>
            {items.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-3">
                  <div className="text-slate-600">{c.email}</div>
                  <div className="text-xs text-slate-400">{c.phone ?? "—"}</div>
                </td>
                <td className="px-4 py-3">{c.orderCount}</td>
                <td className="px-4 py-3 font-medium">{fmtMoney(c.totalSpent)}</td>
                <td className="px-4 py-3"><Badge tone={statusTone(c.status)}>{c.status}</Badge></td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(c.createdAt)}</td>
                <td className="px-4 py-3"><ButtonGhost onClick={() => openDetail(c)}>View</ButtonGhost></td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={20} total={total} onChange={setPage} />
        </>
      )}

      <Modal open={!!detail} title={detail ? `Customer: ${detail.name}` : ""} onClose={() => setDetail(null)} wide>
        {detail && (detailLoading ? (
          <Spinner label="Detail load ho raha hai..." />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Badge tone={statusTone(detail.status)}>{detail.status}</Badge>
                <Badge tone="slate">{detail.orderCount} orders</Badge>
              </div>
              <div className="flex gap-2">
                {detail.status !== "ACTIVE" && <ButtonGhost onClick={() => changeStatus(detail, "ACTIVE")}>Activate</ButtonGhost>}
                {detail.status !== "BLOCKED" && <ButtonGhost onClick={() => changeStatus(detail, "BLOCKED")}>Block</ButtonGhost>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-4">
                <div className="text-xs text-slate-500">Total spent</div>
                <div className="mt-1 text-xl font-bold text-slate-800">{fmtMoney(detail.totalSpent)}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-slate-500">Last order</div>
                <div className="mt-1 text-sm font-medium text-slate-700">{detail.lastOrderAt ? fmtDate(detail.lastOrderAt) : "—"}</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-slate-500">Phone</div>
                <div className="mt-1 text-sm font-medium text-slate-700">{detail.phone ?? "—"}</div>
              </Card>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Addresses</h3>
              {detail.addresses.length === 0 ? (
                <Empty text="Koi address nahi." />
              ) : (
                <Table headers={["Address", "City", "Default"]}>
                  {detail.addresses.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</td>
                      <td className="px-4 py-2">{a.city}</td>
                      <td className="px-4 py-2">{a.isDefault ? <Badge tone="indigo">Default</Badge> : "—"}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-600">Recent orders</h3>
              {detail.recentOrders.length === 0 ? (
                <Empty text="Koi order nahi." />
              ) : (
                <Table headers={["#", "Total", "Status", "Payment", "Date"]}>
                  {detail.recentOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-2 font-semibold text-indigo-600">{o.orderNumber}</td>
                      <td className="px-4 py-2">{fmtMoney(o.grandTotal)}</td>
                      <td className="px-4 py-2"><Badge tone={statusTone(o.orderStatus)}>{o.orderStatus}</Badge></td>
                      <td className="px-4 py-2"><Badge tone={statusTone(o.paymentStatus)}>{o.paymentStatus}</Badge></td>
                      <td className="px-4 py-2">{fmtDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          </div>
        ))}
      </Modal>
    </div>
  );
}