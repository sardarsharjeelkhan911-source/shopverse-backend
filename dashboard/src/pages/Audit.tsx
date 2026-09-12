import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { Badge, Empty, Input, Pagination, Select, Spinner, Table, fmtDate } from "../components/ui";

interface Log {
  id: string;
  adminId: string | null;
  admin: { id: string; name: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  ip: string | null;
  createdAt: string;
}

const actionTone = (a: string) =>
  a === "CREATE" ? "green" : a === "DELETE" || a === "BLOCK" ? "rose" : a === "UPDATE" || a === "INVENTORY" ? "amber" : "sky";

export default function Audit() {
  const [items, setItems] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get<{ items: Log[]; total: number }>("/api/admin/audit-logs", {
        page,
        pageSize: 25,
        action: action || undefined,
        entityType: entity || undefined,
      });
      setItems(d.items);
      setTotal(d.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, action, entity]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Audit Logs</h1>

      <div className="flex flex-wrap gap-3">
        <Select className="max-w-40" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">All actions</option>
          {["CREATE", "UPDATE", "DELETE", "READ", "INVENTORY", "LOGIN", "LOGOUT"].map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
        <Input className="max-w-52" placeholder="Entity type (Product, Order...)" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} />
      </div>

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Empty text="Koi log nahi." />
      ) : (
        <>
          <Table headers={["When", "Admin", "Action", "Entity", "Details", "IP"]}>
            {items.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(l.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{l.admin?.name ?? "System"}</div>
                  <div className="text-xs text-slate-400">{l.admin?.email}</div>
                </td>
                <td className="px-4 py-3"><Badge tone={actionTone(l.action)}>{l.action}</Badge></td>
                <td className="px-4 py-3 text-slate-600">{l.entityType}</td>
                <td className="max-w-md px-4 py-3 truncate text-slate-500" title={l.details ?? ""}>{l.details ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{l.ip ?? "—"}</td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={25} total={total} onChange={setPage} />
        </>
      )}
    </div>
  );
}