import { describe, expect, it } from "@jest/globals";

import { generateAuthToken, hashAuthToken } from "@/lib/auth/tokens";

describe("auth tokens", () => {
  it("hashes tokens deterministically with sha256", () => {
    const plain = "abc123";
    expect(hashAuthToken(plain)).toBe(hashAuthToken(plain));
    expect(hashAuthToken(plain)).toHaveLength(64);
    expect(hashAuthToken("other")).not.toBe(hashAuthToken(plain));
  });

  it("generates 64-char hex tokens", () => {
    expect(generateAuthToken()).toMatch(/^[a-f0-9]{64}$/);
    expect(generateAuthToken()).not.toBe(generateAuthToken());
  });
});
