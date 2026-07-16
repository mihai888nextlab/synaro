"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, MousePointerClick, Sparkles } from "lucide-react";

import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  consumeOnboardingPending,
  isOnboardingCompleted,
  markOnboardingCompleted,
} from "@/lib/onboarding-storage";
import {
  dispatchCloseMobileSidebar,
  dispatchOpenMobileSidebar,
  findClickedTourTarget,
  findVisibleTourTarget,
  getEffectiveStepIndex,
  getOnboardingTourSteps,
  getPreviousEffectiveStepIndex,
  getStepIndexById,
  isAppShellPath,
  isElementVisible,
  isMobileViewport,
  resolveNavigateTo,
  resolveStepSelectors,
  routeMatches,
  type OnboardingTourStep,
} from "@/lib/onboarding-tour-steps";
import { useTranslation } from "@/components/ui/locale-provider";
import { cn } from "@/lib/utils";

type Rect = { top: number; left: number; width: number; height: number };

type Ctx = {
  active: boolean;
  openOnboarding: () => void;
  closeOnboarding: () => void;
};

const OnboardingContext = React.createContext<Ctx | null>(null);

const SPOTLIGHT_PAD = 10;
/** Dim/spotlight sit below app dialogs (z 9998/9999) so modals are never covered. */
const Z_OVERLAY = 9000;
const Z_TARGET = 9003;
/** Tour card stays above dialogs so Next/Skip remain clickable. */
const Z_POPOVER = 10050;

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
  const computed = window.getComputedStyle(el).zIndex;
  const current = computed === "auto" ? 0 : Number(computed);
  // Never lower an already-high stacking context (e.g. Radix dialog at 9999).
  el.style.zIndex = String(Math.max(Number.isFinite(current) ? current : 0, Z_TARGET));
}

/** App modal open during the tour (excludes the tour popover itself). */
function findOpenAppDialog(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  for (const node of document.querySelectorAll('[role="dialog"]')) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.getAttribute("aria-labelledby") === "onboarding-tour-title") continue;
    const r = node.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") continue;
    return node;
  }
  return null;
}

function measureElement(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function rectsEqual(a: Rect | null, b: Rect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height
  );
}

function SpotlightPanels({ rect }: { rect: Rect | null }) {
  if (!rect) {
    return (
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px] pointer-events-none"
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
    "fixed bg-black/38 backdrop-blur-[1px] transition-[top,left,width,height] duration-300 ease-out pointer-events-none";

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
  waitingForClick,
  targetClicked,
  onSkipStep,
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
  waitingForClick: boolean;
  targetClicked: boolean;
  onSkipStep: () => void;
}) {
  const { t } = useTranslation();
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
            {t("onboarding.stepProgress", { current: stepIndex + 1, total: totalSteps })}
          </span>
        </div>
        <div className="hidden gap-1 sm:flex" aria-hidden>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 w-3 rounded-full transition-colors md:w-4",
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
        <p
          className={cn(
            "mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-relaxed",
            targetClicked
              ? "border-emerald-500/30 bg-emerald-500/10 text-foreground/90"
              : "border-primary/20 bg-primary/5 text-foreground/90",
          )}
        >
          {targetClicked ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
          ) : (
            <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          <span>{targetClicked ? t("onboarding.gotItMovingOn") : step.encourageClick}</span>
        </p>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            {t("onboarding.skipTour")}
          </button>
          {waitingForClick && !targetClicked ? (
            <button
              type="button"
              onClick={onSkipStep}
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              {t("onboarding.skipStep")}
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {!isFirst ? (
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={onBack}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t("onboarding.back")}
            </Button>
          ) : null}
          {waitingForClick && !targetClicked ? null : (
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              onClick={onNext}
            >
              {targetClicked ? (
                t("onboarding.continuing")
              ) : isLast ? (
                t("onboarding.finish")
              ) : (
                <>
                  {t("onboarding.next")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          )}
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
  const { t } = useTranslation();
  const tourSteps = React.useMemo(() => getOnboardingTourSteps(t), [t]);
  const [targetRect, setTargetRect] = React.useState<Rect | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [targetClicked, setTargetClicked] = React.useState(false);
  const rafRef = React.useRef<number | null>(null);
  const elevatedElRef = React.useRef<HTMLElement | null>(null);
  const interactionHandledRef = React.useRef(false);

  const effectiveIndex = getEffectiveStepIndex(stepIndex, tourSteps);
  const step = tourSteps[effectiveIndex]!;
  const stepSelectors = resolveStepSelectors(step);
  const visibleSteps = tourSteps.filter((s) => !s.skipIf?.());
  const displayIndex = visibleSteps.findIndex((s) => s.id === step.id);
  const isFirst = effectiveIndex === getEffectiveStepIndex(0, tourSteps);
  const isLast = step.id === "finish";
  const hasTarget = stepSelectors.length > 0;
  const waitingForClick = Boolean(step.advanceOnTargetClick && step.encourageClick);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    setTargetClicked(false);
    interactionHandledRef.current = false;
  }, [step.id]);

  const goToStep = React.useCallback(
    (nextRaw: number, options?: { hrefOverride?: string | null }) => {
      const next = getEffectiveStepIndex(nextRaw, tourSteps);
      if (next >= tourSteps.length) {
        onFinish();
        return;
      }
      const nextStep = tourSteps[next]!;
      const href = options?.hrefOverride ?? resolveNavigateTo(nextStep);
      const needsNav = Boolean(href && !routeMatches(router.pathname, nextStep.route));

      const complete = () => {
        onStepIndexChange(next);
      };

      if (needsNav && href) {
        void router.push(href).finally(complete);
        return;
      }
      complete();
    },
    [onFinish, onStepIndexChange, router, tourSteps],
  );

  const advanceAfterInteraction = React.useCallback(
    (clickedHref?: string | null) => {
      if (interactionHandledRef.current) return;
      interactionHandledRef.current = true;
      setTargetClicked(true);

      const targetIdx = step.advanceOnNavigateTo
        ? getStepIndexById(step.advanceOnNavigateTo.stepId, tourSteps)
        : effectiveIndex + 1;
      const resolvedIdx = getEffectiveStepIndex(targetIdx, tourSteps);
      const nextStep = tourSteps[resolvedIdx]!;

      const finish = () => {
        onStepIndexChange(resolvedIdx);
      };

      const isOnTargetRoute = () => routeMatches(router.pathname, nextStep.route);

      // Sidebar nav — tour drives navigation; route-sync effect also advances as backup.
      if (step.id === "nav-projects" || step.id === "nav-agents") {
        const href = step.id === "nav-projects" ? "/projects" : "/agents";
        dispatchCloseMobileSidebar();
        if (isOnTargetRoute()) {
          finish();
          return;
        }
        void router.push(href).catch(() => {
          // Fall through to route-sync / timeout backup
        });
        window.setTimeout(() => {
          const here =
            typeof window !== "undefined" ? window.location.pathname : router.pathname;
          if (
            routeMatches(here, nextStep.route) ||
            here === href ||
            here.startsWith(`${href}/`)
          ) {
            finish();
          }
        }, 400);
        return;
      }

      // Links — navigate immediately on first click (don't wait for the native link).
      if (clickedHref) {
        if (isOnTargetRoute()) {
          finish();
          return;
        }
        void router.push(clickedHref).catch(() => {});
        window.setTimeout(() => {
          const here =
            typeof window !== "undefined" ? window.location.pathname : router.pathname;
          if (routeMatches(here, nextStep.route) || routeMatches(router.pathname, nextStep.route)) {
            finish();
          }
        }, 400);
        return;
      }

      // Buttons / tabs — native handler runs first, then advance.
      window.setTimeout(finish, 200);
    },
    [effectiveIndex, onStepIndexChange, router, step, tourSteps],
  );

  const updateTarget = React.useCallback(
    (opts?: { scroll?: boolean }) => {
      if (!active || !hasTarget) {
        clearTargetElevation(elevatedElRef.current);
        elevatedElRef.current = null;
        setTargetRect((prev) => (prev === null ? prev : null));
        return;
      }

      let el = findVisibleTourTarget(stepSelectors) as HTMLElement | null;
      const openDialog = findOpenAppDialog();

      // If a modal opened over the previous target, spotlight inside it (or the dialog).
      if (openDialog) {
        if (el && openDialog.contains(el)) {
          // keep el
        } else {
          const dialogMatch = stepSelectors.some((sel) => {
            try {
              return openDialog.matches(sel) || Boolean(openDialog.querySelector(sel));
            } catch {
              return false;
            }
          });
          if (dialogMatch) {
            el = openDialog;
          } else {
            clearTargetElevation(elevatedElRef.current);
            elevatedElRef.current = null;
            const nextRect = measureElement(openDialog);
            setTargetRect((prev) => (rectsEqual(prev, nextRect) ? prev : nextRect));
            return;
          }
        }
      }

      if (!el) {
        setTargetRect((prev) => (prev === null ? prev : null));
        return;
      }

      if (elevatedElRef.current !== el) {
        clearTargetElevation(elevatedElRef.current);
        elevatedElRef.current = el;
        elevateTarget(el);
      }

      if (opts?.scroll && !openDialog) {
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      }
      const nextRect = measureElement(el);
      setTargetRect((prev) => (rectsEqual(prev, nextRect) ? prev : nextRect));
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

    if (step.needsMobileSidebar && isMobileViewport()) {
      dispatchOpenMobileSidebar();
    } else if (!step.needsMobileSidebar) {
      // Leaving sidebar-targeted steps: collapse the mobile drawer so content is free.
      if (isMobileViewport()) dispatchCloseMobileSidebar();
    }

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
    // childList only — attribute mutations from elevateTarget / framer-motion
    // would otherwise re-enter updateTarget every animation frame.
    observer.observe(document.body, { childList: true, subtree: true, attributes: false });

    const poll = window.setInterval(onLayoutChange, 400);

    const onClickCapture = (event: MouseEvent) => {
      window.setTimeout(() => updateTarget(), 50);
      window.setTimeout(() => updateTarget(), 300);

      const clicked = event.target;
      if (!(clicked instanceof Node)) return;
      if (clicked instanceof HTMLElement && clicked.closest('[role="dialog"][aria-labelledby="onboarding-tour-title"]')) {
        return;
      }

      if (step.advanceOnTargetClick && hasTarget) {
        const matched = findClickedTourTarget(stepSelectors, clicked);
        if (matched) {
          const anchor =
            matched instanceof HTMLAnchorElement
              ? matched
              : matched.querySelector("a[href]") ?? matched.closest("a[href]");
          const href = anchor?.getAttribute("href");
          if (href) {
            event.preventDefault();
            event.stopPropagation();
          }
          advanceAfterInteraction(href);
        }
      }
    };
    document.addEventListener("click", onClickCapture, true);

    const onWorkspaceAction = (event: Event) => {
      if (!step.advanceOnWorkspaceTab) return;
      const detail = (event as CustomEvent<{ type?: string; tab?: string }>).detail;
      if (detail?.type !== "workspace-tab" || detail.tab !== step.advanceOnWorkspaceTab) return;
      advanceAfterInteraction();
    };
    window.addEventListener("synaro:onboarding-action", onWorkspaceAction);

    return () => {
      window.clearTimeout(t);
      window.clearInterval(poll);
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("synaro:onboarding-action", onWorkspaceAction);
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTargetElevation(elevatedElRef.current);
      elevatedElRef.current = null;
    };
  }, [
    active,
    step,
    router,
    updateTarget,
    hasTarget,
    stepSelectors,
    advanceAfterInteraction,
  ]);

  React.useEffect(() => {
    if (!active || !step.advanceWhenVisible) return;
    const { selector, stepId } = step.advanceWhenVisible;
    const targetIdx = getStepIndexById(stepId, tourSteps);
    if (targetIdx < 0 || targetIdx === effectiveIndex) return;

    const check = () => {
      if (!isElementVisible(selector)) return;
      goToStep(targetIdx);
    };

    check();
    const poll = window.setInterval(check, 200);
    return () => window.clearInterval(poll);
  }, [active, step.advanceWhenVisible, step.id, effectiveIndex, goToStep]);

  React.useEffect(() => {
    if (!active || !step.advanceOnNavigateTo) return;
    const { prefix, stepId } = step.advanceOnNavigateTo;

    const pathMatches = (path: string) => {
      const pathname = path.split("?")[0] ?? path;
      if (prefix === "/projects/") {
        return pathname.startsWith("/projects/") && pathname !== "/projects";
      }
      return pathname === prefix || pathname.startsWith(`${prefix}/`);
    };

    const tryAdvance = (path: string = router.pathname) => {
      if (!pathMatches(path)) return;
      // Click-to-advance steps: only follow the URL after the user hit the target
      // (or if they somehow landed on the route while Continuing… was showing).
      if (step.advanceOnTargetClick && !targetClicked && !interactionHandledRef.current) {
        return;
      }
      const targetIdx = getStepIndexById(stepId, tourSteps);
      if (targetIdx < 0) return;
      const resolved = getEffectiveStepIndex(targetIdx, tourSteps);
      if (resolved === effectiveIndex) return;
      onStepIndexChange(resolved);
    };

    // Already on the destination (e.g. push resolved but step index never moved).
    tryAdvance(router.pathname);
    tryAdvance(typeof window !== "undefined" ? window.location.pathname : router.pathname);

    const onComplete = (url: string) => tryAdvance(url);
    router.events.on("routeChangeComplete", onComplete);
    const t = window.setTimeout(() => tryAdvance(), 350);
    return () => {
      router.events.off("routeChangeComplete", onComplete);
      window.clearTimeout(t);
    };
  }, [
    active,
    step.advanceOnNavigateTo,
    step.advanceOnTargetClick,
    step.id,
    router,
    router.pathname,
    effectiveIndex,
    targetClicked,
    tourSteps,
    onStepIndexChange,
  ]);

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
          onBack={() => goToStep(getPreviousEffectiveStepIndex(effectiveIndex, tourSteps))}
          onNext={() => {
            if (isLast) {
              onFinish();
              return;
            }
            // If the user already clicked the target but the step index stalled
            // (common after client-side nav), jump via advanceOnNavigateTo.
            if (targetClicked && step.advanceOnNavigateTo) {
              const targetIdx = getStepIndexById(step.advanceOnNavigateTo.stepId, tourSteps);
              goToStep(targetIdx >= 0 ? targetIdx : effectiveIndex + 1);
              return;
            }
            goToStep(effectiveIndex + 1);
          }}
          onSkip={onFinish}
          onSkipStep={() => goToStep(effectiveIndex + 1)}
          waitingForClick={waitingForClick}
          targetClicked={targetClicked}
        />
      </AnimatePresence>
    </>,
    document.body,
  );
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useSession();
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
    dispatchCloseMobileSidebar();
    setActive(false);
  }, []);

  React.useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      hasAutoStartedRef.current = true;
      return;
    }
    if (status !== "authenticated") return;
    if (!isAppShellPath(router.pathname)) return;
    if (hasAutoStartedRef.current) return;
    hasAutoStartedRef.current = true;

    const pending = consumeOnboardingPending();
    if (!pending && isOnboardingCompleted()) return;

    setStepIndex(0);
    setActive(true);
    if (router.pathname !== "/dashboard") {
      void router.push("/dashboard");
    }
  }, [status, router]);

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
