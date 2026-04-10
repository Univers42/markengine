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

NPM := npm

IMAGE_NAME ?= markengine:local
CONTAINER_NAME ?= markengine-dev

.PHONY: help deps doctor build build-engine test dev playground start up stop down rm clean logs lint typecheck check reinstall
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

doctor: ## Verify required tooling and key files
	@echo -e "$(INFO) Running environment checks...$(RESET)"
	@(command -v $(NPM) >/dev/null && echo -e "$(SUCCESS) $(NPM) found$(RESET)") || { echo -e "$(RED) $(NPM) not found$(RESET)"; exit 1; }
	@(command -v $(DOCKER) >/dev/null && echo -e "$(SUCCESS) Docker found$(RESET)") || echo -e "$(RED) Docker not found (docker targets unavailable)$(RESET)"
	@test -f package.json || { echo -e "$(RED)package.json not found$(RESET)"; exit 1; }
	@test -f tsconfig.json || { echo -e "$(RED)tsconfig.json not found$(RESET)"; exit 1; }
	@echo -e "$(SUCCESS) Environment checks passed$(RESET)"

build: ## Build Docker image
	@echo -e "$(INFO) Building image $(IMAGE_NAME)..."
	@docker build -t $(IMAGE_NAME) .
	@echo -e "$(SUCCESS) Image built: $(IMAGE_NAME)"

build-engine: ## Compile only the markdown engine to dist/
	@echo -e "$(INFO) Building TypeScript engine...$(RESET)"
	@$(NPM) run build:engine
	@echo -e "$(SUCCESS) Engine build complete$(RESET)"

test: ## Build the engine and run the test suite
	@echo -e "$(INFO) Running tests...$(RESET)"
	@$(MAKE) -s build-engine
	@$(NODE) --test tests/*.test.js
	@echo -e "$(SUCCESS) All tests passed$(RESET)"

dev: ## Start playground in dev mode (Vite + TS watch)
	@echo -e "$(INFO) Starting playground in dev mode...$(RESET)"
	@$(NPM) run dev

playground: dev ## Alias for dev playground

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

reinstall: ## Reinstall dependencies from scratch
	@echo -e "$(INFO) Reinstalling dependencies from scratch...$(RESET)"
	@rm -rf node_modules
	@$(NPM) install
	@echo -e "$(SUCCESS) Reinstall complete$(RESET)"