"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MousePointerClick, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  consumeOnboardingPending,
  markOnboardingCompleted,
} from "@/lib/onboarding-storage";
import {
  findVisibleTourTarget,
  getEffectiveStepIndex,
  getPreviousEffectiveStepIndex,
  ONBOARDING_TOUR_STEPS,
  resolveNavigateTo,
  resolveStepSelectors,
  routeMatches,
  type OnboardingTourStep,
} from "@/lib/onboarding-tour-steps";
import { cn } from "@/lib/utils";

type Rect = { top: number; left: number; width: number; height: number };

type Ctx = {
  active: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
};

const OnboardingContext = React.createContext<Ctx | null>(null);

const SPOTLIGHT_PAD = 10;
const Z_OVERLAY = 10000;
const Z_TARGET = 10003;
const Z_POPOVER = 10004;

function clearTargetElevation(el: HTMLElement | null) {
  if (!el) return;
  if (el.dataset.prevOnboardingZIndex !== undefined) {
    el.style.zIndex = el.dataset.prevOnboardingZIndex;
    delete el.dataset.prevOnboardingZIndex;
  }
  if (el.dataset.prevOnboardingPosition !== undefined) {
    el.style.position = el.dataset.prevOnboardingPosition;
    delete el.dataset.prevOnboardingPosition;
  }
}

function elevateTarget(el: HTMLElement) {
  if (el.dataset.prevOnboardingZIndex === undefined) {
    el.dataset.prevOnboardingZIndex = el.style.zIndex;
  }
  if (el.dataset.prevOnboardingPosition === undefined) {
    el.dataset.prevOnboardingPosition = el.style.position;
  }
  const pos = window.getComputedStyle(el).position;
  if (pos === "static") el.style.position = "relative";
  el.style.zIndex = String(Z_TARGET);
}

function measureElement(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function SpotlightPanels({ rect }: { rect: Rect | null }) {
  if (!rect) {
    return (
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
        style={{ zIndex: Z_OVERLAY }}
        aria-hidden
      />
    );
  }

  const t = Math.max(0, rect.top - SPOTLIGHT_PAD);
  const l = Math.max(0, rect.left - SPOTLIGHT_PAD);
  const w = rect.width + SPOTLIGHT_PAD * 2;
  const h = rect.height + SPOTLIGHT_PAD * 2;
  const panel =
    "fixed bg-black/38 backdrop-blur-[1px] transition-[top,left,width,height] duration-300 ease-out pointer-events-auto";

  return (
    <>
      <div className={panel} style={{ zIndex: Z_OVERLAY, top: 0, left: 0, right: 0, height: t }} />
      <div className={panel} style={{ zIndex: Z_OVERLAY, top: t, left: 0, width: l, height: h }} />
      <div
        className={panel}
        style={{ zIndex: Z_OVERLAY, top: t, left: l + w, right: 0, height: h }}
      />
      <div
        className={panel}
        style={{ zIndex: Z_OVERLAY, top: t + h, left: 0, right: 0, bottom: 0 }}
      />
      <motion.div
        className="pointer-events-none fixed rounded-xl border-2 border-primary/80 shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_32px_rgba(255,255,255,0.06)]"
        style={{ zIndex: Z_OVERLAY + 1, top: t, left: l, width: w, height: h }}
        initial={{ opacity: 0.7 }}
        animate={{ opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
    </>
  );
}

function TourPopover({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onBack,
  onNext,
  onSkip,
  isFirst,
  isLast,
}: {
  step: OnboardingTourStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: Rect | null;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const isCenter =
    step.placement === "center" || (!step.selector && !(step.selectors?.length ?? 0));

  const popoverStyle = React.useMemo((): React.CSSProperties => {
    if (isCenter || !targetRect) {
      return {
        position: "fixed",
        zIndex: Z_POPOVER,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(calc(100vw - 2rem), 420px)",
      };
    }

    const gap = 14;
    const maxW = Math.min(380, window.innerWidth - 32);
    let top = targetRect.top + targetRect.height + gap;
    let left = targetRect.left;

    if (step.placement === "top") {
      top = targetRect.top - gap - 220;
    } else if (step.placement === "left") {
      left = targetRect.left - maxW - gap;
      top = targetRect.top;
    } else if (step.placement === "right") {
      left = targetRect.left + targetRect.width + gap;
      top = targetRect.top;
    }

    left = Math.max(16, Math.min(left, window.innerWidth - maxW - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - 280));

    return {
      position: "fixed",
      zIndex: Z_POPOVER,
      top,
      left,
      width: maxW,
    };
  }, [isCenter, step.placement, targetRect]);

  return (
    <motion.div
      key={step.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      style={popoverStyle}
      className="rounded-2xl border border-border/70 bg-card/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
      role="dialog"
      aria-labelledby="onboarding-tour-title"
      aria-describedby="onboarding-tour-desc"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>
            {stepIndex + 1} of {totalSteps}
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 w-4 rounded-full transition-colors",
                i <= stepIndex ? "bg-primary" : "bg-border/80",
              )}
            />
          ))}
        </div>
      </div>

      <h2 id="onboarding-tour-title" className="text-base font-semibold tracking-tight text-foreground">
        {step.title}
      </h2>
      <p id="onboarding-tour-desc" className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {step.description}
      </p>

      {step.encourageClick ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-foreground/90">
          <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{step.encourageClick}</span>
        </p>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          {!isFirst ? (
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={onBack}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          ) : null}
          <Button type="button" size="sm" className="rounded-xl" onClick={onNext}>
            {isLast ? "Finish" : "Next"}
            {!isLast ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function SpotlightTourLayer({
  active,
  stepIndex,
  onStepIndexChange,
  onFinish,
}: {
  active: boolean;
  stepIndex: number;
  onStepIndexChange: (index: number) => void;
  onFinish: () => void;
}) {
  const router = useRouter();
  const [targetRect, setTargetRect] = React.useState<Rect | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const rafRef = React.useRef<number | null>(null);
  const elevatedElRef = React.useRef<HTMLElement | null>(null);

  const effectiveIndex = getEffectiveStepIndex(stepIndex);
  const step = ONBOARDING_TOUR_STEPS[effectiveIndex]!;
  const stepSelectors = resolveStepSelectors(step);
  const visibleSteps = ONBOARDING_TOUR_STEPS.filter((s) => !s.skipIf?.());
  const displayIndex = visibleSteps.findIndex((s) => s.id === step.id);
  const isFirst = effectiveIndex === getEffectiveStepIndex(0);
  const isLast = step.id === "finish";
  const hasTarget = stepSelectors.length > 0;

  React.useEffect(() => setMounted(true), []);

  const goToStep = React.useCallback(
    (nextRaw: number) => {
      const next = getEffectiveStepIndex(nextRaw);
      if (next >= ONBOARDING_TOUR_STEPS.length) {
        onFinish();
        return;
      }
      const nextStep = ONBOARDING_TOUR_STEPS[next]!;
      const href = resolveNavigateTo(nextStep);
      if (href && !routeMatches(router.pathname, nextStep.route)) {
        void router.push(href).then(() => onStepIndexChange(next));
      } else {
        onStepIndexChange(next);
      }
    },
    [onFinish, onStepIndexChange, router],
  );

  const updateTarget = React.useCallback(
    (opts?: { scroll?: boolean }) => {
      if (!active || !hasTarget) {
        clearTargetElevation(elevatedElRef.current);
        elevatedElRef.current = null;
        setTargetRect(null);
        return;
      }

      const el = findVisibleTourTarget(stepSelectors);
      if (!el || !(el instanceof HTMLElement)) {
        setTargetRect(null);
        return;
      }

      if (elevatedElRef.current !== el) {
        clearTargetElevation(elevatedElRef.current);
        elevatedElRef.current = el;
        elevateTarget(el);
      }

      if (opts?.scroll) {
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      }
      setTargetRect(measureElement(el));
    },
    [active, hasTarget, stepSelectors],
  );

  React.useEffect(() => {
    if (!active) {
      clearTargetElevation(elevatedElRef.current);
      elevatedElRef.current = null;
      return;
    }

    step.onEnter?.();

    if (!routeMatches(router.pathname, step.route)) {
      const href = resolveNavigateTo(step);
      if (href) void router.push(href);
    }

    updateTarget({ scroll: true });

    let attempts = 0;
    const tryFind = () => {
      updateTarget({ scroll: attempts === 0 });
      if (hasTarget && !findVisibleTourTarget(stepSelectors) && attempts < 50) {
        attempts++;
        window.setTimeout(tryFind, 100);
      }
    };
    const t = window.setTimeout(tryFind, 50);

    const onLayoutChange = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => updateTarget());
    };
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);

    const observer = new MutationObserver(onLayoutChange);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    const poll = window.setInterval(onLayoutChange, 400);

    const onClickCapture = () => {
      window.setTimeout(() => updateTarget(), 50);
      window.setTimeout(() => updateTarget(), 300);
    };
    document.addEventListener("click", onClickCapture, true);

    return () => {
      window.clearTimeout(t);
      window.clearInterval(poll);
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
      document.removeEventListener("click", onClickCapture, true);
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTargetElevation(elevatedElRef.current);
      elevatedElRef.current = null;
    };
  }, [active, step, router, updateTarget, hasTarget, stepSelectors]);

  React.useEffect(() => {
    if (!active || !step.advanceOnNavigateTo) return;
    const { prefix, stepId } = step.advanceOnNavigateTo;
    const matches =
      prefix === "/projects/"
        ? router.pathname.startsWith("/projects/") && router.pathname !== "/projects"
        : router.pathname === prefix || router.pathname.startsWith(`${prefix}/`);
    if (!matches) return;

    const targetIdx = ONBOARDING_TOUR_STEPS.findIndex((s) => s.id === stepId);
    if (targetIdx < 0 || targetIdx === effectiveIndex) return;

    const t = window.setTimeout(() => goToStep(targetIdx), 350);
    return () => window.clearTimeout(t);
  }, [active, step.advanceOnNavigateTo, router.pathname, effectiveIndex, goToStep]);

  if (!active || !mounted) return null;

  return createPortal(
    <>
      <SpotlightPanels rect={hasTarget ? targetRect : null} />
      <AnimatePresence mode="wait">
        <TourPopover
          key={step.id}
          step={step}
          stepIndex={displayIndex >= 0 ? displayIndex : effectiveIndex}
          totalSteps={visibleSteps.length}
          targetRect={hasTarget ? targetRect : null}
          isFirst={isFirst}
          isLast={isLast}
          onBack={() => goToStep(getPreviousEffectiveStepIndex(effectiveIndex))}
          onNext={() => {
            if (isLast) onFinish();
            else goToStep(effectiveIndex + 1);
          }}
          onSkip={onFinish}
        />
      </AnimatePresence>
    </>,
    document.body,
  );
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [active, setActive] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(0);
  const hasAutoStartedRef = React.useRef(false);

  const openOnboarding = React.useCallback(() => {
    setStepIndex(0);
    setActive(true);
    if (router.pathname !== "/dashboard") {
      void router.push("/dashboard");
    }
  }, [router]);

  const closeOnboarding = React.useCallback(() => {
    setActive(false);
  }, []);

  const finishOnboarding = React.useCallback(() => {
    markOnboardingCompleted();
    setActive(false);
  }, []);

  React.useEffect(() => {
    if (hasAutoStartedRef.current) return;
    hasAutoStartedRef.current = true;
    if (consumeOnboardingPending()) {
      setStepIndex(0);
      setActive(true);
    }
  }, []);

  const value = React.useMemo(
    () => ({ active, openOnboarding, closeOnboarding }),
    [active, openOnboarding, closeOnboarding],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <SpotlightTourLayer
        active={active}
        stepIndex={stepIndex}
        onStepIndexChange={setStepIndex}
        onFinish={finishOnboarding}
      />
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = React.useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
