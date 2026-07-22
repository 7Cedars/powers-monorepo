# Powers Protocol — Code Size

An at-a-glance indication of the size of the Powers protocol's Solidity source (`src/`), subdivided by **core protocol**, **core mandates**, and **addons**. Helper contracts are folded into the mandate group they support.

_Generated: 2026-07-20. "Code lines" excludes blank lines and comment-only lines (see [Methodology](#methodology))._

## Summary

| Group | Contracts | Total lines | Code lines | Avg code lines / contract |
|---|--:|--:|--:|--:|
| Core protocol | 12 | 2,840 | 1,302 | 109 |
| Core mandates | 31 | 3,698 | 2,362 | 76 |
| Addons | 28 | 3,792 | 2,291 | 82 |
| **Total** | **71** | **10,330** | **5,955** | **84** |

## Detailed breakdown

### Core protocol
The central hub, mandate base classes, shared interfaces, and libraries.

| Component | Contracts | Total lines | Code lines |
|---|--:|--:|--:|
| `Powers.sol` | 1 | 922 | 531 |
| Mandate bases (`Mandate.sol`, `AsyncMandate.sol`) | 2 | 368 | 192 |
| `interfaces/` | 6 | 1,199 | 362 |
| `libraries/` | 3 | 351 | 217 |
| **Subtotal** | **12** | **2,840** | **1,302** |

### Core mandates
Tier 0–3 mandates (`src/core/mandates/`) plus the core helper contracts (`src/core/helpers/`) required for them to function.

| Category | Contracts | Total lines | Code lines |
|---|--:|--:|--:|
| electoral | 5 | 517 | 334 |
| executive | 8 | 488 | 334 |
| integrations | 8 | 916 | 597 |
| reform | 3 | 386 | 245 |
| helpers | 7 | 1,391 | 852 |
| **Subtotal** | **31** | **3,698** | **2,362** |

Helpers: `ElectionRegistry`, `SlateRegistry`, `Nominees`, `MandateRegistry`, `PowersFactory`, `PowersDeployer`, `PowersPaymaster`.

### Addons
Tier 4 niche/advanced mandates (`src/addons/mandates/`) plus the addon helper contracts (`src/addons/helpers/`) required for them to function.

| Category | Contracts | Total lines | Code lines |
|---|--:|--:|--:|
| electoral | 4 | 497 | 323 |
| executive | 3 | 201 | 142 |
| integrations | 19 | 2,628 | 1,531 |
| helpers | 2 | 466 | 295 |
| **Subtotal** | **28** | **3,792** | **2,291** |

Helpers: `Governed721`, `ZKPassport_PowersRegistry`.

## Methodology

- **Scope:** all `*.sol` files under `solidity/src/`. Test code (`test/`), scripts (`script/`), and third-party dependencies (`lib/`) are excluded.
- **Contracts:** counted as source files (one primary contract per file).
- **Total lines:** every line in the file, including blanks and comments.
- **Code lines:** total lines minus blank lines and comment-only lines (`//`, `/* … */`, and `*` continuation lines). This is a rough SLOC approximation, not a compiler-accurate statement count.
- Counts were produced with `find` + `awk`; re-run against `src/` to refresh after code changes.
