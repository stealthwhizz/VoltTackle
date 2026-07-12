import { LoginGate } from "@/components/LoginGate";
import { IncidentDetail } from "@/components/IncidentDetail";
import { AppHeader } from "@/components/AppHeader";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <LoginGate>
          <IncidentDetail id={id} />
        </LoginGate>
      </main>
    </>
  );
}
