import {
  isSelfServeTier,
  isStripeConfigured,
  priceIdForTier,
  tierForPriceId,
} from "@/lib/billing/stripe";

describe("billing stripe price maps", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.STRIPE_PRICE_STARTER = "price_starter_123";
    process.env.STRIPE_PRICE_PRO = "price_pro_456";
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("round-trips self-serve tiers to price ids and back", () => {
    expect(priceIdForTier("STARTER")).toBe("price_starter_123");
    expect(priceIdForTier("PRO")).toBe("price_pro_456");
    expect(tierForPriceId("price_starter_123")).toBe("STARTER");
    expect(tierForPriceId("price_pro_456")).toBe("PRO");
  });

  it("returns null tier for unknown or missing price ids", () => {
    expect(tierForPriceId("price_enterprise_custom")).toBeNull();
    expect(tierForPriceId(null)).toBeNull();
    expect(tierForPriceId(undefined)).toBeNull();
  });

  it("treats only STARTER and PRO as self-serve", () => {
    expect(isSelfServeTier("STARTER")).toBe(true);
    expect(isSelfServeTier("PRO")).toBe(true);
    expect(isSelfServeTier("ENTERPRISE")).toBe(false);
    expect(isSelfServeTier("FREE")).toBe(false);
  });

  it("reports configuration state from the secret key", () => {
    delete process.env.STRIPE_SECRET_KEY;
    expect(isStripeConfigured()).toBe(false);
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    expect(isStripeConfigured()).toBe(true);
  });
});
