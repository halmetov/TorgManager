from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    name: str
    price: float = Field(..., gt=0)
    quantity: float = Field(..., ge=0)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str]
    price: Optional[float] = Field(default=None, gt=0)
    quantity: Optional[float] = Field(default=None, ge=0)
    is_archived: Optional[bool]


class ProductOut(ProductBase):
    id: int
    is_archived: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SearchProductOut(BaseModel):
    id: int
    name: str
    price: float
    quantity: float

    class Config:
        from_attributes = True


class IncomingItemCreate(BaseModel):
    product_id: int
    quantity: float = Field(..., gt=0)
    price_at_time: float = Field(..., gt=0)


class IncomingCreate(BaseModel):
    items: List[IncomingItemCreate] = Field(..., min_length=1)


class IncomingItemOut(BaseModel):
    id: int
    product_id: int
    quantity: float
    price_at_time: float

    class Config:
        from_attributes = True


class IncomingOut(BaseModel):
    id: int
    created_at: datetime
    created_by_admin_id: int
    items: List[IncomingItemOut]

    class Config:
        from_attributes = True


class DispatchStatus(str, Enum):
    pending = "pending"
    sent = "sent"


class DispatchItemCreate(BaseModel):
    product_id: int
    quantity: float = Field(..., gt=0)
    price: float = Field(..., gt=0)


class DispatchCreate(BaseModel):
    manager_id: int
    items: List[DispatchItemCreate] = Field(..., min_length=1)


class DispatchItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: float
    price: float

    class Config:
        from_attributes = True


class DispatchOut(BaseModel):
    id: int
    manager_id: int
    status: DispatchStatus
    created_at: datetime
    sent_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    items: List[DispatchItemOut]

    class Config:
        from_attributes = True


class ShopBase(BaseModel):
    name: str
    address: str
    phone: str
    fridge_number: str


class ShopCreate(ShopBase):
    pass


class ShopOut(ShopBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ShopAdminOut(ShopOut):
    manager_id: int
    manager_full_name: Optional[str]
    manager_username: Optional[str]

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


class ManagerStockOut(BaseModel):
    product_id: int
    product_name: str
    quantity: float
    price: float

