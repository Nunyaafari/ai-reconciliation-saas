"use client";

import { useReconciliationStore } from "@/store/reconciliation-api";
import UploadStep from "@/components/UploadStepConnected";
import MappingStep from "@/components/MappingStepConnected";
import ReconciliationStep from "@/components/ReconciliationStepConnected";
import { useEffect } from "react";
import { Heart } from "lucide-react";

export default function Home() {
  const { step, error, initOrg } = useReconciliationStore();

  useEffect(() => {
    initOrg().catch((e) => {
      console.warn("⚠️ Failed to initialize org:", e);
    });

    // Optional: Check backend health on load
    const checkHealth = async () => {
      try {
        const response = await fetch("http://localhost:8000/health");
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
  }, [initOrg]);

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

      {step === "upload" && <UploadStep />}
      {step === "mapping" && <MappingStep />}
      {step === "reconciliation" && <ReconciliationStep />}
    </>
  );
}
