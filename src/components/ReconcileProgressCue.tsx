"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ReconcileProgressCue({
  label = "Reconciling...",
}: {
  label?: string;
}) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhase((current) => (current + 1) % 4);
    }, 180);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex h-4 w-8 items-center justify-center overflow-hidden">
        <ChevronLeft
          className={`absolute h-4 w-4 transition-all duration-150 ${
            phase === 0 || phase === 1
              ? "-translate-x-1 opacity-100"
              : "-translate-x-0.5 opacity-35"
          }`}
        />
        <ChevronRight
          className={`absolute h-4 w-4 transition-all duration-150 ${
            phase === 2 || phase === 3
              ? "translate-x-1 opacity-100"
              : "translate-x-0.5 opacity-35"
          }`}
        />
      </span>
      <span>{label}</span>
    </span>
  );
}
