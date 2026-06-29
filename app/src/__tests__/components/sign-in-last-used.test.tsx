import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";

import { SignInPage } from "@/components/ui/sign-in";
import { setLastLoginMethod } from "@/lib/last-login-storage";

jest.mock("next-auth/react", () => ({
  getProviders: jest.fn().mockResolvedValue({}),
  signIn: jest.fn(),
}));

describe("SignInPage last-used pill", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows Used last time on the Google button when google was last method (login mode)", async () => {
    setLastLoginMethod("google");
    render(<SignInPage mode="login" submitLabel="Sign in" />);

    await waitFor(() => {
      expect(screen.getByText("Used last time")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Continue with Google/i })).toHaveTextContent(
      "Used last time",
    );
  });

  it("shows Used last time on submit when email was last method", async () => {
    setLastLoginMethod("email");
    render(<SignInPage mode="login" submitLabel="Sign in" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Sign in/i })).toHaveTextContent("Used last time");
    });
  });

  it("does not show Used last time in signup mode", async () => {
    setLastLoginMethod("google");
    render(<SignInPage mode="signup" submitLabel="Create account" />);

    await waitFor(() => {
      expect(screen.getByText("Create account")).toBeInTheDocument();
    });
    expect(screen.queryByText("Used last time")).not.toBeInTheDocument();
  });

  it("does not show Used last time when no method is stored", async () => {
    render(<SignInPage mode="login" submitLabel="Sign in" />);

    await waitFor(() => {
      expect(screen.getByText("Sign in")).toBeInTheDocument();
    });
    expect(screen.queryByText("Used last time")).not.toBeInTheDocument();
  });
});
