import { getDb } from "../db/client";
import { UserModel } from "../db/models/user.model";
import { AppError } from "../errors";
import { verifyPassword } from "../auth/password";
import {
  credentialsSchema,
  type Credentials,
  type User,
} from "../schemas/user";

/*
 * MVP auth service. Wave 1.1 ships only `verifyCredentials` — the function
 * Auth.js calls from the Credentials provider's `authorize` callback.
 * Wave 1.4's seed script writes the admin record this function reads.
 */

function toDto(doc: {
  _id: { toString(): string };
  email: string;
  name: string;
  role: "admin";
  emailVerified?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    emailVerified: doc.emailVerified ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function verifyCredentials(
  input: Credentials,
): Promise<User | null> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) {
    throw AppError.Validation(parsed.error.issues, "Invalid credentials shape.");
  }

  await getDb();
  const doc = await UserModel.findOne({ email: parsed.data.email })
    .select("+passwordHash")
    .lean();

  // Constant-ish: still run argon2 verify on a dummy hash to dampen the
  // user-existence timing oracle. Cheap relative to the cost of a real
  // verification and worth it for the property.
  const dummyHash =
    "$argon2id$v=19$m=19456,t=2,p=1$saltsaltsaltsalt$hashhashhashhashhashhashhashhashhashhashhash";
  const ok = await verifyPassword(
    parsed.data.password,
    doc?.passwordHash ?? dummyHash,
  );
  if (!doc || !ok) return null;

  return toDto(doc);
}
