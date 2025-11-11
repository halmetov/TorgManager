import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ManagerShops() {
  const { data: shops = [] } = useQuery({
    queryKey: ["shops"],
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
                <TableHead>Название</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>№ Холодильника</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(shops as any[]).map((shop: any) => (
                <TableRow key={shop.id}>
                  <TableCell>{shop.name}</TableCell>
                  <TableCell>{shop.address}</TableCell>
                  <TableCell>{shop.phone}</TableCell>
                  <TableCell>{shop.refrigerator_number}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
