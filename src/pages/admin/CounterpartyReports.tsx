import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Printer } from "lucide-react";

interface CounterpartyOption {
  id: number;
  name: string;
}

interface ManagerOption {
  id: number;
  full_name: string;
}

interface CounterpartySalesReportRow {
  id: number;
  date: string;
  counterparty_id: number;
  counterparty_name: string;
  driver_id?: number | null;
  driver_name?: string | null;
  total: number;
  paid_cash: number;
  paid_kaspi: number;
  paid_total: number;
  debt_for_sale: number;
}

interface CounterpartySalesReportTotals {
  sales_total: number;
  paid_cash_total: number;
  paid_kaspi_total: number;
  paid_total: number;
  debt_total: number;
}

interface CounterpartySalesReport {
  totals: CounterpartySalesReportTotals;
  sales: CounterpartySalesReportRow[];
}

const getAlmatyDateValue = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(date);

export default function AdminCounterpartyReports() {
  const { toast } = useToast();
  const [counterpartyId, setCounterpartyId] = useState<string>("");
  const [driverId, setDriverId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(() => getAlmatyDateValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [dateTo, setDateTo] = useState(() => getAlmatyDateValue(new Date()));

  const { data: counterparties = [], error: counterpartiesError } = useQuery({
    queryKey: ["counterparties"],
    queryFn: () => api.getAdminCounterparties(),
  });

  const { data: managers = [], error: managersError } = useQuery({
    queryKey: ["managers"],
    queryFn: () => api.getManagers(),
  });

  useEffect(() => {
    if (counterpartiesError) {
      const message =
        counterpartiesError instanceof Error ? counterpartiesError.message : "Не удалось загрузить контрагентов";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [counterpartiesError, toast]);

  useEffect(() => {
    if (managersError) {
      const message = managersError instanceof Error ? managersError.message : "Не удалось загрузить водителей";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [managersError, toast]);

  const {
    data: report,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["counterparty-sales-report", { counterpartyId, driverId, dateFrom, dateTo }],
    queryFn: () =>
      api.getCounterpartySalesReport({
        counterparty_id: counterpartyId ? Number(counterpartyId) : undefined,
        driver_id: driverId ? Number(driverId) : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
  });

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Не удалось сформировать отчет";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [error, toast]);

  const handlePrint = (saleId: number) => {
    const url = `${window.location.origin}/admin/counterparty-sales/${saleId}/print`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const counterpartiesList = Array.isArray(counterparties) ? (counterparties as CounterpartyOption[]) : [];
  const managersList = Array.isArray(managers) ? (managers as ManagerOption[]) : [];
  const reportData = report as CounterpartySalesReport | undefined;

  const totals = useMemo(() => {
    return {
      sales_total: reportData?.totals.sales_total ?? 0,
      paid_total: reportData?.totals.paid_total ?? 0,
      paid_cash_total: reportData?.totals.paid_cash_total ?? 0,
      paid_kaspi_total: reportData?.totals.paid_kaspi_total ?? 0,
      debt_total: reportData?.totals.debt_total ?? 0,
    };
  }, [reportData]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Отчёт по контрагентам</h1>

      <Card>
        <CardHeader>
          <CardTitle>Параметры отчёта</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Контрагент</Label>
            <Select value={counterpartyId} onValueChange={setCounterpartyId}>
              <SelectTrigger>
                <SelectValue placeholder="Все контрагенты" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Все</SelectItem>
                {counterpartiesList.map((counterparty) => (
                  <SelectItem key={counterparty.id} value={String(counterparty.id)}>
                    {counterparty.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Водитель</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Все водители" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Все</SelectItem>
                {managersList.map((manager) => (
                  <SelectItem key={manager.id} value={String(manager.id)}>
                    {manager.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Дата с</Label>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>
          <div>
            <Label>Дата по</Label>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle>Продажи</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.sales_total.toFixed(2)} ₸</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Оплачено</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.paid_total.toFixed(2)} ₸</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Наличные</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.paid_cash_total.toFixed(2)} ₸</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kaspi</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.paid_kaspi_total.toFixed(2)} ₸</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Долг</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.debt_total.toFixed(2)} ₸</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Продажи за период</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>№</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Контрагент</TableHead>
                  <TableHead>Водитель</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Наличные</TableHead>
                  <TableHead>Kaspi</TableHead>
                  <TableHead>Оплачено</TableHead>
                  <TableHead>Долг</TableHead>
                  <TableHead className="text-right">Печать</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : reportData?.sales?.length ? (
                  reportData.sales.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{new Date(row.date).toLocaleDateString("ru-RU")}</TableCell>
                      <TableCell>{row.counterparty_name}</TableCell>
                      <TableCell>{row.driver_name || "—"}</TableCell>
                      <TableCell>{row.total.toFixed(2)}</TableCell>
                      <TableCell>{row.paid_cash.toFixed(2)}</TableCell>
                      <TableCell>{row.paid_kaspi.toFixed(2)}</TableCell>
                      <TableCell>{row.paid_total.toFixed(2)}</TableCell>
                      <TableCell>{row.debt_for_sale.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handlePrint(row.id)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">
                      Нет данных
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
