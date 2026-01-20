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

interface Counterparty {
  id: number;
  name: string;
  company_name?: string | null;
  phone?: string | null;
  iin_bin?: string | null;
  address?: string | null;
  created_at: string;
  created_by_admin_id: number;
  is_archived: boolean;
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default function AdminCounterparties() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedCounterparty, setSelectedCounterparty] = useState<Counterparty | null>(null);

  const [createForm, setCreateForm] = useState({
    name: "",
    company_name: "",
    phone: "",
    iin_bin: "",
    address: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    company_name: "",
    phone: "",
    iin_bin: "",
    address: "",
  });

  const {
    data: counterparties = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["counterparties", { search: debouncedSearch }],
    queryFn: () => api.getAdminCounterparties({ search: debouncedSearch }),
  });

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить контрагентов";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [error, toast]);

  const resetCreateForm = () =>
    setCreateForm({ name: "", company_name: "", phone: "", iin_bin: "", address: "" });

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => api.createAdminCounterparty(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counterparties"] });
      toast({ title: "Контрагент добавлен" });
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: (mutationError: any) => {
      const message = mutationError?.message ?? "Не удалось добавить контрагента";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof editForm }) =>
      api.updateAdminCounterparty(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counterparties"] });
      toast({ title: "Контрагент обновлён" });
      setIsEditOpen(false);
      setSelectedCounterparty(null);
    },
    onError: (mutationError: any) => {
      const message = mutationError?.message ?? "Не удалось обновить контрагента";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteAdminCounterparty(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counterparties"] });
      toast({ title: "Контрагент удалён" });
    },
    onError: (mutationError: any) => {
      const message = mutationError?.message ?? "Не удалось удалить контрагента";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const handleCreateSubmit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate({
      name: createForm.name.trim(),
      company_name: createForm.company_name.trim() || "",
      phone: createForm.phone.trim() || "",
      iin_bin: createForm.iin_bin.trim() || "",
      address: createForm.address.trim() || "",
    });
  };

  const handleEditSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedCounterparty) return;
    updateMutation.mutate({
      id: selectedCounterparty.id,
      data: {
        name: editForm.name.trim(),
        company_name: editForm.company_name.trim() || "",
        phone: editForm.phone.trim() || "",
        iin_bin: editForm.iin_bin.trim() || "",
        address: editForm.address.trim() || "",
      },
    });
  };

  const openEditDialog = (counterparty: Counterparty) => {
    setSelectedCounterparty(counterparty);
    setEditForm({
      name: counterparty.name ?? "",
      company_name: counterparty.company_name ?? "",
      phone: counterparty.phone ?? "",
      iin_bin: counterparty.iin_bin ?? "",
      address: counterparty.address ?? "",
    });
    setIsEditOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Удалить контрагента?")) {
      deleteMutation.mutate(id);
    }
  };

  const isCreateValid = useMemo(() => createForm.name.trim().length > 0, [createForm.name]);
  const isEditValid = useMemo(() => editForm.name.trim().length > 0, [editForm.name]);

  const counterpartiesList = Array.isArray(counterparties) ? (counterparties as Counterparty[]) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold">Контрагенты</h1>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по названию, фирме или телефону"
            className="md:w-72"
          />
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый контрагент</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="create-name">Название/ФИО</Label>
                  <Input
                    id="create-name"
                    value={createForm.name}
                    onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="create-company">Фирма/ИП</Label>
                  <Input
                    id="create-company"
                    value={createForm.company_name}
                    onChange={(event) => setCreateForm({ ...createForm, company_name: event.target.value })}
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
                  <Label htmlFor="create-iin">БИН/ИИН</Label>
                  <Input
                    id="create-iin"
                    value={createForm.iin_bin}
                    onChange={(event) => setCreateForm({ ...createForm, iin_bin: event.target.value })}
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
                <Button type="submit" disabled={!isCreateValid || createMutation.isPending} className="w-full">
                  Сохранить
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список контрагентов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Фирма</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : counterpartiesList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Контрагенты не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  counterpartiesList.map((counterparty) => (
                    <TableRow key={counterparty.id}>
                      <TableCell className="font-medium">{counterparty.name}</TableCell>
                      <TableCell>{counterparty.company_name || "—"}</TableCell>
                      <TableCell>{counterparty.phone || "—"}</TableCell>
                      <TableCell>{counterparty.address || "—"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(counterparty)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(counterparty.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать контрагента</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Название/ФИО</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-company">Фирма/ИП</Label>
              <Input
                id="edit-company"
                value={editForm.company_name}
                onChange={(event) => setEditForm({ ...editForm, company_name: event.target.value })}
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
              <Label htmlFor="edit-iin">БИН/ИИН</Label>
              <Input
                id="edit-iin"
                value={editForm.iin_bin}
                onChange={(event) => setEditForm({ ...editForm, iin_bin: event.target.value })}
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
            <Button type="submit" disabled={!isEditValid || updateMutation.isPending} className="w-full">
              Сохранить изменения
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
