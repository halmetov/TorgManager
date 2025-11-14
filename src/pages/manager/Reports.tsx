import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Eye } from "lucide-react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ManagerDailySummary {
  received_total: string | number;
  delivered_total: string | number;
  return_to_main_total: string | number;
  return_from_shops_total: string | number;
}

interface MovementRow {
  id: number;
  time: string;
  shop_name?: string | null;
  type: "delivery" | "return_to_main" | "return_from_shop";
}

interface ManagerDailyReport {
  date: string;
  summary: ManagerDailySummary;
  deliveries: MovementRow[];
  returns_to_main: MovementRow[];
  returns_from_shops: MovementRow[];
}

type MovementType = "delivery" | "return_to_main" | "return_from_shop";

const movementOptions: { value: MovementType; label: string }[] = [
  { value: "delivery", label: "Выдачи" },
  { value: "return_to_main", label: "Возврат в главный склад" },
  { value: "return_from_shop", label: "Возврат из магазинов" },
];

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export default function ManagerReports() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [movementType, setMovementType] = useState<MovementType>("delivery");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const formattedDate = useMemo(() => {
    if (!selectedDate) return "";
    return format(selectedDate, "yyyy-MM-dd");
  }, [selectedDate]);

  const {
    data: report,
    isLoading,
    isFetching,
    error,
  } = useQuery<ManagerDailyReport>({
    queryKey: ["manager", "daily-report", formattedDate],
    queryFn: () => api.getManagerDailyReport(formattedDate),
    enabled: Boolean(formattedDate),
  });

  useEffect(() => {
    if (!error) return;
    const message = error instanceof Error ? error.message : "Не удалось загрузить отчет";
    toast({ title: "Ошибка", description: message, variant: "destructive" });
  }, [error, toast]);

  const summaryCards = useMemo(
    () => [
      { label: "Получено", value: report?.summary.received_total ?? 0 },
      { label: "Доставлено", value: report?.summary.delivered_total ?? 0 },
      { label: "Возврат в главный склад", value: report?.summary.return_to_main_total ?? 0 },
      { label: "Возврат из магазинов", value: report?.summary.return_from_shops_total ?? 0 },
    ],
    [report?.summary]
  );

  const movementData = useMemo(() => {
    if (!report) return [] as MovementRow[];
    if (movementType === "delivery") return report.deliveries;
    if (movementType === "return_to_main") return report.returns_to_main;
    return report.returns_from_shops;
  }, [movementType, report]);

  const renderShopName = (row: MovementRow) => {
    if (row.shop_name) return row.shop_name;
    if (movementType === "return_to_main") return "Главный склад";
    return "—";
  };

  const renderTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  };

  const isSummaryLoading = isLoading && !report;
  const isMovementsLoading = (isLoading || isFetching) && !report;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-bold">Отчеты</h1>
          <div className="w-full sm:w-64">
            <Label className="mb-2 block text-sm font-medium text-muted-foreground">Дата</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Выберите дату"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(value) => {
                    setSelectedDate(value ?? new Date());
                    setCalendarOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <Card key={card.label}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {isSummaryLoading ? "—" : numberFormatter.format(Number(card.value ?? 0))}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Движения за выбранный день</CardTitle>
          <div className="w-full sm:w-72">
            <Label className="mb-2 block text-sm font-medium text-muted-foreground">Тип движения</Label>
            <Select value={movementType} onValueChange={(value) => setMovementType(value as MovementType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {movementOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isMovementsLoading ? (
            <div className="rounded-lg border p-4 text-center text-muted-foreground">Загрузка...</div>
          ) : movementData.length === 0 ? (
            <div className="rounded-lg border p-4 text-center text-muted-foreground">Нет данных</div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {movementData.map((row) => (
                  <div key={`${row.type}-${row.id}`} className="rounded-lg border p-4 space-y-2 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold leading-tight">{renderShopName(row)}</p>
                        <p className="text-xs text-muted-foreground">{renderTime(row.time)}</p>
                      </div>
                      <Button variant="ghost" size="icon" aria-label="Подробнее">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Магазин</TableHead>
                      <TableHead>Время</TableHead>
                      <TableHead className="w-16 text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movementData.map((row) => (
                      <TableRow key={`${row.type}-${row.id}`}>
                        <TableCell>{renderShopName(row)}</TableCell>
                        <TableCell>{renderTime(row.time)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" aria-label="Подробнее">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
