SHELL := /usr/bin/bash
.SHELLFLAGS := -ec

BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RESET := \033[0m
CYAN := \033[0;36m
ORANGE := \033[0;31m
RED := \033[0;31m
SUCCESS := $(GREEN)✓
FAIL := $(RED)✗
INFO := $(CYAN)ℹ
WARN := $(YELLOW)⚠

TS_FILES := markdown.ts src/*.ts
PYTHON_FILES := md-to-pdf.py
TSC := tsc
PYTHON := python3
NODE := node

.PHONY: help check lint typecheck py-check build test clean pdf playground
.DEFAULT_GOAL := help

help: ## Show available targets
	@echo -e "$(CYAN)List of available targets$(RESET)"
	@echo ""
	@grep -hE '^[a-zA-Z_-]+:.*## .*$$' Makefile | \
		awk 'BEGIN {FS = ":.*## "}; {printf "  $(CYAN)%-18s$(RESET) %s\n", $$1, $$2}'
	@echo ""

typecheck: ## Type-check the TypeScript sources
	@$(TSC) --noEmit -p tsconfig.json

py-check: ## Syntax-check the Python tooling
	@$(PYTHON) -m py_compile $(PYTHON_FILES)

lint: typecheck py-check ## Run the available code-quality checks
	@echo -e "$(GREEN)✓$(RESET) Lint checks passed"

check: lint test ## Run all validation checks
	@echo -e "$(GREEN)✓$(RESET) Validation complete"

build: ## Compile the TypeScript engine to dist/
	@rm -rf dist
	@$(TSC) -p tsconfig.json --outDir dist --module commonjs --declaration false --target ES2020

test: build ## Build the engine and run the test suite
	@$(NODE) --test tests/*.test.js

playground: build ## Start the markdown playground server on PORT=3000
	@$(NODE) playground/server.js

pdf: ## Build a PDF from a Markdown document (usage: make pdf INPUT=README.md [ARGS='...'])
	@if [[ -z "$(INPUT)" ]]; then \
		echo -e "$(RED)✗$(RESET) Set INPUT=path/to/file.md"; \
		exit 1; \
	fi
	@$(PYTHON) md-to-pdf.py "$(INPUT)" $(ARGS)

clean: ## Remove common build and cache artifacts
	@rm -rf dist .pytest_cache .mypy_cache .ruff_cache .mermaid-cache __pycache__ src/__pycache__
