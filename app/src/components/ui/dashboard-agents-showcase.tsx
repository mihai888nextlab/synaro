import { useTranslation } from "@/components/ui/locale-provider";
import { DashboardSectionLink } from "@/components/ui/dashboard-section-link";
import {
  SynaroAgentsCardsGrid,
  type SynaroAgentCardModel,
} from "@/components/ui/agent-cards-grid";
import type { WidgetLayoutMode } from "@/components/ui/dashboard/widget-layout-utils";
import { showcaseSectionClass } from "@/components/ui/dashboard/widget-layout-utils";
import { cn } from "@/lib/utils";

export function DashboardAgentsShowcase({
  agents = [],
  className,
  layoutMode = "grid",
}: {
  agents?: SynaroAgentCardModel[];
  className?: string;
  layoutMode?: WidgetLayoutMode;
}) {
  const { t } = useTranslation();
  return (
    <section className={showcaseSectionClass(layoutMode, className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-4 max-sm:px-4 max-sm:py-3.5 sm:px-6">
        <h2 className="min-w-0 text-lg font-semibold tracking-tight text-foreground max-sm:text-base">
          {t("dashboard.agentsTitle")}
        </h2>
        <DashboardSectionLink href="/agents" label={t("common.viewAll")} />
      </div>

      <div className="px-4 py-4 max-sm:px-3 max-sm:py-3 sm:px-5 sm:py-5">
        <SynaroAgentsCardsGrid
          agents={agents}
          showNewAgent
          newAgentHref="/agents"
          cardVariant="embedded"
          className="grid-cols-2 gap-3 max-sm:gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
          newAgentClassName="max-sm:min-h-[8.5rem] max-sm:px-4 max-sm:py-6"
        />
      </div>
    </section>
  );
}
