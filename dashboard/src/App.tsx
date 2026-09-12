import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Spinner } from "./components/ui";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Brands from "./pages/Brands";
import Inventory from "./pages/Inventory";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import Coupons from "./pages/Coupons";
import TaxRules from "./pages/TaxRules";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Admins from "./pages/Admins";
import Audit from "./pages/Audit";
import Forbidden from "./pages/Forbidden";

export default function App() {
  const { admin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Spinner label="Checking session..." />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!admin ? <Login /> : <Navigate to="/" replace />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route index element={<PermGuard perm="dashboard"><Dashboard /></PermGuard>} />
          <Route path="products" element={<PermGuard perm="products"><Products /></PermGuard>} />
          <Route path="categories" element={<PermGuard perm="categories"><Categories /></PermGuard>} />
          <Route path="brands" element={<PermGuard perm="brands"><Brands /></PermGuard>} />
          <Route path="inventory" element={<PermGuard perm="inventory"><Inventory /></PermGuard>} />
          <Route path="orders" element={<PermGuard perm="orders"><Orders /></PermGuard>} />
          <Route path="customers" element={<PermGuard perm="customers"><Customers /></PermGuard>} />
          <Route path="coupons" element={<PermGuard perm="discounts"><Coupons /></PermGuard>} />
          <Route path="tax" element={<PermGuard perm="settings"><TaxRules /></PermGuard>} />
          <Route path="reports" element={<PermGuard perm="reports"><Reports /></PermGuard>} />
          <Route path="settings" element={<PermGuard perm="settings"><Settings /></PermGuard>} />
          <Route path="admins" element={<PermGuard perm="admins"><Admins /></PermGuard>} />
          <Route path="audit" element={<PermGuard perm="reports"><Audit /></PermGuard>} />
          <Route path="forbidden" element={<Forbidden />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

function Protected() {
  const { admin } = useAuth();
  if (!admin) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function PermGuard({ perm, children }: { perm: string; children: React.ReactNode }) {
  const { admin } = useAuth();
  if (!admin?.permissions.includes(perm)) return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
}