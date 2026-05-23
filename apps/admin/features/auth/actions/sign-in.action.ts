"use server";

import { signIn } from "@repo/api/auth";
import { AuthError } from "next-auth";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type SignInActionResult = { error: string } | undefined;

export async function signInAction(
  credentials: z.infer<typeof credentialsSchema>,
  redirectTo?: string,
): Promise<SignInActionResult> {
  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success) return { error: "Invalid input." };

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: redirectTo ?? "/admin",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid email or password." };
        default:
          return { error: "Something went wrong. Please try again." };
      }
    }
    // Re-throw Next.js redirect — it is not an error, it is the success path.
    throw error;
  }
}
