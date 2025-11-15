import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ManagerStockItem {
  product_id: number;
  name: string;
  quantity: number;
  price?: number | null;
}

interface ShopInfo {
  id: number;
  name: string;
  address?: string | null;
}

interface ShopOrderItem {
  product_id: number;
  product_name: string;
  quantity: number;
  price?: number | null;
  is_bonus: boolean;
}

interface ShopOrderPayment {
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
}

interface ShopOrder {
  id: number;
  manager_id: number;
  shop_id: number;
  shop_name: string;
  created_at: string;
  items: ShopOrderItem[];
  payment?: ShopOrderPayment | null;
}

interface OrderFormItem {
  product_id: number;
  product_name: string;
  quantity: string;
  price: string;
  is_bonus: boolean;
}

interface ShopOrderCreatePayload {
  shop_id: number;
  items: { product_id: number; quantity: number; price?: number | null; is_bonus: boolean }[];
  payment?: { paid_amount: number } | null;
}

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

export default function ManagerOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [shopId, setShopId] = useState("");
  const [items, setItems] = useState<OrderFormItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ManagerStockItem | null>(null);
  const [quantityInput, setQuantityInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [detailOrder, setDetailOrder] = useState<ShopOrder | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [pendingOrderPayload, setPendingOrderPayload] = useState<ShopOrderCreatePayload | null>(null);
  const [pendingTotalAmount, setPendingTotalAmount] = useState(0);
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const {
    data: stock = [],
    isFetching: stockLoading,
    error: stockError,
    refetch: refetchStock,
  } = useQuery<ManagerStockItem[]>({
    queryKey: ["manager", "stock"],
    queryFn: () => api.getManagerStock() as Promise<ManagerStockItem[]>,
  });

  const {
    data: shops = [],
    error: shopsError,
    isFetching: shopsLoading,
  } = useQuery<ShopInfo[]>({
    queryKey: ["manager", "shops"],
    queryFn: () => api.getMyShops() as Promise<ShopInfo[]>,
  });

  const {
    data: orders = [],
    isFetching: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery<ShopOrder[]>({
    queryKey: ["manager", "shop-orders"],
    queryFn: () => api.getShopOrders() as Promise<ShopOrder[]>,
  });

  useEffect(() => {
    if (stockError) {
      const message = stockError instanceof Error ? stockError.message : "Не удалось загрузить остатки";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [stockError, toast]);

  useEffect(() => {
    if (shopsError) {
      const message = shopsError instanceof Error ? shopsError.message : "Не удалось загрузить магазины";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [shopsError, toast]);

  useEffect(() => {
    if (ordersError) {
      const message = ordersError instanceof Error ? ordersError.message : "Не удалось загрузить историю выдач";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [ordersError, toast]);

  const availableProducts = useMemo(
    () => stock.filter((product) => product.quantity > 0),
    [stock]
  );

  const stockMap = useMemo(() => {
    const map = new Map<number, ManagerStockItem>();
    for (const item of stock) {
      map.set(item.product_id, item);
    }
    return map;
  }, [stock]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return availableProducts;
    return availableProducts.filter((product) => product.name.toLowerCase().includes(term));
  }, [availableProducts, productSearch]);

  const resetProductSelection = () => {
    setSelectedProduct(null);
    setQuantityInput("");
    setPriceInput("");
    setProductSearch("");
    setProductOpen(false);
  };

  const handleSelectProduct = (product: ManagerStockItem) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setPriceInput(product.price != null ? String(product.price) : "");
    setProductOpen(false);
  };

  const addItem = () => {
    if (!selectedProduct) {
      toast({ title: "Ошибка", description: "Выберите товар", variant: "destructive" });
      return;
    }

    const quantityValue = Number(quantityInput.trim());
    if (!quantityInput.trim() || Number.isNaN(quantityValue) || quantityValue <= 0) {
      toast({ title: "Ошибка", description: "Количество должно быть больше нуля", variant: "destructive" });
      return;
    }

    const available = selectedProduct.quantity;
    const existing = items.find((item) => item.product_id === selectedProduct.product_id);
    const alreadyRequested = existing ? Number(existing.quantity) : 0;
    if (quantityValue + alreadyRequested > available) {
      toast({
        title: "Недостаточно товара",
        description: `${selectedProduct.name}: доступно ${available}, пытаетесь выдать ${quantityValue + alreadyRequested}`,
        variant: "destructive",
      });
      return;
    }

    const priceValue = priceInput.trim();
    const priceNumber = priceValue === "" ? null : Number(priceValue);
    if (priceValue !== "" && (Number.isNaN(priceNumber) || priceNumber < 0)) {
      toast({ title: "Ошибка", description: "Цена должна быть неотрицательной", variant: "destructive" });
      return;
    }

    setItems((current) => {
      const index = current.findIndex((item) => item.product_id === selectedProduct.product_id);
      if (index >= 0) {
        const next = [...current];
        next[index] = {
          ...next[index],
          quantity: String(Number(next[index].quantity) + quantityValue),
          price: priceNumber === null ? next[index].price : String(priceNumber),
        };
        return next;
      }

      return [
        ...current,
        {
          product_id: selectedProduct.product_id,
          product_name: selectedProduct.name,
          quantity: String(quantityValue),
          price: priceNumber === null ? "" : String(priceNumber),
          is_bonus: false,
        },
      ];
    });

    resetProductSelection();
  };

  const handleQuantityChange = (productId: number, value: string) => {
    setItems((current) => current.map((item) => (item.product_id === productId ? { ...item, quantity: value } : item)));
  };

  const handlePriceChange = (productId: number, value: string) => {
    setItems((current) => current.map((item) => (item.product_id === productId ? { ...item, price: value } : item)));
  };

  const handleBonusToggle = (productId: number, checked: boolean) => {
    setItems((current) =>
      current.map((item) => (item.product_id === productId ? { ...item, is_bonus: checked } : item))
    );
  };

  const handleRemoveItem = (productId: number) => {
    setItems((current) => current.filter((item) => item.product_id !== productId));
  };

  const orderMutation = useMutation({
    mutationFn: (payload: ShopOrderCreatePayload) => api.createShopOrder(payload),
    onSuccess: () => {
      toast({ title: "Товары выданы магазину" });
      setShopId("");
      setItems([]);
      resetProductSelection();
      setPendingOrderPayload(null);
      setPaymentDialogOpen(false);
      setPendingTotalAmount(0);
      setPaidAmountInput("");
      setPaymentError(null);
      queryClient.invalidateQueries({ queryKey: ["manager", "stock"] });
      refetchOrders();
    },
    onError: (mutationError: unknown) => {
      const error = mutationError as (Error & { status?: number; data?: any }) | undefined;
      if (error?.status === 409 && error.data?.error === "INSUFFICIENT_STOCK") {
        const shortages: Array<{ product_id: number; requested: number; available: number }> =
          Array.isArray(error.data.items) ? error.data.items : [];
        const lines = shortages.map((shortage) => {
          const stockItem = stockMap.get(shortage.product_id);
          const name = stockItem?.name ?? `Товар ${shortage.product_id}`;
          return `${name}: нужно ${shortage.requested}, доступно ${shortage.available}`;
        });
        toast({
          title: "Недостаточно товара на складе",
          description: lines.length > 0 ? lines.join("\n") : error.message,
          variant: "destructive",
        });
        return;
      }

      const message = error?.message || "Не удалось оформить выдачу";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (orderMutation.isPending) return;

    if (!shopId) {
      toast({ title: "Ошибка", description: "Выберите магазин", variant: "destructive" });
      return;
    }

    if (items.length === 0) {
      toast({ title: "Ошибка", description: "Добавьте хотя бы один товар", variant: "destructive" });
      return;
    }

    for (const item of items) {
      const quantityNumber = Number(item.quantity.trim());
      if (item.quantity.trim() === "" || Number.isNaN(quantityNumber) || quantityNumber <= 0) {
        toast({ title: "Ошибка", description: "Количество должно быть больше нуля", variant: "destructive" });
        return;
      }

      const stockItem = stockMap.get(item.product_id);
      const available = stockItem?.quantity ?? 0;
      if (quantityNumber > available) {
        toast({
          title: "Недостаточно товара",
          description: `${stockItem?.name ?? `Товар ${item.product_id}`}: доступно ${available}, указано ${quantityNumber}`,
          variant: "destructive",
        });
        return;
      }

      if (item.price.trim() !== "") {
        const priceNumber = Number(item.price.trim());
        if (Number.isNaN(priceNumber) || priceNumber < 0) {
          toast({ title: "Ошибка", description: "Цена должна быть неотрицательной", variant: "destructive" });
          return;
        }
      }
    }

    const payloadItems = items.map((item) => {
      const quantityNumber = Number(item.quantity.trim());
      const priceValue = item.price.trim() === "" ? null : Number(item.price.trim());
      return {
        product_id: item.product_id,
        quantity: quantityNumber,
        price: priceValue,
        is_bonus: item.is_bonus,
      };
    });

    const computedTotal = payloadItems.reduce((sum, item) => {
      const product = stockMap.get(item.product_id);
      const price = item.price ?? product?.price ?? 0;
      return sum + item.quantity * (price ?? 0);
    }, 0);

    setPendingOrderPayload({
      shop_id: Number(shopId),
      items: payloadItems,
    });
    setPendingTotalAmount(computedTotal);
    setPaidAmountInput(computedTotal ? computedTotal.toFixed(2) : "0");
    setPaymentError(null);
    setPaymentDialogOpen(true);
  };

  const totalRequested = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity || 0);
      if (Number.isNaN(quantity)) {
        return sum;
      }

      const stockItem = stockMap.get(item.product_id);
      const priceValue = item.price.trim() !== "" ? Number(item.price) : stockItem?.price ?? 0;
      if (Number.isNaN(priceValue) || priceValue == null) {
        return sum;
      }

      return sum + quantity * priceValue;
    }, 0);
  }, [items, stockMap]);
  const handlePaidAmountChange = (value: string) => {
    setPaidAmountInput(value);
    if (value.trim() === "") {
      setPaymentError(null);
      return;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      setPaymentError("Введите корректную сумму");
      return;
    }

    if (parsed < 0) {
      setPaymentError("Сумма не может быть отрицательной");
      return;
    }

    if (parsed > pendingTotalAmount) {
      setPaymentError("Сумма не может превышать общий заказ");
      return;
    }

    setPaymentError(null);
  };

  const handleConfirmOrder = () => {
    if (!pendingOrderPayload) {
      return;
    }

    const parsed = paidAmountInput.trim() === "" ? 0 : Number(paidAmountInput);
    if (Number.isNaN(parsed)) {
      setPaymentError("Введите корректную сумму");
      return;
    }

    if (parsed < 0 || parsed > pendingTotalAmount) {
      setPaymentError("Сумма оплаты должна быть от 0 до общей суммы заказа");
      return;
    }

    orderMutation.mutate({
      ...pendingOrderPayload,
      payment: { paid_amount: parsed },
    });
  };

  const pendingPaid = paidAmountInput.trim() === "" ? 0 : Number(paidAmountInput);
  const pendingDebt = Math.max(
    Number.isNaN(pendingPaid) ? pendingTotalAmount : pendingTotalAmount - pendingPaid,
    0,
  );

  const handlePaymentDialogChange = (open: boolean) => {
    setPaymentDialogOpen(open);
    if (!open && !orderMutation.isPending) {
      setPendingOrderPayload(null);
      setPaymentError(null);
      setPendingTotalAmount(0);
      setPaidAmountInput("");
    }
  };

  const isAddDisabled =
    !selectedProduct ||
    !quantityInput.trim() ||
    Number.isNaN(Number(quantityInput)) ||
    Number(quantityInput) <= 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Выдача в магазины</h1>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Оформить выдачу</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchStock()} disabled={stockLoading}>
            {stockLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Обновить остатки"}
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Магазин</Label>
                <Select value={shopId} onValueChange={setShopId} disabled={shopsLoading || shops.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите магазин" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {shops.map((shop) => (
                      <SelectItem key={shop.id} value={String(shop.id)}>
                        {shop.name}
                        {shop.address ? ` — ${shop.address}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Добавить товар</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Popover open={productOpen} onOpenChange={setProductOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                        onClick={() => setProductOpen((prev) => !prev)}
                      >
                        {selectedProduct ? selectedProduct.name : "Выберите товар"}
                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(320px,90vw)] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Поиск товара..."
                          value={productSearch}
                          onValueChange={setProductSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Товар не найден</CommandEmpty>
                          <CommandGroup>
                            {filteredProducts.map((product) => (
                              <CommandItem
                                key={product.product_id}
                                value={String(product.product_id)}
                                onSelect={() => handleSelectProduct(product)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedProduct?.product_id === product.product_id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="flex-1">{product.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  Остаток: {product.quantity}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="number"
                    min={0}
                    value={quantityInput}
                    onChange={(event) => setQuantityInput(event.target.value)}
                    placeholder="Кол-во"
                    className="w-full sm:w-24"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={priceInput}
                    onChange={(event) => setPriceInput(event.target.value)}
                    placeholder="Цена"
                    className="w-full sm:w-28"
                  />
                  <Button type="button" onClick={addItem} disabled={isAddDisabled}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="w-28">Доступно</TableHead>
                    <TableHead className="w-28">Количество</TableHead>
                    <TableHead className="w-32">Цена</TableHead>
                  <TableHead className="w-24 text-center">Бонус</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Товары не выбраны
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => {
                      const stockItem = stockMap.get(item.product_id);
                      return (
                        <TableRow key={item.product_id}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell>{stockItem?.quantity ?? 0}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={item.quantity}
                              onChange={(event) => handleQuantityChange(item.product_id, event.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.price}
                              placeholder="—"
                              onChange={(event) => handlePriceChange(item.product_id, event.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={item.is_bonus}
                              onCheckedChange={(checked) =>
                                handleBonusToggle(item.product_id, checked === true)
                              }
                              aria-label={`Пометить ${item.product_name} как бонус`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.product_id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 md:hidden">
              {items.length === 0 ? (
                <div className="rounded-lg border p-4 text-center text-muted-foreground">Товары не выбраны</div>
              ) : (
                items.map((item) => {
                  const stockItem = stockMap.get(item.product_id);
                  return (
                    <div key={item.product_id} className="rounded-lg border p-4 space-y-3 bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold leading-tight">{item.product_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Остаток: {stockItem?.quantity ?? 0}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <p className="text-xs uppercase text-muted-foreground">Количество</p>
                          <Input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(event) => handleQuantityChange(item.product_id, event.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs uppercase text-muted-foreground">Цена</p>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.price}
                            placeholder="—"
                            onChange={(event) => handlePriceChange(item.product_id, event.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={item.is_bonus}
                            onCheckedChange={(checked) =>
                              handleBonusToggle(item.product_id, checked === true)
                            }
                            aria-label={`Пометить ${item.product_name} как бонус`}
                          />
                          <span className="text-sm">Бонус</span>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.product_id)}
                          aria-label={`Удалить ${item.product_name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Всего товаров: {totalRequested}</p>
              <p className="text-sm text-muted-foreground">
                Сумма заказа: {currencyFormatter.format(totalAmount)}
              </p>
              <Button type="submit" className="w-full sm:w-56" disabled={orderMutation.isPending}>
                {orderMutation.isPending ? "Отправка..." : "Отдать"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>История выдач в магазины</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchOrders()} disabled={ordersLoading}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {ordersLoading ? (
              <div className="rounded-lg border p-4 text-center text-muted-foreground">Загрузка...</div>
            ) : orders.length === 0 ? (
              <div className="rounded-lg border p-4 text-center text-muted-foreground">Выдач пока нет</div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="rounded-lg border p-4 space-y-3 bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold leading-tight">{order.shop_name}</h3>
                      <p className="text-sm text-muted-foreground">{fmt(order.created_at)}</p>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">#{order.id}</span>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setDetailOrder(order)}>
                      Подробнее
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">№</TableHead>
                  <TableHead>Магазин</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="w-24 text-right">Позиции</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Выдач пока нет
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.id}</TableCell>
                      <TableCell>{order.shop_name}</TableCell>
                      <TableCell>{fmt(order.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setDetailOrder(order)}>
                          Подробнее
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

      <Dialog open={detailOrder !== null} onOpenChange={(open) => !open && setDetailOrder(null)}>
        <DialogContent className="w-full max-w-[90vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Детали выдачи</DialogTitle>
          </DialogHeader>
          {!detailOrder ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Магазин: {detailOrder.shop_name}</p>
                <p>Дата: {fmt(detailOrder.created_at)}</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Товар</TableHead>
                      <TableHead className="w-32">Количество</TableHead>
                      <TableHead className="w-32">Цена</TableHead>
                      <TableHead className="w-24 text-center">Бонус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailOrder.items.map((item) => (
                      <TableRow key={item.product_id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.price ?? "—"}</TableCell>
                        <TableCell className="text-center">{item.is_bonus ? "Да" : "Нет"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Сумма: {currencyFormatter.format(detailOrder.payment?.total_amount ?? 0)}</p>
                <p>Оплачено: {currencyFormatter.format(detailOrder.payment?.paid_amount ?? detailOrder.payment?.total_amount ?? 0)}</p>
                <p>Долг: {currencyFormatter.format(detailOrder.payment?.debt_amount ?? 0)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={handlePaymentDialogChange}>
        <DialogContent className="w-full max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Оплата заказа</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Сумма заказа: {currencyFormatter.format(pendingTotalAmount)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paid-amount">Сколько клиент платит сейчас</Label>
              <Input
                id="paid-amount"
                type="number"
                min={0}
                step="0.01"
                value={paidAmountInput}
                onChange={(event) => handlePaidAmountChange(event.target.value)}
              />
              <p className="text-sm text-muted-foreground">Долг: {currencyFormatter.format(pendingDebt)}</p>
              {paymentError ? <p className="text-sm text-destructive">{paymentError}</p> : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handlePaymentDialogChange(false)} disabled={orderMutation.isPending}>
              Отмена
            </Button>
            <Button onClick={handleConfirmOrder} disabled={orderMutation.isPending || paymentError !== null}>
              {orderMutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
