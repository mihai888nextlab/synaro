import { API_KEY_PREFIX, generateApiKey, hashApiKey } from "@/lib/api-key-crypto";

describe("api-key-crypto", () => {
  it("generates keys with sk_live_ prefix and stable hash", () => {
    const { raw, prefix, hash } = generateApiKey();
    expect(raw.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(prefix).toBe(raw.slice(0, API_KEY_PREFIX.length + 8));
    expect(hash).toBe(hashApiKey(raw));
  });

  it("hashes deterministically", () => {
    expect(hashApiKey("sk_live_test")).toBe(hashApiKey("sk_live_test"));
    expect(hashApiKey("sk_live_test")).not.toBe(hashApiKey("sk_live_other"));
  });
});
