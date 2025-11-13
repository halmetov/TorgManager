import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface ReturnHistoryItem {
  id: number;
  manager_id: number;
  manager_name?: string | null;
  created_at: string;
}

interface ReturnDetailItem {
  product_id: number;
  product_name: string;
  quantity: number;
}

interface ReturnDetail {
  id: number;
  manager_id: number;
  manager_name?: string | null;
  created_at: string;
  items: ReturnDetailItem[];
}

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

export default function AdminReturns() {
  const { toast } = useToast();
  const [detailId, setDetailId] = useState<number | null>(null);

  const {
    data: history = [],
    isFetching: historyLoading,
    error: historyError,
    refetch,
  } = useQuery<ReturnHistoryItem[]>({
    queryKey: ["returns", "admin"],
    queryFn: () => api.getReturns() as Promise<ReturnHistoryItem[]>,
  });

  useEffect(() => {
    if (historyError) {
      const message = historyError instanceof Error ? historyError.message : "Не удалось загрузить возвраты";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [historyError, toast]);

  const {
    data: detail,
    isFetching: detailLoading,
    error: detailError,
  } = useQuery<ReturnDetail>({
    queryKey: ["return", detailId],
    queryFn: () => api.getReturnDetail(detailId!) as Promise<ReturnDetail>,
    enabled: detailId !== null,
  });

  useEffect(() => {
    if (detailError) {
      const message = detailError instanceof Error ? detailError.message : "Не удалось загрузить детали возврата";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [detailError, toast]);

  const handleCloseDetail = (open: boolean) => {
    if (!open) {
      setDetailId(null);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Возвраты от менеджеров</h1>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>История возвратов</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={historyLoading}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">№</TableHead>
                <TableHead>Менеджер</TableHead>
                <TableHead>Дата и время</TableHead>
                <TableHead className="w-32 text-right">Подробнее</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Возвратов пока нет
                  </TableCell>
                </TableRow>
              ) : (
                history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.manager_name ?? "—"}</TableCell>
                    <TableCell>{fmt(item.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setDetailId(item.id)}>
                        Подробнее
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detailId !== null} onOpenChange={handleCloseDetail}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Детали возврата</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Создано: {fmt(detail.created_at)}</p>
                  <p className="text-sm text-muted-foreground">Менеджер: {detail.manager_name ?? "—"}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  Печать
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="w-32">Количество</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.items.map((item) => (
                    <TableRow key={item.product_id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
