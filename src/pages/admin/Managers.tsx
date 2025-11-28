import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

export default function AdminManagers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    full_name: "",
    is_active: true,
  });

  const { data: managers = [] } = useQuery({
    queryKey: ["managers"],
    queryFn: () => api.getManagers(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createManager(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      toast({ title: "Водитель добавлен" });
      setOpen(false);
      setFormData({ username: "", password: "", full_name: "", is_active: true });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateManager(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      toast({ title: "Статус обновлен" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Водители</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Добавить водителя
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый водитель</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Логин</Label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Пароль</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Имя Фамилия</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Активный</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <Button type="submit" className="w-full">
                Добавить
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список водителей</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Логин</TableHead>
                <TableHead>Имя Фамилия</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(managers as any[]).map((manager: any) => (
                <TableRow key={manager.id}>
                  <TableCell>{manager.username}</TableCell>
                  <TableCell>{manager.full_name}</TableCell>
                  <TableCell>
                    {manager.is_active ? (
                      <span className="text-green-600">Активный</span>
                    ) : (
                      <span className="text-red-600">Неактивный</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={manager.is_active}
                      onCheckedChange={(checked) =>
                        updateMutation.mutate({
                          id: manager.id,
                          data: { is_active: checked },
                        })
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
