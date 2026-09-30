import { describe, expect, it } from "vitest";
import { parseConfirm, parseSign } from "./requests";

const LOG = "11111111-1111-4111-8111-111111111111";
const PHOTO = "22222222-2222-4222-8222-222222222222";

describe("parseSign", () => {
  it("takes a log id and a format", () => {
    expect(parseSign({ logId: LOG, ext: "webp" })).toEqual({ logId: LOG, ext: "webp" });
    expect(parseSign({ logId: LOG, ext: "jpg" })).toEqual({ logId: LOG, ext: "jpg" });
  });

  it.each([null, "x", {}, { logId: "nope", ext: "webp" }, { logId: LOG, ext: "png" }, { logId: `${LOG}/../x`, ext: "webp" }])(
    "refuses %j",
    (body) => expect(parseSign(body)).toBeNull(),
  );
});

describe("parseConfirm", () => {
  const ok = { logId: LOG, photoId: PHOTO, ext: "webp", width: 1600, height: 1200 };

  it("takes ids, format and full-size dimensions", () => {
    expect(parseConfirm(ok)).toEqual(ok);
  });

  it.each([
    { ...ok, photoId: "p1" },
    { ...ok, width: 0 },
    { ...ok, height: 1601 },
    { ...ok, width: 12.5 },
    { ...ok, width: "1600" },
  ])("refuses %j", (body) => expect(parseConfirm(body)).toBeNull());
});
