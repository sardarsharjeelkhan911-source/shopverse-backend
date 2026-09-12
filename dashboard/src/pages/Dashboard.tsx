import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Card, Spinner, Empty, Badge, fmtMoney } from "../components/ui";

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

interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  productName: string;
  _sum: { quantity: number; total: number };
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Summary>("/api/admin/reports/summary"),
      api.get<{ series: RevenuePoint[] }>("/api/admin/reports/revenue", { from: new Date(Date.now() - 30 * 864e5).toISOString() }),
      api.get<{ items: TopProduct[] }>("/api/admin/reports/top-products", { limit: 5 }),
    ])
      .then(([s, r, t]) => {
        setSummary(s);
        setRevenue(r.series);
        setTopProducts(t.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Report load ho raha hai..." />;

  const cards = [
    { label: "Today's Revenue", value: summary ? fmtMoney(summary.todayRevenue) : "—", sub: summary ? `${summary.todayOrders} orders` : "" },
    { label: "Period Revenue", value: summary ? fmtMoney(summary.periodRevenue) : "—", sub: summary ? `${summary.periodOrders} orders` : "" },
    { label: "Total Orders", value: summary ? String(summary.totalOrders) : "—", sub: "All time" },
    { label: "Products", value: summary ? String(summary.totalProducts) : "—", sub: summary ? `${summary.lowStockProducts} low stock` : "" },
    { label: "Customers", value: summary ? String(summary.totalCustomers) : "—", sub: "Registered" },
  ];

  const maxRevenue = Math.max(...revenue.map((r) => r.revenue), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="text-xs font-medium text-slate-500">{c.label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-800">{c.value}</div>
            <div className="mt-0.5 text-xs text-slate-400">{c.sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-slate-700">Revenue (30 days)</h2>
          {revenue.length === 0 ? (
            <Empty text="Is period mein koi order nahi." />
          ) : (
            <div className="flex h-48 items-end gap-1">
              {revenue.map((r) => (
                <div key={r.date} className="group relative flex-1">
                  <div
                    className="w-full rounded-t bg-indigo-500 transition-colors hover:bg-indigo-600"
                    style={{ height: `${Math.max(3, (r.revenue / maxRevenue) * 160)}px` }}
                    title={`${r.date}: ${fmtMoney(r.revenue)} (${r.orders} orders)`}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 font-semibold text-slate-700">Top Products</h2>
          {topProducts.length === 0 ? (
            <Empty text="Koi sales data nahi." />
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-700">{p.productName}</div>
                    <div className="text-xs text-slate-400">{p._sum.quantity} sold</div>
                  </div>
                  <Badge tone="sky">{fmtMoney(Number(p._sum.total))}</Badge>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {summary && summary.lowStockProducts > 0 && <Badge tone="rose">{summary.lowStockProducts} low-stock products</Badge>}
            <Badge tone="green">API live</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}