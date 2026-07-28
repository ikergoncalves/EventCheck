from httpx import AsyncClient


async def test_unmatched_route_never_leaks_default_detail_body(client: AsyncClient) -> None:
    response = await client.get("/this-route-does-not-exist")

    assert response.status_code == 404
    body = response.json()
    assert "detail" not in body
    assert "error" in body
    assert body["error"]["code"]


async def test_method_not_allowed_never_leaks_default_detail_body(client: AsyncClient) -> None:
    response = await client.put("/health")

    assert response.status_code == 405
    body = response.json()
    assert "detail" not in body
    assert "error" in body
