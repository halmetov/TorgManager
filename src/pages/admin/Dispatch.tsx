import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

export default function AdminDispatch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [managerId, setManagerId] = useState("");
  const [items, setItems] = useState([{ product_id: "", quantity: "" }]);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.getProducts(false), // Get only non-return products
  });

  // Filter only admin products (manager_id is null)
  const adminProducts = (products as any[]).filter((p: any) => !p.is_return && p.manager_id === null && p.quantity > 0);

  const { data: managers = [] } = useQuery({
    queryKey: ["managers"],
    queryFn: () => api.getManagers(),
  });

  const dispatchMutation = useMutation({
    mutationFn: (data: any) => api.createDispatch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Товары отправлены менеджеру" });
      setManagerId("");
      setItems([{ product_id: "", quantity: "" }]);
    },
  });

  const handleAddItem = () => {
    setItems([...items, { product_id: "", quantity: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatchMutation.mutate({
      manager_id: parseInt(managerId),
      items: items.map((item) => ({
        product_id: parseInt(item.product_id),
        quantity: parseInt(item.quantity),
      })),
    });
  };

  const normalProducts = adminProducts;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Отправка</h1>

      <Card>
        <CardHeader>
          <CardTitle>Отправить товары менеджеру</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label>Выберите менеджера</Label>
              <Select value={managerId} onValueChange={setManagerId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите менеджера" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {(managers as any[]).filter((m: any) => m.is_active).map((manager: any) => (
                    <SelectItem key={manager.id} value={manager.id.toString()}>
                      {manager.full_name} ({manager.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Товары для отправки</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-4 w-4" />
                  Добавить товар
                </Button>
              </div>

              {items.map((item, index) => (
                <div key={index} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label>Товар</Label>
                    <Select
                      value={item.product_id}
                      onValueChange={(value) => handleItemChange(index, "product_id", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите товар" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {normalProducts.map((product: any) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name} (в наличии: {product.quantity}, цена: {product.price} ₸)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-32">
                    <Label>Количество</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                      placeholder="0"
                      required
                    />
                  </div>

                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button type="submit" className="w-full h-12 text-lg">
              Отправить
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
