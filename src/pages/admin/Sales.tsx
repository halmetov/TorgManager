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
import { Check, Loader2, Plus, Printer, Trash2 } from "lucide-react";

interface CounterpartyOption {
  id: number;
  name: string;
  company?: string | null;
  debt?: number;
}

interface ProductOption {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

interface SalesHistoryItem {
  id: number;
  counterparty: CounterpartyOption;
  created_at: string;
  total_amount: number;
  paid_total: number;
  new_debt_added: number;
  debt_after: number;
}

interface SaleDetailItem {
  product_id: number;
  product_name: string;
  quantity: number;
  price_at_time: number;
  line_total: number;
}

interface SaleDetail {
  id: number;
  counterparty: CounterpartyOption;
  created_at: string;
  total_amount: number;
  paid_kaspi: number;
  paid_cash: number;
  paid_debt: number;
  paid_total: number;
  new_debt_added: number;
  old_debt: number;
  debt_after: number;
  items: SaleDetailItem[];
}

interface SalesItemForm {
  id: string;
  product_id?: number;
  product_name?: string;
  quantity: string;
  price: string;
  confirmed: boolean;
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" });

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AdminSales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [counterpartyId, setCounterpartyId] = useState<string>("");
  const [items, setItems] = useState<SalesItemForm[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ kaspi: "", cash: "", debt: "" });

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchControllerRef = useRef<AbortController | null>(null);

  const { data: counterparties = [], error: counterpartiesError } = useQuery({
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
    data: salesHistory = [],
    isLoading,
    error: salesError,
  } = useQuery({
    queryKey: ["counterparty-sales"],
    queryFn: () => api.getAdminCounterpartySales(),
  });

  useEffect(() => {
    if (salesError) {
      const message = salesError instanceof Error ? salesError.message : "Не удалось загрузить историю продаж";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [salesError, toast]);

  const { data: saleDetail, isFetching: detailLoading } = useQuery({
    queryKey: ["counterparty-sale", detailId],
    queryFn: () => api.getAdminCounterpartySale(detailId!),
    enabled: detailId !== null,
  });

  useEffect(() => {
    if (saleDetail) {
      setDetailOpen(true);
    }
  }, [saleDetail]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (searchControllerRef.current) {
        searchControllerRef.current.abort();
      }
    };
  }, []);

  const createMutation = useMutation({
    mutationFn: (payload: {
      counterparty_id: number;
      items: { product_id: number; quantity: number; price: number }[];
      payment: { kaspi: number; cash: number; debt: number };
    }) => api.createAdminCounterpartySale(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counterparty-sales"] });
      queryClient.invalidateQueries({ queryKey: ["counterparties"] });
      toast({ title: "Продажа оформлена" });
      setItems([]);
      setCounterpartyId("");
      setPaymentOpen(false);
      setPaymentForm({ kaspi: "", cash: "", debt: "" });
    },
    onError: (mutationError: any) => {
      const message = mutationError?.message ?? "Не удалось создать продажу";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity);
      const price = Number(item.price);
      if (Number.isNaN(quantity) || Number.isNaN(price)) return sum;
      return sum + quantity * price;
    }, 0);
  }, [items]);

  const selectedCounterparty = useMemo(() => {
    const list = Array.isArray(counterparties) ? (counterparties as CounterpartyOption[]) : [];
    return list.find((counterparty) => String(counterparty.id) === counterpartyId) ?? null;
  }, [counterparties, counterpartyId]);

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

  const handleSelectProduct = (index: number, option: ProductOption) => {
    cancelScheduledSearch(true);
    setProductSearch(option.name);
    setProductOptions([]);
    setProductLoading(false);
    setProductPickerOpen(false);
    setActiveRowIndex(null);

    setItems((prev) => {
      const existingIndex = prev.findIndex((item, idx) => item.product_id === option.id && idx !== index);
      if (existingIndex !== -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        updated[existingIndex] = {
          ...existing,
          quantity: String(Number(existing.quantity || 0) + 1),
        };
        updated.splice(index, 1);
        return updated;
      }
      return prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              product_id: option.id,
              product_name: option.name,
              quantity: item.quantity || "1",
              price: item.price || String(option.price ?? 0),
            }
          : item
      );
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        quantity: "1",
        price: "0",
        confirmed: false,
      },
    ]);
  };

  const handleItemChange = (index: number, field: "quantity" | "price", value: string) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const toggleConfirm = (index: number) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, confirmed: !item.confirmed } : item)));
  };

  const openPayment = () => {
    if (!counterpartyId) {
      toast({ title: "Ошибка", description: "Выберите контрагента", variant: "destructive" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Ошибка", description: "Добавьте товары", variant: "destructive" });
      return;
    }
    const invalidItem = items.find(
      (item) =>
        !item.product_id ||
        Number.isNaN(Number(item.quantity)) ||
        Number(item.quantity) <= 0 ||
        Number.isNaN(Number(item.price)) ||
        Number(item.price) < 0
    );
    if (invalidItem) {
      toast({ title: "Ошибка", description: "Проверьте товары и цены", variant: "destructive" });
      return;
    }
    setPaymentForm({ kaspi: totalAmount.toFixed(2), cash: "0", debt: "0" });
    setPaymentOpen(true);
  };

  const handleSubmitSale = () => {
    const kaspi = Number(paymentForm.kaspi);
    const cash = Number(paymentForm.cash);
    const debt = Number(paymentForm.debt);

    if ([kaspi, cash, debt].some((value) => Number.isNaN(value) || value < 0)) {
      toast({ title: "Ошибка", description: "Введите корректные суммы", variant: "destructive" });
      return;
    }

    const paymentSum = kaspi + cash + debt;
    if (Math.abs(paymentSum - totalAmount) > 0.01) {
      toast({
        title: "Ошибка",
        description: "Сумма оплаты должна равняться сумме продажи",
        variant: "destructive",
      });
      return;
    }

    const payloadItems = items
      .filter((item) => item.product_id)
      .map((item) => ({
        product_id: item.product_id!,
        quantity: Number(item.quantity),
        price: Number(item.price),
      }));

    createMutation.mutate({
      counterparty_id: Number(counterpartyId),
      items: payloadItems,
      payment: { kaspi, cash, debt },
    });
  };

  const handlePrint = (saleId: number) => {
    const url = `${apiBaseUrl}/admin/counterparty-sales/${saleId}/print`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleOpenDetail = (saleId: number) => {
    setDetailId(saleId);
  };

  const handleDetailOpenChange = (open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setDetailId(null);
    }
  };

  const counterpartiesList = Array.isArray(counterparties) ? (counterparties as CounterpartyOption[]) : [];
  const historyList = Array.isArray(salesHistory) ? (salesHistory as SalesHistoryItem[]) : [];
  const detail = saleDetail as SaleDetail | undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Продажа</h1>

      <Card>
        <CardHeader>
          <CardTitle>Оптовая продажа контрагенту</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <div>
              <Label>Контрагент</Label>
              <Select value={counterpartyId} onValueChange={setCounterpartyId}>
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
            <div className="rounded-md border p-3 text-sm">
              Текущий долг: <span className="font-semibold">{(selectedCounterparty?.debt ?? 0).toFixed(2)} ₸</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Товары</Label>
            <Button variant="outline" onClick={handleAddItem}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить товар
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead>Кол-во</TableHead>
                  <TableHead>Цена</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Добавьте товары
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => {
                    const quantity = Number(item.quantity);
                    const price = Number(item.price);
                    const lineTotal =
                      Number.isNaN(quantity) || Number.isNaN(price) ? 0 : Math.max(quantity, 0) * Math.max(price, 0);

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="min-w-[220px]">
                          <Popover
                            open={productPickerOpen && activeRowIndex === index}
                            onOpenChange={(open) => {
                              setProductPickerOpen(open);
                              setActiveRowIndex(open ? index : null);
                              if (open) {
                                setProductSearch("");
                                scheduleSearch("");
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between" disabled={item.confirmed}>
                                {item.product_name || "Выберите товар"}
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
                                        onSelect={() => handleSelectProduct(index, option)}
                                        className="flex items-center justify-between"
                                      >
                                        <span>{option.name}</span>
                                        <span className="text-xs text-muted-foreground">Доступно: {option.quantity}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={item.quantity}
                            onChange={(event) => handleItemChange(index, "quantity", event.target.value)}
                            disabled={item.confirmed}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(event) => handleItemChange(index, "price", event.target.value)}
                            disabled={item.confirmed}
                          />
                        </TableCell>
                        <TableCell>{lineTotal.toFixed(2)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => toggleConfirm(index)}>
                            <Check className={item.confirmed ? "h-4 w-4 text-emerald-600" : "h-4 w-4"} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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
              Итого: <span className="font-semibold text-foreground">{totalAmount.toFixed(2)} ₸</span>
            </div>
            <Button onClick={openPayment} disabled={createMutation.isPending}>
              Отправить / Сохранить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История продаж</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Контрагент</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Оплачено</TableHead>
                  <TableHead>Долг после</TableHead>
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
                ) : historyList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Продажи не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  historyList.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>
                        <div className="font-medium">{sale.counterparty.name}</div>
                        <div className="text-xs text-muted-foreground">{sale.counterparty.company || "—"}</div>
                      </TableCell>
                      <TableCell>{formatDateTime(sale.created_at)}</TableCell>
                      <TableCell>{sale.total_amount.toFixed(2)}</TableCell>
                      <TableCell>{sale.paid_total.toFixed(2)}</TableCell>
                      <TableCell>{sale.debt_after.toFixed(2)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" onClick={() => handleOpenDetail(sale.id)}>
                          Подробнее
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handlePrint(sale.id)}>
                          <Printer className="h-4 w-4" />
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

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Оплата продажи</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Сумма продажи</Label>
              <div className="h-10 flex items-center rounded-md border px-3 text-sm">
                {totalAmount.toFixed(2)} ₸
              </div>
            </div>
            <div>
              <Label htmlFor="payment-kaspi">Kaspi</Label>
              <Input
                id="payment-kaspi"
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.kaspi}
                onChange={(event) => setPaymentForm({ ...paymentForm, kaspi: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="payment-cash">Наличные</Label>
              <Input
                id="payment-cash"
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.cash}
                onChange={(event) => setPaymentForm({ ...paymentForm, cash: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="payment-debt">В долг</Label>
              <Input
                id="payment-debt"
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.debt}
                onChange={(event) => setPaymentForm({ ...paymentForm, debt: event.target.value })}
              />
            </div>
            <Button onClick={handleSubmitSale} disabled={createMutation.isPending}>
              Провести продажу
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={handleDetailOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Детали продажи</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Загрузка...</div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-muted-foreground">Контрагент</div>
                  <div className="font-medium">{detail.counterparty.name}</div>
                  <div className="text-xs text-muted-foreground">{detail.counterparty.company || "—"}</div>
                </div>
                <div className="text-sm text-muted-foreground">{formatDateTime(detail.created_at)}</div>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Товар</TableHead>
                      <TableHead>Кол-во</TableHead>
                      <TableHead>Цена</TableHead>
                      <TableHead>Сумма</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((item) => (
                      <TableRow key={item.product_id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.price_at_time.toFixed(2)}</TableCell>
                        <TableCell>{item.line_total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1 text-sm">
                  <div>Сумма: {detail.total_amount.toFixed(2)} ₸</div>
                  <div>Kaspi: {detail.paid_kaspi.toFixed(2)} ₸</div>
                  <div>Наличные: {detail.paid_cash.toFixed(2)} ₸</div>
                  <div>В долг: {detail.paid_debt.toFixed(2)} ₸</div>
                </div>
                <div className="space-y-1 text-sm">
                  <div>Старый долг: {detail.old_debt.toFixed(2)} ₸</div>
                  <div>Добавлено долга: {detail.new_debt_added.toFixed(2)} ₸</div>
                  <div>Долг после: {detail.debt_after.toFixed(2)} ₸</div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => handlePrint(detail.id)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Печать
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
