'use client'

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import Link from 'next/link'
import { useState } from 'react'

import type { Playlist, PlaylistStatus } from '@repo/api/schemas/playlist'
import type { Locale } from '@repo/api/schemas/locale'

// Date fields are serialized to ISO strings at the RSC→client boundary.
// Next.js cannot pass Date objects through props to client components.
export type SerializedPlaylist = Omit<Playlist, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt: string
}

// Row enriched server-side with the locale this program is still missing, so
// we can offer an "Add translation" link (undefined when both locales exist).
export type PlaylistRow = SerializedPlaylist & {
  addTranslationLocale?: Locale
}

const columnHelper = createColumnHelper<PlaylistRow>()

const columns = [
  columnHelper.accessor('title', {
    header: 'Title',
    cell: (info) => (
      <Link
        href={`/playlists/${info.row.original.id}/edit`}
        className="font-medium hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor('locale', {
    header: 'Language',
    enableSorting: false,
    cell: (info) => {
      const { contentId, addTranslationLocale } = info.row.original
      return (
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground uppercase">
            {info.getValue()}
          </span>
          {addTranslationLocale && (
            <Link
              href={`/playlists/new?contentId=${contentId}&locale=${addTranslationLocale}`}
              className="text-xs text-primary hover:underline"
            >
              + Add {addTranslationLocale.toUpperCase()}
            </Link>
          )}
        </div>
      )
    },
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    filterFn: 'equals',
    cell: (info) => {
      const status = info.getValue()
      return (
        <span
          className={
            status === 'published'
              ? 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-success/10 text-success'
              : 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground'
          }
        >
          {status}
        </span>
      )
    },
  }),
  columnHelper.accessor('createdAt', {
    header: 'Created',
    cell: (info) =>
      new Date(info.getValue()).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
  }),
  columnHelper.display({
    id: 'actions',
    header: '',
    cell: (info) => (
      <Link
        href={`/playlists/${info.row.original.id}/edit`}
        className="text-sm text-primary hover:underline"
      >
        Edit
      </Link>
    ),
  }),
]

interface Props {
  playlists: PlaylistRow[]
}

export function PlaylistsTable({ playlists }: Props) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data: playlists,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const statusFilter =
    (columnFilters.find((f) => f.id === 'status')?.value as
      | PlaylistStatus
      | undefined) ?? ''

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label htmlFor="status-filter" className="text-sm font-medium">
          Status
        </label>
        <select
          id="status-filter"
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => {
            const value = e.target.value as PlaylistStatus | ''
            table
              .getColumn('status')
              ?.setFilterValue(value === '' ? undefined : value)
          }}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

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
                  No playlists found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
