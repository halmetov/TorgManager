from pydantic import BaseModel, conint
from typing import Optional, List
from datetime import datetime, timezone

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
    quantity: conint(gt=0)


class IncomingCreate(BaseModel):
    items: List[IncomingItemCreate]


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
