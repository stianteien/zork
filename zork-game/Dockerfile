# syntax=docker/dockerfile:1.6

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

ENV UV_LINK_MODE=copy
WORKDIR /app

COPY pyproject.toml uv.lock ./

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --python 3.14

COPY . .

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS runner

ENV UV_LINK_MODE=copy
WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app /app

ENV PATH="/app/.venv/bin:${PATH}"
ENV PORT=8000

EXPOSE 8000

CMD ["uv", "run", "--frozen", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
