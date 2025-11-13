import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface ManagerStockItem {
  product_id: number;
  name: string;
  quantity: number;
}

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

export default function ManagerReturns() {
  const { toast } = useToast();
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [detailId, setDetailId] = useState<number | null>(null);

  const {
    data: stock = [],
    isFetching: stockLoading,
    error: stockError,
    refetch: refetchStock,
  } = useQuery<ManagerStockItem[]>({
    queryKey: ["manager", "stock"],
    queryFn: () => api.getManagerStock() as Promise<ManagerStockItem[]>,
  });

  useEffect(() => {
    if (stockError) {
      const message = stockError instanceof Error ? stockError.message : "Не удалось загрузить остатки";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [stockError, toast]);

  const {
    data: history = [],
    isFetching: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery<ReturnHistoryItem[]>({
    queryKey: ["returns", "manager"],
    queryFn: () => api.getReturns() as Promise<ReturnHistoryItem[]>,
  });

  useEffect(() => {
    if (historyError) {
      const message = historyError instanceof Error ? historyError.message : "Не удалось загрузить историю возвратов";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [historyError, toast]);

  const {
    data: detail,
    isFetching: detailLoading,
    error: detailError,
  } = useQuery<ReturnDetail>({
    queryKey: ["return", "manager", detailId],
    queryFn: () => api.getReturnDetail(detailId!) as Promise<ReturnDetail>,
    enabled: detailId !== null,
  });

  useEffect(() => {
    if (detailError) {
      const message = detailError instanceof Error ? detailError.message : "Не удалось загрузить детали возврата";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [detailError, toast]);

  const handleQuantityChange = (productId: number, value: string) => {
    setQuantities((prev) => ({ ...prev, [productId]: value }));
  };

  const selectedItems = useMemo(() => {
    return stock
      .map((item) => ({
        product_id: item.product_id,
        name: item.name,
        available: item.quantity,
        requested: Number(quantities[item.product_id] ?? 0),
      }))
      .filter((item) => !Number.isNaN(item.requested) && item.requested > 0);
  }, [stock, quantities]);

  const returnMutation = useMutation({
    mutationFn: (payload: { items: { product_id: number; quantity: number }[] }) => api.createReturn(payload),
    onSuccess: () => {
      toast({ title: "Возврат оформлен" });
      setQuantities({});
      refetchStock();
      refetchHistory();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Не удалось оформить возврат";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (returnMutation.isPending) return;

    if (selectedItems.length === 0) {
      toast({ title: "Ошибка", description: "Укажите количество хотя бы для одного товара", variant: "destructive" });
      return;
    }

    const overLimit = selectedItems.find((item) => item.requested > item.available);
    if (overLimit) {
      toast({
        title: "Ошибка",
        description: `${overLimit.name}: в наличии ${overLimit.available}, попытка вернуть ${overLimit.requested}`,
        variant: "destructive",
      });
      return;
    }

    returnMutation.mutate({
      items: selectedItems.map((item) => ({ product_id: item.product_id, quantity: item.requested })),
    });
  };

  const handleCloseDetail = (open: boolean) => {
    if (!open) {
      setDetailId(null);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Возврат остатков</h1>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Оформить возврат</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchStock()} disabled={stockLoading}>
            Обновить остатки
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead className="w-32">Доступно</TableHead>
                  <TableHead className="w-40">К возврату</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : stock.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Нет товаров для возврата
                    </TableCell>
                  </TableRow>
                ) : (
                  stock.map((item) => (
                    <TableRow key={item.product_id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={item.quantity}
                          value={quantities[item.product_id] ?? ""}
                          onChange={(event) => handleQuantityChange(item.product_id, event.target.value)}
                          placeholder="0"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex justify-end">
              <Button type="submit" className="w-full md:w-56" disabled={returnMutation.isPending}>
                {returnMutation.isPending ? "Отправка..." : "Отправить возврат"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>История возвратов</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchHistory()} disabled={historyLoading}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">№</TableHead>
                <TableHead>Дата и время</TableHead>
                <TableHead className="w-32 text-right">Подробнее</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Возвратов пока нет
                  </TableCell>
                </TableRow>
              ) : (
                history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
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
                <p className="text-sm text-muted-foreground">Создано: {fmt(detail.created_at)}</p>
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
