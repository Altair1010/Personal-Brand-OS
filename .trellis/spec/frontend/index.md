# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains frontend guidelines for **Personal Brand OS** — a Next.js 15
(App Router) + React 19 + Tailwind/shadcn desktop app (Electron shell). Conventions below
are drawn from the actual codebase.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Filled |
| [Component Guidelines](./component-guidelines.md) | Server/client split, shadcn+cva, required states | Filled |
| [Hook Guidelines](./hook-guidelines.md) | TanStack Query, custom hooks, Zustand selectors | Filled |
| [State Management](./state-management.md) | Server (Query) vs UI (Zustand) split | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Required/forbidden patterns, review checklist | Filled |
| [Type Safety](./type-safety.md) | zod schema-first, enum-from-constants, no `any` | Filled |

---

## How to Fill These Guidelines

For each guideline file:

1. Document your project's **actual conventions** (not ideals)
2. Include **code examples** from your codebase
3. List **forbidden patterns** and why
4. Add **common mistakes** your team has made

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**Language**: All documentation should be written in **English**.
