import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface DispatchItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
}

interface Dispatch {
  id: number;
  status: "pending" | "sent";
  created_at: string;
  sent_at?: string | null;
  items: DispatchItem[];
}

export default function ManagerDispatches() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading: pendingLoading } = useQuery<Dispatch[]>({
    queryKey: ["dispatches", "manager", "pending"],
    queryFn: () => api.getDispatches({ status: "pending" }),
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<Dispatch[]>({
    queryKey: ["dispatches", "manager", "sent"],
    queryFn: () => api.getDispatches({ status: "sent" }),
  });

  const acceptMutation = useMutation({
    mutationFn: (dispatchId: number) => api.acceptDispatch(dispatchId),
    onSuccess: () => {
      toast({ title: "Отправка принята" });
      queryClient.invalidateQueries({ queryKey: ["dispatches", "manager"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      toast({
        title: "Не удалось принять отправку",
        description: error?.message || "Произошла ошибка",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Отправки</h1>

      <Card>
        <CardHeader>
          <CardTitle>Ожидающие отправки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет отправок в ожидании</p>
          ) : (
            pending.map((dispatch) => (
              <div key={dispatch.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold">Отправка №{dispatch.id}</div>
                    <div className="text-xs text-muted-foreground">Создана: {new Date(dispatch.created_at).toLocaleString()}</div>
                  </div>
                  <Button
                    onClick={() => acceptMutation.mutate(dispatch.id)}
                    disabled={acceptMutation.isPending}
                    className="md:w-48"
                  >
                    Принять
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Товар</TableHead>
                      <TableHead>Количество</TableHead>
                      <TableHead>Цена</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatch.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.quantity.toFixed(2)}</TableCell>
                        <TableCell>{item.price.toFixed(2)} ₸</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История отправок</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {historyLoading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Отправок пока нет</p>
          ) : (
            history.map((dispatch) => (
              <div key={dispatch.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">Отправка №{dispatch.id}</div>
                    <div className="text-xs text-muted-foreground">Создана: {new Date(dispatch.created_at).toLocaleString()}</div>
                  </div>
                  {dispatch.sent_at && (
                    <div className="text-xs text-muted-foreground">Отправлена: {new Date(dispatch.sent_at).toLocaleString()}</div>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Товар</TableHead>
                      <TableHead>Количество</TableHead>
                      <TableHead>Цена</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatch.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.quantity.toFixed(2)}</TableCell>
                        <TableCell>{item.price.toFixed(2)} ₸</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
