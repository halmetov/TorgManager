import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProductOption {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

interface IncomingRow {
  product_id: number | null;
  product_name: string;
  quantity: string;
  search: string;
  options: ProductOption[];
  loading: boolean;
}

interface IncomingHistoryItem {
  id: number;
  created_at: string;
}

interface IncomingDetailItem {
  product_id: number;
  product_name: string;
  quantity: number;
}

interface IncomingDetail {
  id: number;
  created_at: string;
  items: IncomingDetailItem[];
}

const createEmptyRow = (): IncomingRow => ({
  product_id: null,
  product_name: "",
  quantity: "",
  search: "",
  options: [],
  loading: false,
});

export default function AdminIncoming() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rows, setRows] = useState<IncomingRow[]>([createEmptyRow()]);
  const [detailId, setDetailId] = useState<number | null>(null);

  const fetchIncomingHistory = async (): Promise<IncomingHistoryItem[]> => {
    const client = api as unknown as { get: <T>(endpoint: string) => Promise<T> };
    return client.get("/incoming");
  };

  const {
    data: history = [],
    isFetching: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["incoming"],
    queryFn: fetchIncomingHistory,
  });

  useEffect(() => {
    if (historyError) {
      const message = historyError instanceof Error ? historyError.message : "Не удалось загрузить историю поступлений";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [historyError, toast]);

  const fetchIncomingDetail = async (id: number): Promise<IncomingDetail> => {
    const client = api as unknown as { get: <T>(endpoint: string) => Promise<T> };
    return client.get(`/incoming/${id}`);
  };

  const {
    data: incomingDetail,
    isFetching: detailLoading,
  } = useQuery({
    queryKey: ["incoming", detailId],
    queryFn: () => fetchIncomingDetail(detailId!),
    enabled: detailId !== null,
  });

  const searchProducts = async (query: string): Promise<ProductOption[]> => {
    if (!query.trim()) return [];
    const products = await api.getProducts({ q: query, mainOnly: true });
    return (products as any[])
      .filter((product) => product.manager_id === null && !product.is_return)
      .map((product) => ({
        id: product.id,
        name: product.name,
        quantity: product.quantity,
        price: product.price,
      }));
  };

  const updateRow = (index: number, updater: (row: IncomingRow) => IncomingRow) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = updater(prev[index]);
      return next;
    });
  };

  const handleSearchChange = async (index: number, value: string) => {
    updateRow(index, (row) => ({
      ...row,
      search: value,
      product_id: null,
      product_name: "",
      options: value ? row.options : [],
      loading: Boolean(value),
    }));

    if (!value) {
      updateRow(index, (row) => ({ ...row, options: [], loading: false }));
      return;
    }

    try {
      const options = await searchProducts(value);
      updateRow(index, (row) => ({
        ...row,
        options,
        loading: false,
      }));
    } catch (error) {
      updateRow(index, (row) => ({ ...row, options: [], loading: false }));
      const message = error instanceof Error ? error.message : "Не удалось выполнить поиск";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  };

  const handleSelectProduct = (index: number, option: ProductOption) => {
    updateRow(index, (row) => ({
      ...row,
      product_id: option.id,
      product_name: option.name,
      search: option.name,
      options: [],
    }));
  };

  const handleQuantityChange = (index: number, value: string) => {
    updateRow(index, (row) => ({ ...row, quantity: value }));
  };

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const resetForm = () => setRows([createEmptyRow()]);

  const isFormValid = useMemo(
    () =>
      rows.every(
        (row) =>
          row.product_id !== null &&
          row.quantity.trim() !== "" &&
          !Number.isNaN(Number(row.quantity)) &&
          Number(row.quantity) > 0
      ),
    [rows]
  );

  const incomingMutation = useMutation({
    mutationFn: () =>
      api.post("/incoming", {
        items: rows.map((row) => ({
          product_id: row.product_id as number,
          quantity: Number(row.quantity),
        })),
      }),
    onSuccess: () => {
      toast({ title: "Поступление сохранено" });
      resetForm();
      refetchHistory();
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      const message = error?.message ?? "Не удалось сохранить поступление";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isFormValid) return;
    incomingMutation.mutate();
  };

  const formatDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Поступление</h1>

      <Card>
        <CardHeader>
          <CardTitle>Добавить товары на склад</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {rows.map((row, index) => (
                <div key={index} className="rounded-lg border p-4 space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label>Товар</Label>
                    <Input
                      value={row.search}
                      onChange={(event) => handleSearchChange(index, event.target.value)}
                      placeholder="Начните вводить название товара"
                      autoComplete="off"
                    />
                    {row.loading && <p className="text-xs text-muted-foreground">Поиск...</p>}
                    {!row.loading && row.options.length > 0 && (
                      <div className="rounded-md border bg-background">
                        {row.options.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => handleSelectProduct(index, option)}
                          >
                            <span>{option.name}</span>
                            <span className="text-xs text-muted-foreground">
                              Остаток: {option.quantity}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {row.product_name && (
                      <p className="text-xs text-muted-foreground">Выбрано: {row.product_name}</p>
                    )}
                  </div>

                  <div className="flex items-end gap-4">
                    <div className="flex-1">
                      <Label>Количество</Label>
                      <Input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(event) => handleQuantityChange(index, event.target.value)}
                        placeholder="0"
                        required
                      />
                    </div>

                    {rows.length > 1 && (
                      <Button type="button" variant="ghost" onClick={() => removeRow(index)}>
                        Удалить
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Button type="button" variant="outline" onClick={addRow}>
                Добавить строку
              </Button>
              <Button type="submit" className="md:w-56" disabled={!isFormValid || incomingMutation.isPending}>
                Сохранить
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>История поступлений</CardTitle>
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
                    Поступлений пока нет
                  </TableCell>
                </TableRow>
              ) : (
                history.map((incoming) => (
                  <TableRow key={incoming.id}>
                    <TableCell>{incoming.id}</TableCell>
                    <TableCell>{formatDate(incoming.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setDetailId(incoming.id)}>
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

      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Детали поступления</DialogTitle>
          </DialogHeader>
          {detailLoading || !incomingDetail ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Создано: {formatDate(incomingDetail.created_at)}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="w-32">Количество</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomingDetail.items.map((item) => (
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
