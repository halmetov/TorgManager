import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
}

interface AdminShopPeriodReport {
  shop_id: number;
  shop_name: string;
  date_from: string;
  date_to: string;
  summary: AdminShopPeriodSummary;
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
    ],
    [report?.summary]
  );

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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {summaryCards.map((card) => (
                <Card key={card.label}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">
                      {numberFormatter.format(Number(card.value ?? 0))}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
