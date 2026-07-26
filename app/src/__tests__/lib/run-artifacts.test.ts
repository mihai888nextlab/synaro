import { normalizeRunArtifacts } from "@/lib/agents/run-artifacts";

describe("normalizeRunArtifacts", () => {
  it("keeps valid chart and kpi artifacts", () => {
    const artifacts = normalizeRunArtifacts([
      {
        id: "kpis",
        type: "kpi_row",
        emphasis: "hero",
        items: [{ label: "AAPL", value: "$214", trend: "up" }],
      },
      {
        id: "price",
        type: "timeseries_chart",
        title: "AAPL",
        series: [{ name: "Close", points: [{ t: "Mon", v: 200 }, { t: "Tue", v: 205 }] }],
      },
    ]);
    expect(artifacts).toHaveLength(2);
    expect(artifacts[0]).toMatchObject({ type: "kpi_row", emphasis: "hero" });
    expect(artifacts[1]?.type).toBe("timeseries_chart");
  });

  it("keeps ranking, timeline, comparison, and funnel", () => {
    const artifacts = normalizeRunArtifacts([
      {
        type: "ranking",
        items: [{ label: "Alpha", value: "92" }, { label: "Beta", value: "80" }],
      },
      {
        type: "timeline",
        items: [
          { t: "Mon", title: "Kickoff", status: "done" },
          { t: "Tue", title: "Build", status: "current" },
        ],
      },
      {
        type: "comparison",
        options: [
          { label: "A", metrics: [{ label: "Price", value: "$10" }] },
          { label: "B", metrics: [{ label: "Price", value: "$12" }] },
        ],
      },
      {
        type: "funnel",
        stages: [
          { label: "Applied", value: 100 },
          { label: "Interview", value: 40 },
          { label: "Offer", value: 8 },
        ],
      },
    ]);
    expect(artifacts.map((a) => a.type)).toEqual([
      "ranking",
      "timeline",
      "comparison",
      "funnel",
    ]);
  });

  it("drops unknown types and empty series", () => {
    const artifacts = normalizeRunArtifacts([
      { type: "react_component", code: "evil" },
      { type: "timeseries_chart", title: "Empty", series: [] },
      { type: "comparison", options: [{ label: "Only one", metrics: [{ label: "X", value: "1" }] }] },
      { type: "markdown", body: "Hello" },
    ]);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({ type: "markdown", body: "Hello" });
  });

  it("caps artifacts at 12", () => {
    const raw = Array.from({ length: 15 }, (_, i) => ({
      id: `m-${i}`,
      type: "markdown",
      body: `Item ${i}`,
    }));
    expect(normalizeRunArtifacts(raw)).toHaveLength(12);
  });
});
