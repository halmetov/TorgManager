import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Eye } from "lucide-react";
import type { DateRange } from "react-day-picker";

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

interface ShopOption {
  id: number;
  name: string;
}

interface AdminShopPeriodSummary {
  issued_total: string | number;
  returns_total: string | number;
  bonuses_total: string | number;
  debt_total: string | number;
}

type ShopDocumentType = "delivery" | "return_from_shop" | "bonus";

interface ShopDocumentRow {
  id: number;
  type: ShopDocumentType;
  date: string;
  amount: string | number;
  manager_name: string;
  debt_amount?: string | number | null;
}

type ReportFilter = "deliveries" | "returns" | "bonuses" | "debts";

interface AdminShopPeriodReport {
  shop_id: number;
  shop_name: string;
  date_from: string;
  date_to: string;
  summary: AdminShopPeriodSummary;
  days: ShopDayStat[];
  deliveries: ShopDocumentRow[];
  returns_from_shop: ShopDocumentRow[];
  bonuses: ShopDocumentRow[];
}

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export default function AdminShopReports() {
  const { toast } = useToast();
  const [selectedShopId, setSelectedShopId] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  }));
  const [activeFilter, setActiveFilter] = useState<ReportFilter>("deliveries");
  const [selectedDebtDay, setSelectedDebtDay] = useState<string | null>(null);
  const [submittedParams, setSubmittedParams] = useState<{
    shopId: number;
    dateFrom: string;
    dateTo: string;
  } | null>(null);

  const { data: shops = [], isLoading: shopsLoading } = useQuery<ShopOption[]>({
    queryKey: ["admin", "shops", "list"],
    queryFn: () => api.getShops().then((response) => response as ShopOption[]),
  });

  const {
    data: report,
    isFetching: reportLoading,
  } = useQuery<AdminShopPeriodReport | null>({
    queryKey: ["admin", "shop-period-report", submittedParams],
    queryFn: () => {
      if (!submittedParams) {
        return Promise.resolve(null);
      }
      return api.getAdminShopPeriodReport(
        submittedParams.shopId,
        submittedParams.dateFrom,
        submittedParams.dateTo
      );
    },
    enabled: submittedParams !== null,
  });

  const summaryCards = useMemo(
    () => [
      { label: "Выдано", value: report?.summary.issued_total ?? 0 },
      { label: "Возвраты", value: report?.summary.returns_total ?? 0 },
      { label: "Бонусы", value: report?.summary.bonuses_total ?? 0 },
      { label: "Долги", value: report?.summary.debt_total ?? 0 },
    ],
    [report?.summary]
  );

  const filterOptions: { label: string; value: ReportFilter }[] = [
    { label: "Выдачи", value: "deliveries" },
    { label: "Возвраты", value: "returns" },
    { label: "Бонусы", value: "bonuses" },
    { label: "Долги", value: "debts" },
  ];

  const formatNumber = (value: string | number | null | undefined) =>
    numberFormatter.format(Number(value ?? 0));

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    return format(date, "dd.MM.yyyy HH:mm");
  };

  const formatDateOnly = (value: string) => {
    const date = new Date(value);
    return format(date, "dd.MM.yyyy");
  };

  const debtOrders = useMemo(() => {
    if (!selectedDebtDay || !report) return [];
    return (report.deliveries || []).filter((delivery) => {
      if (!delivery.debt_amount || Number(delivery.debt_amount) <= 0) return false;
      const deliveryDate = delivery.date.split("T")[0];
      return deliveryDate === selectedDebtDay;
    });
  }, [report, selectedDebtDay]);

  const handleSubmit = () => {
    if (!selectedShopId) {
      toast({ title: "Ошибка", description: "Выберите магазин", variant: "destructive" });
      return;
    }
    if (!dateRange?.from || !dateRange?.to) {
      toast({ title: "Ошибка", description: "Выберите период", variant: "destructive" });
      return;
    }

    const dateFrom = format(dateRange.from, "yyyy-MM-dd");
    const dateTo = format(dateRange.to, "yyyy-MM-dd");

    setSubmittedParams({
      shopId: Number(selectedShopId),
      dateFrom,
      dateTo,
    });
  };

  const selectedShopName = report?.shop_name || shops.find((shop) => shop.id === Number(selectedShopId))?.name;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Отчёт по магазинам</h1>
        <p className="text-sm text-muted-foreground">Сводка выдач, возвратов и бонусов за выбранный период</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Параметры отчёта</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Магазин</Label>
              <Select
                value={selectedShopId}
                onValueChange={setSelectedShopId}
                disabled={shopsLoading || shops.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={shopsLoading ? "Загрузка..." : "Выберите магазин"} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {shops.map((shop) => (
                    <SelectItem key={shop.id} value={String(shop.id)}>
                      {shop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Период</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange?.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from && dateRange?.to
                      ? `${format(dateRange.from, "dd.MM.yyyy")} — ${format(dateRange.to, "dd.MM.yyyy")}`
                      : "Выберите даты"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end">
              <Button onClick={handleSubmit} className="w-full md:w-auto">
                Показать отчёт
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Сводка</CardTitle>
            {submittedParams && selectedShopName ? (
              <p className="text-sm text-muted-foreground">
                Магазин: {selectedShopName}. Период: {submittedParams.dateFrom} — {submittedParams.dateTo}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Выберите параметры и нажмите «Показать отчёт»</p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {reportLoading && !report ? (
            <div className="rounded-lg border p-4 text-center text-muted-foreground">Загрузка...</div>
          ) : submittedParams && !report ? (
            <div className="rounded-lg border p-4 text-center text-muted-foreground">Нет данных</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {summaryCards.map((card) => (
                <Card key={card.label}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">
                      {formatNumber(card.value as number)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle>Детализация по операциям</CardTitle>
              {submittedParams && selectedShopName ? (
                <p className="text-sm text-muted-foreground">
                  Магазин: {selectedShopName}. Период: {submittedParams.dateFrom} — {submittedParams.dateTo}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Выберите параметры и нажмите «Показать отчёт»</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={activeFilter === option.value ? "default" : "outline"}
                  onClick={() => {
                    setActiveFilter(option.value);
                    setSelectedDebtDay(null);
                  }}
                  size="sm"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {reportLoading && !report ? (
            <div className="rounded-lg border p-4 text-center text-muted-foreground">Загрузка...</div>
          ) : submittedParams && !report ? (
            <div className="rounded-lg border p-4 text-center text-muted-foreground">Нет данных</div>
          ) : report ? (
            <div className="space-y-4">
              {activeFilter !== "debts" ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата и время</TableHead>
                      <TableHead className="text-right">Сумма</TableHead>
                      <TableHead>Менеджер</TableHead>
                      <TableHead className="w-[80px] text-center">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(activeFilter === "deliveries"
                      ? report.deliveries
                      : activeFilter === "returns"
                      ? report.returns_from_shop
                      : report.bonuses
                    ).map((row) => (
                      <TableRow key={`${row.type}-${row.id}`}>
                        <TableCell>{formatDateTime(row.date)}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.amount)}</TableCell>
                        <TableCell>{row.manager_name}</TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" aria-label="Подробнее">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead className="text-right">Долг за день</TableHead>
                        <TableHead className="w-[80px] text-center">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.days.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>{formatDateOnly(day.date)}</TableCell>
                          <TableCell className="text-right">{formatNumber(day.debt_total)}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Подробнее"
                              onClick={() => setSelectedDebtDay(day.date)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {selectedDebtDay && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Детализация долгов за {formatDateOnly(selectedDebtDay)}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {debtOrders.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Нет заказов с долгами за выбранный день</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Дата и время</TableHead>
                                <TableHead className="text-right">Сумма заказа</TableHead>
                                <TableHead className="text-right">Долг</TableHead>
                                <TableHead>Менеджер</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {debtOrders.map((order) => (
                                <TableRow key={`debt-${order.id}`}>
                                  <TableCell>{formatDateTime(order.date)}</TableCell>
                                  <TableCell className="text-right">{formatNumber(order.amount)}</TableCell>
                                  <TableCell className="text-right">{formatNumber(order.debt_amount)}</TableCell>
                                  <TableCell>{order.manager_name}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
