import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export default function ManagerReturns() {
  const { toast } = useToast();

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
    if (shopsError) {
      const message = shopsError instanceof Error ? shopsError.message : "Не удалось загрузить магазины";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [shopsError, toast]);

  const shopProductOptions = useMemo(() => {
    const term = shopProductSearch.trim().toLowerCase();
    if (!term) return stock;
    return stock.filter((product) => product.name.toLowerCase().includes(term));
  }, [stock, shopProductSearch]);

  const totalShopItems = shopReturnItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const shopReturnMutation = useMutation({
    mutationFn: (payload: { shop_id: number; items: { product_id: number; quantity: number }[] }) =>
      api.createShopReturn(payload),
    onSuccess: () => {
      toast({ title: "Возврат сохранён" });
      setShopId("");
      setShopReturnItems([]);
      setShopQuantityInput("");
      setSelectedShopProduct(null);
      setShopProductSearch("");
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Не удалось зарегистрировать возврат";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

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
    setShopReturnItems((current) => current.map((item) => (item.product_id === productId ? { ...item, quantity: value } : item)));
  };

  const handleShopItemRemove = (productId: number) => {
    setShopReturnItems((current) => current.filter((item) => item.product_id !== productId));
  };

  const handleShopReturnSubmit = (event: FormEvent<HTMLFormElement>) => {
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

  const isAddDisabled =
    !selectedShopProduct ||
    !shopQuantityInput.trim() ||
    Number.isNaN(Number(shopQuantityInput)) ||
    Number(shopQuantityInput) <= 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Возврат из магазинов</h1>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Зафиксировать возврат</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchStock()} disabled={stockLoading}>
            {stockLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Обновить остатки"}
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
                  <Button type="button" onClick={addShopReturnItem} disabled={isAddDisabled}>
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
        </CardContent>
      </Card>
    </div>
  );
}
