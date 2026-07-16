"use client";

import { useTranslation } from "@/components/ui/locale-provider";
import type { DashboardWidgetInstance } from "@/lib/dashboard/layout-schema";
import { WIDGET_REGISTRY_BY_TYPE } from "@/lib/dashboard/widget-registry-meta";
import { clampWidgetSize } from "@/lib/dashboard/widget-size-utils";
import { cn } from "@/lib/utils";

type DashboardWidgetSizeToolbarProps = {
  widget: DashboardWidgetInstance;
  onResize: (widgetId: string, w: number, h: number) => void;
};

export function DashboardWidgetSizeToolbar({ widget, onResize }: DashboardWidgetSizeToolbarProps) {
  const { t } = useTranslation();
  const meta = WIDGET_REGISTRY_BY_TYPE[widget.type];
  if (!meta?.sizePresets?.length) return null;

  return (
    <div className="dashboard-widget-no-drag absolute bottom-3 left-3 right-12 z-20 flex flex-wrap gap-1.5">
      {meta.sizePresets.map((preset) => {
        const active = widget.w === preset.w && widget.h === preset.h;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              const clamped = clampWidgetSize(widget.type, preset.w, preset.h, widget.x);
              onResize(widget.id, clamped.w, clamped.h);
            }}
            className={cn(
              "rounded-md border px-2 py-1 text-[0.65rem] font-medium backdrop-blur-sm transition",
              active
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border/60 bg-background/90 text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {t(preset.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
