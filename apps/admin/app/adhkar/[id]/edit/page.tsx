import Link from "next/link";
import { notFound } from "next/navigation";

import { requireSession } from "@repo/api/auth";
import { getAzkarById } from "@repo/api/services/azkar";

import { updateAzkarAction } from "../../../../features/adhkar/actions/update-azkar.action";
import { AzkarForm } from "../../../../features/adhkar/components/azkar-form";
import type { AzkarFormValues } from "../../../../features/adhkar/schemas/azkar-form.schema";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditAzkarPage({ params }: Props) {
  const { id } = await params;
  const session = await requireSession(["admin"]);
  const azkar = await getAzkarById(id, session);
  if (!azkar) notFound();

  const initialValues: AzkarFormValues = {
    kind: azkar.kind,
    status: azkar.status,
    ar: { title: azkar.ar.title },
    en: { title: azkar.en.title },
    items: azkar.items.map((it) => ({
      id: crypto.randomUUID(), // client-only stable key — DTO items have no id
      ar: it.ar,
      en: it.en ?? "",
      transliteration: it.transliteration ?? "",
      repeat: it.repeat,
      virtue: { ar: it.virtue?.ar ?? "", en: it.virtue?.en ?? "" },
      source: { ar: it.source?.ar ?? "", en: it.source?.en ?? "" },
      audioMediaId: it.audioMediaId ?? "",
    })),
  };

  // Bind the azkar id into the server action so the form's onSubmit signature
  // matches (values) => Promise<...>. Server-action .bind() is safe to pass from
  // RSC to a client component (Next.js serialises the binding server-side).
  const boundUpdateAction = updateAzkarAction.bind(null, azkar.id);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/adhkar" className="text-sm text-muted-foreground hover:underline">
          ← Adhkar
        </Link>
        <h1 className="text-2xl font-semibold">Edit azkar</h1>
      </div>
      <AzkarForm mode="edit" initialValues={initialValues} onSubmit={boundUpdateAction} />
    </main>
  );
}
