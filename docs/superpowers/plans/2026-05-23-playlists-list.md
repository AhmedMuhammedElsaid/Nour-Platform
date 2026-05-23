# Playlists List Page (ticket 3.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin playlists list page at `/playlists` — TanStack Table showing all playlists with a client-side status filter and links to the edit page.

**Architecture:** RSC page (`app/playlists/page.tsx`) calls `requireSession(['admin'])` then `getAllPlaylists(session)`, serializes Date fields to ISO strings, and passes the result to a `"use client"` table component. TanStack Table v8 handles column filtering client-side — all rows loaded once, no TanStack Query needed.

**Tech Stack:** Next.js 16 RSC, TanStack Table v8, Vitest + @testing-library/react (new in admin), `@repo/api/auth`, `@repo/api/services/playlist`, `@repo/api/schemas/playlist`

---

### Task 1: Add @tanstack/react-table and test stack

**Files:**
- Modify: `apps/admin/package.json`

- [ ] **Step 1: Replace apps/admin/package.json**

```json
{
  "name": "admin",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf .next .turbo"
  },
  "dependencies": {
    "@repo/api": "workspace:*",
    "@repo/ui": "workspace:*",
    "@tanstack/react-form": "^1.0.0",
    "@tanstack/react-table": "^8.21.0",
    "next": "16.2.0",
    "next-auth": "5.0.0-beta.25",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/tsconfig": "workspace:*",
    "@tailwindcss/postcss": "^4.0.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "eslint": "^9.15.0",
    "postcss": "^8.5.0",
    "tailwindcss": "^4.0.0",
    "typescript": "5.6.3",
    "vite-tsconfig-paths": "^5.1.4",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Install**

```
pnpm install
```

Expected: lockfile updated; no new peer warnings beyond the existing next-auth one.

---

### Task 2: Set up Vitest in apps/admin

**Files:**
- Create: `apps/admin/vitest.config.ts`
- Create: `apps/admin/vitest.setup.ts`

- [ ] **Step 1: Create vitest.config.ts**

```ts
// apps/admin/vitest.config.ts
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

- [ ] **Step 2: Create vitest.setup.ts**

```ts
// apps/admin/vitest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Verify the test runner boots with no test files**

```
pnpm --filter admin test
```

Expected output: `No test files found` or `0 tests passed` — exit 0.

---

### Task 3: Write failing tests for PlaylistsTable

**Files:**
- Create: `apps/admin/features/playlists/components/playlists-table.test.tsx`

- [ ] **Step 1: Write tests**

```tsx
// apps/admin/features/playlists/components/playlists-table.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

// next/link renders fine in the browser but needs the Next.js router context
// in tests. Stub it to a plain anchor to avoid that dependency.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

import { PlaylistsTable } from './playlists-table'
import type { SerializedPlaylist } from './playlists-table'

const rows: SerializedPlaylist[] = [
  {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    title: 'Quran Recitations',
    slug: 'quran-recitations',
    status: 'published',
    trackIds: [
      'bbbbbbbbbbbbbbbbbbbbbbbb',
      'cccccccccccccccccccccccc',
      'dddddddddddddddddddddddd',
    ],
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  },
  {
    id: 'eeeeeeeeeeeeeeeeeeeeeeee',
    title: 'Islamic Lectures',
    slug: 'islamic-lectures',
    status: 'draft',
    trackIds: ['ffffffffffffffffffffffff'],
    createdAt: '2024-02-20T00:00:00.000Z',
    updatedAt: '2024-02-20T00:00:00.000Z',
  },
]

describe('PlaylistsTable', () => {
  it('renders all rows when no filter applied', () => {
    render(<PlaylistsTable playlists={rows} />)
    expect(screen.getByText('Quran Recitations')).toBeInTheDocument()
    expect(screen.getByText('Islamic Lectures')).toBeInTheDocument()
  })

  it('shows empty state when no playlists provided', () => {
    render(<PlaylistsTable playlists={[]} />)
    expect(screen.getByText('No playlists found.')).toBeInTheDocument()
  })

  it('filters to draft rows only', async () => {
    const user = userEvent.setup()
    render(<PlaylistsTable playlists={rows} />)
    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      'draft',
    )
    expect(screen.queryByText('Quran Recitations')).not.toBeInTheDocument()
    expect(screen.getByText('Islamic Lectures')).toBeInTheDocument()
  })

  it('filters to published rows only', async () => {
    const user = userEvent.setup()
    render(<PlaylistsTable playlists={rows} />)
    await user.selectOptions(
      screen.getByLabelText(/filter by status/i),
      'published',
    )
    expect(screen.getByText('Quran Recitations')).toBeInTheDocument()
    expect(screen.queryByText('Islamic Lectures')).not.toBeInTheDocument()
  })

  it('title cell links to the edit page', () => {
    render(<PlaylistsTable playlists={rows} />)
    const link = screen.getByRole('link', { name: 'Quran Recitations' })
    expect(link).toHaveAttribute(
      'href',
      '/playlists/aaaaaaaaaaaaaaaaaaaaaaaa/edit',
    )
  })

  it('shows track count per row', () => {
    render(<PlaylistsTable playlists={rows} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```
pnpm --filter admin test
```

Expected: FAIL — `Cannot find module './playlists-table'`

---

### Task 4: Implement PlaylistsTable

**Files:**
- Create: `apps/admin/features/playlists/components/playlists-table.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/admin/features/playlists/components/playlists-table.tsx
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

// Date fields are serialized to ISO strings at the RSC→client boundary.
// Next.js cannot pass Date objects through props to client components.
export type SerializedPlaylist = Omit<Playlist, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt: string
}

const columnHelper = createColumnHelper<SerializedPlaylist>()

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
  columnHelper.accessor('trackIds', {
    id: 'trackCount',
    header: 'Tracks',
    enableSorting: false,
    cell: (info) => info.getValue().length,
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
  playlists: SerializedPlaylist[]
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
```

- [ ] **Step 2: Run tests — expect PASS**

```
pnpm --filter admin test
```

Expected: 6 tests pass, 0 failures.

---

### Task 5: Implement RSC page

**Files:**
- Create: `apps/admin/app/playlists/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// apps/admin/app/playlists/page.tsx
import Link from 'next/link'

import { requireSession } from '@repo/api/auth'
import { getAllPlaylists } from '@repo/api/services/playlist'

import type { SerializedPlaylist } from '../../features/playlists/components/playlists-table'
import { PlaylistsTable } from '../../features/playlists/components/playlists-table'

export default async function PlaylistsPage() {
  const session = await requireSession(['admin'])
  const playlists = await getAllPlaylists(session)

  // Date objects cannot cross the RSC→client boundary; serialize to ISO strings.
  const rows: SerializedPlaylist[] = playlists.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Playlists</h1>
        <Link
          href="/playlists/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New playlist
        </Link>
      </div>
      <PlaylistsTable playlists={rows} />
    </main>
  )
}
```

- [ ] **Step 2: Run typecheck**

```
pnpm --filter admin typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Run lint**

```
pnpm --filter admin lint
```

Expected: 0 warnings, 0 errors.

---

### Task 6: Final verification and commit

- [ ] **Step 1: Run all checks**

```
pnpm --filter admin test && pnpm --filter admin typecheck && pnpm --filter admin lint
```

Expected: all three pass.

- [ ] **Step 2: Commit (one commit per ticket)**

```bash
git add apps/admin/package.json apps/admin/vitest.config.ts apps/admin/vitest.setup.ts apps/admin/features/playlists/components/playlists-table.tsx apps/admin/features/playlists/components/playlists-table.test.tsx apps/admin/app/playlists/page.tsx pnpm-lock.yaml
git commit -m "[AhmedMuhammedElsaid][wip]: wave 3-3.1 admin playlists-list"
```
