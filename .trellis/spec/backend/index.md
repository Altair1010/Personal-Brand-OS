# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

"Backend" here = the **server side of Next.js** for **Personal Brand OS**: server actions,
route handlers, Prisma/SQLite data access, and server-only libs (single-user local app).
Conventions below are drawn from the actual codebase.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Server actions, route handlers, lib layout | Filled |
| [Database Guidelines](./database-guidelines.md) | Prisma singleton, upsert, invariants, seed | Filled |
| [Error Handling](./error-handling.md) | Typed action results, route status codes, AI repair | Filled |
| [Quality Guidelines](./quality-guidelines.md) | AI pipeline, forbidden patterns, review checklist | Filled |
| [Logging Guidelines](./logging-guidelines.md) | Prisma log levels, savePromptRun, secrets | Filled |

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
