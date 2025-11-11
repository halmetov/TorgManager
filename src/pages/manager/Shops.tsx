import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Shop {
  id: number;
  name: string;
  address: string;
  phone: string;
  fridge_number: string;
  created_at: string;
}

const initialForm = {
  name: "",
  address: "",
  phone: "",
  fridge_number: "",
};

export default function ManagerShops() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(initialForm);

  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ["shops", "manager"],
    queryFn: () => api.getMyShops(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof initialForm) => api.createShop(payload),
    onSuccess: () => {
      toast({ title: "Магазин создан" });
      setForm(initialForm);
      queryClient.invalidateQueries({ queryKey: ["shops"] });
    },
    onError: (error: any) => {
      toast({
        title: "Не удалось создать магазин",
        description: error?.message || "Произошла ошибка",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.address || !form.phone || !form.fridge_number) {
      toast({
        title: "Заполните все поля",
        description: "Все поля обязательны для заполнения",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Магазины</h1>

      <Card>
        <CardHeader>
          <CardTitle>Создать магазин</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="shop-name">Название</Label>
              <Input
                id="shop-name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="shop-address">Адрес</Label>
              <Input
                id="shop-address"
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-phone">Телефон</Label>
              <Input
                id="shop-phone"
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-fridge">№ холодильника</Label>
              <Input
                id="shop-fridge"
                value={form.fridge_number}
                onChange={(event) => setForm((prev) => ({ ...prev, fridge_number: event.target.value }))}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createMutation.isPending}>
                Создать магазин
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Мои магазины</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>№ Холодильника</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shops.map((shop) => (
                <TableRow key={shop.id}>
                  <TableCell>{shop.name}</TableCell>
                  <TableCell>{shop.address}</TableCell>
                  <TableCell>{shop.phone}</TableCell>
                  <TableCell>{shop.fridge_number}</TableCell>
                </TableRow>
              ))}
              {shops.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    У вас пока нет магазинов
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
