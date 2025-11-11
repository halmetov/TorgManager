from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String)  # 'admin' or 'manager'
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    quantity = Column(Integer)
    price = Column(Float)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_return = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    manager = relationship("User", foreign_keys=[manager_id])

class Shop(Base):
    __tablename__ = "shops"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    address = Column(String)
    phone = Column(String)
    refrigerator_number = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class Dispatch(Base):
    __tablename__ = "dispatches"
    
    id = Column(Integer, primary_key=True, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer)
    price = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    
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
    created_at = Column(DateTime, default=datetime.utcnow)
    
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
    created_at = Column(DateTime, default=datetime.utcnow)
    
    manager = relationship("User")
    shop = relationship("Shop")
    product = relationship("Product")
