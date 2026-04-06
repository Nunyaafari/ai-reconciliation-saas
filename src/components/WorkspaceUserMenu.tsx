"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronDown, LogOut, Settings, UserCircle2 } from "lucide-react";
import { useReconciliationStore } from "@/store/reconciliation-api";

export default function WorkspaceUserMenu() {
  const { currentUser, currentOrganization, logout, setStep, step } =
    useReconciliationStore();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const compactFloating = step === "prepare" || step === "reconciliation";

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [step]);

  const initials = useMemo(() => {
    const source = currentUser?.name?.trim() || currentUser?.email || "U";
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [currentUser?.email, currentUser?.name]);

  if (!currentUser) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className={`fixed z-[60] ${
        compactFloating ? "bottom-5 right-5" : "right-5 top-5"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center rounded-2xl border border-slate-200 bg-white/95 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white ${
          compactFloating ? "gap-2 px-2.5 py-2.5" : "gap-3 px-3 py-2"
        }`}
      >
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
          {initials}
        </div>
        <div className={`text-left ${compactFloating ? "hidden" : "hidden sm:block"}`}>
          <p className="max-w-[160px] truncate text-sm font-semibold text-slate-900">
            {currentUser.name}
          </p>
          <p className="max-w-[160px] truncate text-xs text-slate-500">
            {currentOrganization?.name || currentUser.email}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          className={`absolute right-0 w-[280px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl ${
            compactFloating ? "bottom-full mb-3" : "top-full mt-3"
          }`}
        >
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center gap-3">
              <UserCircle2 className="h-9 w-9 text-slate-500" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {currentUser.name}
                </p>
                <p className="text-xs text-slate-500">{currentUser.email}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {currentUser.role} · {currentOrganization?.slug || "workspace"}
                </p>
              </div>
            </div>
          </div>

          <div className="p-2">
            <MenuButton
              icon={<Building2 className="h-4 w-4" />}
              label="Workspace"
              description="Open accounts, per-account monthly history, and start new account periods."
              onClick={() => setStep("workspace")}
            />
            <MenuButton
              icon={<Settings className="h-4 w-4" />}
              label="Settings"
              description="Manage branding, audit trail, security, team, and admin tools."
              onClick={() => setStep("settings")}
            />
          </div>

          <div className="border-t border-slate-200 p-2">
            <MenuButton
              icon={<LogOut className="h-4 w-4" />}
              label="Sign Out"
              description="End this session on the current device."
              onClick={() => logout()}
              tone="danger"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({
  icon,
  label,
  description,
  onClick,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${
        tone === "danger"
          ? "text-rose-700 hover:bg-rose-50"
          : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <div
        className={`mt-0.5 rounded-xl p-2 ${
          tone === "danger" ? "bg-rose-100 text-rose-700" : "bg-slate-100"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </button>
  );
}
