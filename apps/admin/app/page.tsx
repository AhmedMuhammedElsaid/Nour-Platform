import { Button } from "@repo/ui/primitives/button";

export default function AdminHome() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-4xl leading-tight tracking-tight">
        Nour — Admin
      </h1>
      <p className="mt-2 text-text-2">
        Admin CMS placeholder. Wave 0 scaffolding active.
      </p>
      <div className="mt-6">
        <Button variant="secondary">Open dashboard</Button>
      </div>
    </main>
  );
}
