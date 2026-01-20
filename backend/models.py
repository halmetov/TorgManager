from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Numeric, Date, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone, date

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String)  # 'admin' or 'manager'
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    quantity = Column(Integer)
    price = Column(Float)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_return = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    manager = relationship("User", foreign_keys=[manager_id])

class Shop(Base):
    __tablename__ = "shops"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    address = Column(String)
    phone = Column(String)
    refrigerator_number = Column(String)
    debt = Column(Float, default=0.0)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    manager_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    manager = relationship("User", foreign_keys=[manager_id])


class Counterparty(Base):
    __tablename__ = "counterparties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    company_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    iin_bin = Column(String, nullable=True)
    address = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)

    created_by_admin = relationship("User")


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id = Column(Integer, primary_key=True, index=True)
    counterparty_id = Column(Integer, ForeignKey("counterparties.id"), nullable=False)
    status = Column(String, nullable=False, default="draft")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    closed_at = Column(DateTime, nullable=True)
    created_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    total_amount = Column(Float, nullable=False, default=0.0)
    paid_amount = Column(Float, nullable=False, default=0.0)
    debt_amount = Column(Float, nullable=False, default=0.0)

    counterparty = relationship("Counterparty")
    created_by_admin = relationship("User")
    items = relationship(
        "SalesOrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
    )
    payments = relationship(
        "SalesOrderPayment",
        back_populates="order",
        cascade="all, delete-orphan",
    )


class SalesOrderItem(Base):
    __tablename__ = "sales_order_items"

    id = Column(Integer, primary_key=True, index=True)
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    price_at_time = Column(Float, nullable=False)
    line_total = Column(Float, nullable=False)

    order = relationship("SalesOrder", back_populates="items")
    product = relationship("Product")


class SalesOrderPayment(Base):
    __tablename__ = "sales_order_payments"

    id = Column(Integer, primary_key=True, index=True)
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    paid_amount = Column(Float, nullable=False)
    debt_amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    order = relationship("SalesOrder", back_populates="payments")


class WarehouseSettings(Base):
    __tablename__ = "warehouse_settings"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=True)
    bin = Column(String, nullable=True)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    bank_details = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Dispatch(Base):
    __tablename__ = "dispatches"

    id = Column(Integer, primary_key=True, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer)
    price = Column(Float)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String, default="pending")
    accepted_at = Column(DateTime, nullable=True)
    
    manager = relationship("User")
    product = relationship("Product")

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"))
    shop_id = Column(Integer, ForeignKey("shops.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer)
    price = Column(Float)
    refrigerator_number = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    manager = relationship("User")
    shop = relationship("Shop")
    product = relationship("Product")

class Return(Base):
    __tablename__ = "returns"

    id = Column(Integer, primary_key=True, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    shop_id = Column(Integer, ForeignKey("shops.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    manager = relationship("User")
    shop = relationship("Shop")
    product = relationship("Product")


class Incoming(Base):
    __tablename__ = "incoming"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    created_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    items = relationship("IncomingItem", back_populates="incoming")
    created_by_admin = relationship("User")


class IncomingItem(Base):
    __tablename__ = "incoming_items"

    id = Column(Integer, primary_key=True, index=True)
    incoming_id = Column(Integer, ForeignKey("incoming.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price_at_time = Column(Float, nullable=False)

    incoming = relationship("Incoming", back_populates="items")
    product = relationship("Product")


class ShopOrder(Base):
    __tablename__ = "shop_orders"

    id = Column(Integer, primary_key=True, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    items = relationship("ShopOrderItem", back_populates="order")
    payment = relationship(
        "ShopOrderPayment",
        uselist=False,
        back_populates="order",
        cascade="all, delete-orphan",
    )
    manager = relationship("User")
    shop = relationship("Shop")


class ShopOrderItem(Base):
    __tablename__ = "shop_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("shop_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric, nullable=False)
    price = Column(Numeric, nullable=True)
    is_bonus = Column(Boolean, nullable=False, default=False)
    is_return = Column(Boolean, nullable=False, default=False)

    order = relationship("ShopOrder", back_populates="items")
    product = relationship("Product")


class ShopOrderPayment(Base):
    __tablename__ = "shop_order_payments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("shop_orders.id"), nullable=False, unique=True)
    total_amount = Column(Numeric, nullable=False)
    total_goods_amount = Column(Numeric, nullable=False)
    returns_amount = Column(Numeric, nullable=False, default=0)
    payable_amount = Column(Numeric, nullable=False)
    paid_amount = Column(Numeric, nullable=False)
    debt_amount = Column(Numeric, nullable=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    order = relationship("ShopOrder", back_populates="payment")


class ShopDebtPayment(Base):
    __tablename__ = "shop_debt_payments"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    shop = relationship("Shop")
    manager = relationship("User")


class ShopReturn(Base):
    __tablename__ = "shop_returns"

    id = Column(Integer, primary_key=True, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    shop_id = Column(Integer, ForeignKey("shops.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    items = relationship("ShopReturnItem", back_populates="return_doc")
    manager = relationship("User")
    shop = relationship("Shop")


class ShopReturnItem(Base):
    __tablename__ = "shop_return_items"

    id = Column(Integer, primary_key=True, index=True)
    return_id = Column(Integer, ForeignKey("shop_returns.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric, nullable=False)

    return_doc = relationship("ShopReturn", back_populates="items")
    product = relationship("Product")


class ManagerReturn(Base):
    __tablename__ = "manager_returns"

    id = Column(Integer, primary_key=True, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    items = relationship("ManagerReturnItem", back_populates="return_doc")
    manager = relationship("User")


class ManagerReturnItem(Base):
    __tablename__ = "manager_return_items"

    id = Column(Integer, primary_key=True, index=True)
    return_id = Column(Integer, ForeignKey("manager_returns.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric, nullable=False)

    return_doc = relationship("ManagerReturn", back_populates="items")
    product = relationship("Product")


class DriverDailyReport(Base):
    __tablename__ = "driver_daily_reports"

    id = Column(Integer, primary_key=True, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_date = Column(Date, default=date.today, nullable=False)
    cash_amount = Column(Float, default=0.0, nullable=False)
    card_amount = Column(Float, default=0.0, nullable=False)
    other_expenses = Column(Float, default=0.0, nullable=False)
    other_details = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    manager = relationship("User")
