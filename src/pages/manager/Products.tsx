import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

interface DispatchRecord {
  id: number;
  manager_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  status: string;
  created_at: string;
  accepted_at?: string | null;
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default function ManagerProducts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, string>>({});
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportBalance, setReportBalance] = useState<number | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportForm, setReportForm] = useState({
    cash_amount: "",
    card_amount: "",
    other_expenses: "",
    other_details: "",
  });
  const priceFormatter = useMemo(
    () =>
      new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  const {
    data: products = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["products", { q: debouncedSearch, scope: "manager" }],
    queryFn: () => api.getProducts({ q: debouncedSearch }),
  });

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить товары";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [error, toast]);

  const productsList = Array.isArray(products) ? (products as Product[]) : [];
  const hasProducts = productsList.length > 0;
  const productMap = useMemo(() => {
    const map = new Map<number, Product>();
    for (const product of productsList) {
      map.set(product.id, product);
    }
    return map;
  }, [productsList]);

  const managerSelectedItems = useMemo(() => {
    return productsList
      .map((product) => {
        const rawValue = returnQuantities[product.id] ?? "";
        const quantityNumber = Number(rawValue);
        return {
          productId: product.id,
          name: product.name,
          available: product.quantity,
          rawValue,
          requested: Number.isNaN(quantityNumber) ? 0 : quantityNumber,
        };
      })
      .filter((item) => item.requested > 0);
  }, [productsList, returnQuantities]);

  const totalReturnRequested = useMemo(
    () => managerSelectedItems.reduce((sum, item) => sum + item.requested, 0),
    [managerSelectedItems]
  );
  const hasReturnableProducts = useMemo(
    () => productsList.some((product) => product.quantity > 0),
    [productsList]
  );

  const managerReturnMutation = useMutation({
    mutationFn: (payload: { items: { product_id: number; quantity: number }[] }) =>
      api.createManagerReturn(payload),
    onSuccess: () => {
      toast({ title: "Товары возвращены" });
      setReturnQuantities({});
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (mutationError: unknown) => {
      const error = mutationError as (Error & { status?: number; data?: any }) | undefined;
      if (error?.status === 409 && error.data?.error === "INSUFFICIENT_STOCK") {
        const shortages: Array<{ product_id: number; requested: number; available: number }> =
          Array.isArray(error.data.items) ? error.data.items : [];
        const lines = shortages.map((shortage) => {
          const product = productMap.get(shortage.product_id);
          const name = product?.name ?? `Товар ${shortage.product_id}`;
          return `${name}: нужно ${shortage.requested}, доступно ${shortage.available}`;
        });
        toast({
          title: "Недостаточно товара",
          description: lines.length > 0 ? lines.join("\n") : error.message,
          variant: "destructive",
        });
        return;
      }

      const message = error?.message || "Не удалось оформить возврат";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const handleReturnQuantityChange = (productId: number, value: string) => {
    if (value === "") {
      setReturnQuantities((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      return;
    }

    setReturnQuantities((prev) => ({ ...prev, [productId]: value }));
  };

  const handleReturnAll = () => {
    const next: Record<number, string> = {};
    for (const product of productsList) {
      if (product.quantity > 0) {
        next[product.id] = String(product.quantity);
      }
    }
    setReturnQuantities(next);
  };

  const handleReturnSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (managerReturnMutation.isPending) return;

    if (managerSelectedItems.length === 0) {
      toast({
        title: "Ошибка",
        description: "Укажите количество хотя бы для одного товара",
        variant: "destructive",
      });
      return;
    }

    for (const item of managerSelectedItems) {
      const rawValue = item.rawValue.trim();
      const quantityNumber = Number(item.rawValue);
      if (rawValue === "" || Number.isNaN(quantityNumber) || quantityNumber <= 0) {
        toast({
          title: "Ошибка",
          description: `${item.name}: количество должно быть больше нуля`,
          variant: "destructive",
        });
        return;
      }

      if (quantityNumber > item.available) {
        toast({
          title: "Ошибка",
          description: `${item.name}: в наличии ${item.available}, пытаетесь вернуть ${quantityNumber}`,
          variant: "destructive",
        });
        return;
      }
    }

    managerReturnMutation.mutate({
      items: managerSelectedItems.map((item) => ({ product_id: item.productId, quantity: item.requested })),
    });
  };

  const createDailyReportMutation = useMutation({
    mutationFn: (payload: {
      cash_amount: number;
      card_amount: number;
      other_expenses: number;
      other_details: string;
    }) => api.createDriverDailyReport(payload),
    onSuccess: () => {
      toast({ title: "Отчёт сохранён" });
      setReportForm({ cash_amount: "", card_amount: "", other_expenses: "", other_details: "" });
      setReportError(null);
      setShowReportModal(false);
    },
    onError: (error: any) => {
      const message = error?.detail || error?.message || "Не удалось сохранить отчёт";
      setReportError(message);
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const handleReportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createDailyReportMutation.isPending) return;

    const cashAmount = Number(reportForm.cash_amount || 0);
    const cardAmount = Number(reportForm.card_amount || 0);
    const otherExpenses = Number(reportForm.other_expenses || 0);

    if ([cashAmount, cardAmount, otherExpenses].some((value) => Number.isNaN(value) || value < 0)) {
      toast({
        title: "Ошибка",
        description: "Суммы должны быть неотрицательными числами",
        variant: "destructive",
      });
      return;
    }

    const totalEntered = cashAmount + cardAmount + otherExpenses;
    if (reportBalance !== null && totalEntered > reportBalance + 0.000001) {
      const message =
        "Сумма на карте, наличными и расходы не может превышать доступный остаток за сегодня";
      setReportError(message);
      toast({ title: "Ошибка", description: message, variant: "destructive" });
      return;
    }

    setReportError(null);
    try {
      await createDailyReportMutation.mutateAsync({
        cash_amount: cashAmount,
        card_amount: cardAmount,
        other_expenses: otherExpenses,
        other_details: reportForm.other_details,
      });
    } catch {
      // handled in mutation
    }
  };

  const handleReportFieldChange = (field: keyof typeof reportForm, value: string) => {
    setReportError(null);
    setReportForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenReportModal = async () => {
    setReportError(null);
    setIsBalanceLoading(true);
    try {
      const data = await api.getDriverDailyBalance();
      setReportBalance(typeof data?.available === "number" ? data.available : 0);
      setShowReportModal(true);
    } catch (error: any) {
      const message = error?.detail || error?.message || "Не удалось получить баланс";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    } finally {
      setIsBalanceLoading(false);
    }
  };

  const fetchDispatches = async (): Promise<DispatchRecord[]> => {
    const client = api as unknown as { get: <T>(endpoint: string) => Promise<T> };
    return client.get("/dispatch");
  };

  const {
    data: dispatches = [],
    isFetching: dispatchesLoading,
    error: dispatchError,
    refetch: refetchDispatches,
  } = useQuery({
    queryKey: ["dispatches"],
    queryFn: fetchDispatches,
  });

  useEffect(() => {
    if (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : "Не удалось загрузить отправки";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [dispatchError, toast]);

  const acceptMutation = useMutation({
    mutationFn: (dispatchId: number) => api.post(`/dispatch/${dispatchId}/accept`, {}),
    onSuccess: () => {
      toast({ title: "Отправка принята" });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      refetchDispatches();
      queryClient.invalidateQueries({ queryKey: ["dispatches", "pending"] });
    },
    onError: (acceptError: any) => {
      let message = "Не удалось принять отправку";
      if (acceptError?.status === 409 && acceptError?.message) {
        message = acceptError.message;
      } else if (acceptError?.detail) {
        if (typeof acceptError.detail === "string") {
          message = acceptError.detail;
        } else if (acceptError.detail?.required !== undefined && acceptError.detail?.available !== undefined) {
          message = `Недостаточно товара: требуется ${acceptError.detail.required}, доступно ${acceptError.detail.available}`;
        }
      }
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const formatDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

  const totalQuantity = useMemo(() => productsList.reduce((acc, product) => acc + product.quantity, 0), [productsList]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Мои товары</h1>
          <p className="text-sm text-muted-foreground">Доступно: {hasProducts ? totalQuantity : 0} шт.</p>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по названию"
          className="w-full md:w-72"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Остатки</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Количество</TableHead>
                  <TableHead>Цена</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : productsList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Нет товаров
                    </TableCell>
                  </TableRow>
                ) : (
                  productsList.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.quantity}</TableCell>
                      <TableCell>{priceFormatter.format(product.price ?? 0)} ₸</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {isLoading ? (
              <div className="rounded-lg border p-4 text-center text-muted-foreground">Загрузка...</div>
            ) : productsList.length === 0 ? (
              <div className="rounded-lg border p-4 text-center text-muted-foreground">Нет товаров</div>
            ) : (
              productsList.map((product) => (
                <div key={product.id} className="rounded-lg border p-4 space-y-2 bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold leading-tight">{product.name}</h3>
                    <span className="text-sm text-muted-foreground">{product.quantity} шт.</span>
                  </div>
                  {product.price ? (
                    <p className="text-sm text-muted-foreground">
                      Цена: {priceFormatter.format(product.price)} ₸
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Возврат в главный склад</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenReportModal}
              disabled={isBalanceLoading}
            >
              {isBalanceLoading ? "Загрузка..." : "Отчитаться"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReturnAll}
              disabled={!hasReturnableProducts || managerReturnMutation.isPending}
            >
              Вернуть всё
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReturnSubmit} className="space-y-6">
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="w-24">Доступно</TableHead>
                    <TableHead className="w-32">К возврату</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Загрузка...
                      </TableCell>
                    </TableRow>
                  ) : productsList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Нет товаров для возврата
                      </TableCell>
                    </TableRow>
                  ) : (
                    productsList.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>{product.quantity}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={product.quantity}
                            value={returnQuantities[product.id] ?? ""}
                            onChange={(event) => handleReturnQuantityChange(product.id, event.target.value)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 md:hidden">
              {isLoading ? (
                <div className="rounded-lg border p-4 text-center text-muted-foreground">Загрузка...</div>
              ) : productsList.length === 0 ? (
                <div className="rounded-lg border p-4 text-center text-muted-foreground">
                  Нет товаров для возврата
                </div>
              ) : (
                productsList.map((product) => (
                  <div key={product.id} className="rounded-lg border p-4 space-y-3 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold leading-tight">{product.name}</h3>
                        <p className="text-sm text-muted-foreground">Доступно: {product.quantity}</p>
                      </div>
                      {product.price ? (
                        <span className="text-sm text-muted-foreground">
                          {priceFormatter.format(product.price)} ₸
                        </span>
                      ) : null}
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={product.quantity}
                      value={returnQuantities[product.id] ?? ""}
                      onChange={(event) => handleReturnQuantityChange(product.id, event.target.value)}
                      placeholder="Кол-во"
                    />
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Всего к возврату: {totalReturnRequested}</p>
              <Button type="submit" className="w-full sm:w-56" disabled={managerReturnMutation.isPending}>
                {managerReturnMutation.isPending ? "Отправка..." : "Возврат товаров"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>История отправок</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchDispatches()} disabled={dispatchesLoading}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {dispatchesLoading ? (
              <div className="rounded-lg border p-4 text-center text-muted-foreground">Загрузка...</div>
            ) : dispatches.length === 0 ? (
              <div className="rounded-lg border p-4 text-center text-muted-foreground">Отправок пока нет</div>
            ) : (
              dispatches.map((dispatch) => {
                const isPending = dispatch.status === "pending";
                return (
                  <div key={dispatch.id} className="rounded-lg border p-4 space-y-3 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold leading-tight">{dispatch.product_name}</p>
                        <p className="text-xs text-muted-foreground">Количество: {dispatch.quantity}</p>
                      </div>
                      <span className="text-sm text-muted-foreground">#{dispatch.id}</span>
                    </div>
                    <div className="grid gap-1 text-sm text-muted-foreground">
                      <span>Статус: {isPending ? "в ожидании" : "отправлен"}</span>
                      <span>Создано: {formatDate(dispatch.created_at)}</span>
                      <span>
                        Принято: {dispatch.status === "sent" ? formatDate(dispatch.accepted_at) : "—"}
                      </span>
                    </div>
                    {isPending ? (
                      <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => acceptMutation.mutate(dispatch.id)}
                        disabled={acceptMutation.isPending}
                      >
                        Принять
                      </Button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">№</TableHead>
                  <TableHead>Товар</TableHead>
                  <TableHead>Количество</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Создано</TableHead>
                  <TableHead>Принято</TableHead>
                  <TableHead className="w-32 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatchesLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : dispatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Отправок пока нет
                    </TableCell>
                  </TableRow>
                ) : (
                  dispatches.map((dispatch) => {
                    const isPending = dispatch.status === "pending";
                    return (
                      <TableRow key={dispatch.id}>
                        <TableCell>{dispatch.id}</TableCell>
                        <TableCell>{dispatch.product_name}</TableCell>
                        <TableCell>{dispatch.quantity}</TableCell>
                        <TableCell>{isPending ? "в ожидании" : "отправлен"}</TableCell>
                        <TableCell>{formatDate(dispatch.created_at)}</TableCell>
                        <TableCell>{dispatch.status === "sent" ? formatDate(dispatch.accepted_at) : "—"}</TableCell>
                        <TableCell className="text-right">
                          {isPending ? (
                            <Button
                              size="sm"
                              onClick={() => acceptMutation.mutate(dispatch.id)}
                              disabled={acceptMutation.isPending}
                            >
                              Принять
                            </Button>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={showReportModal}
        onOpenChange={(open) => {
          setShowReportModal(open);
          if (!open) {
            setReportError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Отчитаться / вернуть деньги</DialogTitle>
            <DialogDescription>
              {reportBalance !== null
                ? `Доступно к возврату сегодня: ${priceFormatter.format(reportBalance)} ₸`
                : "Укажи, сколько сегодня денег"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReportSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="card_amount">На карте</Label>
                <Input
                  id="card_amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={reportForm.card_amount}
                  onChange={(event) => handleReportFieldChange("card_amount", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cash_amount">Наличные</Label>
                <Input
                  id="cash_amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={reportForm.cash_amount}
                  onChange={(event) => handleReportFieldChange("cash_amount", event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="other_expenses">Потрачено на другие</Label>
                <Input
                  id="other_expenses"
                  type="number"
                  min={0}
                  step="0.01"
                  value={reportForm.other_expenses}
                  onChange={(event) => handleReportFieldChange("other_expenses", event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="other_details">На что потратил (например, бензин)</Label>
              <Textarea
                id="other_details"
                rows={3}
                value={reportForm.other_details}
                onChange={(event) => handleReportFieldChange("other_details", event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowReportModal(false)}
                disabled={createDailyReportMutation.isPending}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createDailyReportMutation.isPending}
              >
                {createDailyReportMutation.isPending ? "Сохранение..." : "Сохранить отчёт"}
              </Button>
            </div>
            {reportError ? <p className="text-sm text-destructive">{reportError}</p> : null}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
