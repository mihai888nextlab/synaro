import { sendAgentRunCompleteEmail } from "@/lib/agents/send-run-complete-email";
import { prisma } from "@/lib/prisma";

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: "email-1" }, error: null }),
    },
  })),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/resend/config", () => ({
  isResendConfigured: jest.fn(() => false),
  getResendApiKey: jest.fn(),
  getResendFrom: jest.fn(() => "Synaro <noreply@synaro.tech>"),
}));

const payload = {
  runId: "run-1",
  agentId: "agent-1",
  userId: "user-1",
  agentName: "Stock Market",
  status: "DONE" as const,
  trigger: "cron",
  output: "## Summary\n\n**Markets** closed higher.",
  finishedAt: "2026-07-15T13:00:00.000Z",
};

describe("sendAgentRunCompleteEmail", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.clearAllMocks();
  });

  it("logs email in development when Resend is not configured", async () => {
    process.env.NODE_ENV = "development";
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "user@example.com",
      name: "Alex",
    });

    const result = await sendAgentRunCompleteEmail(payload);

    expect(result).toEqual({ ok: true, devLogged: true });
  });

  it("skips when user is missing", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await sendAgentRunCompleteEmail(payload);

    expect(result).toEqual({ ok: true, skipped: true, reason: "no_user" });
  });
});
