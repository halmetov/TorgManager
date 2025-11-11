import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ManagerStockItem {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
}

export default function ManagerProducts() {
  const { data: stock = [] } = useQuery<ManagerStockItem[]>({
    queryKey: ["manager-stock"],
    queryFn: () => api.getManagerStock(),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Мой склад</h1>

      <Card>
        <CardHeader>
          <CardTitle>Остатки</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead>Количество</TableHead>
                <TableHead>Цена</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Нет остатков
                  </TableCell>
                </TableRow>
              ) : (
                stock.map((item) => (
                  <TableRow key={item.product_id}>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell>{item.quantity.toFixed(2)}</TableCell>
                    <TableCell>{item.price.toFixed(2)} ₸</TableCell>
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
