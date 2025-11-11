import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ProductOption {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface IncomingRowState {
  id: number;
  query: string;
  product: ProductOption | null;
  quantity: string;
  price: string;
  showSuggestions: boolean;
}

const createRow = (id: number): IncomingRowState => ({
  id,
  query: "",
  product: null,
  quantity: "",
  price: "",
  showSuggestions: false,
});

export default function AdminIncoming() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<IncomingRowState[]>([createRow(0)]);
  const [nextId, setNextId] = useState(1);

  const incomingMutation = useMutation({
    mutationFn: (payload: { items: { product_id: number; quantity: number; price_at_time: number }[] }) =>
      api.createIncoming(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Поступление проведено" });
      setRows([createRow(0)]);
      setNextId(1);
    },
    onError: (error: any) => {
      toast({
        title: "Не удалось провести поступление",
        description: error?.message || "Произошла ошибка",
        variant: "destructive",
      });
    },
  });

  const searchQueries = rows.map((row) => row.query.trim());

  const searchResults = useQuery({
    queryKey: ["incoming-search", searchQueries],
    queryFn: async () => {
      const results: Record<number, ProductOption[]> = {};
      await Promise.all(
        searchQueries.map(async (query, index) => {
          if (query.length < 2) {
            results[index] = [];
            return;
          }
          results[index] = await api.searchProducts(query);
        }),
      );
      return results;
    },
    staleTime: 30_000,
  });

  const addRow = () => {
    setRows((prev) => [...prev, createRow(nextId)]);
    setNextId((prev) => prev + 1);
  };

  const updateRow = (id: number, partial: Partial<IncomingRowState>) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              ...partial,
            }
          : row,
      ),
    );
  };

  const removeRow = (id: number) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== id)));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const items = rows
      .map((row) => {
        const quantity = parseFloat(row.quantity);
        const price = parseFloat(row.price || "0");
        if (!row.product || Number.isNaN(quantity) || Number.isNaN(price)) {
          return null;
        }
        if (quantity <= 0 || price <= 0) {
          return null;
        }
        return {
          product_id: row.product.id,
          quantity,
          price_at_time: price,
        };
      })
      .filter((item): item is { product_id: number; quantity: number; price_at_time: number } => Boolean(item));

    if (items.length !== rows.length) {
      toast({
        title: "Проверьте строки",
        description: "Убедитесь, что выбран товар и заполнены количество и цена",
        variant: "destructive",
      });
      return;
    }

    incomingMutation.mutate({ items });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Поступление</h1>

      <Card>
        <CardHeader>
          <CardTitle>Провести поступление</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {rows.map((row, index) => {
              const suggestions = searchResults.data?.[index] || [];
              return (
                <div key={row.id} className="rounded-lg border p-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-[2fr,1fr,1fr,auto] md:items-end">
                    <div className="space-y-2">
                      <Label>Товар</Label>
                      <Input
                        value={row.product ? row.product.name : row.query}
                        placeholder="Начните вводить название"
                        onChange={(event) =>
                          updateRow(row.id, {
                            query: event.target.value,
                            product: null,
                            showSuggestions: true,
                          })
                        }
                        onFocus={() => updateRow(row.id, { showSuggestions: true })}
                      />
                      {row.showSuggestions && suggestions.length > 0 && (
                        <div className="max-h-48 overflow-y-auto rounded-md border bg-background shadow">
                          {suggestions.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              className="flex w-full flex-col items-start gap-1 border-b px-3 py-2 text-left hover:bg-muted"
                              onClick={() =>
                                updateRow(row.id, {
                                  product,
                                  query: product.name,
                                  price: product.price.toString(),
                                  showSuggestions: false,
                                })
                              }
                            >
                              <span className="font-medium">{product.name}</span>
                              <span className="text-xs text-muted-foreground">
                                Цена: {product.price.toFixed(2)} ₸ · Остаток: {product.quantity.toFixed(2)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {row.showSuggestions && suggestions.length === 0 && row.query.trim().length >= 2 && (
                        <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                          Товар не найден
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Количество</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.quantity}
                        onChange={(event) => updateRow(row.id, { quantity: event.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Цена поступления</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.price}
                        onChange={(event) => updateRow(row.id, { price: event.target.value })}
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10"
                        onClick={() =>
                          updateRow(row.id, {
                            query: "",
                            product: null,
                            quantity: "",
                            price: "",
                            showSuggestions: false,
                          })
                        }
                      >
                        Очистить
                      </Button>
                      {rows.length > 1 && (
                        <Button type="button" variant="ghost" className="h-10" onClick={() => removeRow(row.id)}>
                          Удалить
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <Button type="button" variant="outline" onClick={addRow}>
                Добавить строку
              </Button>
              <Button type="submit" disabled={incomingMutation.isPending || rows.length === 0}>
                Провести поступление
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
