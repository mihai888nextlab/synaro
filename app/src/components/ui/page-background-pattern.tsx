"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type LineConfig = {
  top: string;
  left?: string;
  right?: string;
  width: number;
  rotate: number;
  color: string;
  opacity: number;
  duration: number;
  delay: number;
};

type DotConfig = {
  top: string;
  left?: string;
  right?: string;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
};

const pageLines: LineConfig[] = [
  {
    top: "8%",
    left: "-8%",
    width: 360,
    rotate: -18,
    color: "from-indigo-500/20",
    opacity: 0.55,
    duration: 16,
    delay: 0.2,
  },
  {
    top: "14%",
    right: "8%",
    width: 200,
    rotate: 24,
    color: "from-amber-500/18",
    opacity: 0.5,
    duration: 14,
    delay: 0.5,
  },
  {
    top: "30%",
    left: "5%",
    width: 230,
    rotate: -15,
    color: "from-cyan-500/20",
    opacity: 0.5,
    duration: 17,
    delay: 0.1,
  },
  {
    top: "41%",
    right: "-5%",
    width: 330,
    rotate: -10,
    color: "from-rose-500/20",
    opacity: 0.55,
    duration: 18,
    delay: 0.4,
  },
  {
    top: "55%",
    left: "-4%",
    width: 280,
    rotate: 14,
    color: "from-violet-500/18",
    opacity: 0.5,
    duration: 15,
    delay: 0.7,
  },
  {
    top: "66%",
    right: "4%",
    width: 210,
    rotate: -22,
    color: "from-blue-500/20",
    opacity: 0.45,
    duration: 19,
    delay: 0.3,
  },
  {
    top: "79%",
    left: "10%",
    width: 240,
    rotate: -8,
    color: "from-fuchsia-500/20",
    opacity: 0.5,
    duration: 16,
    delay: 0.6,
  },
  {
    top: "91%",
    right: "-2%",
    width: 300,
    rotate: 8,
    color: "from-red-500/15",
    opacity: 0.45,
    duration: 20,
    delay: 0.2,
  },
];

const sectionLines: LineConfig[] = [
  {
    top: "12%",
    left: "-6%",
    width: 230,
    rotate: -14,
    color: "from-indigo-500/18",
    opacity: 0.45,
    duration: 16,
    delay: 0.2,
  },
  {
    top: "28%",
    right: "4%",
    width: 180,
    rotate: 20,
    color: "from-amber-500/15",
    opacity: 0.4,
    duration: 14,
    delay: 0.6,
  },
  {
    top: "64%",
    left: "8%",
    width: 210,
    rotate: -8,
    color: "from-cyan-500/18",
    opacity: 0.42,
    duration: 18,
    delay: 0.3,
  },
  {
    top: "84%",
    right: "-3%",
    width: 250,
    rotate: 10,
    color: "from-rose-500/15",
    opacity: 0.38,
    duration: 17,
    delay: 0.5,
  },
];

const sectionDots: DotConfig[] = [
  { top: "8%", left: "14%", size: 2, opacity: 0.5, delay: 0.1, duration: 8 },
  { top: "13%", right: "18%", size: 2, opacity: 0.45, delay: 0.4, duration: 9 },
  { top: "18%", left: "48%", size: 3, opacity: 0.55, delay: 0.2, duration: 7 },
  { top: "24%", left: "30%", size: 2, opacity: 0.52, delay: 0.7, duration: 10 },
  { top: "29%", right: "42%", size: 2, opacity: 0.48, delay: 0.3, duration: 9 },
  { top: "35%", left: "64%", size: 3, opacity: 0.58, delay: 0.6, duration: 8 },
  { top: "41%", left: "10%", size: 2, opacity: 0.5, delay: 0.2, duration: 9 },
  { top: "47%", right: "12%", size: 3, opacity: 0.55, delay: 0.5, duration: 10 },
  { top: "53%", left: "40%", size: 2, opacity: 0.47, delay: 0.1, duration: 8 },
  { top: "58%", right: "28%", size: 2, opacity: 0.5, delay: 0.4, duration: 7 },
  { top: "63%", left: "22%", size: 3, opacity: 0.57, delay: 0.6, duration: 9 },
  { top: "68%", right: "8%", size: 2, opacity: 0.46, delay: 0.2, duration: 10 },
  { top: "73%", left: "54%", size: 2, opacity: 0.52, delay: 0.7, duration: 8 },
  { top: "78%", left: "8%", size: 3, opacity: 0.56, delay: 0.3, duration: 9 },
  { top: "83%", right: "20%", size: 2, opacity: 0.5, delay: 0.4, duration: 7 },
  { top: "88%", left: "34%", size: 2, opacity: 0.48, delay: 0.2, duration: 10 },
  { top: "92%", right: "36%", size: 3, opacity: 0.55, delay: 0.5, duration: 9 },
  { top: "16%", right: "4%", size: 2, opacity: 0.45, delay: 0.6, duration: 8 },
  { top: "50%", right: "48%", size: 3, opacity: 0.53, delay: 0.1, duration: 9 },
  { top: "96%", left: "18%", size: 2, opacity: 0.5, delay: 0.3, duration: 10 },
];

export function PageBackgroundPattern({
  className,
  variant = "page",
}: {
  className?: string;
  variant?: "page" | "section";
}) {
  const lines = variant === "section" ? sectionLines : pageLines;

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {lines.map((line, index) => (
        <motion.div
          key={`${line.top}-${index}`}
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: line.opacity, y: [0, 10, 0] }}
          transition={{
            opacity: { duration: 1.4, delay: line.delay },
            y: {
              duration: line.duration,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            },
          }}
          className="absolute"
          style={{
            top: line.top,
            left: line.left,
            right: line.right,
            rotate: `${line.rotate}deg`,
          }}
        >
          <div
            style={{ width: `${line.width}px` }}
            className={`h-16 rounded-full border border-white/10 bg-gradient-to-r ${line.color} to-transparent backdrop-blur-[2px]`}
          />
        </motion.div>
      ))}

      {variant === "section" &&
        sectionDots.map((dot, index) => (
          <motion.div
            key={`${dot.top}-${index}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [dot.opacity * 0.55, dot.opacity, dot.opacity * 0.55] }}
            transition={{
              duration: dot.duration,
              delay: dot.delay,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
            className="absolute rounded-full bg-white"
            style={{
              top: dot.top,
              left: dot.left,
              right: dot.right,
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              boxShadow: "0 0 10px rgba(255,255,255,0.45)",
            }}
          />
        ))}
    </div>
  );
}
