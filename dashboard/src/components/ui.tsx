import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
        "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      {...props}
    />
  );
}

export function ButtonGhost({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
        "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function ButtonDanger({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
        "bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400",
        "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100",
        className
      )}
      {...props}
    />
  );
}

export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-slate-200 bg-white p-5 shadow-sm", className)}>{children}</div>;
}

export function Badge({ tone = "slate", children }: { tone?: "slate" | "green" | "amber" | "rose" | "indigo" | "sky"; children: ReactNode }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-700",
    indigo: "bg-indigo-100 text-indigo-800",
    sky: "bg-sky-100 text-sky-800",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
      {label ?? "Loading..."}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{text}</div>;
}

export function Toast({ type, children }: { type: "success" | "error"; children: ReactNode }) {
  return (
    <div
      className={cx(
        "pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg",
        type === "success" ? "bg-emerald-600" : "bg-rose-600"
      )}
    >
      {children}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-10" onClick={onClose}>
      <div
        className={cx("w-full rounded-xl bg-white shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  const lo = Math.max(1, page - 2);
  const hi = Math.min(totalPages, page + 2);
  for (let i = lo; i <= hi; i++) pages.push(i);
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-slate-500">
        Page {page} of {totalPages} ({total} items)
      </span>
      <div className="flex gap-1.5">
        <ButtonGhost disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Prev
        </ButtonGhost>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cx(
              "h-9 w-9 rounded-lg text-sm font-medium",
              p === page ? "bg-indigo-600 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            {p}
          </button>
        ))}
        <ButtonGhost disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next
        </ButtonGhost>
      </div>
    </div>
  );
}

export function Table({ headers, children }: { headers: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
}

export function Monetary({ value }: { value: number }) {
  return <span className="font-medium tabular-nums">{new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(value)}</span>;
}

export function fmtDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

export function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(value);
}