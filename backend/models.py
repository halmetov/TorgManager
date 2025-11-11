from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("name", name="uq_products_name"),)

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    price = Column(Numeric(12, 2), nullable=False)
    quantity = Column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    incoming_items = relationship("IncomingItem", back_populates="product")
    dispatch_items = relationship("DispatchItem", back_populates="product")
    manager_stocks = relationship("ManagerStock", back_populates="product")


class Incoming(Base):
    __tablename__ = "incoming"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_by_admin = relationship("User")
    items = relationship(
        "IncomingItem",
        back_populates="incoming",
        cascade="all, delete-orphan",
    )


class IncomingItem(Base):
    __tablename__ = "incoming_items"

    id = Column(Integer, primary_key=True, index=True)
    incoming_id = Column(Integer, ForeignKey("incoming.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(12, 2), nullable=False)
    price_at_time = Column(Numeric(12, 2), nullable=False)

    incoming = relationship("Incoming", back_populates="items")
    product = relationship("Product", back_populates="incoming_items")


class Dispatch(Base):
    __tablename__ = "dispatches"

    id = Column(Integer, primary_key=True, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(16), nullable=False, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    sent_at = Column(DateTime)
    cancelled_at = Column(DateTime)

    manager = relationship("User")
    items = relationship(
        "DispatchItem",
        back_populates="dispatch",
        cascade="all, delete-orphan",
    )


class DispatchItem(Base):
    __tablename__ = "dispatch_items"

    id = Column(Integer, primary_key=True, index=True)
    dispatch_id = Column(Integer, ForeignKey("dispatches.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(12, 2), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)

    dispatch = relationship("Dispatch", back_populates="items")
    product = relationship("Product", back_populates="dispatch_items")


class ManagerStock(Base):
    __tablename__ = "manager_stock"
    __table_args__ = (
        UniqueConstraint("manager_id", "product_id", name="uq_manager_stock"),
    )

    id = Column(Integer, primary_key=True, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Numeric(12, 2), nullable=False, default=Decimal("0"))

    manager = relationship("User")
    product = relationship("Product", back_populates="manager_stocks")


class Shop(Base):
    __tablename__ = "shops"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    fridge_number = Column(String, nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    manager = relationship("User")
