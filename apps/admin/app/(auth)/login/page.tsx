import { LoginForm } from "@/features/auth/components/login-form";

export const metadata = { title: "Sign in — Nour Admin" };

interface LoginPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { from } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-text-2">Admin access only.</p>
        <div className="mt-8">
          <LoginForm from={from} />
        </div>
      </div>
    </main>
  );
}
