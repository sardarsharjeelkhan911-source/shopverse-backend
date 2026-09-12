import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge, Card, Empty, Spinner, Table, fmtMoney } from "../components/ui";

interface Summary {
  periodRevenue: number;
  periodOrders: number;
  todayRevenue: number;
  todayOrders: number;
  totalOrders: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockProducts: number;
}

interface RevenuePoint { date: string; revenue: number; orders: number }

interface TopProduct { productId: string; productName: string; _sum: { quantity: number; total: number }; _count: number }

interface TopCategory { name: string; qty: number; revenue: number }

interface StockValue { costValue: number; retailValue: number; potentialProfit: number; productCount: number }

export default function Reports() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topCats, setTopCats] = useState<TopCategory[]>([]);
  const [stockValue, setStockValue] = useState<StockValue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const from = new Date(Date.now() - 90 * 864e5).toISOString();
    Promise.all([
      api.get<Summary>("/api/admin/reports/summary", { from }),
      api.get<{ series: RevenuePoint[] }>("/api/admin/reports/revenue", { from }),
      api.get<{ items: TopProduct[] }>("/api/admin/reports/top-products", { from, limit: 10 }),
      api.get<{ items: TopCategory[] }>("/api/admin/reports/top-categories", { from }),
      api.get<StockValue>("/api/admin/reports/stock-value"),
    ])
      .then(([s, r, tp, tc, sv]) => {
        setSummary(s);
        setRevenue(r.series);
        setTopProducts(tp.items);
        setTopCats(tc.items);
        setStockValue(sv);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Reports load ho rahe hain..." />;

  const maxRevenue = Math.max(...revenue.map((r) => r.revenue), 1);
  const maxQty = Math.max(...topProducts.map((p) => p._sum.quantity), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Reports</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { l: "Today Revenue", v: summary ? fmtMoney(summary.todayRevenue) : "—" },
          { l: "90-day Revenue", v: summary ? fmtMoney(summary.periodRevenue) : "—" },
          { l: "Orders", v: summary ? String(summary.totalOrders) : "—" },
          { l: "Customers", v: summary ? String(summary.totalCustomers) : "—" },
          { l: "Low stock", v: summary ? String(summary.lowStockProducts) : "—" },
        ].map((c) => (
          <Card key={c.l} className="p-4">
            <div className="text-xs font-medium text-slate-500">{c.l}</div>
            <div className="mt-1 text-xl font-bold text-slate-800">{c.v}</div>
          </Card>
        ))}
      </div>

      {stockValue && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs font-medium text-slate-500">Stock value (cost)</div>
            <div className="mt-1 text-2xl font-bold text-slate-800">{fmtMoney(stockValue.costValue)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium text-slate-500">Stock value (retail)</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{fmtMoney(stockValue.retailValue)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium text-slate-500">Potential profit</div>
            <div className="mt-1 text-2xl font-bold text-indigo-700">{fmtMoney(stockValue.potentialProfit)}</div>
            <div className="text-xs text-slate-400">{stockValue.productCount} products</div>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-slate-700">Revenue (daily, 90 days)</h2>
          {revenue.length === 0 ? (
            <Empty text="Koi revenue data nahi." />
          ) : (
            <div>
              <div className="flex h-48 items-end gap-0.5">
                {revenue.map((r) => (
                  <div key={r.date} className="group relative flex-1">
                    <div className="w-full rounded-t bg-indigo-500 hover:bg-indigo-600" style={{ height: `${Math.max(3, (r.revenue / maxRevenue) * 160)}px` }} title={`${r.date}: ${fmtMoney(r.revenue)} (${r.orders} orders)`} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-400">
                <span>{revenue[0]?.date}</span>
                <span>{revenue[revenue.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold text-slate-700">Top Categories</h2>
          {topCats.length === 0 ? (
            <Empty text="Koi category sales nahi." />
          ) : (
            <div className="space-y-2">
              {topCats.map((c) => (
                <div key={c.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">{c.name}</span>
                  <span className="text-sm text-slate-500">{c.qty} pcs · <b>{fmtMoney(c.revenue)}</b></span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 font-semibold text-slate-700">Top Products (by quantity)</h2>
        {topProducts.length === 0 ? (
          <Empty text="Koi product sales nahi." />
        ) : (
          <Table headers={["Product", "Qty share", "Qty", "Revenue", "Orders"]}>
            {topProducts.map((p) => (
              <tr key={p.productId}>
                <td className="px-4 py-3 font-medium text-slate-800">{p.productName}</td>
                <td className="w-40 px-4 py-3">
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(p._sum.quantity / maxQty) * 100}%` }} />
                  </div>
                </td>
                <td className="px-4 py-3">{p._sum.quantity}</td>
                <td className="px-4 py-3 font-medium">{fmtMoney(Number(p._sum.total))}</td>
                <td className="px-4 py-3"><Badge tone="sky">{p._count}</Badge></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}