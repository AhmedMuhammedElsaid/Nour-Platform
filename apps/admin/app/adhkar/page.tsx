import Link from 'next/link'

import { requireSession } from '@repo/api/auth'
import { getAllAzkar } from '@repo/api/services/azkar'

import type { SerializedAzkar } from '../../features/adhkar/components/azkar-table'
import { AzkarTable } from '../../features/adhkar/components/azkar-table'

// Opt out of static prerendering. proxy.ts sets a per-request CSP nonce that
// would mismatch a cached static body, and the deploy build runs without an
// Atlas connection — both reasons require dynamic rendering.
export const dynamic = 'force-dynamic'

export default async function AdhkarPage() {
  const session = await requireSession(['admin'])
  const azkar = await getAllAzkar(session)

  // Date objects cannot cross the RSC→client boundary; serialize to ISO strings.
  const rows: SerializedAzkar[] = azkar.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }))

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Adhkar</h1>
        <Link
          href="/adhkar/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New
        </Link>
      </div>
      <AzkarTable azkar={rows} />
    </main>
  )
}
