import { getDashboardData } from "@/lib/data";
import { getWeather } from "@/lib/weather";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [data, weather] = await Promise.all([getDashboardData(), getWeather()]);
  return <DashboardClient data={data} weather={weather} />;
}
