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

interface ManagerOption {
  id: number;
  full_name: string;
  username: string;
}

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

interface AdminDailyReport {
  manager_id: number;
  manager_name: string;
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
  product_id: number;
  product_name: string;
  quantity: string | number;
  price?: string | number | null;
  line_total: string | number;
  is_bonus: boolean;
}

interface ShopOrderDetail {
  id: number;
  manager_id: number;
  manager_name: string;
  shop_id: number;
  shop_name: string;
  created_at: string;
  total_quantity: string | number;
  total_goods_amount: string | number;
  total_bonus_quantity: string | number;
  total_bonus_amount: string | number;
  items: ShopOrderDetailItem[];
  payment?: ShopOrderPaymentDetail | null;
}

interface ManagerReturnDetailItem {
  product_id: number;
  product_name: string;
  quantity: string | number;
}

interface ManagerReturnDetail {
  id: number;
  manager_id: number;
  manager_name: string;
  created_at: string;
  items: ManagerReturnDetailItem[];
}

interface ShopReturnDetailItem {
  product_id: number;
  product_name: string;
  quantity: string | number;
}

interface ShopReturnDetail {
  id: number;
  manager_id: number;
  manager_name: string;
  shop_id: number;
  shop_name: string;
  created_at: string;
  items: ShopReturnDetailItem[];
}

interface ShopOrderPaymentDetail {
  total_goods_amount: string | number;
  returns_amount: string | number;
  payable_amount: string | number;
  paid_amount: string | number;
  debt_amount: string | number;
}

type MovementDetail =
  | { type: "delivery"; data: ShopOrderDetail }
  | { type: "return_to_main"; data: ManagerReturnDetail }
  | { type: "return_from_shop"; data: ShopReturnDetail };

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

interface ShopOption {
  id: number;
  name: string;
  address?: string | null;
}

interface ShopDayStat {
  date: string;
  issued_total: string | number;
  returns_total: string | number;
  bonuses_total: string | number;
  debt_total: string | number;
}

interface ShopDocumentRef {
  id: number;
  type: "delivery" | "return_from_shop";
  date: string;
  shop_name: string;
  manager_name: string;
}

interface AdminShopPeriodSummary {
  issued_total: string | number;
  returns_total: string | number;
  bonuses_total: string | number;
  debt_total: string | number;
}

interface AdminShopPeriodReport {
  shop_id: number;
  shop_name: string;
  date_from: string;
  date_to: string;
  summary: AdminShopPeriodSummary;
  days: ShopDayStat[];
  deliveries: ShopDocumentRef[];
  returns_from_shop: ShopDocumentRef[];
}

export default function AdminReports() {
  const { toast } = useToast();
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [movementType, setMovementType] = useState<MovementType>("delivery");
  const [detail, setDetail] = useState<MovementDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);
  const [currentDetailType, setCurrentDetailType] = useState<MovementType | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string>("");
  const [shopDateFrom, setShopDateFrom] = useState<Date | null>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [shopDateTo, setShopDateTo] = useState<Date | null>(() => new Date());
  const [shopFromCalendarOpen, setShopFromCalendarOpen] = useState(false);
  const [shopToCalendarOpen, setShopToCalendarOpen] = useState(false);
  const [shopDayModalOpen, setShopDayModalOpen] = useState(false);
  const [selectedShopDay, setSelectedShopDay] = useState<string | null>(null);

  const { data: managers = [], isLoading: managersLoading } = useQuery<ManagerOption[]>({
    queryKey: ["admin", "managers"],
    queryFn: () => api.getManagersList(),
  });

  const { data: shops = [], isLoading: shopsLoading } = useQuery<ShopOption[]>({
    queryKey: ["admin", "shops"],
    queryFn: () => api.getShops() as Promise<ShopOption[]>,
  });

  useEffect(() => {
    if (!managers.length || selectedManagerId) {
      return;
    }
    setSelectedManagerId(String(managers[0].id));
  }, [managers, selectedManagerId]);

  useEffect(() => {
    if (!shops.length || selectedShopId) {
      return;
    }
    setSelectedShopId(String(shops[0].id));
  }, [shops, selectedShopId]);

  const formattedDate = useMemo(() => {
    if (!selectedDate) return "";
    return format(selectedDate, "yyyy-MM-dd");
  }, [selectedDate]);

  const formattedShopDateFrom = useMemo(() => {
    if (!shopDateFrom) return "";
    return format(shopDateFrom, "yyyy-MM-dd");
  }, [shopDateFrom]);

  const formattedShopDateTo = useMemo(() => {
    if (!shopDateTo) return "";
    return format(shopDateTo, "yyyy-MM-dd");
  }, [shopDateTo]);

  const managerIdNumber = selectedManagerId ? Number(selectedManagerId) : null;

  const {
    data: report,
    isLoading: reportLoading,
    isFetching: reportFetching,
    error,
  } = useQuery<AdminDailyReport | null>({
    queryKey: ["admin", "daily-report", managerIdNumber, formattedDate],
    queryFn: () => {
      if (!managerIdNumber || !formattedDate) {
        return Promise.resolve(null);
      }
      return api.getAdminDailyReport(managerIdNumber, formattedDate);
    },
    enabled: Boolean(managerIdNumber && formattedDate),
  });

  const {
    data: shopReport,
    isLoading: shopReportLoading,
    isFetching: shopReportFetching,
    error: shopReportError,
  } = useQuery<AdminShopPeriodReport | null>({
    queryKey: [
      "admin",
      "shop-report",
      selectedShopId ? Number(selectedShopId) : null,
      formattedShopDateFrom,
      formattedShopDateTo,
    ],
    queryFn: () => {
      if (!selectedShopId || !formattedShopDateFrom || !formattedShopDateTo) {
        return Promise.resolve(null);
      }
      return api.getAdminShopPeriodReport(
        Number(selectedShopId),
        formattedShopDateFrom,
        formattedShopDateTo
      );
    },
    enabled: Boolean(selectedShopId && formattedShopDateFrom && formattedShopDateTo),
  });

  useEffect(() => {
    if (!error) return;
    const message = error instanceof Error ? error.message : "Не удалось загрузить отчет";
    toast({ title: "Ошибка", description: message, variant: "destructive" });
  }, [error, toast]);

  useEffect(() => {
    if (!shopReportError) return;
    const message =
      shopReportError instanceof Error
        ? shopReportError.message
        : "Не удалось загрузить отчет по магазину";
    toast({ title: "Ошибка", description: message, variant: "destructive" });
  }, [shopReportError, toast]);

  const summaryCards = useMemo(() => {
    if (!report) {
      return [
        { label: "Получено", value: 0 },
        { label: "Доставлено", value: 0 },
        { label: "Возврат в главный склад", value: 0 },
        { label: "Возврат из магазинов", value: 0 },
      ];
    }
    return [
      { label: "Получено", value: report.summary.received_total ?? 0 },
      { label: "Доставлено", value: report.summary.delivered_total ?? 0 },
      { label: "Возврат в главный склад", value: report.summary.return_to_main_total ?? 0 },
      { label: "Возврат из магазинов", value: report.summary.return_from_shops_total ?? 0 },
    ];
  }, [report]);

  const shopSummaryCards = useMemo(() => {
    if (!shopReport) {
      return [
        { label: "Выдано", value: 0 },
        { label: "Возвраты", value: 0 },
        { label: "Бонусы", value: 0 },
        { label: "Долг", value: 0 },
      ];
    }
    return [
      { label: "Выдано", value: shopReport.summary.issued_total ?? 0 },
      { label: "Возвраты", value: shopReport.summary.returns_total ?? 0 },
      { label: "Бонусы", value: shopReport.summary.bonuses_total ?? 0 },
      { label: "Долг", value: shopReport.summary.debt_total ?? 0 },
    ];
  }, [shopReport]);

  const movementData = useMemo(() => {
    if (!report) return [] as MovementRow[];
    if (movementType === "delivery") return report.deliveries;
    if (movementType === "return_to_main") return report.returns_to_main;
    return report.returns_from_shops;
  }, [movementType, report]);

  const shopReportBusy = (shopReportLoading || shopReportFetching) && !shopReport;

  const shopDayDocuments = useMemo(() => {
    if (!selectedShopDay || !shopReport) {
      return { deliveries: [] as ShopDocumentRef[], returns: [] as ShopDocumentRef[] };
    }
    const target = selectedShopDay;
    const deliveries = shopReport.deliveries.filter((doc) => {
      return format(new Date(doc.date), "yyyy-MM-dd") === target;
    });
    const returns = shopReport.returns_from_shop.filter((doc) => {
      return format(new Date(doc.date), "yyyy-MM-dd") === target;
    });
    return { deliveries, returns };
  }, [selectedShopDay, shopReport]);

  const renderShopName = (row: MovementRow) => {
    if (row.shop_name) return row.shop_name;
    if (movementType === "return_to_main") return "Главный склад";
    return "—";
  };

  const handleShopDayOpen = (day: string) => {
    setSelectedShopDay(day);
    setShopDayModalOpen(true);
  };

  const handleShopDayModalChange = (open: boolean) => {
    setShopDayModalOpen(open);
    if (!open) {
      setSelectedShopDay(null);
    }
  };

  const formatShopDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("ru-RU");

  const buildDocumentRow = (doc: ShopDocumentRef): MovementRow => ({
    id: doc.id,
    type: doc.type,
    shop_name: doc.shop_name,
    time: doc.date,
  });

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

  const isSummaryLoading = (reportLoading || reportFetching) && !report;
  const isMovementsLoading = (reportLoading || reportFetching) && !report;

  const managerName = report?.manager_name ?? managers.find((manager) => manager.id === managerIdNumber)?.full_name;

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
                    <TableCell>{formatCurrency(item.line_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Всего: {formatValue(data.total_quantity)} шт.</p>
            <p>Обычные товары: {formatCurrency(data.total_goods_amount)}</p>
            <p>Бонусы: {formatCurrency(data.total_bonus_amount)}</p>
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
            {data.manager_name ? <p>Менеджер: {data.manager_name}</p> : null}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead className="w-24">Кол-во</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.product_id}>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell>{formatValue(item.quantity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-sm text-muted-foreground">Всего: {formatValue(total)} шт.</div>
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
          {data.manager_name ? <p>Менеджер: {data.manager_name}</p> : null}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead className="w-24">Кол-во</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.product_id}>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell>{formatValue(item.quantity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="text-sm text-muted-foreground">Всего: {formatValue(total)} шт.</div>
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
        <h1 className="text-3xl font-bold">Отчеты</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Менеджер</Label>
            <Select
              value={selectedManagerId}
              onValueChange={setSelectedManagerId}
              disabled={managersLoading || managers.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={managersLoading ? "Загрузка..." : "Выберите менеджера"} />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={String(manager.id)}>
                    {manager.full_name || manager.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Дата</Label>
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
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-1">
            <CardTitle>Сводка за день</CardTitle>
            {managerName ? (
              <p className="text-sm text-muted-foreground">Отчёт по менеджеру: {managerName}</p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

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
          {!managerIdNumber ? (
            <div className="rounded-lg border p-4 text-center text-muted-foreground">Выберите менеджера и дату</div>
          ) : isMovementsLoading ? (
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

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Отчет по магазинам</CardTitle>
          <p className="text-sm text-muted-foreground">
            Сводка по выдачам, возвратам, бонусам и долгам выбранного магазина за период
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                      {shop.address ? ` — ${shop.address}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Дата от</Label>
              <Popover open={shopFromCalendarOpen} onOpenChange={setShopFromCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !shopDateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {shopDateFrom ? format(shopDateFrom, "PPP") : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={shopDateFrom ?? undefined}
                    onSelect={(value) => {
                      setShopDateFrom(value ?? null);
                      setShopFromCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Дата до</Label>
              <Popover open={shopToCalendarOpen} onOpenChange={setShopToCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !shopDateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {shopDateTo ? format(shopDateTo, "PPP") : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={shopDateTo ?? undefined}
                    onSelect={(value) => {
                      setShopDateTo(value ?? null);
                      setShopToCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {shopSummaryCards.map((card) => (
              <Card key={card.label}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {shopReportBusy ? "—" : numberFormatter.format(Number(card.value ?? 0))}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {!selectedShopId || !formattedShopDateFrom || !formattedShopDateTo ? (
            <div className="rounded-lg border p-4 text-center text-muted-foreground">
              Выберите магазин и период для отчета
            </div>
          ) : shopReportBusy ? (
            <div className="rounded-lg border p-4 text-center text-muted-foreground">Загрузка...</div>
          ) : !shopReport || shopReport.days.length === 0 ? (
            <div className="rounded-lg border p-4 text-center text-muted-foreground">Нет данных за выбранный период</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Выдано</TableHead>
                    <TableHead>Возвраты</TableHead>
                    <TableHead>Бонусы</TableHead>
                    <TableHead>Долг</TableHead>
                    <TableHead className="w-16 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shopReport.days.map((day) => {
                    return (
                    <TableRow key={day.date}>
                      <TableCell>{formatShopDay(day.date)}</TableCell>
                        <TableCell>{numberFormatter.format(Number(day.issued_total ?? 0))}</TableCell>
                        <TableCell>{numberFormatter.format(Number(day.returns_total ?? 0))}</TableCell>
                        <TableCell>{numberFormatter.format(Number(day.bonuses_total ?? 0))}</TableCell>
                        <TableCell>{numberFormatter.format(Number(day.debt_total ?? 0))}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Подробнее"
                            onClick={() => handleShopDayOpen(day.date)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={shopDayModalOpen} onOpenChange={handleShopDayModalChange}>
        <DialogContent className="w-full max-w-[90vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Документы за {selectedShopDay ? formatShopDay(selectedShopDay) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold">Выдачи</h4>
              {shopDayDocuments.deliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет выдач</p>
              ) : (
                <ul className="space-y-2">
                  {shopDayDocuments.deliveries.map((doc) => (
                    <li key={`delivery-${doc.id}`} className="flex items-start justify-between gap-2">
                      <div className="text-sm">
                        <p className="font-medium leading-tight">{doc.shop_name}</p>
                        {doc.manager_name ? (
                          <p className="text-xs text-muted-foreground">Менеджер: {doc.manager_name}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">{formatDateTime(doc.date)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Подробнее"
                        onClick={() => handleViewDetails(buildDocumentRow(doc))}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold">Возвраты</h4>
              {shopDayDocuments.returns.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет возвратов</p>
              ) : (
                <ul className="space-y-2">
                  {shopDayDocuments.returns.map((doc) => (
                    <li key={`return-${doc.id}`} className="flex items-start justify-between gap-2">
                      <div className="text-sm">
                        <p className="font-medium leading-tight">{doc.shop_name}</p>
                        {doc.manager_name ? (
                          <p className="text-xs text-muted-foreground">Менеджер: {doc.manager_name}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">{formatDateTime(doc.date)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Подробнее"
                        onClick={() => handleViewDetails(buildDocumentRow(doc))}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
