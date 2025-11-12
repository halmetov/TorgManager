import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ManagerSidebar } from "@/components/manager/ManagerSidebar";
import { Outlet } from "react-router-dom";

export default function Manager() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <ManagerSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b px-4 bg-background sticky top-0 z-30">
            <SidebarTrigger className="h-10 w-10" />
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
