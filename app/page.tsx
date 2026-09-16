import { MonitorDashboard } from "@/components/monitor-dashboard";
import { createDashboardData } from "@/lib/mock-data";

export default function Home() {
  return <MonitorDashboard data={createDashboardData()} />;
}
