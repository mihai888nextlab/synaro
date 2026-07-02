import type { WidgetLayoutMode } from "@/components/ui/dashboard/widget-layout-utils";

export type DashboardWidgetRenderProps = {
  variant: "live" | "preview";
  layoutMode?: WidgetLayoutMode;
  widget: import("@/lib/dashboard/layout-schema").DashboardWidgetInstance;
  data: import("@/lib/dashboard/layout-schema").DashboardPageData;
};
