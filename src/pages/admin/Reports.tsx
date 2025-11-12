import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function AdminReports() {
  const [selectedManager, setSelectedManager] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const { data: managers = [] } = useQuery({
    queryKey: ["managers"],
    queryFn: () => api.getManagers(),
  });

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append('start_date', startDate.toISOString());
  if (endDate) queryParams.append('end_date', endDate.toISOString());

  const { data: productReport } = useQuery({
    queryKey: ["productReport", startDate, endDate],
    queryFn: () => api.get(`/reports/products?${queryParams.toString()}`),
  });

  const managerQueryParams = new URLSearchParams();
  if (startDate) managerQueryParams.append('start_date', startDate.toISOString());
  if (endDate) managerQueryParams.append('end_date', endDate.toISOString());

  const { data: managerReport } = useQuery({
    queryKey: ["managerReport", selectedManager, startDate, endDate],
    queryFn: () =>
      selectedManager === "all"
        ? api.get(`/reports/manager-summary?${managerQueryParams.toString()}`)
        : api.get(`/reports/manager/${selectedManager}?${managerQueryParams.toString()}`),
    enabled: !!selectedManager,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Отчеты</h1>

      <Card>
        <CardHeader>
          <CardTitle>Общий отчет по товарам</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{(productReport as any)?.total_products || 0}</div>
              <div className="text-sm text-muted-foreground">Всего товаров</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{(productReport as any)?.total_dispatched || 0}</div>
              <div className="text-sm text-muted-foreground">Отправлено</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{(productReport as any)?.total_returns || 0}</div>
              <div className="text-sm text-muted-foreground">Возвратов</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Отчет по менеджерам</CardTitle>
            <div className="flex gap-4">
              <div className="w-48">
                <Label>Дата начала</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span>Выберите дату</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="w-48">
                <Label>Дата окончания</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : <span>Выберите дату</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="w-64">
                <Label>Выбрать менеджера</Label>
                <Select value={selectedManager} onValueChange={setSelectedManager}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">Все менеджеры</SelectItem>
                    {(managers as any[]).map((manager: any) => (
                      <SelectItem key={manager.id} value={manager.id.toString()}>
                        {manager.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedManager === "all" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Менеджер</TableHead>
                  <TableHead>Получено товаров</TableHead>
                  <TableHead>Доставлено</TableHead>
                  <TableHead>Возвратов</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(managerReport as any)?.map((report: any) => (
                  <TableRow key={report.manager_id}>
                    <TableCell>{report.manager_name}</TableCell>
                    <TableCell>{report.total_received ?? report.total_dispatches ?? 0}</TableCell>
                    <TableCell>{report.total_delivered ?? report.total_orders ?? 0}</TableCell>
                    <TableCell>{report.total_returns ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{(managerReport as any)?.total_received || 0}</div>
                  <div className="text-sm text-muted-foreground">Получено товаров</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{(managerReport as any)?.total_delivered || 0}</div>
                  <div className="text-sm text-muted-foreground">Доставлено</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">{(managerReport as any)?.total_returns || 0}</div>
                  <div className="text-sm text-muted-foreground">Возвратов</div>
                </div>
              </div>

              {(managerReport as any)?.dispatches && (managerReport as any).dispatches.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Детали отправок</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Товар</TableHead>
                        <TableHead>Количество</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(managerReport as any).dispatches.map((dispatch: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>
                            {new Date(dispatch.created_at).toLocaleString('ru-RU', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                          <TableCell>{dispatch.product_name}</TableCell>
                          <TableCell>{dispatch.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
