import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Eye, Loader2 } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

interface ShopDayStat {
  date: string;
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

interface ShopOrderDetailItem {
  product_name: string;
  quantity: string | number;
  price: string | number;
  line_total: string | number;
  is_bonus: boolean;
  is_return: boolean;
}

interface ShopOrderPaymentDetail {
  total_amount: string | number;
  returns_amount: string | number;
  payable_amount: string | number;
  paid_amount: string | number;
  debt_amount: string | number;
}

interface ShopOrderDetail {
  id: number;
  manager_name: string;
  shop_name: string;
  created_at: string;
  items: ShopOrderDetailItem[];
  payment: ShopOrderPaymentDetail;
  total_goods_amount: string | number;
  total_bonus_amount: string | number;
  total_return_amount: string | number;
}

interface ShopReturnDetailItem {
  product_id: number;
  product_name: string;
  quantity: string | number;
  price: string | number;
  line_total: string | number;
}

interface ShopReturnDetail {
  id: number;
  manager_id: number;
  manager_name: string;
  shop_id: number;
  shop_name: string;
  created_at: string;
  total_quantity: string | number;
  total_amount: string | number;
  items: ShopReturnDetailItem[];
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
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [submittedParams, setSubmittedParams] = useState<{
    shopId: number;
    dateFrom: string;
    dateTo: string;
  } | null>(null);
  const [detail, setDetail] = useState<
    | { type: "delivery" | "bonus"; data: ShopOrderDetail }
    | { type: "return_from_shop"; data: ShopReturnDetail }
    | null
  >(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);

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

  const formatCurrency = (value: string | number | null | undefined) => `${formatNumber(value)} ₸`;

  const getLineTotal = (
    items: { line_total: string | number; [key: string]: any }[],
    predicate: (item: any) => boolean
  ) =>
    items.reduce((sum, item) => (predicate(item) ? sum + Number(item.line_total ?? 0) : sum), 0);

  const getQuantityTotal = (
    items: { quantity: string | number; [key: string]: any }[],
    predicate: (item: any) => boolean
  ) =>
    items.reduce((sum, item) => (predicate(item) ? sum + Number(item.quantity ?? 0) : sum), 0);

  const debtOrders = useMemo(() => {
    if (!selectedDebtDay || !report) return [];
    return (report.deliveries || []).filter((delivery) => {
      if (!delivery.debt_amount || Number(delivery.debt_amount) <= 0) return false;
      const deliveryDate = delivery.date.split("T")[0];
      return deliveryDate === selectedDebtDay;
    });
  }, [report, selectedDebtDay]);

  const debtDays = useMemo(
    () => (report?.days || []).filter((day) => Number(day.debt_total ?? 0) > 0),
    [report]
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

  const handleViewDetail = async (row: ShopDocumentRow) => {
    const key = `${row.type}-${row.id}`;
    setActiveRowKey(key);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);

    try {
      if (row.type === "delivery" || row.type === "bonus") {
        const data = await api.getShopOrderDetail(row.id);
        setDetail({ type: row.type, data });
      } else {
        const data = await api.getShopReturnDetail(row.id);
        setDetail({ type: row.type, data });
      }
    } catch (err) {
      setDetailOpen(false);
      const message = err instanceof Error ? err.message : "Не удалось загрузить детали";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    } finally {
      setDetailLoading(false);
      setActiveRowKey(null);
    }
  };

  const handleDetailOpenChange = (open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setDetail(null);
    }
  };

  const detailTitle = detail?.type === "return_from_shop"
    ? "Детали возврата"
    : detail?.type === "bonus"
    ? "Детали бонусов"
    : "Детали выдачи";

  const renderDetailContent = () => {
    if (detailLoading) {
      return <div className="py-6 text-center text-muted-foreground">Загрузка...</div>;
    }

    if (!detail) {
      return <div className="py-6 text-center text-muted-foreground">Нет данных</div>;
    }

    if (detail.type === "return_from_shop") {
      const data = detail.data;
      const total = data.total_quantity ?? getQuantityTotal(data.items, () => true);
      return (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Магазин: {data.shop_name}</p>
            <p>Дата: {formatDateTime(data.created_at)}</p>
            {data.manager_name ? <p>Менеджер: {data.manager_name}</p> : null}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead className="w-24">Кол-во</TableHead>
                  <TableHead className="w-28">Цена</TableHead>
                  <TableHead className="w-32">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.product_id}>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell>{formatNumber(item.quantity)}</TableCell>
                    <TableCell>{formatCurrency(item.price)}</TableCell>
                    <TableCell>{formatCurrency(item.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Всего: {formatNumber(total)} шт.</p>
            <p>Сумма возврата: {formatCurrency(data.total_amount)}</p>
          </div>
        </div>
      );
    }

    const data = detail.data;
    const totalQuantity = getQuantityTotal(data.items, (item) => !item.is_return);
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Магазин: {data.shop_name}</p>
          <p>Дата: {formatDateTime(data.created_at)}</p>
          {data.manager_name ? <p>Менеджер: {data.manager_name}</p> : null}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead className="w-24">Кол-во</TableHead>
                <TableHead className="w-28">Цена</TableHead>
                <TableHead className="w-24 text-center">Бонус</TableHead>
                <TableHead className="w-24 text-center">Возврат</TableHead>
                <TableHead className="w-32">Сумма</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item, index) => (
                <TableRow key={`${item.product_name}-${index}`}>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell>{formatNumber(item.quantity)}</TableCell>
                  <TableCell>{formatCurrency(item.price)}</TableCell>
                  <TableCell className="text-center">{item.is_bonus ? "Да" : "Нет"}</TableCell>
                  <TableCell className="text-center">{item.is_return ? "Да" : "Нет"}</TableCell>
                  <TableCell>{formatCurrency(item.line_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Всего товаров: {formatNumber(totalQuantity)} шт.</p>
          <p>Сумма заказа: {formatCurrency(data.payment?.total_amount ?? data.total_goods_amount)}</p>
          <p>Сумма возврата: {formatCurrency(data.payment?.returns_amount ?? data.total_return_amount)}</p>
          <p>Сумма бонусов: {formatCurrency(data.total_bonus_amount ?? getLineTotal(data.items, (item) => item.is_bonus))}</p>
          <p>Долг: {formatCurrency(data.payment?.debt_amount ?? 0)}</p>
        </div>
      </div>
    );
  };

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
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Подробнее"
                            onClick={() => handleViewDetail(row)}
                            disabled={activeRowKey === `${row.type}-${row.id}` && detailLoading}
                          >
                            {activeRowKey === `${row.type}-${row.id}` && detailLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
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
                      {debtDays.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>{formatDateOnly(day.date)}</TableCell>
                          <TableCell className="text-right">{formatNumber(day.debt_total)}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Подробнее"
                              onClick={() => {
                                setSelectedDebtDay(day.date);
                                setDebtModalOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={handleDetailOpenChange}>
        <DialogContent className="w-full max-w-[90vw] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detailTitle}</DialogTitle>
          </DialogHeader>
          {renderDetailContent()}
        </DialogContent>
      </Dialog>

      <Dialog
        open={debtModalOpen}
        onOpenChange={(open) => {
          setDebtModalOpen(open);
          if (!open) {
            setSelectedDebtDay(null);
          }
        }}
      >
        <DialogContent className="w-full max-w-[90vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDebtDay ? `Детализация долгов за ${formatDateOnly(selectedDebtDay)}` : "Долги"}
            </DialogTitle>
          </DialogHeader>
          {selectedDebtDay ? (
            debtOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет заказов с долгами за выбранный день</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата и время</TableHead>
                    <TableHead className="text-right">Сумма заказа</TableHead>
                    <TableHead className="text-right">Долг</TableHead>
                    <TableHead>Менеджер</TableHead>
                    <TableHead className="w-[80px] text-center">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtOrders.map((order) => (
                    <TableRow key={`debt-${order.id}`}>
                      <TableCell>{formatDateTime(order.date)}</TableCell>
                      <TableCell className="text-right">{formatNumber(order.amount)}</TableCell>
                      <TableCell className="text-right">{formatNumber(order.debt_amount)}</TableCell>
                      <TableCell>{order.manager_name}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Подробнее"
                          onClick={() => handleViewDetail({ ...order, type: "delivery" })}
                          disabled={activeRowKey === `delivery-${order.id}` && detailLoading}
                        >
                          {activeRowKey === `delivery-${order.id}` && detailLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Выберите день с долгами</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
