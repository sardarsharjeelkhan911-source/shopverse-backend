import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Button, ButtonGhost, Card, Modal, Spinner, Textarea, cx } from "../components/ui";

type SettingsData = Record<string, Record<string, string | number | boolean | object | null>>;

export default function Settings() {
  const [groups, setGroups] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const d = await api.get<SettingsData>("/api/admin/settings");
      setGroups(d);
    } catch {
      setGroups({});
    } finally {
      setLoading(false);
    }
  }

  function displayValue(v: string | number | boolean | object | null): string {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return JSON.stringify(v, null, 2);
    return String(v);
  }

  function parseValue(raw: string): string | number | boolean | object {
    const t = raw.trim();
    if (t === "") return "";
    if (t === "true") return true;
    if (t === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    try {
      return JSON.parse(t);
    } catch {
      return raw;
    }
  }

  function setValue(group: string, key: string, raw: string) {
    setGroups((g) => {
      if (!g) return g;
      return { ...g, [group]: { ...g[group], [key]: raw } };
    });
  }

  async function save() {
    if (!groups) return;
    setBusy(true);
    setToast("");
    setError("");
    const settings: { key: string; value: unknown; group: string }[] = [];
    for (const [group, kv] of Object.entries(groups)) {
      for (const [key, raw] of Object.entries(kv)) {
        settings.push({ key, value: parseValue(String(raw)), group });
      }
    }
    try {
      await api.put("/api/admin/settings", { settings });
      setToast("Settings saved");
      setTimeout(() => setToast(""), 2500);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save fail");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Settings load ho rahe hain..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Store Settings</h1>
        <div className="flex items-center gap-3">
          {toast && <span className="text-sm font-medium text-emerald-600">{toast}</span>}
          <Button onClick={() => setConfirmOpen(true)} disabled={busy}>{busy ? "Saving..." : "Save All"}</Button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}

      {!groups || Object.keys(groups).length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">Koi settings nahi. Naye keys add karne ke liye seed ya API use karein.</p>
        </Card>
      ) : (
        Object.entries(groups).map(([group, kv]) => (
          <Card key={group}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{group}</h2>
            <div className="space-y-3">
              {Object.entries(kv).map(([key, raw]) => {
                const isJson = typeof raw === "object";
                return (
                  <div key={key} className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                    <div>
                      <div className="text-sm font-medium text-slate-700">{key}</div>
                      {!isJson && <div className="text-xs text-slate-400">text</div>}
                    </div>
                    <div>
                      <Textarea
                        rows={isJson ? 5 : 1}
                        className={cx("font-mono")}
                        value={displayValue(raw)}
                        onChange={(e) => setValue(group, key, e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))
      )}

      <Modal open={confirmOpen} title="Confirm save" onClose={() => setConfirmOpen(false)}>
        <p className="text-sm text-slate-600">Saari settings save ho jayengi. Storefront par yehi values reflect hongi. Confirm?</p>
        <div className="mt-4 flex justify-end gap-2">
          <ButtonGhost onClick={() => setConfirmOpen(false)}>Cancel</ButtonGhost>
          <Button onClick={() => { setConfirmOpen(false); save(); }}>Yes, Save</Button>
        </div>
      </Modal>
    </div>
  );
}