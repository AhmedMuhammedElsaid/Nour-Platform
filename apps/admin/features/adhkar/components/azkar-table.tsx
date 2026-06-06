'use client'

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnFiltersState,
  type Row,
} from '@tanstack/react-table'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { useCallback, useState } from 'react'

import type { Azkar, AzkarStatus } from '@repo/api/schemas/azkar'

import { reorderAzkarAction } from '../actions/reorder-azkar.action'
import { togglePublishAzkarAction } from '../actions/toggle-publish-azkar.action'

// Date fields are serialized to ISO strings at the RSC→client boundary.
// Next.js cannot pass Date objects through props to client components.
export type SerializedAzkar = Omit<Azkar, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt: string
}

const columnHelper = createColumnHelper<SerializedAzkar>()

const columns = [
  columnHelper.accessor('ar.title', {
    header: 'Title (AR)',
    cell: (info) => (
      <span className="font-medium">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('en.title', {
    header: 'Title (EN)',
    cell: (info) => (
      <span className="text-muted-foreground">{info.getValue()}</span>
    ),
  }),
  columnHelper.accessor('kind', {
    header: 'Kind',
    cell: (info) => (
      <span className="capitalize">{info.getValue()}</span>
    ),
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
  columnHelper.display({
    id: 'itemCount',
    header: 'Items',
    cell: (info) => (
      <span className="tabular-nums">{info.row.original.items.length}</span>
    ),
  }),
  columnHelper.display({
    id: 'actions',
    header: '',
    cell: (info) => <ActionsCell row={info.row} />,
  }),
]

// Separate component so it can hold its own pending state without re-rendering
// the whole table on every toggle.
function ActionsCell({ row }: { row: Row<SerializedAzkar> }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { id, status, ar } = row.original
  const isPublished = status === 'published'

  async function handleToggle() {
    setPending(true)
    setError(null)
    const result = await togglePublishAzkarAction(id, !isPublished)
    if (result?.error) setError(result.error)
    setPending(false)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        aria-label={`${isPublished ? 'Unpublish' : 'Publish'} ${ar.title}`}
        className="text-sm text-primary hover:underline disabled:opacity-50"
      >
        {isPublished ? 'Unpublish' : 'Publish'}
      </button>
      <Link
        href={`/adhkar/${id}/edit`}
        className="text-sm text-primary hover:underline"
      >
        Edit
      </Link>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

interface Props {
  azkar: SerializedAzkar[]
}

function SortableAzkarRow({ row }: { row: Row<SerializedAzkar> }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.original.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-border last:border-0"
    >
      <td className="px-4 py-3 w-8">
        <button
          type="button"
          aria-label={`Drag to reorder ${row.original.ar.title}`}
          className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </td>
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-4 py-3">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  )
}

export function AzkarTable({ azkar }: Props) {
  const [rows, setRows] = useState<SerializedAzkar[]>(() =>
    [...azkar].sort((a, b) => a.order - b.order),
  )
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [dragError, setDragError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const snapshot = rows
      const oldIndex = rows.findIndex((r) => r.id === active.id)
      const newIndex = rows.findIndex((r) => r.id === over.id)
      const reordered = arrayMove(rows, oldIndex, newIndex)

      setRows(reordered)
      setDragError(null)

      const result = await reorderAzkarAction(reordered.map((r) => r.id))
      if (result?.error) {
        setRows(snapshot)
        setDragError(result.error)
      }
    },
    [rows],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const statusFilter =
    (columnFilters.find((f) => f.id === 'status')?.value as
      | AzkarStatus
      | undefined) ?? ''

  return (
    <div className="space-y-4">
      {dragError && (
        <p className="text-sm text-destructive">{dragError}</p>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor="azkar-status-filter" className="text-sm font-medium">
          Status
        </label>
        <select
          id="azkar-status-filter"
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => {
            const value = e.target.value as AzkarStatus | ''
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
                <th className="px-4 py-3 w-8" aria-label="Drag handle" />
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rows.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + 1}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No azkar found.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <SortableAzkarRow key={row.id} row={row} />
                  ))
                )}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>
    </div>
  )
}
