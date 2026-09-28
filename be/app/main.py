from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from be.app.config import CORS_ORIGINS
from be.app.routers.todos import router as todos_router

app = FastAPI(title="Todo API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(todos_router, prefix="/api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
