from pydantic import BaseModel, condecimal
from typing import Optional, List, Literal
from datetime import datetime, timezone, date
from decimal import Decimal

class ProductBase(BaseModel):
    name: str
    quantity: int
    price: float

class ProductCreate(ProductBase):
    is_return: bool = False

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = None
    price: Optional[float] = None


class ProductOut(ProductBase):
    id: int

    class Config:
        from_attributes = True

class Product(ProductBase):
    id: int
    manager_id: Optional[int]
    is_return: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class ShopBase(BaseModel):
    name: str
    address: str
    phone: str
    refrigerator_number: str


class ShopCreate(ShopBase):
    pass


class ShopUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    refrigerator_number: Optional[str] = None


class ShopOut(ShopBase):
    id: int
    manager_id: Optional[int] = None
    manager_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ManagerBase(BaseModel):
    username: str
    full_name: str

class ManagerCreate(ManagerBase):
    password: str
    is_active: bool = True

class ManagerUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None

class Manager(ManagerBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class DispatchItemCreate(BaseModel):
    product_id: int
    quantity: int
    price: float


class DispatchCreate(BaseModel):
    manager_id: int
    items: List[DispatchItemCreate]


class DispatchItemOut(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    price: float


class DispatchOut(BaseModel):
    id: int
    manager_id: int
    manager_name: Optional[str] = None
    status: str
    created_at: datetime
    accepted_at: Optional[datetime] = None
    items: List[DispatchItemOut]


class OrderItem(BaseModel):
    product_id: int
    quantity: int
    price: float

class OrderCreate(BaseModel):
    shop_id: int
    refrigerator_number: str
    items: List[OrderItem]

class ManagerStockItem(BaseModel):
    product_id: int
    name: str
    quantity: int
    price: Optional[float] = None


class ReturnItemCreate(BaseModel):
    product_id: int
    quantity: int


class ReturnCreate(BaseModel):
    items: List[ReturnItemCreate]


class ReturnCreated(BaseModel):
    id: int
    created_at: datetime


class ReturnListItem(BaseModel):
    id: int
    created_at: datetime
    manager_id: int
    manager_name: Optional[str] = None


class ReturnDetailItem(BaseModel):
    product_id: int
    product_name: str
    quantity: int


class ReturnDetail(BaseModel):
    id: int
    created_at: datetime
    manager_id: int
    manager_name: Optional[str] = None
    items: List[ReturnDetailItem]


class IncomingItemCreate(BaseModel):
    product_id: int
    quantity: condecimal(gt=0)


class IncomingCreate(BaseModel):
    product_id: Optional[int] = None
    quantity: Optional[condecimal(gt=0)] = None
    items: Optional[List[IncomingItemCreate]] = None


class IncomingCreated(BaseModel):
    id: int
    created_at: datetime


class IncomingListItem(BaseModel):
    id: int
    created_at: datetime


class IncomingDetailItem(BaseModel):
    product_id: int
    product_name: str
    quantity: int


class IncomingDetail(BaseModel):
    id: int
    created_at: datetime
    items: List[IncomingDetailItem]


class OrderReturnBlock(BaseModel):
    amount: condecimal(ge=0)


class ShopOrderItemCreate(BaseModel):
    product_id: int
    quantity: condecimal(gt=0)
    price: Optional[condecimal(ge=0)] = None
    is_bonus: bool = False


class ShopOrderCreate(BaseModel):
    shop_id: int
    returns: Optional[OrderReturnBlock] = None
    items: List[ShopOrderItemCreate]
    paid_amount: condecimal(ge=0)


class ShopOrderItemOut(BaseModel):
    product_id: int
    product_name: str
    quantity: float
    price: Optional[float] = None
    is_bonus: bool


class ShopOrderPaymentOut(BaseModel):
    total_goods_amount: Decimal
    returns_amount: Decimal
    payable_amount: Decimal
    paid_amount: Decimal
    debt_amount: Decimal


class ShopOrderOut(BaseModel):
    id: int
    manager_id: int
    shop_id: int
    shop_name: str
    created_at: datetime
    items: List[ShopOrderItemOut]
    payment: Optional[ShopOrderPaymentOut] = None


class ShopOrderDetailItem(BaseModel):
    product_id: int
    product_name: str
    quantity: Decimal
    price: Optional[Decimal] = None
    line_total: Decimal
    is_bonus: bool


class ShopOrderDetail(BaseModel):
    id: int
    manager_id: int
    manager_name: str
    shop_id: int
    shop_name: str
    created_at: datetime
    total_quantity: Decimal
    total_goods_amount: Decimal
    total_bonus_quantity: Decimal
    total_bonus_amount: Decimal
    items: List[ShopOrderDetailItem]
    payment: Optional[ShopOrderPaymentOut] = None


class ManagerReturnDetailItem(BaseModel):
    product_id: int
    product_name: str
    quantity: Decimal


class ManagerReturnDetail(BaseModel):
    id: int
    manager_id: int
    manager_name: str
    created_at: datetime
    items: List[ManagerReturnDetailItem]


class ShopReturnDetailItem(BaseModel):
    product_id: int
    product_name: str
    quantity: Decimal


class ShopReturnDetail(BaseModel):
    id: int
    manager_id: int
    manager_name: str
    shop_id: int
    shop_name: str
    created_at: datetime
    items: List[ShopReturnDetailItem]


class ShopReturnItemCreate(BaseModel):
    product_id: int
    quantity: condecimal(gt=0)


class ShopReturnCreate(BaseModel):
    shop_id: int
    items: List[ShopReturnItemCreate]


class ShopReturnItemOut(BaseModel):
    product_id: int
    product_name: str
    quantity: float


class ShopReturnOut(BaseModel):
    id: int
    manager_id: int
    shop_id: int
    shop_name: str
    created_at: datetime
    items: List[ShopReturnItemOut]


class ManagerReturnItemCreate(BaseModel):
    product_id: int
    quantity: condecimal(gt=0)


class ManagerReturnCreate(BaseModel):
    items: List[ManagerReturnItemCreate]


class ManagerReturnCreated(BaseModel):
    id: int
    created_at: datetime


class ManagerReturnItemOut(BaseModel):
    product_id: int
    product_name: str
    quantity: float


class ManagerReturnOut(BaseModel):
    id: int
    manager_id: int
    created_at: datetime
    items: List[ManagerReturnItemOut]


class ManagerDailySummary(BaseModel):
    received_total: Decimal
    delivered_total: Decimal
    return_to_main_total: Decimal
    return_from_shops_total: Decimal


class MovementRow(BaseModel):
    time: datetime
    shop_name: Optional[str] = None
    type: Literal["delivery", "return_to_main", "return_from_shop"]
    id: int


class ManagerDailyReport(BaseModel):
    date: date
    summary: ManagerDailySummary
    deliveries: List[MovementRow]
    returns_to_main: List[MovementRow]
    returns_from_shops: List[MovementRow]


class AdminDailyReport(ManagerDailyReport):
    manager_id: int
    manager_name: str


class ShopDayStat(BaseModel):
    date: date
    issued_total: Decimal
    returns_total: Decimal
    bonuses_total: Decimal
    debt_total: Decimal


class ShopDocumentRow(BaseModel):
    id: int
    type: Literal["delivery", "return_from_shop", "bonus"]
    date: datetime
    amount: Decimal
    manager_name: str
    debt_amount: Optional[Decimal] = None


class AdminShopPeriodSummary(BaseModel):
    issued_total: Decimal
    returns_total: Decimal
    bonuses_total: Decimal
    debt_total: Decimal


class AdminShopPeriodReport(BaseModel):
    shop_id: int
    shop_name: str
    date_from: date
    date_to: date
    summary: AdminShopPeriodSummary
    days: List[ShopDayStat]
    deliveries: List[ShopDocumentRow]
    returns_from_shop: List[ShopDocumentRow]
    bonuses: List[ShopDocumentRow]
