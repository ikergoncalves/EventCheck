from httpx import AsyncClient


async def test_health_reports_ok_with_database_up(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "up"
    assert isinstance(body["uptime_seconds"], int)
    assert "version" in body
