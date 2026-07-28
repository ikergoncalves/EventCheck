from pydantic import BaseModel


class Page[T](BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    items: list[T]
