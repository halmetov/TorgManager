import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export default function ManagerProducts() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const {
    data: products = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["products", { q: debouncedSearch, scope: "main" }],
    queryFn: () => api.getProducts({ q: debouncedSearch, mainOnly: true }),
  });

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить товары";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [error, toast]);

  const productsList = Array.isArray(products) ? (products as Product[]) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold">Товары главного склада</h1>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по названию"
          className="md:w-72"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Доступные товары</CardTitle>
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : productsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Нет товаров
                  </TableCell>
                </TableRow>
              ) : (
                productsList.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.quantity}</TableCell>
                    <TableCell>
                      {product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₸
                    </TableCell>
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
