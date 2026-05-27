"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Category } from "@repo/api/schemas/category";
import type { Locale } from "@repo/api/schemas/locale";

import { deleteCategoryAction } from "../actions/delete-category.action";

// Date fields are serialized to ISO strings at the RSC→client boundary.
// Next.js cannot pass Date objects through props to client components.
export type SerializedCategory = Omit<Category, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

// Row enriched server-side with the locale this category is still missing, so
// we can offer an "Add translation" link (undefined when both locales exist).
export type CategoryRow = SerializedCategory & {
  addTranslationLocale?: Locale;
};

const columnHelper = createColumnHelper<CategoryRow>();

function truncate(text: string | undefined, max: number): string {
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

interface ActionsProps {
  id: string;
}

function RowActions({ id }: ActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this category? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    const result = await deleteCategoryAction(id);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/categories/${id}/edit`}
        className="text-sm text-primary hover:underline"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="text-sm text-destructive hover:underline disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

const columns = [
  columnHelper.accessor("name", {
    header: "Name",
    cell: (info) => (
      <Link
        href={`/categories/${info.row.original.id}/edit`}
        className="font-medium hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor("locale", {
    header: "Language",
    cell: (info) => {
      const { contentId, addTranslationLocale } = info.row.original;
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground uppercase">
            {info.getValue()}
          </span>
          {addTranslationLocale && (
            <Link
              href={`/categories/new?contentId=${contentId}&locale=${addTranslationLocale}`}
              className="text-xs text-primary hover:underline"
            >
              + Add {addTranslationLocale.toUpperCase()}
            </Link>
          )}
        </div>
      );
    },
  }),
  columnHelper.accessor("slug", {
    header: "Slug",
    cell: (info) => (
      <span className="font-mono text-xs text-muted-foreground">
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.accessor("description", {
    header: "Description",
    cell: (info) => (
      <span className="text-muted-foreground">
        {truncate(info.getValue(), 60)}
      </span>
    ),
  }),
  columnHelper.accessor("createdAt", {
    header: "Created",
    cell: (info) =>
      new Date(info.getValue()).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
  }),
  columnHelper.display({
    id: "actions",
    header: "",
    cell: (info) => <RowActions id={info.row.original.id} />,
  }),
];

interface Props {
  categories: CategoryRow[];
}

export function CategoriesTable({ categories }: Props) {
  const table = useReactTable({
    data: categories,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-start font-medium text-muted-foreground"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                No categories found.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
