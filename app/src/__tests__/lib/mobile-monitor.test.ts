import type { DashboardLayout } from "@/lib/dashboard/layout-schema";
import { resolveMobileLastRunAgents } from "@/lib/dashboard/mobile-monitor";

const agents = [
  {
    id: "a1",
    name: "Stock Market",
    description: "",
    toolsCount: 2,
    enabled: true,
    createdRelative: "1d",
  },
  {
    id: "a2",
    name: "Research",
    description: "",
    toolsCount: 1,
    enabled: true,
    createdRelative: "2d",
  },
  {
    id: "a3",
    name: "Disabled",
    description: "",
    toolsCount: 0,
    enabled: false,
    createdRelative: "3d",
  },
];

describe("resolveMobileLastRunAgents", () => {
  it("prefers agents from agent_last_run widgets in layout order", () => {
    const layout: DashboardLayout = {
      version: 1,
      widgets: [
        {
          id: "w2",
          type: "agent_last_run",
          x: 0,
          y: 2,
          w: 6,
          h: 4,
          config: { agentId: "a2" },
        },
        {
          id: "w1",
          type: "agent_last_run",
          x: 0,
          y: 0,
          w: 6,
          h: 4,
          config: { agentId: "a1" },
        },
      ],
    };

    expect(resolveMobileLastRunAgents(layout, agents)).toEqual([
      { agentId: "a1", name: "Stock Market" },
      { agentId: "a2", name: "Research" },
    ]);
  });

  it("falls back to enabled agents when layout has no last-run widgets", () => {
    const layout: DashboardLayout = {
      version: 1,
      widgets: [{ id: "kpi", type: "kpi_strip", x: 0, y: 0, w: 12, h: 2 }],
    };

    expect(resolveMobileLastRunAgents(layout, agents)).toEqual([
      { agentId: "a1", name: "Stock Market" },
      { agentId: "a2", name: "Research" },
    ]);
  });
});
