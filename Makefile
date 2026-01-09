.PHONY: dev-up dev-down venv migrate dev-api dev-web lint test typecheck

PYTHON ?= python3.13
VENV_DIR ?= .venv
PYTHONPATH_API ?= apps/api

dev-up:
	docker compose up -d postgres redis

dev-down:
	docker compose down

venv:
	$(PYTHON) -m venv $(VENV_DIR)
	$(VENV_DIR)/bin/pip install --upgrade pip
	$(VENV_DIR)/bin/pip install -r apps/api/requirements-dev.txt

migrate:
	PYTHONPATH=$(PYTHONPATH_API) $(VENV_DIR)/bin/alembic -c apps/api/alembic.ini upgrade head

dev-api:
	PYTHONPATH=$(PYTHONPATH_API) $(VENV_DIR)/bin/uvicorn inplain.api.main:app --reload --port 8000

dev-web:
	npm --prefix apps/web run dev

lint:
	$(VENV_DIR)/bin/ruff check apps/api
	npm --prefix apps/web run lint

test:
	PYTHONPATH=$(PYTHONPATH_API) $(VENV_DIR)/bin/pytest -q apps/api/tests

typecheck:
	npm --prefix apps/web run build
