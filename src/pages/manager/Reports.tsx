import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function ManagerReports() {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const queryParams = new URLSearchParams();
  if (startDate) queryParams.append('start_date', startDate.toISOString());
  if (endDate) queryParams.append('end_date', endDate.toISOString());

  const { data: report } = useQuery({
    queryKey: ["managerReport", startDate, endDate],
    queryFn: () => api.get(`/reports/manager-summary?${queryParams.toString()}`),
  });

  const currentReport = report?.[0];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Мой отчет</h1>
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
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Получено товаров</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{currentReport?.total_received || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Доставлено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{currentReport?.total_delivered || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Возвратов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{currentReport?.total_returns || 0}</div>
          </CardContent>
        </Card>
      </div>

      {currentReport?.dispatches && currentReport.dispatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>История поступлений</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Товар</TableHead>
                  <TableHead>Количество</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentReport.dispatches.map((dispatch: any, idx: number) => (
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
