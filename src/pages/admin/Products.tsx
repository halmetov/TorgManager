import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Archive, Pencil, RefreshCcw } from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: number;
  quantity: number;
  is_archived: boolean;
  created_at: string;
}

const emptyForm = {
  name: "",
  price: "",
  quantity: "",
};

export default function AdminProducts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const { data: products = [], isFetching } = useQuery<Product[]>({
    queryKey: ["products", showArchived],
    queryFn: () => api.getProducts(showArchived),
  });

  useEffect(() => {
    if (!dialogOpen) {
      setEditingProduct(null);
      setFormData(emptyForm);
    }
  }, [dialogOpen]);

  const displayedProducts = useMemo(() => {
    if (showArchived) {
      return products;
    }
    return products.filter((product) => !product.is_archived);
  }, [products, showArchived]);

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; price: number; quantity: number }) =>
      api.createProduct(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Товар добавлен" });
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Не удалось добавить товар",
        description: error?.message || "Произошла ошибка",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; data: any }) => api.updateProduct(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Товар обновлен" });
      setDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Не удалось обновить товар",
        description: error?.message || "Произошла ошибка",
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.archiveProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Товар перемещен в архив" });
    },
    onError: (error: any) => {
      toast({
        title: "Не удалось архивировать товар",
        description: error?.message || "Произошла ошибка",
        variant: "destructive",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => api.updateProduct(id, { is_archived: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Товар восстановлен" });
    },
    onError: (error: any) => {
      toast({
        title: "Не удалось восстановить товар",
        description: error?.message || "Произошла ошибка",
        variant: "destructive",
      });
    },
  });

  const openCreateDialog = () => {
    setEditingProduct(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price.toString(),
      quantity: product.quantity.toString(),
    });
    setDialogOpen(true);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const payload = {
      name: formData.name.trim(),
      price: parseFloat(formData.price),
      quantity: parseFloat(formData.quantity),
    };

    if (!payload.name || Number.isNaN(payload.price) || Number.isNaN(payload.quantity)) {
      toast({
        title: "Проверьте данные",
        description: "Все поля обязательны и должны быть корректными",
        variant: "destructive",
      });
      return;
    }

    if (payload.price <= 0 || payload.quantity < 0) {
      toast({
        title: "Некорректные значения",
        description: "Цена должна быть больше 0, количество не может быть отрицательным",
        variant: "destructive",
      });
      return;
    }

    if (editingProduct) {
      updateMutation.mutate({
        id: editingProduct.id,
        data: { ...payload, is_archived: editingProduct.is_archived },
      });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Товары</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-archived" />
            <Label htmlFor="show-archived" className="cursor-pointer">
              Показывать архив
            </Label>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>Добавить товар</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Редактировать товар" : "Новый товар"}</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <Label htmlFor="product-name">Название</Label>
                  <Input
                    id="product-name"
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="product-price">Цена</Label>
                    <Input
                      id="product-price"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(event) => setFormData((prev) => ({ ...prev, price: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="product-quantity">Количество</Label>
                    <Input
                      id="product-quantity"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(event) => setFormData((prev) => ({ ...prev, quantity: event.target.value }))}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingProduct ? "Сохранить изменения" : "Добавить"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Список товаров</CardTitle>
          {isFetching && <span className="text-sm text-muted-foreground">Обновление данных...</span>}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead className="w-32 text-right">Цена</TableHead>
                <TableHead className="w-32 text-right">Остаток</TableHead>
                <TableHead className="w-32">Статус</TableHead>
                <TableHead className="w-40 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedProducts.map((product) => (
                <TableRow key={product.id} className={product.is_archived ? "opacity-70" : undefined}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="text-right">{product.price.toFixed(2)} ₸</TableCell>
                  <TableCell className="text-right">{product.quantity.toFixed(2)}</TableCell>
                  <TableCell>
                    {product.is_archived ? (
                      <span className="text-sm text-muted-foreground">В архиве</span>
                    ) : (
                      <span className="text-sm text-emerald-600">Активен</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="icon" onClick={() => openEditDialog(product)}>
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Редактировать</span>
                      </Button>
                      {product.is_archived ? (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => restoreMutation.mutate(product.id)}
                          disabled={restoreMutation.isPending}
                        >
                          <RefreshCcw className="h-4 w-4" />
                          <span className="sr-only">Восстановить</span>
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => archiveMutation.mutate(product.id)}
                          disabled={archiveMutation.isPending}
                        >
                          <Archive className="h-4 w-4" />
                          <span className="sr-only">Архивировать</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {displayedProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {showArchived ? "Архив пуст" : "Нет товаров"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
