import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(""),
});

export const sortSchema = z.object({
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export type Pagination = { page: number; pageSize: number; search: string };

export function paginateArgs(p: Pagination) {
  return { take: p.pageSize, skip: (p.page - 1) * p.pageSize };
}

export function meta(p: Pagination, total: number) {
  return {
    page: p.page,
    pageSize: p.pageSize,
    total,
    totalPages: Math.ceil(total / p.pageSize),
  };
}