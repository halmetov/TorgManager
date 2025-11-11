import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ManagerProducts() {
  const { data: products = [] } = useQuery({
    queryKey: ["managerProducts"],
    queryFn: () => api.getManagerProducts(),
  });

  // Filter only non-return products
  const regularProducts = (products as any[]).filter((p: any) => !p.is_return);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Мои товары</h1>

      <Card>
        <CardHeader>
          <CardTitle>Товары в наличии</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Количество</TableHead>
                <TableHead>Цена</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regularProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Нет товаров
                  </TableCell>
                </TableRow>
              ) : (
                regularProducts.map((product: any) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.quantity}</TableCell>
                    <TableCell>{product.price} ₸</TableCell>
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
