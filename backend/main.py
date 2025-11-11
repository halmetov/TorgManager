import os
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from sqlalchemy.orm import Session, selectinload

import models
import schemas
from database import engine, get_db

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Confectionery Management System")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user


def admin_required(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def manager_required(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != "manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager access required")
    return current_user


def to_decimal(value: float | Decimal) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


# Initialize admin user
@app.on_event("startup")
def startup_event() -> None:
    db = next(get_db())
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin:
        admin = models.User(
            username="admin",
            password=get_password_hash("admin"),
            role="admin",
            full_name="Administrator",
            is_active=True,
        )
        db.add(admin)
        db.commit()


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
            detail="Account is not active",
        )

    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "full_name": user.full_name,
    }


@app.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "role": current_user.role,
        "full_name": current_user.full_name,
    }


@app.get("/products", response_model=List[schemas.ProductOut])
def get_products(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Product)
    if not include_archived:
        query = query.filter(models.Product.is_archived.is_(False))
    return query.order_by(models.Product.name.asc()).all()


@app.post("/products", response_model=schemas.ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    product: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    existing = db.query(models.Product).filter(models.Product.name == product.name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product with this name already exists")

    db_product = models.Product(
        name=product.name,
        price=to_decimal(product.price),
        quantity=to_decimal(product.quantity),
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@app.put("/products/{product_id}", response_model=schemas.ProductOut)
def update_product(
    product_id: int,
    product_update: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if product_update.name and product_update.name != db_product.name:
        exists = db.query(models.Product).filter(models.Product.name == product_update.name).first()
        if exists:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Product with this name already exists")
        db_product.name = product_update.name

    if product_update.price is not None:
        db_product.price = to_decimal(product_update.price)
    if product_update.quantity is not None:
        db_product.quantity = to_decimal(product_update.quantity)
    if product_update.is_archived is not None:
        db_product.is_archived = product_update.is_archived

    db.commit()
    db.refresh(db_product)
    return db_product


@app.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    db_product.is_archived = True
    db.commit()


@app.get("/products/search", response_model=List[schemas.SearchProductOut])
def search_products(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = (
        db.query(models.Product)
        .filter(models.Product.is_archived.is_(False))
        .filter(models.Product.name.ilike(f"%{q}%"))
        .order_by(models.Product.name.asc())
        .limit(limit)
    )
    return query.all()


@app.post("/incoming", response_model=schemas.IncomingOut, status_code=status.HTTP_201_CREATED)
def create_incoming(
    incoming: schemas.IncomingCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    if not incoming.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No incoming items provided")

    db_incoming = models.Incoming(created_by_admin_id=current_user.id)
    db.add(db_incoming)

    try:
        db.flush()
        for item in incoming.items:
            product = (
                db.query(models.Product)
                .filter(models.Product.id == item.product_id, models.Product.is_archived.is_(False))
                .first()
            )
            if not product:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not found")

            product.quantity = to_decimal(product.quantity) + to_decimal(item.quantity)

            incoming_item = models.IncomingItem(
                incoming_id=db_incoming.id,
                product_id=item.product_id,
                quantity=to_decimal(item.quantity),
                price_at_time=to_decimal(item.price_at_time),
            )
            db.add(incoming_item)

        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(db_incoming)
    db_incoming = (
        db.query(models.Incoming)
        .options(selectinload(models.Incoming.items))
        .filter(models.Incoming.id == db_incoming.id)
        .first()
    )
    return db_incoming


@app.post("/dispatch", response_model=schemas.DispatchOut, status_code=status.HTTP_201_CREATED)
def create_dispatch(
    dispatch: schemas.DispatchCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    if not dispatch.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No dispatch items provided")

    manager = db.query(models.User).filter(models.User.id == dispatch.manager_id, models.User.role == "manager").first()
    if not manager:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager not found")

    db_dispatch = models.Dispatch(manager_id=dispatch.manager_id, status=schemas.DispatchStatus.pending.value)
    db.add(db_dispatch)

    try:
        db.flush()
        for item in dispatch.items:
            product = (
                db.query(models.Product)
                .filter(models.Product.id == item.product_id, models.Product.is_archived.is_(False))
                .first()
            )
            if not product:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not found")

            dispatch_item = models.DispatchItem(
                dispatch_id=db_dispatch.id,
                product_id=item.product_id,
                quantity=to_decimal(item.quantity),
                price=to_decimal(item.price),
            )
            db.add(dispatch_item)

        db.commit()
    except Exception:
        db.rollback()
        raise

    dispatch_with_items = (
        db.query(models.Dispatch)
        .options(selectinload(models.Dispatch.items).selectinload(models.DispatchItem.product))
        .filter(models.Dispatch.id == db_dispatch.id)
        .first()
    )
    return map_dispatch_to_schema(dispatch_with_items)


@app.get("/dispatch", response_model=List[schemas.DispatchOut])
def list_dispatches(
    status_filter: Optional[schemas.DispatchStatus] = Query(default=None, alias="status"),
    manager_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Dispatch).options(
        selectinload(models.Dispatch.items).selectinload(models.DispatchItem.product)
    )

    if current_user.role == "manager":
        query = query.filter(models.Dispatch.manager_id == current_user.id)
    elif manager_id:
        query = query.filter(models.Dispatch.manager_id == manager_id)

    if status_filter:
        query = query.filter(models.Dispatch.status == status_filter.value)

    dispatches = query.order_by(models.Dispatch.created_at.desc()).all()
    return [map_dispatch_to_schema(d) for d in dispatches]


@app.post("/dispatch/{dispatch_id}/accept", response_model=schemas.DispatchOut)
def accept_dispatch(
    dispatch_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(manager_required),
):
    dispatch = (
        db.query(models.Dispatch)
        .options(selectinload(models.Dispatch.items).selectinload(models.DispatchItem.product))
        .filter(models.Dispatch.id == dispatch_id)
        .first()
    )

    if not dispatch or dispatch.manager_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispatch not found")

    if dispatch.status != schemas.DispatchStatus.pending.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dispatch already processed")

    try:
        for item in dispatch.items:
            product = db.query(models.Product).filter(models.Product.id == item.product_id).with_for_update().first()
            if not product or product.is_archived:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not available")

            available = to_decimal(product.quantity)
            required = to_decimal(item.quantity)
            if available < required:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "product_id": item.product_id,
                        "available": float(available),
                        "required": float(required),
                    },
                )

            product.quantity = available - required

            stock = (
                db.query(models.ManagerStock)
                .filter(
                    models.ManagerStock.manager_id == current_user.id,
                    models.ManagerStock.product_id == item.product_id,
                )
                .first()
            )
            if stock:
                stock.quantity = to_decimal(stock.quantity) + required
            else:
                stock = models.ManagerStock(
                    manager_id=current_user.id,
                    product_id=item.product_id,
                    quantity=required,
                )
                db.add(stock)

        dispatch.status = schemas.DispatchStatus.sent.value
        dispatch.sent_at = datetime.utcnow()
        db.commit()
    except HTTPException as exc:
        db.rollback()
        raise exc
    except Exception:
        db.rollback()
        raise

    db.refresh(dispatch)
    dispatch = (
        db.query(models.Dispatch)
        .options(selectinload(models.Dispatch.items).selectinload(models.DispatchItem.product))
        .filter(models.Dispatch.id == dispatch_id)
        .first()
    )
    return map_dispatch_to_schema(dispatch)


@app.get("/manager/stock", response_model=List[schemas.ManagerStockOut])
def get_manager_stock(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(manager_required),
):
    stocks = (
        db.query(models.ManagerStock)
        .options(selectinload(models.ManagerStock.product))
        .filter(models.ManagerStock.manager_id == current_user.id)
        .order_by(models.ManagerStock.id.asc())
        .all()
    )
    result: List[schemas.ManagerStockOut] = []
    for stock in stocks:
        result.append(
            schemas.ManagerStockOut(
                product_id=stock.product_id,
                product_name=stock.product.name if stock.product else "",
                quantity=float(stock.quantity),
                price=float(stock.product.price) if stock.product else 0.0,
            )
        )
    return result


@app.post("/shops", response_model=schemas.ShopOut, status_code=status.HTTP_201_CREATED)
def create_shop(
    shop: schemas.ShopCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(manager_required),
):
    db_shop = models.Shop(
        name=shop.name,
        address=shop.address,
        phone=shop.phone,
        fridge_number=shop.fridge_number,
        manager_id=current_user.id,
    )
    db.add(db_shop)
    db.commit()
    db.refresh(db_shop)
    return db_shop


@app.get("/shops", response_model=List[schemas.ShopAdminOut])
def list_shops(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    shops = (
        db.query(models.Shop)
        .options(selectinload(models.Shop.manager))
        .order_by(models.Shop.created_at.desc())
        .all()
    )
    result: List[schemas.ShopAdminOut] = []
    for shop in shops:
        result.append(
            schemas.ShopAdminOut(
                id=shop.id,
                name=shop.name,
                address=shop.address,
                phone=shop.phone,
                fridge_number=shop.fridge_number,
                created_at=shop.created_at,
                manager_id=shop.manager_id,
                manager_full_name=shop.manager.full_name if shop.manager else None,
                manager_username=shop.manager.username if shop.manager else None,
            )
        )
    return result


@app.get("/shops/me", response_model=List[schemas.ShopOut])
def list_my_shops(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(manager_required),
):
    return (
        db.query(models.Shop)
        .filter(models.Shop.manager_id == current_user.id)
        .order_by(models.Shop.created_at.desc())
        .all()
    )


@app.get("/managers", response_model=List[schemas.Manager])
def get_managers(db: Session = Depends(get_db), current_user: models.User = Depends(admin_required)):
    return db.query(models.User).filter(models.User.role == "manager").all()


@app.post("/managers", response_model=schemas.Manager)
def create_manager(
    manager: schemas.ManagerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    existing_user = db.query(models.User).filter(models.User.username == manager.username).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")

    db_manager = models.User(
        username=manager.username,
        password=get_password_hash(manager.password),
        role="manager",
        full_name=manager.full_name,
        is_active=manager.is_active,
    )
    db.add(db_manager)
    db.commit()
    db.refresh(db_manager)
    return db_manager


@app.put("/managers/{manager_id}")
def update_manager(
    manager_id: int,
    manager: schemas.ManagerUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(admin_required),
):
    db_manager = db.query(models.User).filter(models.User.id == manager_id, models.User.role == "manager").first()
    if not db_manager:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager not found")

    if manager.full_name:
        db_manager.full_name = manager.full_name
    if manager.is_active is not None:
        db_manager.is_active = manager.is_active
    if manager.password:
        db_manager.password = get_password_hash(manager.password)

    db.commit()
    return {"message": "Manager updated"}


def map_dispatch_to_schema(dispatch: models.Dispatch) -> schemas.DispatchOut:
    if dispatch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dispatch not found")

    items = []
    for item in dispatch.items:
        items.append(
            schemas.DispatchItemOut(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product.name if item.product else "",
                quantity=float(item.quantity),
                price=float(item.price),
            )
        )
    return schemas.DispatchOut(
        id=dispatch.id,
        manager_id=dispatch.manager_id,
        status=schemas.DispatchStatus(dispatch.status),
        created_at=dispatch.created_at,
        sent_at=dispatch.sent_at,
        cancelled_at=dispatch.cancelled_at,
        items=items,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
