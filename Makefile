.PHONY: dev-up dev-down venv migrate dev-api dev-web dev-worker lint test typecheck catalog-validate smoke-test demo-seed

PYTHON ?= python3.13
VENV_DIR ?= .venv
PYTHONPATH_API ?= apps/api
WEB_DIR ?= apps/web

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
	npm --prefix $(WEB_DIR) run dev

dev-worker:
	PYTHONPATH=$(PYTHONPATH_API) $(VENV_DIR)/bin/python -m inplain.worker.main

lint:
	$(VENV_DIR)/bin/ruff check --config apps/api/pyproject.toml apps/api
	npm --prefix $(WEB_DIR) run lint

test:
	PYTHONPATH=$(PYTHONPATH_API) $(VENV_DIR)/bin/pytest -q apps/api/tests

typecheck:
	npm --prefix $(WEB_DIR) run build

catalog-validate:
	PYTHONPATH=$(PYTHONPATH_API) $(VENV_DIR)/bin/python scripts/catalog/validate_catalog.py --catalog catalog.json --report docs/catalog-validation.md

smoke-test:
	PYTHONPATH=$(PYTHONPATH_API) $(VENV_DIR)/bin/python scripts/smoke/smoke_test.py

demo-seed:
	PYTHONPATH=$(PYTHONPATH_API) $(VENV_DIR)/bin/python scripts/demo/seed_demo_change_event.py
