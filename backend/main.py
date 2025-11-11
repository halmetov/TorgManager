from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
import os
import secrets
import models
import schemas
from database import engine, get_db
from passlib.context import CryptContext
import jwt

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Confectionery Management System")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://192.168.8.98:8080"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# Initialize admin user
@app.on_event("startup")
def startup_event():
    db = next(get_db())
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        admin = models.User(
            username="admin",
            password=get_password_hash("admin"),
            role="admin",
            full_name="Administrator",
            is_active=True
        )
        db.add(admin)
        db.commit()

# Auth endpoints
@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active"
        )
    
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.full_name
    }

@app.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "role": current_user.role,
        "full_name": current_user.full_name
    }

# Products endpoints
@app.get("/products", response_model=List[schemas.Product])
def get_products(
    is_return: Optional[bool] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Product)
    if current_user.role == "manager":
        query = query.filter(models.Product.manager_id == current_user.id)
    if is_return is not None:
        query = query.filter(models.Product.is_return == is_return)
    return query.all()

@app.post("/products", response_model=schemas.Product)
def create_product(
    product: schemas.ProductCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db_product = models.Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@app.put("/products/{product_id}")
def update_product(
    product_id: int,
    product: schemas.ProductCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    for key, value in product.dict().items():
        setattr(db_product, key, value)
    
    db.commit()
    return {"message": "Product updated"}

@app.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check authorization
    if current_user.role == "admin" and db_product.manager_id is None:
        # Admin can delete admin products
        pass
    elif current_user.role == "manager" and db_product.manager_id == current_user.id:
        # Manager can delete their own products
        pass
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if product is referenced in dispatches, orders, or returns
    has_dispatches = db.query(models.Dispatch).filter(models.Dispatch.product_id == product_id).first()
    has_orders = db.query(models.Order).filter(models.Order.product_id == product_id).first()
    has_returns = db.query(models.Return).filter(models.Return.product_id == product_id).first()
    
    if has_dispatches or has_orders or has_returns:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete product with existing transactions. Please archive it instead."
        )
    
    db.delete(db_product)
    db.commit()
    return {"message": "Product deleted"}

# Shops endpoints
@app.get("/shops", response_model=List[schemas.Shop])
def get_shops(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Shop).all()

@app.post("/shops", response_model=schemas.Shop)
def create_shop(
    shop: schemas.ShopCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_shop = models.Shop(**shop.dict())
    db.add(db_shop)
    db.commit()
    db.refresh(db_shop)
    return db_shop

# Managers endpoints
@app.get("/managers", response_model=List[schemas.Manager])
def get_managers(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return db.query(models.User).filter(models.User.role == "manager").all()

@app.post("/managers", response_model=schemas.Manager)
def create_manager(
    manager: schemas.ManagerCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing_user = db.query(models.User).filter(models.User.username == manager.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    db_manager = models.User(
        username=manager.username,
        password=get_password_hash(manager.password),
        role="manager",
        full_name=manager.full_name,
        is_active=manager.is_active
    )
    db.add(db_manager)
    db.commit()
    db.refresh(db_manager)
    return db_manager

@app.put("/managers/{manager_id}")
def update_manager(
    manager_id: int,
    manager: schemas.ManagerUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    db_manager = db.query(models.User).filter(models.User.id == manager_id, models.User.role == "manager").first()
    if not db_manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    
    if manager.full_name:
        db_manager.full_name = manager.full_name
    if manager.is_active is not None:
        db_manager.is_active = manager.is_active
    if manager.password:
        db_manager.password = get_password_hash(manager.password)
    
    db.commit()
    return {"message": "Manager updated"}

# Dispatch endpoints
@app.post("/dispatch")
def create_dispatch(
    dispatch: schemas.DispatchCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check manager exists
    manager = db.query(models.User).filter(models.User.id == dispatch.manager_id).first()
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    
    # Create dispatch records and update inventory
    for item in dispatch.items:
        # Check product availability (only admin products where manager_id is NULL)
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.manager_id.is_(None),
            models.Product.is_return == False
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found in admin inventory")
        
        if product.quantity < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient quantity for product {product.name}")
        
        # Deduct from admin inventory
        product.quantity -= item.quantity
        
        # Find or create manager product
        manager_product = db.query(models.Product).filter(
            models.Product.name == product.name,
            models.Product.price == product.price,
            models.Product.manager_id == dispatch.manager_id,
            models.Product.is_return == False
        ).first()
        
        if manager_product:
            # Update existing manager product
            manager_product.quantity += item.quantity
        else:
            # Create new product for manager
            manager_product = models.Product(
                name=product.name,
                quantity=item.quantity,
                price=product.price,
                manager_id=dispatch.manager_id,
                is_return=False
            )
            db.add(manager_product)
        
        # Create dispatch record
        db_dispatch = models.Dispatch(
            manager_id=dispatch.manager_id,
            product_id=item.product_id,
            quantity=item.quantity,
            price=product.price
        )
        db.add(db_dispatch)
    
    db.commit()
    return {"message": "Dispatch created successfully"}

# Orders endpoints
@app.post("/orders")
def create_order(
    order: schemas.OrderCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check shop exists
    shop = db.query(models.Shop).filter(models.Shop.id == order.shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    for item in order.items:
        # Check product availability
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.manager_id == current_user.id
        ).first()
        
        if not product or product.quantity < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient quantity for product {item.product_id}")
        
        # Deduct from manager inventory
        product.quantity -= item.quantity
        
        # Create order record
        db_order = models.Order(
            manager_id=current_user.id,
            shop_id=order.shop_id,
            product_id=item.product_id,
            quantity=item.quantity,
            price=item.price,
            refrigerator_number=order.refrigerator_number
        )
        db.add(db_order)
    
    db.commit()
    return {"message": "Order created successfully"}

# Returns endpoints
@app.post("/returns")
def create_return(
    return_data: schemas.ReturnCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can create returns")
    
    for item in return_data.items:
        # Get product info
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.manager_id == current_user.id
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found in your inventory")
        
        if product.quantity < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient quantity for product {product.name}")
        
        # Deduct from manager's regular inventory
        product.quantity -= item.quantity
        
        # Find or create return product in manager's inventory
        return_product = db.query(models.Product).filter(
            models.Product.name == product.name,
            models.Product.manager_id == current_user.id,
            models.Product.is_return == True
        ).first()
        
        if return_product:
            return_product.quantity += item.quantity
        else:
            return_product = models.Product(
                name=product.name,
                quantity=item.quantity,
                price=product.price,
                manager_id=current_user.id,
                is_return=True
            )
            db.add(return_product)
        
        # Create return record for admin reports
        db_return = models.Return(
            manager_id=current_user.id,
            shop_id=return_data.shop_id,
            product_id=item.product_id,
            quantity=item.quantity
        )
        db.add(db_return)
    
    db.commit()
    return {"message": "Return created successfully"}

# Reports endpoints
@app.get("/reports/products")
def get_product_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    total_products = db.query(models.Product).filter(
        models.Product.manager_id.is_(None),
        models.Product.is_return == False
    ).count()
    
    total_returns = db.query(models.Return).count()
    
    dispatch_query = db.query(models.Dispatch)
    if start_date:
        dispatch_query = dispatch_query.filter(models.Dispatch.created_at >= start_date)
    if end_date:
        dispatch_query = dispatch_query.filter(models.Dispatch.created_at <= end_date)
    
    dispatches = dispatch_query.all()
    total_dispatched = sum(d.quantity for d in dispatches)
    
    return {
        "total_products": total_products,
        "total_returns": total_returns,
        "total_dispatched": total_dispatched
    }

@app.get("/reports/manager/{manager_id}")
def get_manager_report(
    manager_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    dispatch_query = db.query(models.Dispatch).filter(models.Dispatch.manager_id == manager_id)
    order_query = db.query(models.Order).filter(models.Order.manager_id == manager_id)
    return_query = db.query(models.Return).filter(models.Return.manager_id == manager_id)
    
    if start_date:
        dispatch_query = dispatch_query.filter(models.Dispatch.created_at >= start_date)
        order_query = order_query.filter(models.Order.created_at >= start_date)
        return_query = return_query.filter(models.Return.created_at >= start_date)
    if end_date:
        dispatch_query = dispatch_query.filter(models.Dispatch.created_at <= end_date)
        order_query = order_query.filter(models.Order.created_at <= end_date)
        return_query = return_query.filter(models.Return.created_at <= end_date)
    
    dispatches = dispatch_query.all()
    orders = order_query.all()
    returns = return_query.all()
    
    # Get product names for dispatches
    dispatches_with_names = []
    for d in dispatches:
        product = db.query(models.Product).filter(models.Product.id == d.product_id).first()
        dispatches_with_names.append({
            "id": d.id,
            "quantity": d.quantity,
            "price": d.price,
            "created_at": d.created_at,
            "product_name": product.name if product else "Unknown"
        })
    
    return {
        "manager_id": manager_id,
        "total_received": sum(d.quantity for d in dispatches),
        "total_delivered": sum(o.quantity for o in orders),
        "total_returns": sum(r.quantity for r in returns),
        "dispatches": dispatches_with_names,
        "orders": orders,
        "returns": returns
    }

@app.get("/reports/manager-summary")
def get_manager_summary_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "admin":
        managers = db.query(models.User).filter(models.User.role == "manager").all()
    else:
        managers = [current_user]
    
    summary = []
    for manager in managers:
        dispatch_query = db.query(models.Dispatch).filter(models.Dispatch.manager_id == manager.id)
        order_query = db.query(models.Order).filter(models.Order.manager_id == manager.id)
        return_query = db.query(models.Return).filter(models.Return.manager_id == manager.id)
        
        if start_date:
            dispatch_query = dispatch_query.filter(models.Dispatch.created_at >= start_date)
            order_query = order_query.filter(models.Order.created_at >= start_date)
            return_query = return_query.filter(models.Return.created_at >= start_date)
        if end_date:
            dispatch_query = dispatch_query.filter(models.Dispatch.created_at <= end_date)
            order_query = order_query.filter(models.Order.created_at <= end_date)
            return_query = return_query.filter(models.Return.created_at <= end_date)
        
        dispatches = dispatch_query.all()
        orders = order_query.all()
        returns = return_query.all()
        
        summary.append({
            "manager_id": manager.id,
            "manager_name": manager.full_name,
            "total_received": sum(d.quantity for d in dispatches),
            "total_delivered": sum(o.quantity for o in orders),
            "total_returns": sum(r.quantity for r in returns)
        })
    
    return summary

@app.get("/reports/returns")
def get_returns_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    manager_id: Optional[int] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = db.query(models.Return)
    
    if start_date:
        query = query.filter(models.Return.created_at >= start_date)
    if end_date:
        query = query.filter(models.Return.created_at <= end_date)
    if manager_id:
        query = query.filter(models.Return.manager_id == manager_id)
    
    returns = query.order_by(models.Return.created_at.desc()).all()
    result = []
    
    for return_item in returns:
        manager = db.query(models.User).filter(models.User.id == return_item.manager_id).first()
        shop = db.query(models.Shop).filter(models.Shop.id == return_item.shop_id).first()
        product = db.query(models.Product).filter(models.Product.id == return_item.product_id).first()
        
        result.append({
            "id": return_item.id,
            "created_at": return_item.created_at.isoformat(),
            "manager_name": manager.full_name if manager else "Unknown",
            "manager_username": manager.username if manager else "Unknown",
            "shop_name": shop.name if shop else "Unknown",
            "product_name": product.name if product else "Unknown",
            "quantity": return_item.quantity
        })
    
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
