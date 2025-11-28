import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

interface DispatchItemDetail {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
}

interface DispatchDocument {
  id: number;
  manager_id: number;
  manager_name?: string | null;
  status: string;
  created_at: string;
  accepted_at?: string | null;
  items: DispatchItemDetail[];
}

interface DispatchFormItem {
  product_id: number;
  product_name: string;
  quantity: string;
  price: string;
}

interface ProductOption {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

interface ManagerInfo {
  id: number;
  full_name: string;
  username: string;
  is_active: boolean;
}

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

const STATUS_LABELS: Record<string, string> = {
  pending: "в ожидании",
  sent: "отправлен",
};

export default function AdminDispatch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [managerId, setManagerId] = useState("");
  const [items, setItems] = useState<DispatchFormItem[]>([]);
  const [productOpen, setProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [quantityInput, setQuantityInput] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchControllerRef = useRef<AbortController | null>(null);

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
    return () => {
      cancelScheduledSearch(true);
    };
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
        .filter((product) => product.manager_id === null || product.manager_id === undefined)
        .map((product) => ({
          id: product.id,
          name: product.name,
          quantity: product.quantity,
          price: product.price,
        }));

      setProductOptions(options);
    } catch (error) {
      if ((error instanceof DOMException || error instanceof Error) && error.name === "AbortError") {
        return;
      }
      const message = error instanceof Error ? error.message : "Не удалось выполнить поиск";
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
    if (selectedProduct && value.trim() !== selectedProduct.name) {
      setSelectedProduct(null);
    }
    scheduleSearch(value);
  };

  const handleSelectProduct = (option: ProductOption) => {
    cancelScheduledSearch(true);
    setSelectedProduct(option);
    setProductSearch(option.name);
    setPriceInput(String(option.price));
    setProductOptions([]);
    setProductLoading(false);
    setProductOpen(false);
  };

  const resetSelection = () => {
    cancelScheduledSearch(true);
    setSelectedProduct(null);
    setProductSearch("");
    setProductOptions([]);
    setProductLoading(false);
    setPriceInput("");
    setQuantityInput("");
  };

  const { data: managers = [] } = useQuery<ManagerInfo[]>({
    queryKey: ["managers"],
    queryFn: async () => (await api.getManagers()) as ManagerInfo[],
  });

  const fetchDispatchHistory = async (): Promise<DispatchDocument[]> => {
    return api.getDispatches() as Promise<DispatchDocument[]>;
  };

  const {
    data: history = [],
    isFetching: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["dispatches"],
    queryFn: fetchDispatchHistory,
  });

  useEffect(() => {
    if (historyError) {
      const message = historyError instanceof Error ? historyError.message : "Не удалось загрузить отправки";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [historyError, toast]);

  const {
    data: dispatchDetail,
    isFetching: detailLoading,
    error: detailError,
  } = useQuery({
    queryKey: ["dispatch", detailId],
    queryFn: () => api.getDispatch(detailId!) as Promise<DispatchDocument>,
    enabled: detailId !== null,
  });

  useEffect(() => {
    if (detailError) {
      const message = detailError instanceof Error ? detailError.message : "Не удалось загрузить отправку";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [detailError, toast]);

  const dispatchMutation = useMutation({
    mutationFn: (data: { manager_id: number; items: { product_id: number; quantity: number; price: number }[] }) =>
      api.createDispatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      refetchHistory();
      toast({ title: "Товары отправлены водителю" });
      setManagerId("");
      setItems([]);
      resetSelection();
    },
    onError: (mutationError: unknown) => {
      const error = mutationError as (Error & { status?: number; data?: any }) | undefined;
      if (error?.status === 409 && error.data?.error === "INSUFFICIENT_STOCK") {
        const shortages: Array<{ product_id: number; requested: number; available: number }> =
          Array.isArray(error.data.items) ? error.data.items : [];
        const lines = shortages.map((shortage) => {
          const existing = items.find((item) => item.product_id === shortage.product_id);
          const name = existing?.product_name ? existing.product_name : `Товар ${shortage.product_id}`;
          return `${name}: нужно ${shortage.requested}, доступно ${shortage.available}`;
        });
        toast({
          title: "Недостаточно товара на складе",
          description: lines.length > 0 ? lines.join("\n") : error.message,
          variant: "destructive",
        });
        return;
      }

      const message = error?.message || "Не удалось создать отправку";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const addItem = () => {
    if (!selectedProduct) {
      toast({ title: "Ошибка", description: "Выберите товар", variant: "destructive" });
      return;
    }

    const quantityValue = quantityInput.trim();
    const quantityNumber = Number(quantityValue);
    if (!quantityValue || Number.isNaN(quantityNumber) || quantityNumber <= 0) {
      toast({ title: "Ошибка", description: "Количество должно быть больше нуля", variant: "destructive" });
      return;
    }

    const priceValue = priceInput.trim();
    const priceNumber = Number(priceValue);
    if (priceValue === "" || Number.isNaN(priceNumber) || priceNumber < 0) {
      toast({ title: "Ошибка", description: "Цена должна быть неотрицательной", variant: "destructive" });
      return;
    }

    setItems((current) => {
      const index = current.findIndex((item) => item.product_id === selectedProduct.id);
      if (index >= 0) {
        const next = [...current];
        next[index] = {
          ...next[index],
          quantity: String(Number(next[index].quantity) + quantityNumber),
          price: priceNumber.toString(),
        };
        return next;
      }

      return [
        ...current,
        {
          product_id: selectedProduct.id,
          product_name: selectedProduct.name,
          quantity: String(quantityNumber),
          price: priceNumber.toString(),
        },
      ];
    });

    resetSelection();
  };

  const handleQuantityChange = (productId: number, value: string) => {
    setItems((current) =>
      current.map((item) => (item.product_id === productId ? { ...item, quantity: value } : item))
    );
  };

  const handlePriceChange = (productId: number, value: string) => {
    setItems((current) =>
      current.map((item) => (item.product_id === productId ? { ...item, price: value } : item))
    );
  };

  const handleRemoveItem = (productId: number) => {
    setItems((current) => current.filter((item) => item.product_id !== productId));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!managerId) {
      toast({ title: "Ошибка", description: "Выберите водителя", variant: "destructive" });
      return;
    }

    if (items.length === 0) {
      toast({ title: "Ошибка", description: "Добавьте хотя бы один товар", variant: "destructive" });
      return;
    }

    const invalidItem = items.find((item) => {
      const quantityValue = Number(item.quantity.trim());
      const priceValue = Number(item.price.trim());
      return (
        item.quantity.trim() === "" ||
        Number.isNaN(quantityValue) ||
        quantityValue <= 0 ||
        item.price.trim() === "" ||
        Number.isNaN(priceValue) ||
        priceValue < 0
      );
    });

    if (invalidItem) {
      toast({ title: "Ошибка", description: "Проверьте количество и цену товаров", variant: "destructive" });
      return;
    }

    const aggregated = new Map<number, { product_id: number; quantity: number; price: number }>();

    for (const item of items) {
      const productId = item.product_id;
      const quantityValue = Number(item.quantity);
      const priceValue = Number(item.price);
      const existing = aggregated.get(productId);
      if (existing) {
        existing.quantity += quantityValue;
        existing.price = priceValue;
      } else {
        aggregated.set(productId, {
          product_id: productId,
          quantity: quantityValue,
          price: priceValue,
        });
      }
    }

    dispatchMutation.mutate({
      manager_id: Number(managerId),
      items: Array.from(aggregated.values()),
    });
  };

  const parsedQuantity = Number(quantityInput);
  const parsedPrice = Number(priceInput);
  const isAddDisabled =
    !selectedProduct ||
    !quantityInput.trim() ||
    Number.isNaN(parsedQuantity) ||
    parsedQuantity <= 0 ||
    priceInput.trim() === "" ||
    Number.isNaN(parsedPrice) ||
    parsedPrice < 0;

  const isFormValid = useMemo(
    () =>
      Boolean(managerId) &&
      items.length > 0 &&
      items.every((item) => {
        const quantityValue = Number(item.quantity.trim());
        const priceValue = Number(item.price.trim());
        return (
          item.quantity.trim() !== "" &&
          !Number.isNaN(quantityValue) &&
          quantityValue > 0 &&
          item.price.trim() !== "" &&
          !Number.isNaN(priceValue) &&
          priceValue >= 0
        );
      }),
    [items, managerId]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Отправка</h1>

      <Card>
        <CardHeader>
          <CardTitle>Создание отправки</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>Выберите водителя</Label>
                <Select value={managerId} onValueChange={setManagerId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите водителя" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {managers
                      .filter((manager) => manager.is_active)
                      .map((manager) => (
                        <SelectItem key={manager.id} value={manager.id.toString()}>
                          {manager.full_name} ({manager.username})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
                  <div className="flex-1">
                    <Label>Товар</Label>
                    <Popover
                      open={productOpen}
                      onOpenChange={(open) => {
                        setProductOpen(open);
                        if (open) {
                          setProductSearch("");
                          setProductOptions([]);
                          scheduleSearch();
                        } else {
                          cancelScheduledSearch(true);
                          setProductOptions([]);
                          setProductSearch(selectedProduct ? selectedProduct.name : "");
                          setProductLoading(false);
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" role="combobox" className="w-full justify-between">
                          {selectedProduct ? (
                            <span className="truncate">{selectedProduct.name}</span>
                          ) : (
                            <span className="text-muted-foreground">Выберите товар</span>
                          )}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="p-0"
                        align="start"
                        style={{ width: "var(--radix-popover-trigger-width)", minWidth: "280px" }}
                      >
                        <Command>
                          <CommandInput
                            value={productSearch}
                            onValueChange={handleSearchChange}
                            placeholder="Начните вводить название товара"
                          />
                          <CommandList>
                            <CommandEmpty>
                              {productLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Поиск...
                                </span>
                              ) : productSearch.trim() ? (
                                "Ничего не найдено"
                              ) : (
                                "Введите название для поиска"
                              )}
                            </CommandEmpty>
                            {productOptions.length > 0 && (
                              <CommandGroup>
                                {productOptions.map((option) => (
                                  <CommandItem key={option.id} value={`${option.id}`} onSelect={() => handleSelectProduct(option)}>
                                    <div className="flex w-full items-center justify-between gap-3">
                                      <span className="truncate">{`${option.name} – остаток: ${option.quantity}`}</span>
                                      <span className="text-xs text-muted-foreground">Цена: {option.price}</span>
                                    </div>
                                    {selectedProduct?.id === option.id && (
                                      <Check className="ml-2 h-4 w-4 text-primary" />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="w-full lg:w-32">
                    <Label>Цена</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceInput}
                      onChange={(event) => setPriceInput(event.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <div className="w-full lg:w-32">
                    <Label>Количество</Label>
                    <Input
                      type="number"
                      min="1"
                      value={quantityInput}
                      onChange={(event) => setQuantityInput(event.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <Button type="button" variant="outline" onClick={addItem} disabled={isAddDisabled}>
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить
                  </Button>
                </div>

                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Товар</TableHead>
                        <TableHead className="w-32">Цена</TableHead>
                        <TableHead className="w-32">Количество</TableHead>
                        <TableHead className="w-32 text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Список пуст
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item) => (
                          <TableRow key={item.product_id}>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.price}
                                onChange={(event) => handlePriceChange(item.product_id, event.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(event) => handleQuantityChange(item.product_id, event.target.value)}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(item.product_id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="w-full lg:w-56" disabled={!isFormValid || dispatchMutation.isPending}>
                {dispatchMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  "Отправить"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Список отправок</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchHistory()} disabled={historyLoading}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">№</TableHead>
                  <TableHead>Водитель</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Создано</TableHead>
                  <TableHead>Принято</TableHead>
                <TableHead className="w-32 text-right">Подробнее</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Отправок пока нет
                  </TableCell>
                </TableRow>
              ) : (
                history.map((dispatch) => (
                  <TableRow key={dispatch.id}>
                    <TableCell>{dispatch.id}</TableCell>
                    <TableCell>{dispatch.manager_name ?? "—"}</TableCell>
                    <TableCell>{STATUS_LABELS[dispatch.status] ?? dispatch.status}</TableCell>
                    <TableCell>{fmt(dispatch.created_at)}</TableCell>
                    <TableCell>
                      {dispatch.status === "sent" ? fmt(dispatch.accepted_at) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setDetailId(dispatch.id)}>
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Детали отправки</DialogTitle>
          </DialogHeader>
          {detailLoading || !dispatchDetail ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Создано: {fmt(dispatchDetail.created_at)}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="w-32">Цена</TableHead>
                    <TableHead className="w-32">Количество</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispatchDetail.items.map((item) => (
                    <TableRow key={item.product_id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.price}</TableCell>
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
