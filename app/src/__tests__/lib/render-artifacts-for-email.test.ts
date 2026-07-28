import { renderArtifactsForEmail } from "@/lib/agents/render-artifacts-for-email";

describe("renderArtifactsForEmail", () => {
  it("returns empty blocks when there are no artifacts", () => {
    expect(renderArtifactsForEmail(null)).toEqual({ html: "", text: "" });
    expect(renderArtifactsForEmail([])).toEqual({ html: "", text: "" });
  });

  it("renders KPI and chart blocks for email clients", () => {
    const result = renderArtifactsForEmail([
      {
        id: "k1",
        type: "kpi_row",
        title: "Markets",
        items: [{ label: "S&P", value: "5,200", trend: "up" }],
      },
      {
        id: "c1",
        type: "timeseries_chart",
        title: "Price",
        series: [
          {
            name: "Close",
            points: [
              { t: "Mon", v: 100 },
              { t: "Tue", v: 110 },
              { t: "Wed", v: 105 },
            ],
          },
        ],
      },
    ]);

    expect(result.html).toContain("Markets");
    expect(result.html).toContain("S&amp;P");
    expect(result.html).toContain("<svg");
    expect(result.html).toContain("Price");
    expect(result.text).toContain("Markets");
    expect(result.text).toContain("Close:");
  });

  it("renders ranking and funnel as tables", () => {
    const result = renderArtifactsForEmail([
      {
        id: "r1",
        type: "ranking",
        title: "Top",
        items: [{ label: "A", value: "10" }, { label: "B", value: "8" }],
      },
      {
        id: "f1",
        type: "funnel",
        title: "Conversion",
        stages: [
          { label: "Visit", value: 100 },
          { label: "Sign up", value: 40 },
        ],
      },
    ]);

    expect(result.html).toContain("Top");
    expect(result.html).toContain("Conversion");
    expect(result.html).toContain("Sign up");
    expect(result.text).toContain("1. A — 10");
  });
});
