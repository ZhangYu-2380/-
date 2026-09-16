"use client";

import { useEffect, useState } from "react";

import { AlertDashboard } from "@/components/alert-dashboard";
import { MonitorDashboard } from "@/components/monitor-dashboard";
import type { DashboardData } from "@/lib/monitor-types";

export function DashboardShell({ data }: { data: DashboardData }) {
  const [screen, setScreen] = useState<"flow" | "alerts">("flow");

  useEffect(() => {
    setScreen(new URLSearchParams(window.location.search).get("screen") === "alerts" ? "alerts" : "flow");
  }, []);

  return screen === "alerts" ? <AlertDashboard /> : <MonitorDashboard data={data} />;
}

