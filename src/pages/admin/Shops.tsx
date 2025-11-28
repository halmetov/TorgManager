import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Shop {
  id: number;
  name: string;
  address: string;
  phone: string;
  refrigerator_number: string;
  manager_id: number | null;
  manager_name: string | null;
}

interface ManagerOption {
  id: number;
  username: string;
  full_name: string | null;
}

export default function AdminShops() {
  const { toast } = useToast();
  const [selectedManager, setSelectedManager] = useState<string>("all");

  const managerId = selectedManager === "all" ? undefined : Number(selectedManager);

  const {
    data: managers = [],
    error: managersError,
  } = useQuery({
    queryKey: ["managers"],
    queryFn: () => api.getManagers(),
  });

  const {
    data: shops = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["shops", "admin", { managerId: managerId ?? "all" }],
    queryFn: () => api.getShops(managerId !== undefined ? { managerId } : undefined),
  });

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить магазины";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [error, toast]);

  useEffect(() => {
    if (managersError) {
      const message = managersError instanceof Error ? managersError.message : "Не удалось загрузить водителей";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [managersError, toast]);

  const managerOptions = useMemo(() => {
    if (!Array.isArray(managers)) {
      return [] as ManagerOption[];
    }
    return managers as ManagerOption[];
  }, [managers]);

  const shopsList = useMemo(() => {
    if (!Array.isArray(shops)) {
      return [] as Shop[];
    }
    return shops as Shop[];
  }, [shops]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold">Магазины</h1>
        <div className="flex w-full flex-col gap-2 md:w-72">
          <span className="text-sm font-medium text-muted-foreground">Фильтр по водителю</span>
          <Select value={selectedManager} onValueChange={setSelectedManager}>
            <SelectTrigger>
              <SelectValue placeholder="Все водители" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все водители</SelectItem>
              {managerOptions.map((manager) => (
                <SelectItem key={manager.id} value={String(manager.id)}>
                  {manager.full_name?.trim() || manager.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                <TableHead>Водитель</TableHead>
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
                    <TableCell>{shop.manager_name ?? "—"}</TableCell>
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
