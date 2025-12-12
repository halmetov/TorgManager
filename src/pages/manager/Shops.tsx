import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CircleDollarSign, Pencil, Plus, Trash2 } from "lucide-react";

interface Shop {
  id: number;
  name: string;
  address: string;
  phone: string;
  refrigerator_number: string;
  manager_id: number;
  manager_name: string | null;
  debt?: number;
}

interface ShopPayload {
  name: string;
  address: string;
  phone: string;
  refrigerator_number: string;
}

const emptyForm: ShopPayload = {
  name: "",
  address: "",
  phone: "",
  refrigerator_number: "",
};

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function ManagerShops() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDebtOpen, setIsDebtOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ShopPayload>(emptyForm);
  const [editForm, setEditForm] = useState<ShopPayload>(emptyForm);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [debtShop, setDebtShop] = useState<Shop | null>(null);
  const [debtAmount, setDebtAmount] = useState("");

  const {
    data: shops = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["shops", "me"],
    queryFn: () => api.getMyShops(),
  });

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить магазины";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [error, toast]);

  const shopsList = useMemo(() => {
    if (!Array.isArray(shops)) {
      return [] as Shop[];
    }
    return shops as Shop[];
  }, [shops]);

  const resetCreateForm = () => setCreateForm(emptyForm);
  const resetEditForm = () => setEditForm(emptyForm);
  const resetDebtForm = () => {
    setDebtAmount("");
    setDebtShop(null);
  };

  const createMutation = useMutation({
    mutationFn: (payload: ShopPayload) => api.createShop(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shops", "me"] });
      toast({ title: "Магазин добавлен" });
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: (mutationError: any) => {
      const message = mutationError?.message ?? "Не удалось добавить магазин";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ShopPayload> }) => api.updateShop(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shops", "me"] });
      toast({ title: "Магазин обновлён" });
      setIsEditOpen(false);
      setSelectedShop(null);
      resetEditForm();
    },
    onError: (mutationError: any) => {
      const message = mutationError?.message ?? "Не удалось обновить магазин";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteShop(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shops", "me"] });
      toast({ title: "Магазин удалён" });
    },
    onError: (mutationError: any) => {
      const message =
        mutationError?.data?.detail ?? mutationError?.message ?? "Не удалось удалить магазин";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const adjustDebtMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => api.adjustShopDebt(id, { amount }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["shops", "me"] });
      const debtValue = typeof data?.debt === "number" ? data.debt : null;
      toast({
        title: "Долг обновлён",
        description:
          debtValue !== null
            ? `Текущий долг: ${currencyFormatter.format(debtValue)} ₸`
            : "Значение долга обновлено",
      });
      setIsDebtOpen(false);
      resetDebtForm();
    },
    onError: (mutationError: any) => {
      const message = mutationError?.message ?? "Не удалось обновить долг";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const handleCreateSubmit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate({
      name: createForm.name.trim(),
      address: createForm.address.trim(),
      phone: createForm.phone.trim(),
      refrigerator_number: createForm.refrigerator_number.trim(),
    });
  };

  const handleEditSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedShop) return;

    updateMutation.mutate({
      id: selectedShop.id,
      payload: {
        name: editForm.name.trim(),
        address: editForm.address.trim(),
        phone: editForm.phone.trim(),
        refrigerator_number: editForm.refrigerator_number.trim(),
      },
    });
  };

  const handleEditClick = (shop: Shop) => {
    setSelectedShop(shop);
    setEditForm({
      name: shop.name,
      address: shop.address,
      phone: shop.phone,
      refrigerator_number: shop.refrigerator_number,
    });
    setIsEditOpen(true);
  };

  const handleDelete = (shop: Shop) => {
    if (window.confirm(`Удалить магазин "${shop.name}"?`)) {
      deleteMutation.mutate(shop.id);
    }
  };

  const handleDebtClick = (shop: Shop) => {
    setDebtShop(shop);
    setDebtAmount("");
    setIsDebtOpen(true);
  };

  const handleDebtSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!debtShop) return;

    const parsed = Number(debtAmount);
    if (Number.isNaN(parsed)) {
      toast({ title: "Ошибка", description: "Введите корректную сумму", variant: "destructive" });
      return;
    }

    adjustDebtMutation.mutate({ id: debtShop.id, amount: parsed });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">Мои магазины</h1>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            resetCreateForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Добавить магазин
            </Button>
          </DialogTrigger>
          <DialogContent className="w-full max-w-[90vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Новый магазин</DialogTitle>
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
                <Label htmlFor="create-address">Адрес</Label>
                <Input
                  id="create-address"
                  value={createForm.address}
                  onChange={(event) => setCreateForm({ ...createForm, address: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="create-phone">Телефон</Label>
                <Input
                  id="create-phone"
                  value={createForm.phone}
                  onChange={(event) => setCreateForm({ ...createForm, phone: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="create-fridge">Номер холодильника</Label>
                <Input
                  id="create-fridge"
                  value={createForm.refrigerator_number}
                  onChange={(event) =>
                    setCreateForm({ ...createForm, refrigerator_number: event.target.value })
                  }
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                Сохранить
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список магазинов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {isLoading ? (
              <div className="rounded-lg border p-4 text-center text-muted-foreground">Загрузка...</div>
            ) : shopsList.length === 0 ? (
              <div className="rounded-lg border p-4 text-center text-muted-foreground">Магазины не найдены</div>
            ) : (
              shopsList.map((shop) => (
                <div key={shop.id} className="rounded-lg border p-4 space-y-3 bg-card">
                  <div>
                    <h3 className="text-lg font-semibold leading-tight">{shop.name}</h3>
                    {shop.address ? (
                      <p className="text-sm text-muted-foreground">{shop.address}</p>
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {shop.phone ? <p>Телефон: {shop.phone}</p> : null}
                    <p>Холодильник: {shop.refrigerator_number}</p>
                    <p>Долг: {currencyFormatter.format(shop.debt ?? 0)} ₸</p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => handleDebtClick(shop)}
                      aria-label={`Изменить долг ${shop.name}`}
                    >
                      <CircleDollarSign className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditClick(shop)}
                      aria-label={`Редактировать ${shop.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(shop)}
                      aria-label={`Удалить ${shop.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
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
                  <TableHead>Название</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>№ Холодильника</TableHead>
                  <TableHead>Долг</TableHead>
                  <TableHead className="w-[180px] text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : shopsList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Магазины не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  shopsList.map((shop) => (
                    <TableRow key={shop.id}>
                      <TableCell>{shop.name}</TableCell>
                      <TableCell>{shop.address}</TableCell>
                      <TableCell>{shop.phone}</TableCell>
                      <TableCell>{shop.refrigerator_number}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {currencyFormatter.format(shop.debt ?? 0)} ₸
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => handleDebtClick(shop)}
                            aria-label={`Изменить долг ${shop.name}`}
                          >
                            <CircleDollarSign className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditClick(shop)}
                            aria-label={`Редактировать ${shop.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDelete(shop)}
                            aria-label={`Удалить ${shop.name}`}
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
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) {
          setSelectedShop(null);
          resetEditForm();
        }
      }}>
        <DialogContent className="w-full max-w-[90vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Редактировать магазин</DialogTitle>
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
              <Label htmlFor="edit-address">Адрес</Label>
              <Input
                id="edit-address"
                value={editForm.address}
                onChange={(event) => setEditForm({ ...editForm, address: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Телефон</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-fridge">Номер холодильника</Label>
              <Input
                id="edit-fridge"
                value={editForm.refrigerator_number}
                onChange={(event) =>
                  setEditForm({ ...editForm, refrigerator_number: event.target.value })
                }
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              Сохранить изменения
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDebtOpen}
        onOpenChange={(open) => {
          setIsDebtOpen(open);
          if (!open && !adjustDebtMutation.isPending) {
            resetDebtForm();
          }
        }}
      >
        <DialogContent className="w-full max-w-[90vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {debtShop ? `Изменить долг магазина ${debtShop.name}` : "Изменить долг"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDebtSubmit} className="space-y-4">
            <div>
              <Label htmlFor="debt-amount">Сумма</Label>
              <Input
                id="debt-amount"
                type="number"
                step="0.01"
                value={debtAmount}
                onChange={(event) => setDebtAmount(event.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                Положительное число увеличивает долг, отрицательное — уменьшает
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={adjustDebtMutation.isPending || !debtShop}>
              {adjustDebtMutation.isPending ? "Сохранение..." : "Обновить долг"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
