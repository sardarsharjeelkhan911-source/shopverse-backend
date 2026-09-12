import { PrismaClient } from "@prisma/client";

export type TaxableItem = {
  productId: string;
  name?: string;
  qty: number;
  unitPrice: number; // net of discounts
  categoryId?: string | null;
  taxExempt?: boolean;
  taxRuleId?: string | null; // assigned tax rule id
};

export type TaxLine = {
  productId: string;
  name: string;
  qty: number;
  taxableAmount: number;
  taxRate: number; // 0.17 for 17%
  taxAmount: number;
};

export type TaxResult = {
  lines: TaxLine[];
  totalTaxable: number;
  totalTax: number;
};

/**
 * Compute tax breakdown for a set of line items.
 * Loads applicable tax rules once and resolves per-product rules.
 */
export async function computeTax(client: PrismaClient, items: TaxableItem[]): Promise<TaxResult> {
  const productWithRules: Record<string, TaxableItem & { taxRuleIds?: string[] }> = {};
  for (const it of items) {
    productWithRules[it.productId] = it;
  }

  const rules = await client.taxRule.findMany({
    where: { active: true },
  });

  const lines: TaxLine[] = [];
  for (const it of items) {
    const exempt = it.taxExempt === true;

    let rate = 0;
    let taxAmount = 0;
    const taxable = it.qty * it.unitPrice;
    if (!exempt) {
      // Priority: product-specific > category > ALL
      const productRule = rules.find((r) => r.appliesTo === "PRODUCT" && r.productId === it.productId);
      const categoryRule = it.categoryId
        ? rules.find((r) => r.appliesTo === "CATEGORY" && r.categoryId === it.categoryId)
        : undefined;
      const allRule = rules.find((r) => r.appliesTo === "ALL");
      const picked = productRule ?? categoryRule ?? allRule;
      if (picked) {
        if (picked.type === "FIXED") {
          taxAmount = round2(Number(picked.fixedAmount ?? 0) * it.qty);
        } else {
          rate = Number(picked.rate) / 100;
          taxAmount = picked.isInclusive ? inclusiveTax(taxable, rate) : round2(taxable * rate);
        }
      }
    }
    lines.push({
      productId: it.productId,
      name: it.name ?? "",
      qty: it.qty,
      taxableAmount: taxable,
      taxRate: rate,
      taxAmount,
    });
  }

  const totalTaxable = round2(lines.reduce((s, l) => s + l.taxableAmount, 0));
  const totalTax = round2(lines.reduce((s, l) => s + l.taxAmount, 0));
  return { lines, totalTaxable, totalTax };
}

/** Tax amount when price already includes tax. */
function inclusiveTax(amount: number, rate: number): number {
  return round2(amount - amount / (1 + rate));
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}