import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Badge, Button, ButtonGhost, Empty, Field, Input, Modal, Pagination, Select, Spinner, Table, cx, fmtDate } from "../components/ui";

interface AdminRec {
  id: string;
  name: string;
  email: string;
  role: { id: string; name: string } | null;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  adminCount: number;
  permissionKeys: string[];
}

interface Permission {
  id: string;
  key: string;
  description: string;
}

export default function Admins() {
  const { admin: me } = useAuth();
  const [tab, setTab] = useState<"admins" | "roles">("admins");
  const [admins, setAdmins] = useState<AdminRec[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const isSuper = me?.role === "SUPER_ADMIN";

  const [adminModal, setAdminModal] = useState<{ editing: AdminRec | null } | null>(null);
  const [roleModal, setRoleModal] = useState<{ editing: Role | null } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: "", email: "", password: "", roleId: "", active: "true" });
  const [roleForm, setRoleForm] = useState({ name: "", description: "", checked: new Set<string>() });

  const loadAdmins = useCallback(async () => {
    const d = await api.get<{ items: AdminRec[]; total: number }>("/api/admin/admins", { page, pageSize: 20 });
    setAdmins(d.items);
    setTotal(d.total);
  }, [page]);

  const loadRoles = useCallback(async () => {
    const [r, p] = await Promise.all([api.get<{ items: Role[] }>("/api/admin/admins/roles"), api.get<{ items: Permission[] }>("/api/admin/admins/permissions")]);
    setRoles(r.items);
    setPermissions(p.items);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAdmins(), loadRoles()]).catch(() => {}).finally(() => setLoading(false));
  }, [loadAdmins, loadRoles]);

  function openNewAdmin() {
    setAdminForm({ name: "", email: "", password: "", roleId: roles.find((r) => r.name === "STAFF")?.id ?? "", active: "true" });
    setError("");
    setAdminModal({ editing: null });
  }

  function openEditAdmin(a: AdminRec) {
    setAdminForm({ name: a.name, email: a.email, password: "", roleId: a.role?.id ?? "", active: String(a.active) });
    setError("");
    setAdminModal({ editing: a });
  }

  async function saveAdmin() {
    setBusy(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        name: adminForm.name,
        email: adminForm.email,
        roleId: adminForm.roleId || undefined,
        active: adminForm.active === "true",
      };
      if (adminModal?.editing) {
        await api.put(`/api/admin/admins/${adminModal.editing.id}`, payload);
      } else {
        await api.post("/api/admin/admins", { ...payload, password: adminForm.password });
      }
      setAdminModal(null);
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save fail");
    } finally {
      setBusy(false);
    }
  }

  function openNewRole() {
    setRoleForm({ name: "", description: "", checked: new Set() });
    setError("");
    setRoleModal({ editing: null });
  }

  function openEditRole(r: Role) {
    setRoleForm({ name: r.name, description: r.description ?? "", checked: new Set(r.permissionKeys) });
    setError("");
    setRoleModal({ editing: r });
  }

  function togglePerm(key: string) {
    setRoleForm((f) => {
      const c = new Set(f.checked);
      if (c.has(key)) c.delete(key);
      else c.add(key);
      return { ...f, checked: c };
    });
  }

  async function saveRole() {
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: roleForm.name,
        description: roleForm.description || null,
        permissionKeys: Array.from(roleForm.checked),
      };
      if (roleModal?.editing) await api.put(`/api/admin/admins/roles/${roleModal.editing.id}`, payload);
      else await api.post("/api/admin/admins/roles", payload);
      setRoleModal(null);
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save fail");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAdmin(a: AdminRec) {
    if (a.id === me?.id) return alert("You cannot disable your own account");
    await api.put(`/api/admin/admins/${a.id}`, { active: !a.active });
    await loadAdmins();
  }

  if (loading) return <Spinner label="Loading..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Admins & Roles</h1>
        {isSuper && (
          <Button onClick={() => (tab === "admins" ? openNewAdmin() : openNewRole())}>
            + {tab === "admins" ? "Add Admin" : "Add Role"}
          </Button>
        )}
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {(["admins", "roles"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cx("rounded-md px-4 py-1.5 text-sm font-medium capitalize", tab === t ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
            {t}
          </button>
        ))}
      </div>

      {tab === "admins" ? (
        <>
          {admins.length === 0 ? (
            <Empty text="Koi admin nahi." />
          ) : (
            <Table headers={["Name", "Email", "Role", "Status", "Last login", "Joined", "Actions"]}>
              {admins.map((a) => (
                <tr key={a.id} className={cx(!a.active && "opacity-60")}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{a.name}</div>
                    {a.id === me?.id && <span className="text-xs text-indigo-500">You</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.email}</td>
                  <td className="px-4 py-3"><Badge tone={a.role?.name === "SUPER_ADMIN" ? "indigo" : "sky"}>{a.role?.name ?? "—"}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={a.active ? "green" : "rose"}>{a.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{a.lastLoginAt ? fmtDate(a.lastLoginAt) : "Never"}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(a.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {isSuper && <ButtonGhost onClick={() => openEditAdmin(a)}>Edit</ButtonGhost>}
                      {isSuper && a.id !== me?.id && <ButtonGhost onClick={() => toggleAdmin(a)}>{a.active ? "Disable" : "Enable"}</ButtonGhost>}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}
          <Pagination page={page} pageSize={20} total={total} onChange={setPage} />
        </>
      ) : (
        <>
          {roles.length === 0 ? (
            <Empty text="Koi role nahi." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {roles.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-800">{r.name}</h3>
                    {r.isSystem ? <Badge tone="indigo">System</Badge> : isSuper && <ButtonGhost onClick={() => openEditRole(r)}>Edit</ButtonGhost>}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{r.description ?? "—"}</p>
                  <div className="mt-2 text-xs text-slate-400">{r.adminCount} admin(s)</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.permissionKeys.map((p) => (
                      <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">{p}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={!!adminModal} title={adminModal?.editing ? `Edit: ${adminModal.editing.name}` : "Add Admin"} onClose={() => setAdminModal(null)}>
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
          <Field label="Name" required><Input value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} /></Field>
          <Field label="Email" required><Input type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} /></Field>
          <Field label="Role" required>
            <Select value={adminForm.roleId} onChange={(e) => setAdminForm({ ...adminForm, roleId: e.target.value })}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          {!adminModal?.editing && <Field label="Password" required><Input type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} /></Field>}
          <Field label="Active">
            <Select value={adminForm.active} onChange={(e) => setAdminForm({ ...adminForm, active: e.target.value })}>
              <option value="true">Yes</option><option value="false">No</option>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <ButtonGhost onClick={() => setAdminModal(null)}>Cancel</ButtonGhost>
            <Button onClick={saveAdmin} disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!roleModal} title={roleModal?.editing ? `Edit Role: ${roleModal.editing.name}` : "Add Role"} onClose={() => setRoleModal(null)}>
        <div className="space-y-4">
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
          <Field label="Name" required><Input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} /></Field>
          <Field label="Description"><Input value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} /></Field>
          <div>
            <span className="mb-2 block text-xs font-medium text-slate-600">Permissions ({roleForm.checked.size})</span>
            <div className="grid max-h-64 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
              {permissions.map((p) => (
                <label key={p.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                  <input type="checkbox" checked={roleForm.checked.has(p.key)} onChange={() => togglePerm(p.key)} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
                  <span className="text-sm text-slate-700">{p.key}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <ButtonGhost onClick={() => setRoleModal(null)}>Cancel</ButtonGhost>
            <Button onClick={saveRole} disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}