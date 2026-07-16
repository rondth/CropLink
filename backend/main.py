from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, listings, transaction, reviews, recommend, distributors, users, messaging, notifications


app = FastAPI(
    title="CropLink API",
    description="Farmer-Distributor Marketplace Backend",
    version="0.1.0",
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(listings.router, prefix="/api/v1")
app.include_router(transaction.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(messaging.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(recommend.router, prefix="/api/v1")
app.include_router(distributors.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "CropLink API is running"}