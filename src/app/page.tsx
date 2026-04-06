"use client";

import dynamic from "next/dynamic";
import { useReconciliationStore } from "@/store/reconciliation-api";
import WorkspaceUserMenu from "@/components/WorkspaceUserMenu";
import { useEffect } from "react";
import { Heart } from "lucide-react";

const AuthStep = dynamic(() => import("@/components/AuthStepConnected"));
const NewReconSetupStep = dynamic(
  () => import("@/components/NewReconSetupStepConnected")
);
const UploadStep = dynamic(() => import("@/components/UploadStepConnected"));
const MappingStep = dynamic(() => import("@/components/MappingStepConnected"));
const PrepareReconciliationStep = dynamic(
  () => import("@/components/PrepareReconciliationStepConnected")
);
const ReconciliationStep = dynamic(
  () => import("@/components/ReconciliationStepConnected")
);
const WorkspaceStep = dynamic(
  () => import("@/components/WorkspaceStepConnected")
);
const SettingsStep = dynamic(() => import("@/components/SettingsStepConnected"));
const OperationsDashboard = dynamic(
  () => import("@/components/OperationsDashboardConnected")
);

export default function Home() {
  const { step, error, hydrateAuth, authStatus } = useReconciliationStore();

  useEffect(() => {
    hydrateAuth().catch((e) => {
      console.warn("⚠️ Failed to restore session:", e);
    });

    // Optional: Check backend health on load
    const checkHealth = async () => {
      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      try {
        const response = await fetch(`${apiBaseUrl}/health`);
        if (response.ok) {
          console.log("✅ Backend is healthy");
        } else {
          console.warn("⚠️ Backend returned:", response.status);
        }
      } catch (e) {
        console.warn("⚠️ Backend not reachable. Make sure to run: docker-compose up");
      }
    };
    checkHealth();
  }, [hydrateAuth]);

  return (
    <>
      {/* Global Error Display */}
      {error && (
        <div className="fixed top-0 left-0 right-0 bg-red-50 border-b border-red-200 p-4 z-50">
          <div className="max-w-6xl mx-auto flex items-start gap-3">
            <Heart className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button
              onClick={() => useReconciliationStore.getState().setError(null)}
              className="ml-auto text-red-600 hover:text-red-900"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {authStatus !== "authenticated" ? (
        <AuthStep />
      ) : (
        <>
          <WorkspaceUserMenu />
          {step === "setup" && <NewReconSetupStep />}
          {step === "upload" && <UploadStep />}
          {step === "mapping" && <MappingStep />}
          {step === "prepare" && <PrepareReconciliationStep />}
          {step === "reconciliation" && <ReconciliationStep />}
          {(step === "workspace" || step === "history") && <WorkspaceStep />}
          {step === "settings" && <SettingsStep />}
          {step === "ops" && <OperationsDashboard />}
        </>
      )}
    </>
  );
}
