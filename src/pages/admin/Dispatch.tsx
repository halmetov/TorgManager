import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DispatchHistoryItem {
  id: number;
  manager_id: number;
  manager_name?: string | null;
  status: string;
  created_at: string;
  accepted_at?: string | null;
}

interface DispatchFormItem {
  product_id: number;
  product_name: string;
  quantity: string;
  price?: number;
}

interface AdminProduct {
  id: number;
  name: string;
  quantity: number;
  price: number;
  manager_id: number | null;
  is_return?: boolean;
}

interface ManagerInfo {
  id: number;
  full_name: string;
  username: string;
  is_active: boolean;
}

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

export default function AdminDispatch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [managerId, setManagerId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState("");
  const [items, setItems] = useState<DispatchFormItem[]>([]);

  const { data: products = [] } = useQuery<AdminProduct[]>({
    queryKey: ["products"],
    queryFn: async () => (await api.getProducts(false)) as AdminProduct[],
  });

  const adminProducts = useMemo(
    () =>
      products.filter(
        (product) => !product.is_return && product.manager_id === null && product.quantity > 0
      ),
    [products]
  );

  const { data: managers = [] } = useQuery<ManagerInfo[]>({
    queryKey: ["managers"],
    queryFn: async () => (await api.getManagers()) as ManagerInfo[],
  });

  const fetchDispatchHistory = async (): Promise<DispatchHistoryItem[]> => {
    const client = api as unknown as { get: <T>(endpoint: string) => Promise<T> };
    return client.get("/dispatch");
  };

  const {
    data: history = [],
    isFetching: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["dispatch-history"],
    queryFn: fetchDispatchHistory,
  });

  useEffect(() => {
    if (historyError) {
      const message = historyError instanceof Error ? historyError.message : "Не удалось загрузить отправки";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [historyError, toast]);

  const dispatchMutation = useMutation({
    mutationFn: (data: { manager_id: number; items: { product_id: number; quantity: number }[] }) =>
      api.createDispatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      refetchHistory();
      toast({ title: "Товары отправлены менеджеру" });
      setManagerId("");
      setSelectedProductId("");
      setSelectedQuantity("");
      setItems([]);
    },
    onError: (mutationError: unknown) => {
      const message =
        mutationError instanceof Error ? mutationError.message : "Не удалось создать отправку";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const addItem = () => {
    if (!selectedProductId) {
      toast({ title: "Ошибка", description: "Выберите товар", variant: "destructive" });
      return;
    }

    const quantityValue = selectedQuantity.trim();
    const quantityNumber = Number(quantityValue);

    if (!quantityValue || Number.isNaN(quantityNumber) || quantityNumber <= 0) {
      toast({ title: "Ошибка", description: "Количество должно быть больше нуля", variant: "destructive" });
      return;
    }

    const productIdNumber = Number(selectedProductId);
    const product = adminProducts.find((item) => item.id === productIdNumber);

    if (!product) {
      toast({ title: "Ошибка", description: "Товар недоступен", variant: "destructive" });
      return;
    }

    setItems((current) => {
      const index = current.findIndex((item) => item.product_id === productIdNumber);
      if (index >= 0) {
        const next = [...current];
        next[index] = {
          ...next[index],
          quantity: String(Number(next[index].quantity) + quantityNumber),
        };
        return next;
      }

      return [
        ...current,
        {
          product_id: productIdNumber,
          product_name: product.name,
          quantity: String(quantityNumber),
          price: product.price,
        },
      ];
    });

    setSelectedProductId("");
    setSelectedQuantity("");
  };

  const handleQuantityChange = (productId: number, value: string) => {
    setItems((current) => current.map((item) => (item.product_id === productId ? { ...item, quantity: value } : item)));
  };

  const handleRemoveItem = (productId: number) => {
    setItems((current) => current.filter((item) => item.product_id !== productId));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!managerId) {
      toast({ title: "Ошибка", description: "Выберите менеджера", variant: "destructive" });
      return;
    }

    if (items.length === 0) {
      toast({ title: "Ошибка", description: "Добавьте хотя бы один товар", variant: "destructive" });
      return;
    }

    const invalidItem = items.find((item) => {
      const value = item.quantity.trim();
      const numberValue = Number(value);
      return !value || Number.isNaN(numberValue) || numberValue <= 0;
    });

    if (invalidItem) {
      toast({ title: "Ошибка", description: "Количество должно быть больше нуля", variant: "destructive" });
      return;
    }

    dispatchMutation.mutate({
      manager_id: Number(managerId),
      items: items.map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
      })),
    });
  };

  const parsedSelectedQuantity = Number(selectedQuantity);
  const isAddDisabled =
    !selectedProductId ||
    !selectedQuantity.trim() ||
    Number.isNaN(parsedSelectedQuantity) ||
    parsedSelectedQuantity <= 0;
  const isFormValid =
    Boolean(managerId) &&
    items.length > 0 &&
    items.every((item) => {
      const value = item.quantity.trim();
      const numberValue = Number(value);
      return Boolean(value) && !Number.isNaN(numberValue) && numberValue > 0;
    });

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
                <Label>Выберите менеджера</Label>
                <Select value={managerId} onValueChange={setManagerId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите менеджера" />
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
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите товар" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50 max-h-60 overflow-auto">
                        {adminProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name} (в наличии: {product.quantity}, цена: {product.price} ₸)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full lg:w-32">
                    <Label>Количество</Label>
                    <Input
                      type="number"
                      min="1"
                      value={selectedQuantity}
                      onChange={(event) => setSelectedQuantity(event.target.value)}
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
                        <TableHead className="w-32">Количество</TableHead>
                        <TableHead className="w-32 text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            Список пуст
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item) => (
                          <TableRow key={item.product_id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>{item.product_name}</span>
                                {item.price !== undefined && (
                                  <span className="text-xs text-muted-foreground">Цена: {item.price} ₸</span>
                                )}
                              </div>
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
                Отправить
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>История отправок</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchHistory()} disabled={historyLoading}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">№</TableHead>
                <TableHead>Менеджер</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Создано</TableHead>
                <TableHead>Принято</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Отправок пока нет
                  </TableCell>
                </TableRow>
              ) : (
                history.map((dispatch) => (
                  <TableRow key={dispatch.id}>
                    <TableCell>{dispatch.id}</TableCell>
                    <TableCell>{dispatch.manager_name ?? "—"}</TableCell>
                    <TableCell>
                      {dispatch.status === "sent"
                        ? "отправлен"
                        : dispatch.status === "pending"
                        ? "в ожидании"
                        : dispatch.status}
                    </TableCell>
                    <TableCell>{fmt(dispatch.created_at)}</TableCell>
                    <TableCell>{dispatch.status === "sent" ? fmt(dispatch.accepted_at) : "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
