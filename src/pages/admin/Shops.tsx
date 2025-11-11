import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Shop {
  id: number;
  name: string;
  address: string;
  phone: string;
  fridge_number: string;
  manager_id: number;
  manager_full_name?: string | null;
  manager_username?: string | null;
  created_at: string;
}

export default function AdminShops() {
  const { data: shops = [], isLoading } = useQuery<Shop[]>({
    queryKey: ["shops", "admin"],
    queryFn: () => api.getShops(),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Магазины</h1>

      <Card>
        <CardHeader>
          <CardTitle>Список магазинов</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Магазин</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>№ Холодильника</TableHead>
                <TableHead>Менеджер</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shops.map((shop) => (
                <TableRow key={shop.id}>
                  <TableCell>{shop.name}</TableCell>
                  <TableCell>{shop.address}</TableCell>
                  <TableCell>{shop.phone}</TableCell>
                  <TableCell>{shop.fridge_number}</TableCell>
                  <TableCell>
                    {shop.manager_full_name || shop.manager_username || "—"}
                    {shop.manager_username && shop.manager_full_name && (
                      <span className="block text-xs text-muted-foreground">{shop.manager_username}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {shops.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Нет магазинов
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
