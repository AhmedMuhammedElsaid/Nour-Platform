import Link from "next/link";

import { createAzkarAction } from "../../../features/adhkar/actions/create-azkar.action";
import { AzkarForm } from "../../../features/adhkar/components/azkar-form";

export const dynamic = "force-dynamic";

export default function NewAzkarPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/adhkar" className="text-sm text-muted-foreground hover:underline">
          ← Adhkar
        </Link>
        <h1 className="text-2xl font-semibold">New azkar</h1>
      </div>
      <AzkarForm mode="create" onSubmit={createAzkarAction} />
    </main>
  );
}
