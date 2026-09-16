import { DashboardShell } from "@/components/dashboard-shell";
import { createDashboardData } from "@/lib/mock-data";

export default function Home() {
  return <DashboardShell data={createDashboardData()} />;
}

