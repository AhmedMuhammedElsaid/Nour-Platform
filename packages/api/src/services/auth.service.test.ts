import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../errors";

const findOneMock = vi.fn();

vi.mock("../db/client", () => ({ getDb: vi.fn().mockResolvedValue({}) }));

// UserModel.findOne(...).select('+passwordHash').lean() must resolve to either a
// user doc or null. Build a fluent chain that lets each test set the resolved
// value via findOneMock.mockResolvedValueOnce.
vi.mock("../db/models/user.model", () => ({
  UserModel: {
    findOne: (...args: unknown[]) => {
      findOneMock(...args);
      return {
        select: () => ({
          lean: () => findOneMock.mock.results.at(-1)?.value,
        }),
        lean: () => findOneMock.mock.results.at(-1)?.value,
      };
    },
    create: vi.fn(),
  },
}));

vi.mock("../auth/password", () => ({ verifyPassword: vi.fn() }));

const { verifyPassword } = await import("../auth/password");
const { verifyCredentials } = await import("./auth.service");

function setNextFindOneResult(doc: unknown): void {
  findOneMock.mockImplementationOnce(() => doc);
}

beforeEach(() => {
  findOneMock.mockReset();
  vi.mocked(verifyPassword).mockReset();
});

describe("auth.service", () => {
  describe("verifyCredentials", () => {
    it("returns the user DTO on a correct password", async () => {
      setNextFindOneResult({
        _id: { toString: () => "u1" },
        email: "admin@example.com",
        name: "Admin",
        role: "admin",
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordHash: "hashed",
      });
      vi.mocked(verifyPassword).mockResolvedValueOnce(true);

      const user = await verifyCredentials({
        email: "admin@example.com",
        password: "correct-horse",
      });

      expect(user).toMatchObject({
        id: "u1",
        email: "admin@example.com",
        role: "admin",
      });
    });

    it("returns null when password is wrong", async () => {
      setNextFindOneResult({
        _id: { toString: () => "u1" },
        email: "admin@example.com",
        name: "Admin",
        role: "admin",
        emailVerified: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordHash: "hashed",
      });
      vi.mocked(verifyPassword).mockResolvedValueOnce(false);

      const user = await verifyCredentials({
        email: "admin@example.com",
        password: "wrong-password-but-valid-length",
      });

      expect(user).toBeNull();
    });

    it("returns null when user does not exist, still running argon2 (timing-oracle defence)", async () => {
      setNextFindOneResult(null);
      vi.mocked(verifyPassword).mockResolvedValueOnce(false);

      const user = await verifyCredentials({
        email: "nobody@example.com",
        password: "anything",
      });

      expect(user).toBeNull();
      // Critical: verify is called even on missing user to keep response time uniform.
      expect(verifyPassword).toHaveBeenCalledTimes(1);
    });

    it("throws Validation on malformed input", async () => {
      await expect(
        verifyCredentials({ email: "not-an-email", password: "x" } as any),
      ).rejects.toBeInstanceOf(AppError);
    });
  });
});
