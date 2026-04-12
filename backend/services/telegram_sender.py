import httpx
from config import get_settings

TELEGRAM_API = "https://api.telegram.org/bot{token}/{method}"


async def send_message(
    telegram_id: int,
    text: str,
    parse_mode: str = "Markdown",
) -> bool:
    """Send a direct Telegram message (used for cron push notifications)."""
    settings = get_settings()
    url = TELEGRAM_API.format(token=settings.telegram_bot_token, method="sendMessage")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            json={
                "chat_id": telegram_id,
                "text": text,
                "parse_mode": parse_mode,
            },
            timeout=10,
        )

    return response.status_code == 200


async def send_messages_bulk(
    recipients: list[dict],  # [{telegram_id, text, parse_mode?}]
) -> dict[int, bool]:
    """Send messages to multiple users. Returns {telegram_id: success}."""
    results: dict[int, bool] = {}
    for r in recipients:
        ok = await send_message(
            r["telegram_id"],
            r["text"],
            r.get("parse_mode", "Markdown"),
        )
        results[r["telegram_id"]] = ok
    return results
