import { getLastLoginMethod, setLastLoginMethod } from "@/lib/last-login-storage";

describe("last-login-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and reads email login method", () => {
    setLastLoginMethod("email");
    expect(getLastLoginMethod()).toBe("email");
  });

  it("stores google and github", () => {
    setLastLoginMethod("google");
    expect(getLastLoginMethod()).toBe("google");
    setLastLoginMethod("github");
    expect(getLastLoginMethod()).toBe("github");
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem("synaro:last-login-method", "facebook");
    expect(getLastLoginMethod()).toBeNull();
  });
});
