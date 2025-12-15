import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ManagerStockItem {
  product_id: number;
  name: string;
  quantity: number;
  price?: number | null;
}

interface ShopInfo {
  id: number;
  name: string;
  address?: string | null;
  debt?: number | null;
}

interface ShopOrderItem {
  product_id: number;
  product_name: string;
  quantity: number;
  price?: number | null;
  is_bonus: boolean;
  is_return: boolean;
}

interface ShopOrderPayment {
  total_goods_amount: number;
  returns_amount: number;
  payable_amount: number;
  paid_amount: number;
  debt_amount: number;
}

interface ShopOrder {
  id: number;
  manager_id: number;
  shop_id: number;
  shop_name: string;
  created_at: string;
  items: ShopOrderItem[];
  payment?: ShopOrderPayment | null;
}

interface OrderFormItem {
  product_id: number;
  product_name: string;
  quantity: string;
  price: string;
  is_bonus: boolean;
  is_return: boolean;
}

interface ShopOrderCreatePayload {
  shop_id: number;
  items: { product_id: number; quantity: number; price?: number | null; is_bonus: boolean; is_return: boolean }[];
  paid_amount: number;
}

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

export default function ManagerOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [shopId, setShopId] = useState("");
  const [items, setItems] = useState<OrderFormItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ManagerStockItem | null>(null);
  const [quantityInput, setQuantityInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [bonusProductSearch, setBonusProductSearch] = useState("");
  const [bonusProductOpen, setBonusProductOpen] = useState(false);
  const [bonusSelectedProduct, setBonusSelectedProduct] = useState<ManagerStockItem | null>(null);
  const [bonusQuantityInput, setBonusQuantityInput] = useState("");
  const [bonusPriceInput, setBonusPriceInput] = useState("");
  const [returnItems, setReturnItems] = useState<OrderFormItem[]>([]);
  const [returnProductSearch, setReturnProductSearch] = useState("");
  const [returnProductOpen, setReturnProductOpen] = useState(false);
  const [returnSelectedProduct, setReturnSelectedProduct] = useState<ManagerStockItem | null>(null);
  const [returnQuantityInput, setReturnQuantityInput] = useState("");
  const [returnPriceInput, setReturnPriceInput] = useState("");
  const [detailOrder, setDetailOrder] = useState<ShopOrder | null>(null);
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [paidAmountError, setPaidAmountError] = useState<string | null>(null);

  const {
    data: stock = [],
    isFetching: stockLoading,
    error: stockError,
    refetch: refetchStock,
  } = useQuery<ManagerStockItem[]>({
    queryKey: ["manager", "stock"],
    queryFn: () => api.getManagerStock() as Promise<ManagerStockItem[]>,
  });

  const {
    data: shops = [],
    error: shopsError,
    isFetching: shopsLoading,
  } = useQuery<ShopInfo[]>({
    queryKey: ["manager", "shops"],
    queryFn: () => api.getMyShops() as Promise<ShopInfo[]>,
  });

  const {
    data: orders = [],
    isFetching: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery<ShopOrder[]>({
    queryKey: ["manager", "shop-orders"],
    queryFn: () => api.getShopOrders() as Promise<ShopOrder[]>,
  });

  const selectedShop = useMemo(
    () => shops.find((shop) => String(shop.id) === shopId) ?? null,
    [shopId, shops]
  );

  useEffect(() => {
    if (stockError) {
      const message = stockError instanceof Error ? stockError.message : "Не удалось загрузить остатки";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [stockError, toast]);

  useEffect(() => {
    if (shopsError) {
      const message = shopsError instanceof Error ? shopsError.message : "Не удалось загрузить магазины";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [shopsError, toast]);

  useEffect(() => {
    if (ordersError) {
      const message = ordersError instanceof Error ? ordersError.message : "Не удалось загрузить историю выдач";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    }
  }, [ordersError, toast]);

  const availableProducts = useMemo(
    () => stock.filter((product) => product.quantity > 0),
    [stock]
  );

  const stockMap = useMemo(() => {
    const map = new Map<number, ManagerStockItem>();
    for (const item of stock) {
      map.set(item.product_id, item);
    }
    return map;
  }, [stock]);

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return availableProducts;
    return availableProducts.filter((product) => product.name.toLowerCase().includes(term));
  }, [availableProducts, productSearch]);

  const filteredBonusProducts = useMemo(() => {
    const term = bonusProductSearch.trim().toLowerCase();
    if (!term) return availableProducts;
    return availableProducts.filter((product) => product.name.toLowerCase().includes(term));
  }, [availableProducts, bonusProductSearch]);

  const filteredReturnProducts = useMemo(() => {
    const term = returnProductSearch.trim().toLowerCase();
    if (!term) return stock;
    return stock.filter((product) => product.name.toLowerCase().includes(term));
  }, [returnProductSearch, stock]);

  const resetGoodsSelection = () => {
    setSelectedProduct(null);
    setQuantityInput("");
    setPriceInput("");
    setProductSearch("");
    setProductOpen(false);
  };

  const resetBonusSelection = () => {
    setBonusSelectedProduct(null);
    setBonusQuantityInput("");
    setBonusPriceInput("");
    setBonusProductSearch("");
    setBonusProductOpen(false);
  };

  const resetReturnSelection = () => {
    setReturnSelectedProduct(null);
    setReturnQuantityInput("");
    setReturnPriceInput("");
    setReturnProductSearch("");
    setReturnProductOpen(false);
  };

  const handleSelectGoodsProduct = (product: ManagerStockItem) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setPriceInput(product.price != null ? String(product.price) : "");
    setProductOpen(false);
  };

  const handleSelectBonusProduct = (product: ManagerStockItem) => {
    setBonusSelectedProduct(product);
    setBonusProductSearch(product.name);
    setBonusPriceInput(product.price != null ? String(product.price) : "");
    setBonusProductOpen(false);
  };

  const handleSelectReturnProduct = (product: ManagerStockItem) => {
    setReturnSelectedProduct(product);
    setReturnProductSearch(product.name);
    setReturnPriceInput(product.price != null ? String(product.price) : "");
    setReturnProductOpen(false);
  };

  const addGoodsItem = () => {
    if (!selectedProduct) {
      toast({ title: "Ошибка", description: "Выберите товар", variant: "destructive" });
      return;
    }

    const quantityValue = Number(quantityInput.trim());
    if (!quantityInput.trim() || Number.isNaN(quantityValue) || quantityValue <= 0) {
      toast({ title: "Ошибка", description: "Количество должно быть больше нуля", variant: "destructive" });
      return;
    }

    const available = selectedProduct.quantity;
    const existingGoods = items.find(
      (item) => item.product_id === selectedProduct.product_id && item.is_bonus === false
    );
    const existingBonus = items.find(
      (item) => item.product_id === selectedProduct.product_id && item.is_bonus === true
    );
    const goodsQuantity = existingGoods ? Number(existingGoods.quantity) : 0;
    const bonusQuantity = existingBonus ? Number(existingBonus.quantity) : 0;
    if (goodsQuantity + bonusQuantity + quantityValue > available) {
      toast({
        title: "Недостаточно товара",
        description: `${selectedProduct.name}: доступно ${available}, пытаетесь выдать ${goodsQuantity + bonusQuantity + quantityValue}`,
        variant: "destructive",
      });
      return;
    }

    const priceValue = priceInput.trim();
    const priceNumber = priceValue === "" ? null : Number(priceValue);
    if (priceValue !== "" && (Number.isNaN(priceNumber) || priceNumber < 0)) {
      toast({ title: "Ошибка", description: "Цена должна быть неотрицательной", variant: "destructive" });
      return;
    }

    setItems((current) => {
      const index = current.findIndex(
        (item) => item.product_id === selectedProduct.product_id && item.is_bonus === false
      );
      if (index >= 0) {
        const next = [...current];
        next[index] = {
          ...next[index],
          quantity: String(Number(next[index].quantity) + quantityValue),
          price: priceNumber === null ? next[index].price : String(priceNumber),
        };
        return next;
      }

      return [
        ...current,
        {
          product_id: selectedProduct.product_id,
          product_name: selectedProduct.name,
          quantity: String(quantityValue),
          price: priceNumber === null ? "" : String(priceNumber),
          is_bonus: false,
          is_return: false,
        },
      ];
    });

    resetGoodsSelection();
  };

  const addBonusItem = () => {
    if (!bonusSelectedProduct) {
      toast({ title: "Ошибка", description: "Выберите бонусный товар", variant: "destructive" });
      return;
    }

    const quantityValue = Number(bonusQuantityInput.trim());
    if (!bonusQuantityInput.trim() || Number.isNaN(quantityValue) || quantityValue <= 0) {
      toast({ title: "Ошибка", description: "Количество должно быть больше нуля", variant: "destructive" });
      return;
    }

    const available = bonusSelectedProduct.quantity;
    const existingGoods = items.find(
      (item) => item.product_id === bonusSelectedProduct.product_id && item.is_bonus === false
    );
    const existingBonus = items.find(
      (item) => item.product_id === bonusSelectedProduct.product_id && item.is_bonus === true
    );
    const goodsQuantity = existingGoods ? Number(existingGoods.quantity) : 0;
    const bonusQuantity = existingBonus ? Number(existingBonus.quantity) : 0;
    if (goodsQuantity + bonusQuantity + quantityValue > available) {
      toast({
        title: "Недостаточно товара",
        description: `${bonusSelectedProduct.name}: доступно ${available}, пытаетесь выдать ${goodsQuantity + bonusQuantity + quantityValue}`,
        variant: "destructive",
      });
      return;
    }

    const priceValue = bonusPriceInput.trim();
    const priceNumber = priceValue === "" ? null : Number(priceValue);
    if (priceValue !== "" && (Number.isNaN(priceNumber) || priceNumber < 0)) {
      toast({ title: "Ошибка", description: "Цена должна быть неотрицательной", variant: "destructive" });
      return;
    }

    setItems((current) => {
      const index = current.findIndex(
        (item) => item.product_id === bonusSelectedProduct.product_id && item.is_bonus === true
      );
      if (index >= 0) {
        const next = [...current];
        next[index] = {
          ...next[index],
          quantity: String(Number(next[index].quantity) + quantityValue),
          price: priceNumber === null ? next[index].price : String(priceNumber),
        };
        return next;
      }

      return [
        ...current,
        {
          product_id: bonusSelectedProduct.product_id,
          product_name: bonusSelectedProduct.name,
          quantity: String(quantityValue),
          price: priceNumber === null ? "" : String(priceNumber),
          is_bonus: true,
          is_return: false,
        },
      ];
    });

    resetBonusSelection();
  };

  const addReturnItem = () => {
    if (!returnSelectedProduct) {
      toast({ title: "Ошибка", description: "Выберите товар для возврата", variant: "destructive" });
      return;
    }

    const quantityValue = Number(returnQuantityInput.trim());
    if (!returnQuantityInput.trim() || Number.isNaN(quantityValue) || quantityValue <= 0) {
      toast({ title: "Ошибка", description: "Количество должно быть больше нуля", variant: "destructive" });
      return;
    }

    const priceValue = returnPriceInput.trim();
    const priceNumber = priceValue === "" ? null : Number(priceValue);
    if (priceValue !== "" && (Number.isNaN(priceNumber) || priceNumber < 0)) {
      toast({ title: "Ошибка", description: "Цена должна быть неотрицательной", variant: "destructive" });
      return;
    }

    setReturnItems((current) => {
      const index = current.findIndex(
        (item) => item.product_id === returnSelectedProduct.product_id && item.is_return,
      );
      if (index >= 0) {
        const next = [...current];
        next[index] = {
          ...next[index],
          quantity: String(Number(next[index].quantity) + quantityValue),
          price: priceNumber === null ? next[index].price : String(priceNumber),
        };
        return next;
      }

      return [
        ...current,
        {
          product_id: returnSelectedProduct.product_id,
          product_name: returnSelectedProduct.name,
          quantity: String(quantityValue),
          price: priceNumber === null ? "" : String(priceNumber),
          is_bonus: false,
          is_return: true,
        },
      ];
    });

    resetReturnSelection();
  };

  const handleQuantityChange = (productId: number, isBonus: boolean, value: string) => {
    setItems((current) =>
      current.map((item) =>
        item.product_id === productId && item.is_bonus === isBonus ? { ...item, quantity: value } : item
      )
    );
  };

  const handlePriceChange = (productId: number, isBonus: boolean, value: string) => {
    setItems((current) =>
      current.map((item) =>
        item.product_id === productId && item.is_bonus === isBonus ? { ...item, price: value } : item
      )
    );
  };

  const handleRemoveItem = (productId: number, isBonus: boolean) => {
    setItems((current) =>
      current.filter((item) => !(item.product_id === productId && item.is_bonus === isBonus))
    );
  };

  const handleReturnQuantityChange = (productId: number, value: string) => {
    setReturnItems((current) =>
      current.map((item) => (item.product_id === productId ? { ...item, quantity: value } : item)),
    );
  };

  const handleReturnPriceChange = (productId: number, value: string) => {
    setReturnItems((current) =>
      current.map((item) => (item.product_id === productId ? { ...item, price: value } : item)),
    );
  };

  const handleRemoveReturnItem = (productId: number) => {
    setReturnItems((current) => current.filter((item) => item.product_id !== productId));
  };

  const goodsItemsList = useMemo(() => items.filter((item) => !item.is_bonus), [items]);
  const bonusItemsList = useMemo(() => items.filter((item) => item.is_bonus), [items]);
  const returnItemsList = useMemo(() => returnItems, [returnItems]);

  const calculateItemsTotal = useCallback(
    (list: OrderFormItem[]) => {
      return list.reduce((sum, item) => {
        const quantity = Number(item.quantity || 0);
        if (Number.isNaN(quantity)) {
          return sum;
        }

        let priceValue: number;
        if (item.price.trim() === "") {
          const stockItem = stockMap.get(item.product_id);
          priceValue = stockItem?.price ?? 0;
        } else {
          priceValue = Number(item.price.trim());
        }

        if (Number.isNaN(priceValue) || priceValue < 0) {
          return sum;
        }

        return sum + quantity * priceValue;
      }, 0);
    },
    [stockMap]
  );

  const totalGoodsAmount = useMemo(
    () => calculateItemsTotal(goodsItemsList),
    [calculateItemsTotal, goodsItemsList]
  );

  const totalBonusAmount = useMemo(
    () => calculateItemsTotal(bonusItemsList),
    [calculateItemsTotal, bonusItemsList]
  );

  const totalGoodsQuantity = useMemo(
    () =>
      goodsItemsList.reduce((sum, item) => {
        const quantity = Number(item.quantity || 0);
        return Number.isNaN(quantity) ? sum : sum + quantity;
      }, 0),
    [goodsItemsList]
  );

  const totalBonusQuantity = useMemo(
    () =>
      bonusItemsList.reduce((sum, item) => {
        const quantity = Number(item.quantity || 0);
        return Number.isNaN(quantity) ? sum : sum + quantity;
      }, 0),
    [bonusItemsList]
  );

  const returnsTotal = useMemo(
    () => calculateItemsTotal(returnItemsList),
    [calculateItemsTotal, returnItemsList],
  );

  const payableAmount = useMemo(() => {
    const diff = totalGoodsAmount - returnsTotal;
    return diff > 0 ? diff : 0;
  }, [returnsTotal, totalGoodsAmount]);

  const orderTotal = useMemo(() => totalGoodsAmount, [totalGoodsAmount]);

  const paidAmountNumber = useMemo(() => {
    if (paidAmountInput.trim() === "") {
      return 0;
    }

    const parsed = Number(paidAmountInput);
    return Number.isNaN(parsed) ? null : parsed;
  }, [paidAmountInput]);

  const orderDebt = useMemo(() => {
    if (paidAmountNumber === null || paidAmountNumber < 0) {
      return Math.max(payableAmount, 0);
    }

    const diff = payableAmount - paidAmountNumber;
    return diff > 0 ? diff : 0;
  }, [payableAmount, paidAmountNumber]);

  const projectedShopDebt = useMemo(() => {
    if (!selectedShop) return null;
    if (paidAmountNumber === null || paidAmountNumber < 0) return null;

    const oldDebt = selectedShop.debt ?? 0;
    const maxAllowed = payableAmount + oldDebt;
    if (paidAmountNumber > maxAllowed) return null;

    if (paidAmountNumber < payableAmount) {
      return oldDebt + (payableAmount - paidAmountNumber);
    }

    if (Math.abs(paidAmountNumber - payableAmount) < 1e-6) {
      return oldDebt;
    }

    const extra = paidAmountNumber - payableAmount;
    return Math.max(oldDebt - extra, 0);
  }, [payableAmount, paidAmountNumber, selectedShop]);

  const detailBonusTotal = useMemo(() => {
    if (!detailOrder) return 0;

    return detailOrder.items.reduce((sum, item) => {
      if (!item.is_bonus) return sum;

      const priceValue = Number(item.price ?? 0);
      const quantityValue = Number(item.quantity ?? 0);
      if (Number.isNaN(priceValue) || Number.isNaN(quantityValue)) {
        return sum;
      }

      return sum + priceValue * quantityValue;
    }, 0);
  }, [detailOrder]);

  const orderMutation = useMutation({
    mutationFn: (payload: ShopOrderCreatePayload) => api.createShopOrder(payload),
    onSuccess: (data: ShopOrder) => {
      const debtValue = data?.payment?.debt_amount;
      toast({
        title: "Товары выданы магазину",
        description:
          debtValue !== undefined && debtValue !== null
            ? `Долг магазина: ${currencyFormatter.format(Number(debtValue))} ₸`
            : undefined,
      });
      setShopId("");
      setItems([]);
      resetGoodsSelection();
      resetBonusSelection();
      setReturnItems([]);
      resetReturnSelection();
      setPaidAmountInput("");
      setPaidAmountError(null);
      queryClient.invalidateQueries({ queryKey: ["manager", "stock"] });
      queryClient.invalidateQueries({ queryKey: ["manager", "shops"] });
      refetchOrders();
    },
    onError: (mutationError: unknown) => {
      const error = mutationError as (Error & { status?: number; data?: any }) | undefined;
      if (
        (error?.status === 400 || error?.status === 409) &&
        error.data?.error === "INSUFFICIENT_STOCK"
      ) {
        const shortages: Array<{ product_id: number; requested: number; available: number }> =
          Array.isArray(error.data.items) ? error.data.items : [];
        const lines = shortages.map((shortage) => {
          const stockItem = stockMap.get(shortage.product_id);
          const name = stockItem?.name ?? `Товар ${shortage.product_id}`;
          return `${name}: нужно ${shortage.requested}, доступно ${shortage.available}`;
        });
        toast({
          title: "Недостаточно товара на складе",
          description: lines.length > 0 ? lines.join("\n") : error.message,
          variant: "destructive",
        });
        return;
      }

      if (error?.status === 400 && error.data?.detail) {
        const detailMessage = String(error.data.detail);
        setPaidAmountError(detailMessage);
        toast({ title: "Ошибка", description: detailMessage, variant: "destructive" });
        return;
      }

      const message = error?.message || "Не удалось оформить выдачу";
      toast({ title: "Ошибка", description: message, variant: "destructive" });
    },
  });

  const payDebtMutation = useMutation({
    mutationFn: (payload: { shopId: number; amount: number }) =>
      api.payShopDebt(payload.shopId, { amount: payload.amount }),
    onSuccess: () => {
      toast({ title: "Долг уменьшен" });
      setPaidAmountInput("");
      setPaidAmountError(null);
      queryClient.invalidateQueries({ queryKey: ["manager", "shops"] });
    },
    onError: (mutationError: unknown) => {
      const error = mutationError as (Error & { status?: number; data?: any }) | undefined;
      const detail = error?.data?.detail;
      const detailMessage =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(", ")
            : error?.message || "Не удалось погасить долг";
      setPaidAmountError(detailMessage);
      toast({ title: "Ошибка", description: detailMessage, variant: "destructive" });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionInProgress) return;

    if (!shopId) {
      toast({ title: "Ошибка", description: "Выберите магазин", variant: "destructive" });
      return;
    }

    const paidValue = paidAmountInput.trim() === "" ? 0 : Number(paidAmountInput);
    if (Number.isNaN(paidValue)) {
      const message = "Введите корректную сумму оплаты";
      setPaidAmountError(message);
      toast({ title: "Ошибка", description: message, variant: "destructive" });
      return;
    }

    if (paidValue < 0) {
      const message = "Сумма не может быть отрицательной";
      setPaidAmountError(message);
      toast({ title: "Ошибка", description: message, variant: "destructive" });
      return;
    }

    const targetShop = selectedShop ?? shops.find((shop) => String(shop.id) === shopId);

    if (!hasGoods) {
      if (paidValue <= 0) {
        const message = "Выберите товары или укажите сумму для погашения долга";
        setPaidAmountError(message);
        toast({ title: "Ошибка", description: message, variant: "destructive" });
        return;
      }

      const currentDebt = targetShop?.debt ?? 0;
      if (currentDebt <= 0) {
        const message = "У магазина нет долга";
        setPaidAmountError(message);
        toast({ title: "Ошибка", description: message, variant: "destructive" });
        return;
      }

      if (paidValue > currentDebt) {
        const message = "Сумма превышает долг";
        setPaidAmountError(message);
        toast({ title: "Ошибка", description: message, variant: "destructive" });
        return;
      }

      setPaidAmountError(null);
      payDebtMutation.mutate({ shopId: Number(shopId), amount: paidValue });
      return;
    }

    const aggregated = new Map<number, number>();
    for (const item of items) {
      const quantityNumber = Number(item.quantity.trim());
      if (item.quantity.trim() === "" || Number.isNaN(quantityNumber) || quantityNumber <= 0) {
        toast({ title: "Ошибка", description: "Количество должно быть больше нуля", variant: "destructive" });
        return;
      }

      aggregated.set(item.product_id, (aggregated.get(item.product_id) ?? 0) + quantityNumber);

      if (item.price.trim() !== "") {
        const priceNumber = Number(item.price.trim());
        if (Number.isNaN(priceNumber) || priceNumber < 0) {
          toast({ title: "Ошибка", description: "Цена должна быть неотрицательной", variant: "destructive" });
          return;
        }
      }
    }

    for (const item of returnItems) {
      const quantityNumber = Number(item.quantity.trim());
      if (item.quantity.trim() === "" || Number.isNaN(quantityNumber) || quantityNumber <= 0) {
        toast({ title: "Ошибка", description: "Количество должно быть больше нуля", variant: "destructive" });
        return;
      }

      if (item.price.trim() !== "") {
        const priceNumber = Number(item.price.trim());
        if (Number.isNaN(priceNumber) || priceNumber < 0) {
          toast({ title: "Ошибка", description: "Цена должна быть неотрицательной", variant: "destructive" });
          return;
        }
      }
    }

    for (const [productId, totalQuantity] of aggregated.entries()) {
      const stockItem = stockMap.get(productId);
      const available = stockItem?.quantity ?? 0;
      if (totalQuantity > available) {
        const name = stockItem?.name ?? `Товар ${productId}`;
        toast({
          title: "Недостаточно товара",
          description: `${name}: доступно ${available}, указано ${totalQuantity}`,
          variant: "destructive",
        });
        return;
      }
    }

    const payloadItems = [
      ...items.map((item) => {
        const quantityNumber = Number(item.quantity.trim());
        const priceValue = item.price.trim() === "" ? null : Number(item.price.trim());
        return {
          product_id: item.product_id,
          quantity: quantityNumber,
          price: priceValue,
          is_bonus: item.is_bonus,
          is_return: false,
        };
      }),
      ...returnItems.map((item) => {
        const quantityNumber = Number(item.quantity.trim());
        const priceValue = item.price.trim() === "" ? null : Number(item.price.trim());
        return {
          product_id: item.product_id,
          quantity: quantityNumber,
          price: priceValue,
          is_bonus: false,
          is_return: true,
        };
      }),
    ];
    if (targetShop) {
      const maxAllowed = payableAmount + (targetShop.debt ?? 0);
      if (paidValue > maxAllowed) {
        const message = "Сумма оплаты превышает сумму заказа и текущий долг магазина";
        setPaidAmountError(message);
        toast({ title: "Ошибка", description: message, variant: "destructive" });
        return;
      }
    }

    setPaidAmountError(null);

    const payload: ShopOrderCreatePayload = {
      shop_id: Number(shopId),
      items: payloadItems,
      paid_amount: paidValue,
    };

    orderMutation.mutate(payload);
  };

  const totalRequested = totalGoodsQuantity + totalBonusQuantity;
  const hasGoods = items.length > 0 || returnItems.length > 0;
  const submissionInProgress = orderMutation.isPending || payDebtMutation.isPending;
  const handlePaidAmountChange = (value: string) => {
    setPaidAmountInput(value);
    if (value.trim() === "") {
      setPaidAmountError(null);
      return;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      setPaidAmountError("Введите корректную сумму");
      return;
    }

    if (parsed < 0) {
      setPaidAmountError("Сумма не может быть отрицательной");
      return;
    }

    if (selectedShop) {
      const maxAllowed = payableAmount + (selectedShop.debt ?? 0);
      if (parsed > maxAllowed) {
        setPaidAmountError("Сумма оплаты превышает сумму заказа и текущий долг магазина");
        return;
      }
    }

    setPaidAmountError(null);
  };

  const isGoodsAddDisabled =
    !selectedProduct ||
    !quantityInput.trim() ||
    Number.isNaN(Number(quantityInput)) ||
    Number(quantityInput) <= 0;

  const isBonusAddDisabled =
    !bonusSelectedProduct ||
    !bonusQuantityInput.trim() ||
    Number.isNaN(Number(bonusQuantityInput)) ||
    Number(bonusQuantityInput) <= 0;

  const isReturnAddDisabled =
    !returnSelectedProduct ||
    !returnQuantityInput.trim() ||
    Number.isNaN(Number(returnQuantityInput)) ||
    Number(returnQuantityInput) <= 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Выдача в магазины</h1>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Оформить выдачу</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchStock()} disabled={stockLoading}>
            {stockLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Обновить остатки"}
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Магазин</Label>
              <Select value={shopId} onValueChange={setShopId} disabled={shopsLoading || shops.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите магазин" />
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
              <p className="text-sm text-muted-foreground">
                {selectedShop
                  ? `Текущий долг магазина: ${currencyFormatter.format(selectedShop.debt ?? 0)} ₸`
                  : "Магазин не выбран"}
              </p>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">Товары</h3>
                  <p className="text-sm text-muted-foreground">
                    Обычные позиции заказа, которые оплачивает магазин
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Popover open={productOpen} onOpenChange={setProductOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                        onClick={() => setProductOpen((prev) => !prev)}
                      >
                        {selectedProduct ? selectedProduct.name : "Выберите товар"}
                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(320px,90vw)] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Поиск товара..."
                          value={productSearch}
                          onValueChange={setProductSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Товар не найден</CommandEmpty>
                          <CommandGroup>
                            {filteredProducts.map((product) => (
                              <CommandItem
                                key={product.product_id}
                                value={String(product.product_id)}
                                onSelect={() => handleSelectGoodsProduct(product)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedProduct?.product_id === product.product_id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="flex-1">{product.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  Остаток: {product.quantity}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="number"
                    min={0}
                    value={quantityInput}
                    onChange={(event) => setQuantityInput(event.target.value)}
                    placeholder="Кол-во"
                    className="w-full sm:w-24"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={priceInput}
                    onChange={(event) => setPriceInput(event.target.value)}
                    placeholder="Цена"
                    className="w-full sm:w-28"
                  />
                  <Button type="button" onClick={addGoodsItem} disabled={isGoodsAddDisabled}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Товар</TableHead>
                      <TableHead className="w-24">Доступно</TableHead>
                      <TableHead className="w-28">Количество</TableHead>
                      <TableHead className="w-28">Цена</TableHead>
                      <TableHead className="w-32">Сумма</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goodsItemsList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Товары не выбраны
                        </TableCell>
                      </TableRow>
                    ) : (
                      goodsItemsList.map((item) => {
                        const stockItem = stockMap.get(item.product_id);
                        const quantity = Number(item.quantity || 0);
                        const priceValue =
                          item.price.trim() !== ""
                            ? Number(item.price)
                            : stockItem?.price ?? 0;
                        const lineTotal =
                          Number.isNaN(quantity) || Number.isNaN(priceValue)
                            ? 0
                            : quantity * priceValue;
                        return (
                          <TableRow key={`goods-${item.product_id}`}>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell>{stockItem?.quantity ?? 0}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                value={item.quantity}
                                onChange={(event) =>
                                  handleQuantityChange(item.product_id, false, event.target.value)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.price}
                                placeholder="—"
                                onChange={(event) =>
                                  handlePriceChange(item.product_id, false, event.target.value)
                                }
                              />
                            </TableCell>
                            <TableCell>{currencyFormatter.format(lineTotal)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.product_id, false)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 md:hidden">
                {goodsItemsList.length === 0 ? (
                  <div className="rounded-lg border p-4 text-center text-muted-foreground">Товары не выбраны</div>
                ) : (
                  goodsItemsList.map((item) => {
                    const stockItem = stockMap.get(item.product_id);
                    const quantity = Number(item.quantity || 0);
                    const priceValue =
                      item.price.trim() !== ""
                        ? Number(item.price)
                        : stockItem?.price ?? 0;
                    const lineTotal =
                      Number.isNaN(quantity) || Number.isNaN(priceValue)
                        ? 0
                        : quantity * priceValue;
                    return (
                      <div key={`goods-mobile-${item.product_id}`} className="rounded-lg border p-4 space-y-3 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-semibold leading-tight">{item.product_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Остаток: {stockItem?.quantity ?? 0}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.product_id, false)}
                            aria-label={`Удалить ${item.product_name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-muted-foreground">Количество</p>
                            <Input
                              type="number"
                              min={0}
                              value={item.quantity}
                              onChange={(event) =>
                                handleQuantityChange(item.product_id, false, event.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-muted-foreground">Цена</p>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.price}
                              placeholder="—"
                              onChange={(event) =>
                                handlePriceChange(item.product_id, false, event.target.value)
                              }
                            />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Сумма: {currencyFormatter.format(lineTotal)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-3 border-t pt-4">
                <div>
                  <h3 className="text-lg font-semibold">Бонус</h3>
                  <p className="text-sm text-muted-foreground">
                    Бонусные товары уменьшают остаток водителя, но не увеличивают оплату
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Popover open={bonusProductOpen} onOpenChange={setBonusProductOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                        onClick={() => setBonusProductOpen((prev) => !prev)}
                      >
                        {bonusSelectedProduct ? bonusSelectedProduct.name : "Выберите бонус"}
                        <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(320px,90vw)] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Поиск товара..."
                          value={bonusProductSearch}
                          onValueChange={setBonusProductSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Товар не найден</CommandEmpty>
                          <CommandGroup>
                            {filteredBonusProducts.map((product) => (
                              <CommandItem
                                key={product.product_id}
                                value={String(product.product_id)}
                                onSelect={() => handleSelectBonusProduct(product)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    bonusSelectedProduct?.product_id === product.product_id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <span className="flex-1">{product.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  Остаток: {product.quantity}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="number"
                    min={0}
                    value={bonusQuantityInput}
                    onChange={(event) => setBonusQuantityInput(event.target.value)}
                    placeholder="Кол-во"
                    className="w-full sm:w-24"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={bonusPriceInput}
                    onChange={(event) => setBonusPriceInput(event.target.value)}
                    placeholder="Цена"
                    className="w-full sm:w-28"
                  />
                  <Button type="button" onClick={addBonusItem} disabled={isBonusAddDisabled}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Товар</TableHead>
                      <TableHead className="w-24">Доступно</TableHead>
                      <TableHead className="w-28">Количество</TableHead>
                      <TableHead className="w-28">Цена</TableHead>
                      <TableHead className="w-32">Сумма</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bonusItemsList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Бонусные товары не выбраны
                        </TableCell>
                      </TableRow>
                    ) : (
                      bonusItemsList.map((item) => {
                        const stockItem = stockMap.get(item.product_id);
                        const quantity = Number(item.quantity || 0);
                        const priceValue =
                          item.price.trim() !== ""
                            ? Number(item.price)
                            : stockItem?.price ?? 0;
                        const lineTotal =
                          Number.isNaN(quantity) || Number.isNaN(priceValue)
                            ? 0
                            : quantity * priceValue;
                        return (
                          <TableRow key={`bonus-${item.product_id}`}>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell>{stockItem?.quantity ?? 0}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                value={item.quantity}
                                onChange={(event) =>
                                  handleQuantityChange(item.product_id, true, event.target.value)
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.price}
                                placeholder="—"
                                onChange={(event) =>
                                  handlePriceChange(item.product_id, true, event.target.value)
                                }
                              />
                            </TableCell>
                            <TableCell>{currencyFormatter.format(lineTotal)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.product_id, true)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 md:hidden">
                {bonusItemsList.length === 0 ? (
                  <div className="rounded-lg border p-4 text-center text-muted-foreground">Бонусные товары не выбраны</div>
                ) : (
                  bonusItemsList.map((item) => {
                    const stockItem = stockMap.get(item.product_id);
                    const quantity = Number(item.quantity || 0);
                    const priceValue =
                      item.price.trim() !== ""
                        ? Number(item.price)
                        : stockItem?.price ?? 0;
                    const lineTotal =
                      Number.isNaN(quantity) || Number.isNaN(priceValue)
                        ? 0
                        : quantity * priceValue;
                    return (
                      <div key={`bonus-mobile-${item.product_id}`} className="rounded-lg border p-4 space-y-3 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-semibold leading-tight">{item.product_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Остаток: {stockItem?.quantity ?? 0}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.product_id, true)}
                            aria-label={`Удалить ${item.product_name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-muted-foreground">Количество</p>
                            <Input
                              type="number"
                              min={0}
                              value={item.quantity}
                              onChange={(event) =>
                                handleQuantityChange(item.product_id, true, event.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs uppercase text-muted-foreground">Цена</p>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.price}
                              placeholder="—"
                              onChange={(event) =>
                                handlePriceChange(item.product_id, true, event.target.value)
                              }
                            />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Сумма: {currencyFormatter.format(lineTotal)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div>
                <h3 className="text-lg font-semibold">Возврат</h3>
                <p className="text-sm text-muted-foreground">
                  Товары, которые магазин возвращает. Сумма возврата уменьшает оплату, остаток водителя не
                  уменьшается.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Popover open={returnProductOpen} onOpenChange={setReturnProductOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      onClick={() => setReturnProductOpen((prev) => !prev)}
                    >
                      {returnSelectedProduct ? returnSelectedProduct.name : "Выберите возврат"}
                      <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(320px,90vw)] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Поиск товара..."
                        value={returnProductSearch}
                        onValueChange={setReturnProductSearch}
                      />
                      <CommandList>
                        <CommandEmpty>Товар не найден</CommandEmpty>
                        <CommandGroup>
                          {filteredReturnProducts.map((product) => (
                            <CommandItem
                              key={product.product_id}
                              value={String(product.product_id)}
                              onSelect={() => handleSelectReturnProduct(product)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  returnSelectedProduct?.product_id === product.product_id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <span className="flex-1">{product.name}</span>
                              <span className="text-xs text-muted-foreground">Остаток: {product.quantity}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Input
                  type="number"
                  min={0}
                  value={returnQuantityInput}
                  onChange={(event) => setReturnQuantityInput(event.target.value)}
                  placeholder="Кол-во"
                  className="w-full sm:w-24"
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={returnPriceInput}
                  onChange={(event) => setReturnPriceInput(event.target.value)}
                  placeholder="Цена"
                  className="w-full sm:w-28"
                />
                <Button type="button" onClick={addReturnItem} disabled={isReturnAddDisabled}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead className="w-24">Доступно</TableHead>
                    <TableHead className="w-28">Количество</TableHead>
                    <TableHead className="w-28">Цена</TableHead>
                    <TableHead className="w-32">Сумма</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnItemsList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Товары на возврат не выбраны
                      </TableCell>
                    </TableRow>
                  ) : (
                    returnItemsList.map((item) => {
                      const stockItem = stockMap.get(item.product_id);
                      const quantity = Number(item.quantity || 0);
                      const priceValue =
                        item.price.trim() !== ""
                          ? Number(item.price)
                          : stockItem?.price ?? 0;
                      const lineTotal =
                        Number.isNaN(quantity) || Number.isNaN(priceValue)
                          ? 0
                          : quantity * priceValue;
                      return (
                        <TableRow key={`return-${item.product_id}`}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell>{stockItem?.quantity ?? 0}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={item.quantity}
                              onChange={(event) =>
                                handleReturnQuantityChange(item.product_id, event.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={item.price}
                              placeholder="—"
                              onChange={(event) =>
                                handleReturnPriceChange(item.product_id, event.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>{currencyFormatter.format(lineTotal)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveReturnItem(item.product_id)}
                              aria-label={`Удалить ${item.product_name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 md:hidden">
              {returnItemsList.length === 0 ? (
                <div className="rounded-lg border p-4 text-center text-muted-foreground">
                  Товары на возврат не выбраны
                </div>
              ) : (
                returnItemsList.map((item) => {
                  const stockItem = stockMap.get(item.product_id);
                  const quantity = Number(item.quantity || 0);
                  const priceValue =
                    item.price.trim() !== ""
                      ? Number(item.price)
                      : stockItem?.price ?? 0;
                  const lineTotal =
                    Number.isNaN(quantity) || Number.isNaN(priceValue) ? 0 : quantity * priceValue;
                  return (
                    <div key={`return-mobile-${item.product_id}`} className="rounded-lg border p-4 space-y-3 bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold leading-tight">{item.product_name}</h3>
                          <p className="text-sm text-muted-foreground">Остаток: {stockItem?.quantity ?? 0}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveReturnItem(item.product_id)}
                          aria-label={`Удалить ${item.product_name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <p className="text-xs uppercase text-muted-foreground">Количество</p>
                          <Input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(event) => handleReturnQuantityChange(item.product_id, event.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs uppercase text-muted-foreground">Цена</p>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.price}
                            placeholder="—"
                            onChange={(event) => handleReturnPriceChange(item.product_id, event.target.value)}
                          />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Сумма: {currencyFormatter.format(lineTotal)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs uppercase text-muted-foreground">Обычные товары</p>
                <p className="text-sm">Количество: {totalGoodsQuantity}</p>
                <p className="text-sm">Сумма: {currencyFormatter.format(totalGoodsAmount)}</p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs uppercase text-muted-foreground">Бонусы</p>
                <p className="text-sm">Количество: {totalBonusQuantity}</p>
                <p className="text-sm">Сумма: {currencyFormatter.format(totalBonusAmount)}</p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs uppercase text-muted-foreground">Сумма возвратов</p>
                <p className="text-sm">{currencyFormatter.format(returnsTotal)}</p>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs uppercase text-muted-foreground">К оплате</p>
                <p className="text-sm font-semibold">{currencyFormatter.format(payableAmount)}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Сумма заказа</span>
                  <span className="text-foreground">{currencyFormatter.format(orderTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Сумма возвратов</span>
                  <span className="text-foreground">{currencyFormatter.format(returnsTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Бонус</span>
                  <span className="text-foreground">{currencyFormatter.format(totalBonusAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-base font-semibold text-foreground">К оплате</span>
                  <span className="text-xl font-semibold text-foreground">{currencyFormatter.format(payableAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Долг по заказу</span>
                  <span className="text-foreground">{currencyFormatter.format(orderDebt)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="paid-now">Сколько магазин платит сейчас</Label>
                  {selectedShop && (
                    <span className="text-xs text-muted-foreground">
                      Текущий долг: {currencyFormatter.format(selectedShop.debt ?? 0)}
                    </span>
                  )}
                </div>
                <Input
                  id="paid-now"
                  type="number"
                  min={0}
                  step="0.01"
                  value={paidAmountInput}
                  onChange={(event) => handlePaidAmountChange(event.target.value)}
                  placeholder="0"
                />
                <p className={`text-sm ${paidAmountError ? "text-destructive" : "text-muted-foreground"}`}>
                  {paidAmountError ??
                    "Можно указать 0, если оплата не производится. Можно погасить долг без товаров: введите сумму и нажмите Отдать"}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Всего позиций: {totalRequested}</p>
              <p className="text-sm text-muted-foreground">
                Ожидаемый долг: {projectedShopDebt != null
                  ? currencyFormatter.format(projectedShopDebt)
                  : "—"}
              </p>
              <Button type="submit" className="w-full sm:w-56" disabled={submissionInProgress}>
                {submissionInProgress ? "Отправка..." : hasGoods ? "Отдать" : "Погасить долг"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>История выдач в магазины</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchOrders()} disabled={ordersLoading}>
            Обновить
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {ordersLoading ? (
              <div className="rounded-lg border p-4 text-center text-muted-foreground">Загрузка...</div>
            ) : orders.length === 0 ? (
              <div className="rounded-lg border p-4 text-center text-muted-foreground">Выдач пока нет</div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="rounded-lg border p-4 space-y-3 bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold leading-tight">{order.shop_name}</h3>
                      <p className="text-sm text-muted-foreground">{fmt(order.created_at)}</p>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">#{order.id}</span>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setDetailOrder(order)}>
                      Подробнее
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">№</TableHead>
                  <TableHead>Магазин</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="w-24 text-right">Позиции</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Выдач пока нет
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{order.id}</TableCell>
                      <TableCell>{order.shop_name}</TableCell>
                      <TableCell>{fmt(order.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setDetailOrder(order)}>
                          Подробнее
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailOrder !== null} onOpenChange={(open) => !open && setDetailOrder(null)}>
        <DialogContent className="w-full max-w-[90vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Детали выдачи</DialogTitle>
          </DialogHeader>
          {!detailOrder ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Магазин: {detailOrder.shop_name}</p>
                <p>Дата: {fmt(detailOrder.created_at)}</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Товар</TableHead>
                      <TableHead className="w-32">Количество</TableHead>
                      <TableHead className="w-32">Цена</TableHead>
                      <TableHead className="w-24 text-center">Бонус</TableHead>
                      <TableHead className="w-24 text-center">Возврат</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailOrder.items.map((item) => (
                      <TableRow key={item.product_id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.price ?? "—"}</TableCell>
                        <TableCell className="text-center">{item.is_bonus ? "Да" : "Нет"}</TableCell>
                        <TableCell className="text-center">{item.is_return ? "Да" : "Нет"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Сумма заказа: {currencyFormatter.format(detailOrder.payment?.total_goods_amount ?? 0)}</p>
                <p>Сумма возвратов: {currencyFormatter.format(detailOrder.payment?.returns_amount ?? 0)}</p>
                <p>Бонус: {currencyFormatter.format(detailBonusTotal)}</p>
                <p>К оплате: {currencyFormatter.format(detailOrder.payment?.payable_amount ?? 0)}</p>
                <p>Оплачено: {currencyFormatter.format(detailOrder.payment?.paid_amount ?? 0)}</p>
                <p>Долг: {currencyFormatter.format(detailOrder.payment?.debt_amount ?? 0)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
