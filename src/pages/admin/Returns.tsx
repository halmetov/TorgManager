import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminReturns() {
  const { data: returns = [] } = useQuery({
    queryKey: ["adminReturns"],
    queryFn: () => api.get("/reports/returns"),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Возвраты от менеджеров</h1>

      <Card>
        <CardHeader>
          <CardTitle>История возвратов</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Менеджер</TableHead>
                <TableHead>Магазин</TableHead>
                <TableHead>Товар</TableHead>
                <TableHead>Количество</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(returns as any[]).map((returnItem: any) => (
                <TableRow key={returnItem.id}>
                  <TableCell>
                    {new Date(returnItem.created_at).toLocaleString('ru-RU', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                  <TableCell>{returnItem.manager_name}</TableCell>
                  <TableCell>{returnItem.shop_name}</TableCell>
                  <TableCell>{returnItem.product_name}</TableCell>
                  <TableCell>{returnItem.quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
