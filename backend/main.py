from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, listings

app = FastAPI(
    title="CropLink API",
    description="Farmer-Distributor Marketplace Backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(listings.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "CropLink API is running"}