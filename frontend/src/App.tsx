import { AppRouter } from "@/app/router";
import { Toaster } from "@/components/Toaster";
import { CreatorCredit } from "@/components/CreatorCredit";
import { useRealtimeConnection } from "@/hooks/useRealtimeConnection";
import { useSessionRestore } from "@/hooks/useSessionRestore";

export default function App() {
  useSessionRestore();
  useRealtimeConnection();

  return (
    <>
      <AppRouter />
      <Toaster />
      <CreatorCredit />
    </>
  );
}
