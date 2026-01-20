import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, Loader2, Plus, Printer, Trash2 } from "lucide-react";

interface CounterpartyOption {
  id: number;
  name: string;
  company_name?: string | null;
}

interface SalesOrderListItem {
  id: number;
  counterparty_id: number;
  counterparty_name: string;
  created_at: string;
  status: "draft" | "closed";
  total_amount: number;
}

interface SalesOrderDetail {
  id: number;
  counterparty: CounterpartyOption;
  status: "draft" | "closed";
  created_at: string;
  closed_at?: string | null;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  items: SalesOrderItem[];
}

interface SalesOrderItem {
  product_id: number;
  product_name: string;
  quantity: number;
  price_at_time: number;
  line_total: number;
}

interface ProductOption {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

interface SalesItemForm {
  product_id: number;
  product_name: string;
  available: number;
  quantity: string;
  price: string;
}

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  closed: "Закрыт",
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" });

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AdminSales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [counterpartyFilter, setCounterpartyFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [activeOrder, setActiveOrder] = useState<SalesOrderDetail | null>(null);
  const [counterpartyId, setCounterpartyId] = useState<string>("");
  const [items, setItems] = useState<SalesItemForm[]>([]);

  const [productOpen, setProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productLoading, setProductLoading] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchControllerRef = useRef<AbortController | null>(null);

  const {
    data: counterparties = [],
    error: counterpartiesError,
  } = useQuery({
    queryKey: ["counterparties"],
    queryFn: () => api.getAdminCounterparties(),
  });

  useEffect(() => {
    if (counterpartiesError) {
      const message =
        counterpartiesError instanceof Error ? counterpartiesError.message : "Не удалось загрузить контрагентов";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [counterpartiesError, toast]);

  const {
    data: salesOrders = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["sales-orders", { statusFilter, counterpartyFilter, dateFrom, dateTo }],
    queryFn: () =>
      api.getAdminSalesOrders({
        status: statusFilter === "all" ? undefined : statusFilter,
        counterparty_id: counterpartyFilter === "all" ? undefined : Number(counterpartyFilter),
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
  });

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить продажи";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [error, toast]);

  const {
    data: orderDetail,
    isFetching: detailLoading,
  } = useQuery({
    queryKey: ["sales-order", detailId],
    queryFn: () => api.getAdminSalesOrder(detailId!),
    enabled: detailId !== null,
  });

  useEffect(() => {
    if (!orderDetail) return;
    const detail = orderDetail as SalesOrderDetail;
    setActiveOrder(detail);
    setCounterpartyId(String(detail.counterparty.id));
    setItems(
      detail.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        available: 0,
        quantity: String(item.quantity),
        price: String(item.price_at_time),
      }))
    );
    setIsDialogOpen(true);
  }, [orderDetail]);

  const resetForm = () => {
    setActiveOrder(null);
    setCounterpartyId("");
    setItems([]);
    setProductSearch("");
    setProductOptions([]);
    setPaidAmount("");
  };

  const createMutation = useMutation({
    mutationFn: (payload: { counterparty_id: number; items: { product_id: number; quantity: number; price: number }[] }) =>
      api.createAdminSalesOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast({ title: "Продажа создана" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (mutationError: any) => {
      const message = mutationError?.message ?? "Не удалось создать продажу";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; data: { counterparty_id: number; items: any[] } }) =>
      api.updateAdminSalesOrder(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast({ title: "Продажа обновлена" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (mutationError: any) => {
      const message = mutationError?.message ?? "Не удалось обновить продажу";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (payload: { id: number; paid_amount: number }) =>
      api.closeAdminSalesOrder(payload.id, { paid_amount: payload.paid_amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      toast({ title: "Продажа закрыта" });
      setPaymentOpen(false);
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (mutationError: any) => {
      const message = mutationError?.message ?? "Не удалось закрыть продажу";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const isReadOnly = activeOrder?.status === "closed";

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity);
      const price = Number(item.price);
      if (Number.isNaN(quantity) || Number.isNaN(price)) return sum;
      return sum + quantity * price;
    }, 0);
  }, [items]);

  const debtAmount = useMemo(() => {
    const paid = Number(paidAmount);
    if (Number.isNaN(paid)) return totalAmount;
    return Math.max(totalAmount - paid, 0);
  }, [paidAmount, totalAmount]);

  const cancelScheduledSearch = (abortOngoing = false) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    if (abortOngoing && searchControllerRef.current) {
      searchControllerRef.current.abort();
      searchControllerRef.current = null;
    }
  };

  useEffect(() => {
    return () => cancelScheduledSearch(true);
  }, []);

  const runSearch = async (query?: string) => {
    if (searchControllerRef.current) {
      searchControllerRef.current.abort();
    }
    const controller = new AbortController();
    searchControllerRef.current = controller;
    setProductLoading(true);

    try {
      const products = (await api.searchProducts(query, { signal: controller.signal })) as Array<
        ProductOption & { manager_id?: number | null; is_return?: boolean }
      >;

      const options = products
        .filter((product) => product.manager_id === null && !product.is_return)
        .map((product) => ({
          id: product.id,
          name: product.name,
          quantity: product.quantity,
          price: product.price,
        }));

      setProductOptions(options);
    } catch (searchError) {
      if ((searchError instanceof DOMException || searchError instanceof Error) && searchError.name === "AbortError") {
        return;
      }
      const message = searchError instanceof Error ? searchError.message : "Не удалось выполнить поиск";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    } finally {
      if (searchControllerRef.current === controller) {
        searchControllerRef.current = null;
      }
      setProductLoading(false);
    }
  };

  const scheduleSearch = (query?: string) => {
    cancelScheduledSearch(false);
    const trimmed = query?.trim();
    if (trimmed) {
      searchTimeoutRef.current = setTimeout(() => {
        searchTimeoutRef.current = null;
        runSearch(trimmed);
      }, 300);
    } else {
      runSearch(undefined);
    }
  };

  const handleSearchChange = (value: string) => {
    setProductSearch(value);
    scheduleSearch(value);
  };

  const handleSelectProduct = (option: ProductOption) => {
    cancelScheduledSearch(true);
    setProductSearch(option.name);
    setProductOptions([]);
    setProductLoading(false);
    setProductOpen(false);

    setItems((prev) => {
      const existing = prev.find((item) => item.product_id === option.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === option.id
            ? {
                ...item,
                quantity: String(Number(item.quantity || 0) + 1),
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: option.id,
          product_name: option.name,
          available: option.quantity,
          quantity: "1",
          price: String(option.price ?? 0),
        },
      ];
    });
  };

  const handleItemChange = (index: number, field: "quantity" | "price", value: string) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleOpenOrder = (orderId: number) => {
    setDetailId(orderId);
  };

  const handleSave = () => {
    const payloadItems = items.map((item) => ({
      product_id: item.product_id,
      quantity: Number(item.quantity),
      price: Number(item.price),
    }));

    if (!counterpartyId) {
      toast({ title: "Ошибка", description: "Выберите контрагента", variant: "destructive" });
      return;
    }

    if (payloadItems.length === 0) {
      toast({ title: "Ошибка", description: "Добавьте товары", variant: "destructive" });
      return;
    }

    if (activeOrder) {
      updateMutation.mutate({
        id: activeOrder.id,
        data: { counterparty_id: Number(counterpartyId), items: payloadItems },
      });
    } else {
      createMutation.mutate({ counterparty_id: Number(counterpartyId), items: payloadItems });
    }
  };

  const handleOpenPayment = () => {
    setPaidAmount(String(totalAmount));
    setPaymentOpen(true);
  };

  const handleCloseOrder = () => {
    if (!activeOrder) return;
    const paid = Number(paidAmount);
    if (Number.isNaN(paid) || paid < 0) {
      toast({ title: "Ошибка", description: "Введите корректную сумму оплаты", variant: "destructive" });
      return;
    }
    closeMutation.mutate({ id: activeOrder.id, paid_amount: paid });
  };

  const handlePrint = (orderId: number) => {
    const url = `${apiBaseUrl}/admin/sales-orders/${orderId}/print`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setDetailId(null);
      resetForm();
    }
  };

  const salesOrdersList = Array.isArray(salesOrders) ? (salesOrders as SalesOrderListItem[]) : [];
  const counterpartiesList = Array.isArray(counterparties) ? (counterparties as CounterpartyOption[]) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold">Продажи</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Создать продажу
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Статус</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="draft">Черновики</SelectItem>
                <SelectItem value="closed">Закрытые</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Контрагент</Label>
            <Select value={counterpartyFilter} onValueChange={setCounterpartyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Все контрагенты" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                {counterpartiesList.map((counterparty) => (
                  <SelectItem key={counterparty.id} value={String(counterparty.id)}>
                    {counterparty.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Дата с</Label>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>
          <div>
            <Label>Дата по</Label>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Список продаж</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>№</TableHead>
                  <TableHead>Контрагент</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : salesOrdersList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Продажи не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  salesOrdersList.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.id}</TableCell>
                      <TableCell>{order.counterparty_name}</TableCell>
                      <TableCell>{formatDateTime(order.created_at)}</TableCell>
                      <TableCell>{order.total_amount.toFixed(2)}</TableCell>
                      <TableCell>{statusLabels[order.status]}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" onClick={() => handleOpenOrder(order.id)}>
                          Открыть
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{activeOrder ? `Продажа №${activeOrder.id}` : "Новая продажа"}</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Загрузка...</div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Контрагент</Label>
                  <Select
                    value={counterpartyId}
                    onValueChange={setCounterpartyId}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите контрагента" />
                    </SelectTrigger>
                    <SelectContent>
                      {counterpartiesList.map((counterparty) => (
                        <SelectItem key={counterparty.id} value={String(counterparty.id)}>
                          {counterparty.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {activeOrder && (
                  <div>
                    <Label>Статус</Label>
                    <div className="h-10 flex items-center rounded-md border px-3 text-sm">
                      {statusLabels[activeOrder.status]}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Товары</Label>
                {!isReadOnly && (
                  <Popover open={productOpen} onOpenChange={setProductOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {productSearch || "Добавить товар"}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Поиск товара..."
                          value={productSearch}
                          onValueChange={handleSearchChange}
                        />
                        <CommandList>
                          {productLoading && (
                            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Загрузка...
                            </div>
                          )}
                          <CommandEmpty>Ничего не найдено</CommandEmpty>
                          <CommandGroup>
                            {productOptions.map((option) => (
                              <CommandItem
                                key={option.id}
                                onSelect={() => handleSelectProduct(option)}
                                className="flex items-center justify-between"
                              >
                                <span>{option.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  Доступно: {option.quantity}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead>Доступно</TableHead>
                      <TableHead>Кол-во</TableHead>
                      <TableHead>Цена</TableHead>
                      <TableHead>Сумма</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">
                          Нет товаров
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, index) => {
                        const quantity = Number(item.quantity);
                        const price = Number(item.price);
                        const lineTotal =
                          Number.isNaN(quantity) || Number.isNaN(price) ? 0 : quantity * price;
                        return (
                          <TableRow key={`${item.product_id}-${index}`}>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell>{item.available || "—"}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                value={item.quantity}
                                onChange={(event) => handleItemChange(index, "quantity", event.target.value)}
                                disabled={isReadOnly}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.price}
                                onChange={(event) => handleItemChange(index, "price", event.target.value)}
                                disabled={isReadOnly}
                              />
                            </TableCell>
                            <TableCell>{lineTotal.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              {!isReadOnly && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveItem(index)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                  Сумма заказа: <span className="font-semibold text-foreground">{totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  {activeOrder?.status === "closed" && (
                    <Button variant="outline" onClick={() => handlePrint(activeOrder.id)}>
                      <Printer className="mr-2 h-4 w-4" />
                      Печать
                    </Button>
                  )}
                  {!isReadOnly && (
                    <>
                      <Button variant="outline" onClick={handleSave} disabled={createMutation.isPending}>
                        Сохранить
                      </Button>
                      {activeOrder && (
                        <Button onClick={handleOpenPayment}>Закрыть заказ</Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Закрытие заказа</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Сумма заказа</Label>
              <div className="h-10 flex items-center rounded-md border px-3 text-sm">
                {totalAmount.toFixed(2)}
              </div>
            </div>
            <div>
              <Label htmlFor="paid-amount">Сколько оплатил контрагент сейчас</Label>
              <Input
                id="paid-amount"
                type="number"
                min="0"
                step="0.01"
                value={paidAmount}
                onChange={(event) => setPaidAmount(event.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              В долг: <span className="font-semibold text-foreground">{debtAmount.toFixed(2)}</span>
            </div>
            <Button onClick={handleCloseOrder} disabled={closeMutation.isPending}>
              Закрыть заказ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
