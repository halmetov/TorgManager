import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";

interface Counterparty {
  id: number;
  name: string;
  company?: string | null;
  phone?: string | null;
  address?: string | null;
  debt: number;
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
  const [debtCounterparty, setDebtCounterparty] = useState<Counterparty | null>(null);
  const [isDebtOpen, setIsDebtOpen] = useState(false);

  const [createForm, setCreateForm] = useState({
    name: "",
    company: "",
    phone: "",
    address: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    company: "",
    phone: "",
    address: "",
  });
  const [debtForm, setDebtForm] = useState({
    amount: "",
    method: "kaspi",
    comment: "",
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

  const resetCreateForm = () => setCreateForm({ name: "", company: "", phone: "", address: "" });

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

  const payDebtMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { amount: number; method: string; comment?: string } }) =>
      api.payAdminCounterpartyDebt(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counterparties"] });
      toast({ title: "Долг погашен" });
      setIsDebtOpen(false);
      setDebtCounterparty(null);
      setDebtForm({ amount: "", method: "kaspi", comment: "" });
    },
    onError: (mutationError: any) => {
      const message = mutationError?.message ?? "Не удалось погасить долг";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const handleCreateSubmit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate({
      name: createForm.name.trim(),
      company: createForm.company.trim() || "",
      phone: createForm.phone.trim() || "",
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
        company: editForm.company.trim() || "",
        phone: editForm.phone.trim() || "",
        address: editForm.address.trim() || "",
      },
    });
  };

  const openEditDialog = (counterparty: Counterparty) => {
    setSelectedCounterparty(counterparty);
    setEditForm({
      name: counterparty.name ?? "",
      company: counterparty.company ?? "",
      phone: counterparty.phone ?? "",
      address: counterparty.address ?? "",
    });
    setIsEditOpen(true);
  };

  const openDebtDialog = (counterparty: Counterparty) => {
    setDebtCounterparty(counterparty);
    setDebtForm({ amount: "", method: "kaspi", comment: "" });
    setIsDebtOpen(true);
  };

  const handleDebtSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!debtCounterparty) return;
    const amount = Number(debtForm.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Ошибка", description: "Введите корректную сумму", variant: "destructive" });
      return;
    }
    if (amount > debtCounterparty.debt) {
      toast({ title: "Ошибка", description: "Сумма превышает текущий долг", variant: "destructive" });
      return;
    }
    payDebtMutation.mutate({
      id: debtCounterparty.id,
      data: {
        amount,
        method: debtForm.method,
        comment: debtForm.comment.trim() || undefined,
      },
    });
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
                    value={createForm.company}
                    onChange={(event) => setCreateForm({ ...createForm, company: event.target.value })}
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
                  <TableHead>Долг</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : counterpartiesList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Контрагенты не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  counterpartiesList.map((counterparty) => (
                    <TableRow key={counterparty.id}>
                      <TableCell className="font-medium">{counterparty.name}</TableCell>
                      <TableCell>{counterparty.company || "—"}</TableCell>
                      <TableCell>{counterparty.phone || "—"}</TableCell>
                      <TableCell>{counterparty.address || "—"}</TableCell>
                      <TableCell>{counterparty.debt.toFixed(2)} ₸</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDebtDialog(counterparty)}
                          disabled={counterparty.debt <= 0}
                        >
                          <CreditCard className="h-4 w-4 text-emerald-600" />
                        </Button>
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
                value={editForm.company}
                onChange={(event) => setEditForm({ ...editForm, company: event.target.value })}
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

      <Dialog open={isDebtOpen} onOpenChange={setIsDebtOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Погасить долг</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDebtSubmit} className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Контрагент: <span className="font-medium text-foreground">{debtCounterparty?.name}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Текущий долг:{" "}
              <span className="font-medium text-foreground">{(debtCounterparty?.debt ?? 0).toFixed(2)} ₸</span>
            </div>
            <div>
              <Label htmlFor="debt-amount">Сумма</Label>
              <Input
                id="debt-amount"
                type="number"
                min="0"
                step="0.01"
                value={debtForm.amount}
                onChange={(event) => setDebtForm({ ...debtForm, amount: event.target.value })}
                required
              />
            </div>
            <div>
              <Label>Метод оплаты</Label>
              <Select
                value={debtForm.method}
                onValueChange={(value) => setDebtForm({ ...debtForm, method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите метод" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kaspi">Kaspi</SelectItem>
                  <SelectItem value="cash">Наличные</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="debt-comment">Комментарий</Label>
              <Input
                id="debt-comment"
                value={debtForm.comment}
                onChange={(event) => setDebtForm({ ...debtForm, comment: event.target.value })}
              />
            </div>
            <Button type="submit" disabled={payDebtMutation.isPending} className="w-full">
              Погасить
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
