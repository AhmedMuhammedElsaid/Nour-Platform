import { beforeEach, describe, expect, it, vi } from "vitest";

const findOne = vi.fn();
const find = vi.fn();
const updateOne = vi.fn();

vi.mock("../client", () => ({
  getDb: vi.fn(async () => ({
    connection: {
      db: {
        collection: () => ({ findOne, find, updateOne }),
      },
    },
  })),
}));

import { dbHasEmbeddedLocaleDocs, up } from "./0003-i18n-backfill";

// Minimal async-iterable standing in for a Mongo cursor.
function cursor(docs: unknown[]) {
  return {
    async *[Symbol.asyncIterator]() {
      yield* docs;
    },
  };
}

beforeEach(() => {
  findOne.mockReset();
  find.mockReset();
  updateOne.mockReset();
});

describe("0003-i18n-backfill embedded-locale guard", () => {
  it("no-ops when embedded-locale documents exist (post-0005 DB)", async () => {
    findOne.mockResolvedValue({ _id: "embedded" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await up();

    expect(find).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[0003]"));
    warn.mockRestore();
  });

  it("runs the backfill when no embedded documents exist (legacy DB)", async () => {
    findOne.mockResolvedValue(null);
    find
      // playlists missing locale → one legacy doc
      .mockReturnValueOnce(cursor([{ _id: "p1" }]))
      // categories missing locale → none
      .mockReturnValueOnce(cursor([]))
      // all-playlists map pass
      .mockReturnValueOnce(cursor([{ _id: "p1", contentId: "c1" }]))
      // tracks missing locale → none
      .mockReturnValueOnce(cursor([]));
    updateOne.mockResolvedValue({});

    await up();

    expect(updateOne).toHaveBeenCalledWith(
      { _id: "p1" },
      expect.objectContaining({
        $set: expect.objectContaining({ locale: "ar" }),
      }),
    );
  });

  it("dbHasEmbeddedLocaleDocs detects an ar sub-object in any collection", async () => {
    // playlists + categories clean, tracks embedded
    findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: "t1" });
    const db = { collection: () => ({ findOne }) };

    await expect(dbHasEmbeddedLocaleDocs(db)).resolves.toBe(true);

    findOne.mockReset();
    findOne.mockResolvedValue(null);
    await expect(dbHasEmbeddedLocaleDocs(db)).resolves.toBe(false);
    expect(findOne).toHaveBeenCalledTimes(3);
  });
});
