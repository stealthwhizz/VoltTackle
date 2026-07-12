import { LoginGate } from "@/components/LoginGate";
import { IncidentList } from "@/components/IncidentList";
import { AppHeader } from "@/components/AppHeader";

export default function DashboardPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <LoginGate>
          <IncidentList />
        </LoginGate>
      </main>
    </>
  );
}
