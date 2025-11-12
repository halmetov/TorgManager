import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function AdminIncoming() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    price: "",
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Товар добавлен на склад" });
      setFormData({ name: "", quantity: "", price: "" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: formData.name,
      quantity: parseInt(formData.quantity),
      price: parseFloat(formData.price),
      is_return: false,
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Поступление</h1>

      <Card>
        <CardHeader>
          <CardTitle>Добавить товар на склад</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Название товара</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Торт Наполеон"
                required
              />
            </div>
            <div>
              <Label>Количество</Label>
              <Input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="10"
                required
              />
            </div>
            <div>
              <Label>Цена за единицу</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="500.00"
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 text-lg">
              Добавить на склад
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
