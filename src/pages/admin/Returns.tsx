import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Loader2 } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface ManagerReturnHistory {
  id: number;
  manager_id: number;
  manager_name?: string | null;
  created_at: string;
}

interface ShopReturnHistory {
  id: number;
  manager_id: number;
  manager_name?: string | null;
  shop_id: number;
  shop_name: string;
  created_at: string;
}

interface ManagerReturnDetailItem {
  product_id: number;
  product_name: string;
  quantity: number | string;
  price: number | string;
  line_total: number | string;
}

interface ManagerReturnDetail {
  id: number;
  manager_id: number;
  manager_name?: string | null;
  created_at: string;
  total_amount: number | string;
  items: ManagerReturnDetailItem[];
}

interface ShopReturnDetailItem {
  product_id: number;
  product_name: string;
  quantity: number | string;
  price: number | string;
  line_total: number | string;
}

interface ShopReturnDetail {
  id: number;
  manager_id: number;
  manager_name?: string | null;
  shop_id: number;
  shop_name: string;
  created_at: string;
  total_quantity: number | string;
  total_amount: number | string;
  items: ShopReturnDetailItem[];
}

type DetailRequest = { type: "manager" | "shop"; id: number } | null;

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

const formatNumber = (value: string | number | null | undefined) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value ?? 0));

const formatCurrency = (value: string | number | null | undefined) => `${formatNumber(value)} ₸`;

const getQuantityTotal = (items: { quantity: string | number }[]) =>
  items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);

export default function AdminReturns() {
  const { toast } = useToast();
  const [detailRequest, setDetailRequest] = useState<DetailRequest>(null);

  const {
    data: managerHistory = [],
    isFetching: managerLoading,
    error: managerError,
    refetch: refetchManager,
  } = useQuery<ManagerReturnHistory[]>({
    queryKey: ["returns", "admin", "manager"],
    queryFn: () => api.getReturns() as Promise<ManagerReturnHistory[]>,
  });

  const {
    data: shopHistory = [],
    isFetching: shopLoading,
    error: shopError,
    refetch: refetchShop,
  } = useQuery<ShopReturnHistory[]>({
    queryKey: ["returns", "admin", "shop"],
    queryFn: () => api.getShopReturns() as Promise<ShopReturnHistory[]>,
  });

  const {
    data: detail,
    isFetching: detailLoading,
    error: detailError,
  } = useQuery<ManagerReturnDetail | ShopReturnDetail>({
    queryKey: ["return", detailRequest?.type, detailRequest?.id],
    queryFn: () => {
      if (!detailRequest) {
        throw new Error("Нет запроса");
      }
      if (detailRequest.type === "manager") {
        return api.getReturnDetail(detailRequest.id) as Promise<ManagerReturnDetail>;
      }
      return api.getShopReturnDetail(detailRequest.id) as Promise<ShopReturnDetail>;
    },
    enabled: detailRequest !== null,
  });

  useEffect(() => {
    if (managerError) {
      const message = managerError instanceof Error ? managerError.message : "Не удалось загрузить возвраты";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [managerError, toast]);

  useEffect(() => {
    if (shopError) {
      const message = shopError instanceof Error ? shopError.message : "Не удалось загрузить возвраты магазинов";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [shopError, toast]);

  useEffect(() => {
    if (detailError) {
      const message = detailError instanceof Error ? detailError.message : "Не удалось загрузить детали возврата";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [detailError, toast]);

  const handleCloseDetail = (open: boolean) => {
    if (!open) {
      setDetailRequest(null);
    }
  };

  const renderDetailContent = () => {
    if (detailLoading) {
      return <p className="text-sm text-muted-foreground">Загрузка...</p>;
    }

    if (!detail || !detailRequest) {
      return <p className="text-sm text-muted-foreground">Нет данных</p>;
    }

    if (detailRequest.type === "shop") {
      const data = detail as ShopReturnDetail;
      return (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Магазин: {data.shop_name}</p>
              <p className="text-sm text-muted-foreground">Менеджер: {data.manager_name ?? "—"}</p>
              <p className="text-sm text-muted-foreground">Создано: {fmt(data.created_at)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              Печать
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead className="w-32">Количество</TableHead>
                <TableHead className="w-32">Цена</TableHead>
                <TableHead className="w-32">Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.product_id}>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell>{formatNumber(item.quantity)}</TableCell>
                  <TableCell>{formatCurrency(item.price)}</TableCell>
                  <TableCell>{formatCurrency(item.line_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Всего: {formatNumber(data.total_quantity ?? getQuantityTotal(data.items))} шт.</p>
            <p>Сумма возврата: {formatCurrency(data.total_amount)}</p>
          </div>
        </div>
      );
    }

    const data = detail as ManagerReturnDetail;
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Создано: {fmt(data.created_at)}</p>
            <p className="text-sm text-muted-foreground">Менеджер: {data.manager_name ?? "—"}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Печать
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Товар</TableHead>
              <TableHead className="w-32">Количество</TableHead>
              <TableHead className="w-32">Цена</TableHead>
              <TableHead className="w-32">Сумма</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item) => (
              <TableRow key={item.product_id}>
                <TableCell>{item.product_name}</TableCell>
                <TableCell>{formatNumber(item.quantity)}</TableCell>
                <TableCell>{formatCurrency(item.price)}</TableCell>
                <TableCell>{formatCurrency(item.line_total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Всего: {formatNumber(getQuantityTotal(data.items))} шт.</p>
          <p>Сумма возврата: {formatCurrency(data.total_amount)}</p>
        </div>
      </div>
    );
  };

  const detailTitle = detailRequest?.type === "shop" ? "Детали возврата из магазина" : "Детали возврата в главный склад";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Возвраты</h1>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Возвраты в главный склад</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchManager()} disabled={managerLoading}>
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
                <TableHead className="w-32 text-center">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managerLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : managerHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Возвратов пока нет
                  </TableCell>
                </TableRow>
              ) : (
                managerHistory.map((item) => {
                  const isActive = detailRequest?.id === item.id && detailRequest.type === "manager" && detailLoading;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>{item.manager_name ?? "—"}</TableCell>
                      <TableCell>{fmt(item.created_at)}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Подробнее"
                          onClick={() => setDetailRequest({ type: "manager", id: item.id })}
                          disabled={isActive}
                        >
                          {isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Возвраты из магазинов</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchShop()} disabled={shopLoading}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">№</TableHead>
                <TableHead>Магазин</TableHead>
                <TableHead>Менеджер</TableHead>
                <TableHead>Дата и время</TableHead>
                <TableHead className="w-32 text-center">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shopLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : shopHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Возвратов пока нет
                  </TableCell>
                </TableRow>
              ) : (
                shopHistory.map((item) => {
                  const isActive = detailRequest?.id === item.id && detailRequest.type === "shop" && detailLoading;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>{item.shop_name}</TableCell>
                      <TableCell>{item.manager_name ?? "—"}</TableCell>
                      <TableCell>{fmt(item.created_at)}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Подробнее"
                          onClick={() => setDetailRequest({ type: "shop", id: item.id })}
                          disabled={isActive}
                        >
                          {isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detailRequest !== null} onOpenChange={handleCloseDetail}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailTitle}</DialogTitle>
          </DialogHeader>
          {renderDetailContent()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
