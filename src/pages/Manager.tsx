import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ManagerSidebar } from "@/components/manager/ManagerSidebar";
import { Outlet } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface DispatchRecord {
  id: number;
  product_name: string;
  quantity: number;
  created_at: string;
}

export default function Manager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const fetchPendingDispatches = async (): Promise<DispatchRecord[]> => {
    const client = api as unknown as { get: <T>(endpoint: string) => Promise<T> };
    return client.get("/dispatch?status=pending");
  };

  const {
    data: pendingDispatches = [],
    refetch: refetchPending,
    isFetching: pendingLoading,
  } = useQuery({
    queryKey: ["dispatches", "pending"],
    queryFn: fetchPendingDispatches,
  });

  const acceptMutation = useMutation({
    mutationFn: (dispatchId: number) => api.post(`/dispatch/${dispatchId}/accept`, {}),
    onSuccess: () => {
      toast({ title: "Отправка принята" });
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
    },
    onError: (error: any) => {
      let message = "Не удалось принять отправку";
      if (error?.detail) {
        if (typeof error.detail === "string") {
          message = error.detail;
        } else if (error.detail?.required !== undefined && error.detail?.available !== undefined) {
          message = `Недостаточно товара: требуется ${error.detail.required}, доступно ${error.detail.available}`;
        }
      } else if (error?.message) {
        message = error.message;
      }
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <ManagerSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b px-4 bg-background sticky top-0 z-30">
            <SidebarTrigger className="h-10 w-10" />
          </header>
          <main className="flex-1 p-6">
            {pendingDispatches.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle>Ожидающие отправки</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => refetchPending()} disabled={pendingLoading}>
                    Обновить
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingDispatches.map((dispatch) => (
                    <div key={dispatch.id} className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">
                          #{dispatch.id} — {dispatch.product_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Количество: {dispatch.quantity} • Создано: {formatDate(dispatch.created_at)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => acceptMutation.mutate(dispatch.id)}
                        disabled={acceptMutation.isPending}
                      >
                        Принять
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
