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

export default function ManagerOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [shopId, setShopId] = useState("");
  const [refrigeratorNumber, setRefrigeratorNumber] = useState("");
  const [items, setItems] = useState([{ product_id: "", quantity: "", price: "" }]);

  const { data: products = [] } = useQuery({
    queryKey: ["managerProducts"],
    queryFn: () => api.getManagerProducts(),
  });

  // Filter only non-return products for orders
  const availableProducts = (products as any[]).filter((p: any) => !p.is_return && p.quantity > 0);

  const { data: shops = [] } = useQuery({
    queryKey: ["shops"],
    queryFn: () => api.getShops(),
  });

  const orderMutation = useMutation({
    mutationFn: (data: any) => api.createOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Заказ оформлен" });
      setShopId("");
      setRefrigeratorNumber("");
      setItems([{ product_id: "", quantity: "", price: "" }]);
    },
  });

  const handleAddItem = () => {
    setItems([...items, { product_id: "", quantity: "", price: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = (products as any[]).find((p: any) => p.id === parseInt(productId));
    if (product) {
      handleItemChange(index, "product_id", productId);
      handleItemChange(index, "price", product.price.toString());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    orderMutation.mutate({
      shop_id: parseInt(shopId),
      refrigerator_number: refrigeratorNumber,
      items: items.map((item) => ({
        product_id: parseInt(item.product_id),
        quantity: parseInt(item.quantity),
        price: parseFloat(item.price),
      })),
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Заказ</h1>

      <Card>
        <CardHeader>
          <CardTitle>Оформить заказ</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label>Магазин</Label>
              <Select value={shopId} onValueChange={setShopId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите магазин" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {(shops as any[]).map((shop: any) => (
                    <SelectItem key={shop.id} value={shop.id.toString()}>
                      {shop.name} - {shop.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Номер холодильника</Label>
              <Input
                value={refrigeratorNumber}
                onChange={(e) => setRefrigeratorNumber(e.target.value)}
                placeholder="123"
                required
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Товары</Label>
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
                      onValueChange={(value) => handleProductSelect(index, value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите товар" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {availableProducts.map((product: any) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name} (в наличии: {product.quantity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-28">
                    <Label>Количество</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                      placeholder="0"
                      required
                    />
                  </div>

                  <div className="w-32">
                    <Label>Цена</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, "price", e.target.value)}
                      placeholder="0.00"
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
              Отдать
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
