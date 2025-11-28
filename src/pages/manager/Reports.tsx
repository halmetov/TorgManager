import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Eye, Loader2 } from "lucide-react";

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

interface ManagerDailySummary {
  received_qty: string | number;
  received_amount: string | number;
  delivered_qty: string | number;
  delivered_amount: string | number;
  return_to_main_qty: string | number;
  return_to_main_amount: string | number;
  return_from_shops_qty: string | number;
  return_from_shops_amount: string | number;
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

interface ManagerReturnDetailItem {
  product_id: number;
  product_name: string;
  quantity: string | number;
  price: string | number;
  line_total: string | number;
}

interface ManagerReturnDetail {
  id: number;
  manager_id: number;
  manager_name: string;
  created_at: string;
  total_amount: string | number;
  items: ManagerReturnDetailItem[];
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
  total_amount: string | number;
  items: ShopReturnDetailItem[];
}

type MovementDetail =
  | { type: "delivery"; data: ShopOrderDetail }
  | { type: "return_to_main"; data: ManagerReturnDetail }
  | { type: "return_from_shop"; data: ShopReturnDetail };

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export default function ManagerReports() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [movementType, setMovementType] = useState<MovementType>("delivery");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [detail, setDetail] = useState<MovementDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const [currentDetailType, setCurrentDetailType] = useState<MovementType | null>(null);

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
      {
        label: "Получено",
        qty: report?.summary.received_qty ?? 0,
        amount: report?.summary.received_amount ?? 0,
      },
      {
        label: "Доставлено",
        qty: report?.summary.delivered_qty ?? 0,
        amount: report?.summary.delivered_amount ?? 0,
      },
      {
        label: "Возврат в главный склад",
        qty: report?.summary.return_to_main_qty ?? 0,
        amount: report?.summary.return_to_main_amount ?? 0,
      },
      {
        label: "Возврат из магазинов",
        qty: report?.summary.return_from_shops_qty ?? 0,
        amount: report?.summary.return_from_shops_amount ?? 0,
      },
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

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" });

  const formatValue = (value: string | number | null | undefined) =>
    numberFormatter.format(Number(value ?? 0));

  const formatCurrency = (value: string | number | null | undefined) => `${formatValue(value)} ₸`;

  const getTotalQuantity = (items: { quantity: string | number }[]) =>
    items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);

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

  const isSummaryLoading = isLoading && !report;
  const isMovementsLoading = (isLoading || isFetching) && !report;

  const handleViewDetails = async (row: MovementRow) => {
    const key = `${row.type}-${row.id}`;
    setActiveRowKey(key);
    setCurrentDetailType(row.type);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetail(null);

    try {
      if (row.type === "delivery") {
        const data = await api.getShopOrderDetail(row.id);
        setDetail({ type: row.type, data });
      } else if (row.type === "return_to_main") {
        const data = await api.getManagerReturnDetail(row.id);
        setDetail({ type: row.type, data });
      } else {
        const data = await api.getShopReturnDetail(row.id);
        setDetail({ type: row.type, data });
      }
    } catch (detailError) {
      setDetailOpen(false);
      const message =
        detailError instanceof Error ? detailError.message : "Не удалось загрузить детали";
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
      setCurrentDetailType(null);
    }
  };

  const renderDetailContent = () => {
    if (detailLoading) {
      return <div className="py-6 text-center text-muted-foreground">Загрузка...</div>;
    }

    if (!detail) {
      return <div className="py-6 text-center text-muted-foreground">Нет данных</div>;
    }

    if (detail.type === "delivery") {
      const data = detail.data;
      return (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Магазин: {data.shop_name}</p>
            <p>Дата: {formatDateTime(data.created_at)}</p>
            {data.manager_name ? <p>Водитель: {data.manager_name}</p> : null}
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
                  <TableRow key={`${item.product_id}-${index}`}> 
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell>{formatValue(item.quantity)}</TableCell>
                    <TableCell>
                      {item.price === null || item.price === undefined
                        ? "—"
                        : formatCurrency(item.price)}
                    </TableCell>
                    <TableCell className="text-center">{item.is_bonus ? "Да" : "Нет"}</TableCell>
                    <TableCell className="text-center">{item.is_return ? "Да" : "Нет"}</TableCell>
                    <TableCell>{formatCurrency(item.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Всего товаров: {formatValue(getQuantityTotal(data.items, (item) => !item.is_return))} шт.</p>
            <p>Сумма заказа: {formatCurrency(data.payment?.total_amount ?? data.total_goods_amount)}</p>
            <p>Сумма возврата: {formatCurrency(data.payment?.returns_amount ?? data.total_return_amount)}</p>
            <p>Сумма бонусов: {formatCurrency(data.total_bonus_amount ?? getLineTotal(data.items, (item) => item.is_bonus))}</p>
            <p>Долг: {formatCurrency(data.payment?.debt_amount ?? 0)}</p>
          </div>
        </div>
      );
    }

    if (detail.type === "return_to_main") {
      const data = detail.data;
      const total = getTotalQuantity(data.items);
      return (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Дата: {formatDateTime(data.created_at)}</p>
            {data.manager_name ? <p>Водитель: {data.manager_name}</p> : null}
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
                    <TableCell>{formatValue(item.quantity)}</TableCell>
                    <TableCell>{formatCurrency(item.price)}</TableCell>
                    <TableCell>{formatCurrency(item.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Всего: {formatValue(total)} шт.</p>
            <p>Сумма возврата: {formatCurrency(data.total_amount)}</p>
          </div>
        </div>
      );
    }

    const data = detail.data;
    const total = getTotalQuantity(data.items);
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Магазин: {data.shop_name}</p>
          <p>Дата: {formatDateTime(data.created_at)}</p>
          {data.manager_name ? <p>Водитель: {data.manager_name}</p> : null}
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
                  <TableCell>{formatValue(item.quantity)}</TableCell>
                  <TableCell>{formatCurrency(item.price)}</TableCell>
                  <TableCell>{formatCurrency(item.line_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Всего: {formatValue(total)} шт.</p>
          <p>Сумма возврата: {formatCurrency(data.total_amount)}</p>
        </div>
      </div>
    );
  };

  const detailTitle = (() => {
    if (currentDetailType === "delivery") return "Детали выдачи";
    if (currentDetailType === "return_to_main") return "Детали возврата в главный склад";
    if (currentDetailType === "return_from_shop") return "Детали возврата из магазина";
    return "Детали";
  })();

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
              <CardContent className="space-y-1">
                <p className="text-2xl font-semibold">
                  {isSummaryLoading ? "—" : `${numberFormatter.format(Number(card.qty ?? 0))} шт.`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isSummaryLoading ? "—" : formatCurrency(card.amount)}
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
                {movementData.map((row) => {
                  const rowKey = `${row.type}-${row.id}`;
                  const isRowLoading = activeRowKey === rowKey && detailLoading;
                  return (
                    <div key={rowKey} className="rounded-lg border p-4 space-y-2 bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold leading-tight">{renderShopName(row)}</p>
                          <p className="text-xs text-muted-foreground">{renderTime(row.time)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Подробнее"
                          onClick={() => handleViewDetails(row)}
                          disabled={isRowLoading}
                        >
                          {isRowLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
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
                    {movementData.map((row) => {
                      const rowKey = `${row.type}-${row.id}`;
                      const isRowLoading = activeRowKey === rowKey && detailLoading;
                      return (
                        <TableRow key={rowKey}>
                          <TableCell>{renderShopName(row)}</TableCell>
                          <TableCell>{renderTime(row.time)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Подробнее"
                              onClick={() => handleViewDetails(row)}
                              disabled={isRowLoading}
                            >
                              {isRowLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Dialog open={detailOpen} onOpenChange={handleDetailOpenChange}>
        <DialogContent className="w-full max-w-[90vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailTitle}</DialogTitle>
          </DialogHeader>
          {renderDetailContent()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
