export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

/** Generate a human-friendly order number like SV-2026-000123 */
export function nextOrderNumber(sequence: number): string {
  const year = new Date().getFullYear();
  return `SV-${year}-${String(sequence).padStart(6, "0")}`;
}

/** Safe parser for a Decimal returned by Prisma. */
export function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "object" && "toNumber" in (v as object)) {
    return (v as { toNumber(): number }).toNumber();
  }
  return Number(v);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Wrap a middleware/controller to reject errors through the error handler. */
export function asyncHandler(
  fn: (req: any, res: any, next: any) => Promise<any>
): (req: any, res: any, next: any) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}