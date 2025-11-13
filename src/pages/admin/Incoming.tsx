import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronDown, Loader2 } from "lucide-react";

interface ProductOption {
  id: number;
  name: string;
  quantity: number;
}

interface IncomingRow {
  id: string;
  product_id: number | null;
  product_name: string;
  quantity: string;
  search: string;
  options: ProductOption[];
  loading: boolean;
  open: boolean;
}

interface ProductSearchResult extends ProductOption {
  manager_id: number | null;
  is_return?: boolean;
}

interface IncomingHistoryItem {
  id: number;
  created_at: string;
}

interface IncomingDetailItem {
  product_id: number;
  product_name: string;
  quantity: number;
}

interface IncomingDetail {
  id: number;
  created_at: string;
  items: IncomingDetailItem[];
}

export default function AdminIncoming() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const idCounterRef = useRef(0);
  const createEmptyRow = (): IncomingRow => ({
    id: `incoming-row-${idCounterRef.current++}`,
    product_id: null,
    product_name: "",
    quantity: "",
    search: "",
    options: [],
    loading: false,
    open: false,
  });

  const [rows, setRows] = useState<IncomingRow[]>(() => [createEmptyRow()]);
  const [detailId, setDetailId] = useState<number | null>(null);

  const searchTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const searchControllers = useRef<Record<string, AbortController>>({});

  const cancelScheduledSearch = (rowId: string, abortOngoing = false) => {
    if (searchTimeouts.current[rowId]) {
      clearTimeout(searchTimeouts.current[rowId]);
      delete searchTimeouts.current[rowId];
    }
    if (abortOngoing && searchControllers.current[rowId]) {
      searchControllers.current[rowId].abort();
      delete searchControllers.current[rowId];
    }
  };

  useEffect(() => {
    return () => {
      Object.keys(searchTimeouts.current).forEach((rowId) => cancelScheduledSearch(rowId, true));
    };
  }, []);

  const fetchIncomingHistory = async (): Promise<IncomingHistoryItem[]> => {
    const client = api as unknown as { get: <T>(endpoint: string) => Promise<T> };
    return client.get("/incoming");
  };

  const {
    data: history = [],
    isFetching: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ["incoming"],
    queryFn: fetchIncomingHistory,
  });

  useEffect(() => {
    if (historyError) {
      const message = historyError instanceof Error ? historyError.message : "Не удалось загрузить историю поступлений";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [historyError, toast]);

  const fetchIncomingDetail = async (id: number): Promise<IncomingDetail> => {
    const client = api as unknown as { get: <T>(endpoint: string) => Promise<T> };
    return client.get(`/incoming/${id}`);
  };

  const {
    data: incomingDetail,
    isFetching: detailLoading,
  } = useQuery({
    queryKey: ["incoming", detailId],
    queryFn: () => fetchIncomingDetail(detailId!),
    enabled: detailId !== null,
  });

  const updateRow = (rowId: string, updater: (row: IncomingRow) => IncomingRow) => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? updater(row) : row)));
  };

  const handleSearchChange = (rowId: string, value: string) => {
    cancelScheduledSearch(rowId, true);

    const trimmed = value.trim();

    updateRow(rowId, (row) => {
      const shouldResetSelection = trimmed ? value !== row.product_name : false;
      return {
        ...row,
        search: value,
        loading: true,
        options: [],
        product_id: shouldResetSelection ? null : row.product_id,
        product_name: shouldResetSelection ? "" : row.product_name,
      };
    });

    const executeSearch = async (query?: string) => {
      const controller = new AbortController();
      searchControllers.current[rowId] = controller;

      try {
        const products = (await api.searchProducts(query, { signal: controller.signal })) as ProductSearchResult[];
        const options = products
          .filter((product) => product.manager_id === null && !product.is_return)
          .map((product) => ({
            id: product.id,
            name: product.name,
            quantity: product.quantity,
          }));

        updateRow(rowId, (row) => ({
          ...row,
          options,
          loading: false,
        }));
      } catch (error) {
        if ((error instanceof DOMException || error instanceof Error) && error.name === "AbortError") {
          return;
        }
        updateRow(rowId, (row) => ({ ...row, loading: false }));
        const message = error instanceof Error ? error.message : "Не удалось выполнить поиск";
        toast({ title: "Ошибка", description: message, variant: "destructive" });
      } finally {
        delete searchControllers.current[rowId];
      }
    };

    if (!trimmed) {
      executeSearch();
      return;
    }

    const timeoutId = setTimeout(() => {
      delete searchTimeouts.current[rowId];
      executeSearch(trimmed);
    }, 300);

    searchTimeouts.current[rowId] = timeoutId;
  };

  const handleSelectProduct = (rowId: string, option: ProductOption) => {
    cancelScheduledSearch(rowId, true);
    updateRow(rowId, (row) => ({
      ...row,
      product_id: option.id,
      product_name: option.name,
      search: option.name,
      options: [],
      loading: false,
      open: false,
    }));
  };

  const handleQuantityChange = (rowId: string, value: string) => {
    updateRow(rowId, (row) => ({ ...row, quantity: value }));
  };

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);

  const removeRow = (rowId: string) => {
    setRows((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      cancelScheduledSearch(rowId, true);
      return prev.filter((row) => row.id !== rowId);
    });
  };

  const resetForm = () => {
    Object.keys(searchTimeouts.current).forEach((rowId) => cancelScheduledSearch(rowId, true));
    searchTimeouts.current = {};
    searchControllers.current = {};
    setRows([createEmptyRow()]);
  };

  const isFormValid = useMemo(
    () =>
      rows.every(
        (row) =>
          row.product_id !== null &&
          row.quantity.trim() !== "" &&
          !Number.isNaN(Number(row.quantity)) &&
          Number(row.quantity) > 0
      ),
    [rows]
  );

  const incomingMutation = useMutation({
    mutationFn: (payload: { items: { product_id: number; quantity: number }[] }) =>
      api.createIncoming(payload),
    onSuccess: () => {
      toast({ title: "Поступление сохранено" });
      resetForm();
      refetchHistory();
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: unknown) => {
      let message = "Не удалось сохранить поступление";
      if (error && typeof error === "object") {
        const err = error as { message?: string; data?: { detail?: string } };
        message = err.data?.detail ?? err.message ?? message;
      }
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isFormValid || incomingMutation.isPending) return;

    const payload = {
      items: rows.map((row) => ({
        product_id: row.product_id as number,
        quantity: Number(row.quantity),
      })),
    };

    incomingMutation.mutate(payload);
  };

  const formatDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

  const onPrint = () => window.print();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Поступление</h1>

      <Card>
        <CardHeader>
          <CardTitle>Добавить товары на склад</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              {rows.map((row) => (
                <div key={row.id} className="space-y-4 rounded-lg border p-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-end">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`incoming-product-${row.id}`}>Товар</Label>
                      <Popover
                        open={row.open}
                        onOpenChange={(open) => {
                          if (!open) {
                            cancelScheduledSearch(row.id, true);
                            updateRow(row.id, (current) => ({
                              ...current,
                              open: false,
                              search: current.product_name,
                              options: [],
                              loading: false,
                            }));
                          } else {
                            updateRow(row.id, (current) => ({
                              ...current,
                              open: true,
                            }));
                            handleSearchChange(row.id, "");
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            id={`incoming-product-${row.id}`}
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={row.open}
                            className="w-full justify-between"
                          >
                            {row.product_name ? (
                              <span className="truncate">{row.product_name}</span>
                            ) : (
                              <span className="text-muted-foreground">Выберите товар</span>
                            )}
                            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="p-0"
                          align="start"
                          style={{ width: "var(--radix-popover-trigger-width)", minWidth: "280px" }}
                        >
                          <Command>
                            <CommandInput
                              value={row.search}
                              onValueChange={(value) => handleSearchChange(row.id, value)}
                              placeholder="Начните вводить название товара"
                            />
                            <CommandList>
                              <CommandEmpty>
                                {row.loading ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Поиск...
                                  </span>
                                ) : row.search.trim() ? (
                                  "Ничего не найдено"
                                ) : (
                                  "Введите название для поиска"
                                )}
                              </CommandEmpty>
                              {row.options.length > 0 && (
                                <CommandGroup>
                                  {row.options.map((option) => (
                                    <CommandItem
                                      key={option.id}
                                      value={`${option.id}`}
                                      onSelect={() => handleSelectProduct(row.id, option)}
                                    >
                                      <span className="truncate">
                                        {`${option.name} – остаток: ${option.quantity}`}
                                      </span>
                                      {row.product_id === option.id && (
                                        <Check className="ml-2 h-4 w-4 text-primary" />
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`incoming-quantity-${row.id}`}>Количество</Label>
                      <Input
                        id={`incoming-quantity-${row.id}`}
                        type="number"
                        min="1"
                        step="1"
                        value={row.quantity}
                        onChange={(event) => handleQuantityChange(row.id, event.target.value)}
                        placeholder="0"
                        required
                      />
                    </div>
                    {rows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeRow(row.id)}
                        className="justify-self-start md:justify-self-end"
                      >
                        Удалить
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Button type="button" variant="outline" onClick={addRow}>
                Добавить позицию
              </Button>
              <Button type="submit" className="md:w-56" disabled={!isFormValid || incomingMutation.isPending}>
                {incomingMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  "Сохранить"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>История поступлений</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchHistory()} disabled={historyLoading}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">№</TableHead>
                <TableHead>Дата и время</TableHead>
                <TableHead className="w-32 text-right">Подробнее</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Поступлений пока нет
                  </TableCell>
                </TableRow>
              ) : (
                history.map((incoming) => (
                  <TableRow key={incoming.id}>
                    <TableCell>{incoming.id}</TableCell>
                    <TableCell>{formatDate(incoming.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setDetailId(incoming.id)}>
                        Подробнее
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="incoming-printable sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Детали поступления</DialogTitle>
          </DialogHeader>
          {detailLoading || !incomingDetail ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Создано: {formatDate(incomingDetail.created_at)}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="w-32">Количество</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomingDetail.items.map((item) => (
                    <TableRow key={item.product_id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end print:hidden">
                <Button onClick={onPrint} type="button">
                  Печать
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .incoming-printable, .incoming-printable * {
              visibility: visible;
            }
            .incoming-printable {
              position: absolute;
              inset: 0;
              background: white;
              padding: 2rem;
            }
          }
        `}
      </style>
    </div>
  );
}
