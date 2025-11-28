import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Manager {
  id: number;
  username: string;
  full_name?: string | null;
}

interface DriverDailyReport {
  id: number;
  manager_id: number;
  report_date: string;
  cash_amount: number;
  card_amount: number;
  other_expenses: number;
  other_details: string | null;
  created_at: string;
}

export default function AdminDriverReports() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [managerId, setManagerId] = useState("");

  const {
    data: managers = [],
    isLoading: managersLoading,
    error: managersError,
  } = useQuery<Manager[]>({
    queryKey: ["managers"],
    queryFn: () => api.getManagers(),
  });

  const managerMap = useMemo(() => {
    const map = new Map<number, Manager>();
    for (const manager of managers) {
      map.set(manager.id, manager);
    }
    return map;
  }, [managers]);

  const {
    data: reports = [],
    isFetching: reportsLoading,
    error: reportsError,
    refetch: refetchReports,
  } = useQuery<DriverDailyReport[]>({
    queryKey: ["driver-daily-reports", { startDate, endDate, managerId }],
    queryFn: () =>
      api.getDriverDailyReports({
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        manager_id: managerId ? Number(managerId) : undefined,
      }),
  });

  useEffect(() => {
    if (managersError instanceof Error) {
      toast({ title: "Ошибка", description: managersError.message, variant: "destructive" });
    }
  }, [managersError, toast]);

  useEffect(() => {
    if (reportsError instanceof Error) {
      toast({ title: "Ошибка", description: reportsError.message, variant: "destructive" });
    }
  }, [reportsError, toast]);

  const reportList = Array.isArray(reports) ? reports : [];

  const totals = useMemo(() => {
    return reportList.reduce(
      (acc, report) => {
        return {
          cash: acc.cash + (report.cash_amount || 0),
          card: acc.card + (report.card_amount || 0),
          other: acc.other + (report.other_expenses || 0),
        };
      },
      { cash: 0, card: 0, other: 0 }
    );
  }, [reportList]);

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Отчёт водителей</h1>
        <p className="text-sm text-muted-foreground">
          Просмотр ежедневных финансовых отчётов по водителям за период
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground" htmlFor="start_date">
                Дата с
              </label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground" htmlFor="end_date">
                Дата по
              </label>
              <Input id="end_date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Водитель</label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder={managersLoading ? "Загрузка..." : "Все водители"} />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="">Все водители</SelectItem>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={String(manager.id)}>
                      {manager.full_name || manager.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={() => refetchReports()} disabled={reportsLoading} className="w-full">
                Показать
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Наличные</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{numberFormatter.format(totals.cash)} ₸</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">На карте</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{numberFormatter.format(totals.card)} ₸</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Другие расходы</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{numberFormatter.format(totals.other)} ₸</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список отчётов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата отчёта</TableHead>
                  <TableHead>Водитель</TableHead>
                  <TableHead>Наличные</TableHead>
                  <TableHead>На карте</TableHead>
                  <TableHead>Другие расходы</TableHead>
                  <TableHead>Детали</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : reportList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Нет данных за выбранный период
                    </TableCell>
                  </TableRow>
                ) : (
                  reportList.map((report) => {
                    const manager = managerMap.get(report.manager_id);
                    const managerName = manager ? manager.full_name || manager.username : `ID ${report.manager_id}`;
                    return (
                      <TableRow key={report.id}>
                        <TableCell>{formatDate(report.report_date)}</TableCell>
                        <TableCell>{managerName}</TableCell>
                        <TableCell>{numberFormatter.format(report.cash_amount)} ₸</TableCell>
                        <TableCell>{numberFormatter.format(report.card_amount)} ₸</TableCell>
                        <TableCell>{numberFormatter.format(report.other_expenses)} ₸</TableCell>
                        <TableCell className="max-w-xs whitespace-pre-wrap text-sm text-muted-foreground">
                          {report.other_details || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
