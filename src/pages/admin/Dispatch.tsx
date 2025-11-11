import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

interface Manager {
  id: number;
  full_name: string;
  username: string;
  is_active: boolean;
}

interface ProductOption {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface DispatchItemState {
  product: ProductOption;
  quantity: string;
  price: string;
}

function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default function AdminDispatch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [managerId, setManagerId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [resultInputs, setResultInputs] = useState<Record<number, { quantity: string; price: string }>>({});
  const [items, setItems] = useState<DispatchItemState[]>([]);

  const debouncedSearch = useDebounce(searchTerm, 350);

  const { data: managers = [] } = useQuery<Manager[]>({
    queryKey: ["managers"],
    queryFn: () => api.getManagers(),
  });

  const { data: searchResults = [], isFetching: isSearching } = useQuery<ProductOption[]>({
    queryKey: ["dispatch-search", debouncedSearch],
    queryFn: () => api.searchProducts(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!searchResults) {
      return;
    }
    setResultInputs((prev) => {
      const next: Record<number, { quantity: string; price: string }> = {};
      for (const product of searchResults) {
        next[product.id] = {
          quantity: prev[product.id]?.quantity ?? "",
          price: prev[product.id]?.price ?? product.price.toString(),
        };
      }
      return next;
    });
  }, [searchResults]);

  const dispatchMutation = useMutation({
    mutationFn: (payload: { manager_id: number; items: { product_id: number; quantity: number; price: number }[] }) =>
      api.createDispatch(payload),
    onSuccess: () => {
      toast({ title: "Отправка создана", description: "Статус: В ожидании" });
      setItems([]);
      setSearchTerm("");
      setResultInputs({});
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      toast({
        title: "Не удалось создать отправку",
        description: error?.message || "Произошла ошибка",
        variant: "destructive",
      });
    },
  });

  const handleAddItem = (product: ProductOption) => {
    const input = resultInputs[product.id];
    const quantity = parseFloat(input?.quantity || "0");
    const price = parseFloat(input?.price || product.price.toString());

    if (!input || Number.isNaN(quantity) || Number.isNaN(price) || quantity <= 0 || price <= 0) {
      toast({
        title: "Проверьте данные",
        description: "Введите количество и цену перед добавлением",
        variant: "destructive",
      });
      return;
    }

    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const newQuantity = (parseFloat(existing.quantity) || 0) + quantity;
        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          quantity: newQuantity.toString(),
          price: price.toString(),
        };
        return updated;
      }
      return [...prev, { product, quantity: quantity.toString(), price: price.toString() }];
    });

    setResultInputs((prev) => ({
      ...prev,
      [product.id]: { quantity: "", price: product.price.toString() },
    }));
  };

  const removeItem = (productId: number) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateItem = (productId: number, partial: Partial<{ quantity: string; price: string }>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              ...partial,
            }
          : item,
      ),
    );
  };

  const totalItems = useMemo(() => items.reduce((acc, item) => acc + (parseFloat(item.quantity) || 0), 0), [items]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!managerId) {
      toast({
        title: "Выберите менеджера",
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: "Добавьте товары",
        description: "Список отправки пуст",
        variant: "destructive",
      });
      return;
    }

    const payloadItems = items.map((item) => ({
      product_id: item.product.id,
      quantity: parseFloat(item.quantity),
      price: parseFloat(item.price),
    }));

    if (payloadItems.some((item) => Number.isNaN(item.quantity) || Number.isNaN(item.price) || item.quantity <= 0 || item.price <= 0)) {
      toast({
        title: "Некорректные значения",
        description: "Количество и цена должны быть больше нуля",
        variant: "destructive",
      });
      return;
    }

    dispatchMutation.mutate({
      manager_id: parseInt(managerId, 10),
      items: payloadItems,
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Отправка</h1>

      <Card>
        <CardHeader>
          <CardTitle>Создать отправку</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label>Менеджер</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите менеджера" />
                </SelectTrigger>
                <SelectContent className="bg-background">
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
              <div>
                <Label htmlFor="dispatch-search">Поиск товаров</Label>
                <Input
                  id="dispatch-search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Введите название товара"
                />
                <p className="mt-1 text-sm text-muted-foreground">Не менее 2 символов для поиска</p>
              </div>

              {debouncedSearch.length >= 2 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Найденные товары</span>
                    {isSearching && <span className="text-sm text-muted-foreground">Поиск...</span>}
                  </div>
                  <div className="grid gap-3">
                    {searchResults?.length ? (
                      searchResults.map((product) => {
                        const inputs = resultInputs[product.id] ?? { quantity: "", price: product.price.toString() };
                        return (
                          <div
                            key={product.id}
                            className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-end"
                          >
                            <div className="flex-1">
                              <div className="font-medium">{product.name}</div>
                              <div className="text-xs text-muted-foreground">
                                Цена: {product.price.toFixed(2)} ₸ · Остаток: {product.quantity.toFixed(2)}
                              </div>
                            </div>
                            <div className="flex flex-1 flex-col gap-2 md:flex-row">
                              <div className="flex-1">
                                <Label className="sr-only">Цена</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={inputs.price}
                                  onChange={(event) =>
                                    setResultInputs((prev) => ({
                                      ...prev,
                                      [product.id]: { ...inputs, price: event.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="flex-1">
                                <Label className="sr-only">Количество</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={inputs.quantity}
                                  onChange={(event) =>
                                    setResultInputs((prev) => ({
                                      ...prev,
                                      [product.id]: { ...inputs, quantity: event.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <Button type="button" onClick={() => handleAddItem(product)}>
                                Добавить
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                        Ничего не найдено
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">К отправке</h2>
                <span className="text-sm text-muted-foreground">Всего позиций: {items.length}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="w-32">Цена</TableHead>
                    <TableHead className="w-32">Количество</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.product.id}>
                      <TableCell>{item.product.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(event) => updateItem(item.product.id, { price: event.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(event) => updateItem(item.product.id, { quantity: event.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.product.id)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Удалить</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Список пуст
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {items.length > 0 && (
                <div className="text-sm text-muted-foreground">Всего единиц к отправке: {totalItems.toFixed(2)}</div>
              )}
            </div>

            <Button type="submit" className="w-full md:w-auto" disabled={dispatchMutation.isPending}>
              Отправить
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
