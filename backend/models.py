from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone

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
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    manager_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    manager = relationship("User", foreign_keys=[manager_id])

class Dispatch(Base):
    __tablename__ = "dispatches"
    
    id = Column(Integer, primary_key=True, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer)
    price = Column(Float)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
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
