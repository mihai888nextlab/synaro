import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import { SessionProvider } from "next-auth/react";

import { LocaleProvider } from "@/components/ui/locale-provider";
import { SignInPage } from "@/components/ui/sign-in";
import { setLastLoginMethod } from "@/lib/last-login-storage";

jest.mock("next-auth/react", () => {
  const actual = jest.requireActual<typeof import("next-auth/react")>("next-auth/react");
  return {
    ...actual,
    getProviders: jest.fn().mockResolvedValue({}),
    signIn: jest.fn(),
  };
});

function renderSignIn(ui: React.ReactElement) {
  return render(
    <SessionProvider session={null}>
      <LocaleProvider>{ui}</LocaleProvider>
    </SessionProvider>,
  );
}

describe("SignInPage last-used pill", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows Used last time on the Google button when google was last method (login mode)", async () => {
    setLastLoginMethod("google");
    renderSignIn(<SignInPage mode="login" submitLabel="Sign in" />);

    await waitFor(() => {
      expect(screen.getByText("Used last time")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Continue with Google/i })).toHaveTextContent(
      "Used last time",
    );
  });

  it("shows Used last time on submit when email was last method", async () => {
    setLastLoginMethod("email");
    renderSignIn(<SignInPage mode="login" submitLabel="Sign in" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Sign in/i })).toHaveTextContent("Used last time");
    });
  });

  it("does not show Used last time in signup mode", async () => {
    setLastLoginMethod("google");
    renderSignIn(<SignInPage mode="signup" submitLabel="Create account" />);

    await waitFor(() => {
      expect(screen.getByText("Create account")).toBeInTheDocument();
    });
    expect(screen.queryByText("Used last time")).not.toBeInTheDocument();
  });

  it("does not show Used last time when no method is stored", async () => {
    renderSignIn(<SignInPage mode="login" submitLabel="Sign in" />);

    await waitFor(() => {
      expect(screen.getByText("Sign in")).toBeInTheDocument();
    });
    expect(screen.queryByText("Used last time")).not.toBeInTheDocument();
  });
});
