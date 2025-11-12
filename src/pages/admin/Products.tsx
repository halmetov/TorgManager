import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";

interface DispatchRecord {
  id: number;
  manager_id: number;
  manager_name?: string;
  product_id: number;
  product_name: string;
  quantity: number;
  status: string;
  created_at: string;
  accepted_at?: string | null;
}

interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default function AdminProducts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", quantity: "", price: "" });
  const [editForm, setEditForm] = useState({ name: "", quantity: "", price: "" });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const {
    data: products = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["products", { q: debouncedSearch }],
    queryFn: () => api.getProducts({ q: debouncedSearch, mainOnly: true }),
  });

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить товары";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [error, toast]);

  const resetCreateForm = () => setCreateForm({ name: "", quantity: "", price: "" });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; quantity: number; price: number }) => api.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Товар добавлен" });
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: (mutationError: any) => {
      const message = mutationError?.message ?? "Не удалось добавить товар";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; quantity: number; price: number } }) =>
      api.updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Товар обновлён" });
      setIsEditOpen(false);
      setSelectedProduct(null);
    },
    onError: (mutationError: any) => {
      const message = mutationError?.message ?? "Не удалось обновить товар";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Товар удалён" });
    },
    onError: (mutationError: any) => {
      const status = mutationError?.status;
      const message =
        status === 409
          ? "Нельзя удалить товар, он участвует в операциях"
          : mutationError?.message ?? "Не удалось удалить товар";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const handleCreateSubmit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate({
      name: createForm.name.trim(),
      quantity: Number(createForm.quantity),
      price: Number(createForm.price),
    });
  };

  const handleEditSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProduct) return;

    updateMutation.mutate({
      id: selectedProduct.id,
      data: {
        name: editForm.name.trim(),
        quantity: Number(editForm.quantity),
        price: Number(editForm.price),
      },
    });
  };

  const openEditDialog = (product: Product) => {
    setSelectedProduct(product);
    setEditForm({
      name: product.name,
      quantity: product.quantity.toString(),
      price: product.price.toString(),
    });
    setIsEditOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Удалить товар?")) {
      deleteMutation.mutate(id);
    }
  };

  const isCreateValid = useMemo(() => {
    const nameValid = createForm.name.trim().length > 0;
    const quantityValid = createForm.quantity !== "" && !Number.isNaN(Number(createForm.quantity));
    const priceValid = createForm.price !== "" && !Number.isNaN(Number(createForm.price));
    return nameValid && quantityValid && priceValid;
  }, [createForm]);

  const isEditValid = useMemo(() => {
    const nameValid = editForm.name.trim().length > 0;
    const quantityValid = editForm.quantity !== "" && !Number.isNaN(Number(editForm.quantity));
    const priceValid = editForm.price !== "" && !Number.isNaN(Number(editForm.price));
    return nameValid && quantityValid && priceValid;
  }, [editForm]);

  const productsList = Array.isArray(products) ? (products as Product[]) : [];

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

  const formatDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold">Товары</h1>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по названию"
            className="md:w-72"
          />
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Добавить товар
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый товар</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="create-name">Название</Label>
                  <Input
                    id="create-name"
                    value={createForm.name}
                    onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="create-quantity">Количество</Label>
                  <Input
                    id="create-quantity"
                    type="number"
                    min="0"
                    value={createForm.quantity}
                    onChange={(event) => setCreateForm({ ...createForm, quantity: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="create-price">Цена</Label>
                  <Input
                    id="create-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.price}
                    onChange={(event) => setCreateForm({ ...createForm, price: event.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={!isCreateValid || createMutation.isPending}>
                  Сохранить
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список товаров главного склада</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Количество</TableHead>
                <TableHead>Цена</TableHead>
                <TableHead className="w-32 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : productsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Нет товаров
                  </TableCell>
                </TableRow>
              ) : (
                productsList.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.quantity}</TableCell>
                    <TableCell>{product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₸</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="icon" onClick={() => openEditDialog(product)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDelete(product.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) {
          setSelectedProduct(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать товар</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Название</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-quantity">Количество</Label>
              <Input
                id="edit-quantity"
                type="number"
                min="0"
                value={editForm.quantity}
                onChange={(event) => setEditForm({ ...editForm, quantity: event.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-price">Цена</Label>
              <Input
                id="edit-price"
                type="number"
                min="0"
                step="0.01"
                value={editForm.price}
                onChange={(event) => setEditForm({ ...editForm, price: event.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={!isEditValid || updateMutation.isPending}>
              Сохранить изменения
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Отправки</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchDispatches()} disabled={dispatchesLoading}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">№</TableHead>
                <TableHead>Менеджер</TableHead>
                <TableHead>Товар</TableHead>
                <TableHead>Количество</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Создано</TableHead>
                <TableHead>Принято</TableHead>
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
                dispatches.map((dispatch) => (
                  <TableRow key={dispatch.id}>
                    <TableCell>{dispatch.id}</TableCell>
                    <TableCell>{dispatch.manager_name ?? "—"}</TableCell>
                    <TableCell>{dispatch.product_name}</TableCell>
                    <TableCell>{dispatch.quantity}</TableCell>
                    <TableCell>
                      {dispatch.status === "sent" ? "отправлен" : dispatch.status === "pending" ? "в ожидании" : dispatch.status}
                    </TableCell>
                    <TableCell>{formatDate(dispatch.created_at)}</TableCell>
                    <TableCell>{dispatch.status === "sent" ? formatDate(dispatch.accepted_at) : "—"}</TableCell>
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
