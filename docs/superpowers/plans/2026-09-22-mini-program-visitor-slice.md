# 微信小程序访客切片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a native-looking, synthetic-data-only WeChat mini-program visitor home and public-content detail slice with safe navigation and local verification.

**Architecture:** Keep the existing TypeScript visitor projection as the only data/security boundary. Add a thin native mini-program shell that translates the projection into page data and WXML, with shared global tokens and phone-first CSS. No API, storage, provider, external asset, or dependency changes are introduced.

**Tech Stack:** Existing TypeScript 5.7 toolchain, Node test runner with native type stripping, ESLint 9, Prettier 3, WeChat mini-program JSON/WXML/WXSS/TypeScript source, and deterministic synthetic fixtures.

---

## File map

- Create `apps/mini-program/app.json`: native app page registry and window defaults.
- Create `apps/mini-program/app.ts`: app lifecycle shell with no I/O.
- Create `apps/mini-program/app.wxss`: global type, color, spacing, focus, and motion tokens.
- Create `apps/mini-program/pages/visitor/home/index.ts`: home page adapter and local synthetic response.
- Create `apps/mini-program/pages/visitor/home/index.wxml`: semantic home structure and state branches.
- Create `apps/mini-program/pages/visitor/home/index.wxss`: home layout and responsive phone styling.
- Create `apps/mini-program/pages/visitor/content/index.ts`: detail page adapter and back navigation.
- Create `apps/mini-program/pages/visitor/content/index.wxml`: detail structure and safe state branches.
- Create `apps/mini-program/pages/visitor/content/index.wxss`: detail layout and action styling.
- Modify `apps/mini-program/src/pages/visitor.test.ts`: add native adapter source and state contract assertions.
- Modify `apps/mini-program/tsconfig.json`: include the native adapter TypeScript files without adding dependencies.

## Task 1: Establish native entry contracts

**Files:** `apps/mini-program/app.json`, `apps/mini-program/app.ts`, `apps/mini-program/tsconfig.json`, `apps/mini-program/src/pages/visitor.test.ts`

- [ ] Add `app.json` with exactly the two visitor pages, `pages/visitor/home/index` and `pages/visitor/content/index`, default navigation bar colors, and no network/plugin configuration.
- [ ] Add an empty `app.ts` lifecycle shell that does not call `wx.request`, storage, analytics, or external modules.
- [ ] Extend `tsconfig.json` only with the two page adapter paths and `app.ts`; keep existing module resolution and compiler strictness.
- [ ] Add tests that read the three native configuration/source files and reject `wx.request`, storage APIs, URLs, provider imports, and unregistered routes.
- [ ] Run `node --test --experimental-strip-types apps/mini-program/src/pages/visitor.test.ts` and confirm the new assertions fail before adapters exist.

## Task 2: Implement the visitor home adapter

**Files:** `apps/mini-program/pages/visitor/home/index.ts`, `apps/mini-program/pages/visitor/home/index.wxml`, `apps/mini-program/pages/visitor/home/index.wxss`

- [ ] Import only the existing local route/data helpers and create a typed local page state with `LOADING`, `EMPTY`, `ERROR`, and `PUBLISHED` values.
- [ ] Use `createSyntheticVisitorResponse()` for the local preview and map only safe fields (`slug`, `title`, `summary`, and state) into `setData`.
- [ ] Handle card selection with `wx.navigateTo({ url: '/pages/visitor/content/index?contentKey=...' })` only after validating the local safe key; invalid keys remain on home.
- [ ] Render a brand header, CSS-only hero, three service direction blocks, public content cards, explicit synthetic-data label, and empty/error status branches.
- [ ] Keep all tap targets at least 44px, use button semantics, and expose `aria`-compatible descriptive labels through visible text and `aria-label` attributes where supported by WXML.
- [ ] Use CSS-only decorative elements, no remote images, no external fonts, no fixed width exceeding the viewport, and reduced-motion-safe transitions.

## Task 3: Implement the visitor content adapter

**Files:** `apps/mini-program/pages/visitor/content/index.ts`, `apps/mini-program/pages/visitor/content/index.wxml`, `apps/mini-program/pages/visitor/content/index.wxss`

- [ ] Read `options.contentKey`, validate it with the existing route helper, and render an error state for missing or unsafe keys.
- [ ] Resolve the item through `renderVisitorContent(createSyntheticVisitorResponse(), key)` and copy only safe presentation fields into page data.
- [ ] Render title, summary/body paragraphs, state announcement, synthetic-data label, and a 44px back button.
- [ ] Implement `handleBack()` with `wx.navigateBack()` when possible and `wx.reLaunch({ url: '/pages/visitor/home/index' })` as a deterministic fallback.
- [ ] Keep the page free of requests, storage, external URLs, and tenant/campus/internal fields.

## Task 4: Add shared mobile visual rules

**Files:** `apps/mini-program/app.wxss`, `apps/mini-program/pages/visitor/home/index.wxss`, `apps/mini-program/pages/visitor/content/index.wxss`

- [ ] Define the palette and spacing once in `app.wxss` and consume the variables in page styles.
- [ ] Use a single-column layout, `box-sizing: border-box`, bounded text widths, `overflow-x: hidden`, and `min-width: 0` for all content regions.
- [ ] Add visible `:focus`/`:focus-visible` treatment where supported and a `prefers-reduced-motion` equivalent class fallback for the page shell.
- [ ] Verify the 320px and 390px layouts have no fixed-width overflow and that every actionable element has a 44px minimum block/inline size.

## Task 5: Complete focused verification

**Files:** no new files.

- [ ] Run `node --test --experimental-strip-types apps/mini-program/src/pages/visitor.test.ts`.
- [ ] Run `node_modules/.bin/tsc.cmd -p apps/mini-program/tsconfig.json --noEmit`.
- [ ] Run `node_modules/.bin/eslint` on the changed TypeScript files.
- [ ] Run `node_modules/.bin/prettier --check` on all changed JSON, TS, WXML, and WXSS files.
- [ ] Run `git diff --check` and `git diff --cached --check`.
- [ ] Run a final scoped `git status --short` and confirm no file outside the design plan, mini-program slice, and pre-existing user-web changes was modified.

## Task 6: Stop boundary

- [ ] Report the exact changed/created files, test results, TypeScript result, lint result, format result, and remaining visual-runtime limitation.
- [ ] Do not run a WeChat cloud build, upload an experience version, deploy to Tencent Cloud, install dependencies, change the lockfile, develop partner-cloud integration, or touch Task 19 final artifacts.
