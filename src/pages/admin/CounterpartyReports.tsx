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

interface CounterpartyReportRow {
  id: number;
  date: string;
  total: number;
  paid: number;
  debt: number;
}

interface CounterpartyReport {
  total_turnover: number;
  total_paid: number;
  total_debt: number;
  orders: CounterpartyReportRow[];
}

const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function AdminCounterpartyReports() {
  const { toast } = useToast();
  const [counterpartyId, setCounterpartyId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: counterparties = [], error: counterpartiesError } = useQuery({
    queryKey: ["counterparties"],
    queryFn: () => api.getAdminCounterparties(),
  });

  useEffect(() => {
    if (counterpartiesError) {
      const message =
        counterpartiesError instanceof Error ? counterpartiesError.message : "Не удалось загрузить контрагентов";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [counterpartiesError, toast]);

  const {
    data: report,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["counterparty-report", { counterpartyId, dateFrom, dateTo }],
    queryFn: () =>
      api.getCounterpartyReport({
        counterparty_id: Number(counterpartyId),
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
    enabled: Boolean(counterpartyId),
  });

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : "Не удалось сформировать отчет";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [error, toast]);

  const handlePrint = (orderId: number) => {
    const url = `${apiBaseUrl}/admin/sales-orders/${orderId}/print`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const counterpartiesList = Array.isArray(counterparties) ? (counterparties as CounterpartyOption[]) : [];
  const reportData = report as CounterpartyReport | undefined;

  const totals = useMemo(() => {
    return {
      total_turnover: reportData?.total_turnover ?? 0,
      total_paid: reportData?.total_paid ?? 0,
      total_debt: reportData?.total_debt ?? 0,
    };
  }, [reportData]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Отчёт по контрагентам</h1>

      <Card>
        <CardHeader>
          <CardTitle>Параметры отчёта</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Контрагент</Label>
            <Select value={counterpartyId} onValueChange={setCounterpartyId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите контрагента" />
              </SelectTrigger>
              <SelectContent>
                {counterpartiesList.map((counterparty) => (
                  <SelectItem key={counterparty.id} value={String(counterparty.id)}>
                    {counterparty.name}
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Оборот</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.total_turnover.toFixed(2)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Оплачено</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.total_paid.toFixed(2)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Долг</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.total_debt.toFixed(2)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Закрытые продажи</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>№</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Оплачено</TableHead>
                  <TableHead>Долг</TableHead>
                  <TableHead className="text-right">Печать</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : reportData?.orders?.length ? (
                  reportData.orders.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{new Date(row.date).toLocaleDateString("ru-RU")}</TableCell>
                      <TableCell>{row.total.toFixed(2)}</TableCell>
                      <TableCell>{row.paid.toFixed(2)}</TableCell>
                      <TableCell>{row.debt.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handlePrint(row.id)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
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
