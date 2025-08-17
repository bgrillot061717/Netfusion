from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .auth import router as auth_router
from .users import router as users_router
from .maps_api import router as maps_router

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Backend OK"}

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(maps_router)
