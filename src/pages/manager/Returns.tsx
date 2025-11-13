import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronDown, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ManagerStockItem {
  product_id: number;
  name: string;
  quantity: number;
  price?: number | null;
}

interface ManagerReturnItem {
  product_id: number;
  product_name: string;
  quantity: number;
}

interface ManagerReturn {
  id: number;
  manager_id: number;
  created_at: string;
  items: ManagerReturnItem[];
}

interface ShopReturnItem {
  product_id: number;
  product_name: string;
  quantity: number;
}

interface ShopReturn {
  id: number;
  manager_id: number;
  shop_id: number;
  shop_name: string;
  created_at: string;
  items: ShopReturnItem[];
}

interface ShopInfo {
  id: number;
  name: string;
  address?: string | null;
}

interface ShopReturnFormItem {
  product_id: number;
  product_name: string;
  quantity: string;
}

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

export default function ManagerReturns() {
  const { toast } = useToast();

  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [managerReturnDetail, setManagerReturnDetail] = useState<ManagerReturn | null>(null);
  const [shopReturnDetail, setShopReturnDetail] = useState<ShopReturn | null>(null);
  const [shopId, setShopId] = useState("");
  const [shopReturnItems, setShopReturnItems] = useState<ShopReturnFormItem[]>([]);
  const [shopProductSearch, setShopProductSearch] = useState("");
  const [shopProductOpen, setShopProductOpen] = useState(false);
  const [selectedShopProduct, setSelectedShopProduct] = useState<ManagerStockItem | null>(null);
  const [shopQuantityInput, setShopQuantityInput] = useState("");

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
    data: managerReturns = [],
    isFetching: managerReturnsLoading,
    error: managerReturnsError,
    refetch: refetchManagerReturns,
  } = useQuery<ManagerReturn[]>({
    queryKey: ["manager", "returns", "warehouse"],
    queryFn: () => api.getManagerReturns() as Promise<ManagerReturn[]>,
  });

  const {
    data: shopReturns = [],
    isFetching: shopReturnsLoading,
    error: shopReturnsError,
    refetch: refetchShopReturns,
  } = useQuery<ShopReturn[]>({
    queryKey: ["manager", "shop-returns"],
    queryFn: () => api.getShopReturns() as Promise<ShopReturn[]>,
  });

  const {
    data: shops = [],
    isFetching: shopsLoading,
    error: shopsError,
  } = useQuery<ShopInfo[]>({
    queryKey: ["manager", "shops"],
    queryFn: () => api.getMyShops() as Promise<ShopInfo[]>,
  });

  useEffect(() => {
    if (stockError) {
      const message = stockError instanceof Error ? stockError.message : "Не удалось загрузить остатки";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [stockError, toast]);

  useEffect(() => {
    if (managerReturnsError) {
      const message =
        managerReturnsError instanceof Error ? managerReturnsError.message : "Не удалось загрузить возвраты";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [managerReturnsError, toast]);

  useEffect(() => {
    if (shopReturnsError) {
      const message = shopReturnsError instanceof Error ? shopReturnsError.message : "Не удалось загрузить возвраты";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [shopReturnsError, toast]);

  useEffect(() => {
    if (shopsError) {
      const message = shopsError instanceof Error ? shopsError.message : "Не удалось загрузить магазины";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [shopsError, toast]);

  const stockMap = useMemo(() => {
    const map = new Map<number, ManagerStockItem>();
    for (const item of stock) {
      map.set(item.product_id, item);
    }
    return map;
  }, [stock]);

  const shopProductOptions = useMemo(() => {
    const term = shopProductSearch.trim().toLowerCase();
    const items = stock;
    if (!term) return items;
    return items.filter((product) => product.name.toLowerCase().includes(term));
  }, [stock, shopProductSearch]);

  const managerSelectedItems = useMemo(() => {
    return stock
      .map((item) => ({
        product_id: item.product_id,
        name: item.name,
        available: item.quantity,
        requested: Number(quantities[item.product_id] ?? 0),
      }))
      .filter((item) => !Number.isNaN(item.requested) && item.requested > 0);
  }, [stock, quantities]);

  const managerReturnMutation = useMutation({
    mutationFn: (payload: { items: { product_id: number; quantity: number }[] }) => api.createManagerReturn(payload),
    onSuccess: () => {
      toast({ title: "Возврат отправлен на склад" });
      setQuantities({});
      refetchStock();
      refetchManagerReturns();
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

  const shopReturnMutation = useMutation({
    mutationFn: (payload: { shop_id: number; items: { product_id: number; quantity: number }[] }) =>
      api.createShopReturn(payload),
    onSuccess: () => {
      toast({ title: "Возврат магазина зарегистрирован" });
      setShopId("");
      setShopReturnItems([]);
      setShopQuantityInput("");
      setSelectedShopProduct(null);
      setShopProductSearch("");
      refetchShopReturns();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Не удалось зарегистрировать возврат";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const handleQuantityChange = (productId: number, value: string) => {
    setQuantities((prev) => ({ ...prev, [productId]: value }));
  };

  const handleReturnAll = () => {
    const next: Record<number, string> = {};
    for (const item of stock) {
      if (item.quantity > 0) {
        next[item.product_id] = String(item.quantity);
      }
    }
    setQuantities(next);
  };

  const handleManagerReturnSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (managerReturnMutation.isPending) return;

    if (managerSelectedItems.length === 0) {
      toast({ title: "Ошибка", description: "Укажите количество хотя бы для одного товара", variant: "destructive" });
      return;
    }

    for (const item of managerSelectedItems) {
      if (item.requested > item.available) {
        toast({
          title: "Ошибка",
          description: `${item.name}: в наличии ${item.available}, пытаетесь вернуть ${item.requested}`,
          variant: "destructive",
        });
        return;
      }
    }

    managerReturnMutation.mutate({
      items: managerSelectedItems.map((item) => ({ product_id: item.product_id, quantity: item.requested })),
    });
  };

  const handleSelectShopProduct = (product: ManagerStockItem) => {
    setSelectedShopProduct(product);
    setShopProductSearch(product.name);
    setShopProductOpen(false);
  };

  const addShopReturnItem = () => {
    if (!selectedShopProduct) {
      toast({ title: "Ошибка", description: "Выберите товар", variant: "destructive" });
      return;
    }

    const quantityValue = Number(shopQuantityInput.trim());
    if (!shopQuantityInput.trim() || Number.isNaN(quantityValue) || quantityValue <= 0) {
      toast({ title: "Ошибка", description: "Количество должно быть больше нуля", variant: "destructive" });
      return;
    }

    setShopReturnItems((current) => {
      const index = current.findIndex((item) => item.product_id === selectedShopProduct.product_id);
      if (index >= 0) {
        const next = [...current];
        next[index] = {
          ...next[index],
          quantity: String(Number(next[index].quantity) + quantityValue),
        };
        return next;
      }

      return [
        ...current,
        {
          product_id: selectedShopProduct.product_id,
          product_name: selectedShopProduct.name,
          quantity: String(quantityValue),
        },
      ];
    });

    setSelectedShopProduct(null);
    setShopQuantityInput("");
    setShopProductSearch("");
    setShopProductOpen(false);
  };

  const handleShopItemQuantityChange = (productId: number, value: string) => {
    setShopReturnItems((current) =>
      current.map((item) => (item.product_id === productId ? { ...item, quantity: value } : item))
    );
  };

  const handleShopItemRemove = (productId: number) => {
    setShopReturnItems((current) => current.filter((item) => item.product_id !== productId));
  };

  const handleShopReturnSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (shopReturnMutation.isPending) return;

    if (!shopId) {
      toast({ title: "Ошибка", description: "Выберите магазин", variant: "destructive" });
      return;
    }

    if (shopReturnItems.length === 0) {
      toast({ title: "Ошибка", description: "Добавьте хотя бы один товар", variant: "destructive" });
      return;
    }

    const aggregated = new Map<number, number>();
    for (const item of shopReturnItems) {
      const quantityNumber = Number(item.quantity.trim());
      if (item.quantity.trim() === "" || Number.isNaN(quantityNumber) || quantityNumber <= 0) {
        toast({ title: "Ошибка", description: "Количество должно быть больше нуля", variant: "destructive" });
        return;
      }

      aggregated.set(item.product_id, (aggregated.get(item.product_id) ?? 0) + quantityNumber);
    }

    shopReturnMutation.mutate({
      shop_id: Number(shopId),
      items: Array.from(aggregated.entries()).map(([product_id, quantity]) => ({ product_id, quantity })),
    });
  };

  const totalManagerRequested = managerSelectedItems.reduce((sum, item) => sum + item.requested, 0);
  const totalShopItems = shopReturnItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Возвраты</h1>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Возврат в главный склад</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReturnAll} disabled={stock.length === 0}>
              Вернуть всё
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetchStock()} disabled={stockLoading}>
              {stockLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Обновить"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManagerReturnSubmit} className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead className="w-24">Доступно</TableHead>
                  <TableHead className="w-32">К возврату</TableHead>
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
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Всего к возврату: {totalManagerRequested}</p>
              <Button type="submit" className="w-full sm:w-56" disabled={managerReturnMutation.isPending}>
                {managerReturnMutation.isPending ? "Отправка..." : "Отправить возврат"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>История возвратов в главный склад</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchManagerReturns()} disabled={managerReturnsLoading}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">№</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="w-24 text-right">Подробнее</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managerReturnsLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : managerReturns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Возвратов пока нет
                  </TableCell>
                </TableRow>
              ) : (
                managerReturns.map((returnDoc) => (
                  <TableRow key={returnDoc.id}>
                    <TableCell>{returnDoc.id}</TableCell>
                    <TableCell>{fmt(returnDoc.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setManagerReturnDetail(returnDoc)}>
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

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Возврат из магазинов</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchShopReturns()} disabled={shopReturnsLoading}>
            Обновить историю
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleShopReturnSubmit} className="space-y-6">
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
                <div className="flex gap-2">
                  <Popover open={shopProductOpen} onOpenChange={setShopProductOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-between">
                        {selectedShopProduct ? selectedShopProduct.name : "Выберите товар"}
                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Поиск товара..."
                          value={shopProductSearch}
                          onValueChange={setShopProductSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Товар не найден</CommandEmpty>
                          <CommandGroup>
                            {shopProductOptions.map((product) => (
                              <CommandItem
                                key={product.product_id}
                                value={String(product.product_id)}
                                onSelect={() => handleSelectShopProduct(product)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedShopProduct?.product_id === product.product_id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="flex-1">{product.name}</span>
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
                    value={shopQuantityInput}
                    onChange={(event) => setShopQuantityInput(event.target.value)}
                    placeholder="Кол-во"
                    className="w-24"
                  />
                  <Button type="button" onClick={addShopReturnItem} disabled={!selectedShopProduct || !shopQuantityInput}>
                    Добавить
                  </Button>
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead className="w-32">Количество</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shopReturnItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Товары не выбраны
                    </TableCell>
                  </TableRow>
                ) : (
                  shopReturnItems.map((item) => (
                    <TableRow key={item.product_id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={item.quantity}
                          onChange={(event) => handleShopItemQuantityChange(item.product_id, event.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleShopItemRemove(item.product_id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Всего позиций: {totalShopItems}</p>
              <Button type="submit" className="w-full sm:w-56" disabled={shopReturnMutation.isPending}>
                {shopReturnMutation.isPending ? "Отправка..." : "Зафиксировать возврат"}
              </Button>
            </div>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">№</TableHead>
                <TableHead>Магазин</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="w-24 text-right">Подробнее</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shopReturnsLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : shopReturns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Возвратов пока нет
                  </TableCell>
                </TableRow>
              ) : (
                shopReturns.map((returnDoc) => (
                  <TableRow key={returnDoc.id}>
                    <TableCell>{returnDoc.id}</TableCell>
                    <TableCell>{returnDoc.shop_name}</TableCell>
                    <TableCell>{fmt(returnDoc.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setShopReturnDetail(returnDoc)}>
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

      <Dialog open={managerReturnDetail !== null} onOpenChange={(open) => !open && setManagerReturnDetail(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Детали возврата в склад</DialogTitle>
          </DialogHeader>
          {!managerReturnDetail ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Дата: {fmt(managerReturnDetail.created_at)}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="w-32">Количество</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managerReturnDetail.items.map((item) => (
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

      <Dialog open={shopReturnDetail !== null} onOpenChange={(open) => !open && setShopReturnDetail(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Детали возврата магазина</DialogTitle>
          </DialogHeader>
          {!shopReturnDetail ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Магазин: {shopReturnDetail.shop_name}</p>
                <p>Дата: {fmt(shopReturnDetail.created_at)}</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="w-32">Количество</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shopReturnDetail.items.map((item) => (
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
