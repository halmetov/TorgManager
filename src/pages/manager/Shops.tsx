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
import { Pencil, Plus, Trash2 } from "lucide-react";

interface Shop {
  id: number;
  name: string;
  address: string;
  phone: string;
  refrigerator_number: string;
  manager_id: number;
  manager_name: string | null;
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

export default function ManagerShops() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ShopPayload>(emptyForm);
  const [editForm, setEditForm] = useState<ShopPayload>(emptyForm);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);

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
      const message = mutationError?.message ?? "Не удалось удалить магазин";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
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
          <DialogContent>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>№ Холодильника</TableHead>
                <TableHead className="w-[140px] text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : shopsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open);
        if (!open) {
          setSelectedShop(null);
          resetEditForm();
        }
      }}>
        <DialogContent>
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
    </div>
  );
}
