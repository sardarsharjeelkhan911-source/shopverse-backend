import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { cx } from "./ui";

interface NavItem {
  to: string;
  label: string;
  perm: string;
  end?: boolean;
  icon: React.ReactNode;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", perm: "dashboard", end: true, icon: <Icon path="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /> },
  { to: "/products", label: "Products", perm: "products", icon: <Icon path="M7 8l5-5 5 5-5 5-5-5zm-4 13v-8h8v8H3zm12 0v-8h8v8h-8z" /> },
  { to: "/categories", label: "Categories", perm: "categories", icon: <Icon path="M3 5h8l2 2h8v12H3V5z" /> },
  { to: "/brands", label: "Brands", perm: "brands", icon: <Icon path="M7 22h9l-1-4h-7zM9 2h6l3 12H6L9 2z" /> },
  { to: "/inventory", label: "Inventory", perm: "inventory", icon: <Icon path="M4 7h16v15H4V7zm4-4h8l1 4H7l1-4z" /> },
  { to: "/orders", label: "Orders", perm: "orders", icon: <Icon path="M3 6h2L5 4h2l.5 2h11l1 13H5L3 6z" /> },
  { to: "/customers", label: "Customers", perm: "customers", icon: <Icon path="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H5z" /> },
  { to: "/coupons", label: "Coupons", perm: "discounts", icon: <Icon path="M20 12l-8 8L4 12l8-8 8 8zm-5.5-3.5a2 2 0 100 4 2 2 0 000-4z" /> },
  { to: "/tax", label: "Tax Rules", perm: "settings", icon: <Icon path="M16 3l5 5-9 9-5-1-1-5 5-5 5-5zM3 21h8" /> },
  { to: "/reports", label: "Reports", perm: "reports", icon: <Icon path="M4 20V10h4v10H4zm6 0V4h4v16h-4zm6 0v-8h4v8h-4z" /> },
  { to: "/settings", label: "Settings", perm: "settings", icon: <Icon path="M19 13h-1a7 7 0 01-14 0H3v-2h1a7 7 0 0114 0h1v2zm-10 0a3 3 0 006 0H9z" /> },
  { to: "/admins", label: "Admins", perm: "admins", icon: <Icon path="M16 11a4 4 0 110-8 4 4 0 010 8zm-8-1a3 3 0 100-6 3 3 0 000 6zm8-8v2M3 20c0-3 2-5 5-5s5 2 5 5H3z" /> },
  { to: "/audit", label: "Audit Logs", perm: "reports", icon: <Icon path="M9 3h6l1 4h3v14H5V7h3l1-4zm1 6v6M12 9v6M15 9v6" /> },
];

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden>
      <path d={path} />
    </svg>
  );
}

export function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!admin) return null;
  const perms = admin.permissions;

  const allowed = NAV.filter((n) => perms.includes(n.perm));

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    cx(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      isActive ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
    );

  return (
    <div className="flex h-full">
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-slate-900 transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-2 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white">S</div>
          <div>
            <div className="font-bold text-white">ShopVerse</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">Admin Panel</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {allowed.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkCls} onClick={() => setOpen(false)}>
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <div className="mb-2 px-2 text-sm">
            <div className="font-medium text-white">{admin.name}</div>
            <div className="text-xs text-slate-400">{admin.email}</div>
            <div className="text-[11px] text-indigo-400">{admin.role}</div>
          </div>
          <button onClick={handleLogout} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700">
            Logout
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button className="rounded-lg border border-slate-300 p-1.5" onClick={() => setOpen(!open)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold">ShopVerse Admin</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}