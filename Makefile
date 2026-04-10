SHELL := /usr/bin/bash
.SHELLFLAGS := -ec

BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RESET := \033[0m
CYAN := \033[0;36m
ORANGE := \033[0;31m
RED := \033[0;31m
SUCCESS := $(GREEN)✓$(RESET)
FAIL := $(RED)✗$(RESET)
INFO := $(CYAN)ℹ$(RESET)
WARN := $(YELLOW)⚠$(RESET)

IMAGE_NAME ?= markengine:local
CONTAINER_NAME ?= markengine-dev

.PHONY: help deps build start up stop down rm clean logs lint typecheck check
.DEFAULT_GOAL := help

help: ## Show available targets
	@echo -e "$(CYAN)List of available targets$(RESET)"
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*## .*$$' Makefile | \
		awk 'BEGIN {FS = ":.*## "}; {printf "  $(CYAN)%-18s$(RESET) %s\n", $$1, $$2}'
	@echo ""

deps: ## Install dependencies with pnpm
	@echo -e "$(INFO) Installing dependencies with pnpm..."
	@corepack enable && pnpm install
	@echo -e "$(SUCCESS) Dependencies installed"

build: ## Build Docker image
	@echo -e "$(INFO) Building image $(IMAGE_NAME)..."
	@docker build -t $(IMAGE_NAME) .
	@echo -e "$(SUCCESS) Image built: $(IMAGE_NAME)"

start: ## Start container in detached mode
	@echo -e "$(INFO) Starting container $(CONTAINER_NAME)..."
	@if docker ps -a --format '{{.Names}}' | grep -q '^$(CONTAINER_NAME)$$'; then \
		echo -e "$(WARN) Existing container found, removing first..."; \
		docker rm -f $(CONTAINER_NAME) >/dev/null; \
	fi
	@docker run -d --name $(CONTAINER_NAME) $(IMAGE_NAME) sleep infinity >/dev/null
	@echo -e "$(SUCCESS) Container started: $(CONTAINER_NAME)"

up: start ## Alias for start

stop: ## Stop running container
	@echo -e "$(INFO) Stopping container $(CONTAINER_NAME)..."
	@if docker ps --format '{{.Names}}' | grep -q '^$(CONTAINER_NAME)$$'; then \
		docker stop $(CONTAINER_NAME) >/dev/null; \
		echo -e "$(SUCCESS) Container stopped: $(CONTAINER_NAME)"; \
	else \
		echo -e "$(WARN) Container is not running: $(CONTAINER_NAME)"; \
	fi

down: stop ## Alias for stop

rm: ## Remove container (force)
	@echo -e "$(INFO) Removing container $(CONTAINER_NAME)..."
	@if docker ps -a --format '{{.Names}}' | grep -q '^$(CONTAINER_NAME)$$'; then \
		docker rm -f $(CONTAINER_NAME) >/dev/null; \
		echo -e "$(SUCCESS) Container removed: $(CONTAINER_NAME)"; \
	else \
		echo -e "$(WARN) Container does not exist: $(CONTAINER_NAME)"; \
	fi

clean: ## Remove container and local build artifacts
	@$(MAKE) -s rm
	@echo -e "$(INFO) Cleaning local artifacts..."
	@corepack enable && pnpm run clean || true
	@echo -e "$(SUCCESS) Local artifacts cleaned"

logs: ## Show container logs
	@docker logs -f $(CONTAINER_NAME)

lint: ## Run TypeScript linter
	@echo -e "$(INFO) Running lint..."
	@corepack enable && pnpm run lint
	@echo -e "$(SUCCESS) Lint passed"

typecheck: ## Run TypeScript typecheck
	@echo -e "$(INFO) Running typecheck..."
	@corepack enable && pnpm run typecheck
	@echo -e "$(SUCCESS) Typecheck passed"

check: ## Run lint and typecheck
	@echo -e "$(INFO) Running checks..."
	@$(MAKE) -s lint
	@$(MAKE) -s typecheck
	@echo -e "$(SUCCESS) Checks passed"