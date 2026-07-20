# Powers Protocol — Code Size

An at-a-glance indication of the size of the Powers protocol's Solidity source (`src/`), subdivided by **core protocol**, **core mandates**, and **addons**. Helper contracts are folded into the mandate group they support.

_Generated: 2026-07-09. "Code lines" excludes blank lines and comment-only lines (see [Methodology](#methodology))._

## Summary

| Group | Contracts | Total lines | Code lines | Avg code lines / contract |
|---|--:|--:|--:|--:|
| Core protocol | 12 | 2,776 | 1,258 | 105 |
| Core mandates | 39 | 4,235 | 2,839 | 73 |
| Addons | 22 | 3,178 | 1,865 | 85 |
| **Total** | **73** | **10,189** | **5,962** | **82** |

## Detailed breakdown

### Core protocol
The central hub, mandate base classes, shared interfaces, and libraries.

| Component | Contracts | Total lines | Code lines |
|---|--:|--:|--:|
| `Powers.sol` | 1 | 922 | 525 |
| Mandate bases (`Mandate.sol`, `AsyncMandate.sol`) | 2 | 316 | 156 |
| `interfaces/` | 6 | 1,187 | 360 |
| `libraries/` | 3 | 351 | 217 |
| **Subtotal** | **12** | **2,776** | **1,258** |

### Core mandates
Tier 0–3 mandates (`src/core/mandates/`) plus the core helper contracts (`src/core/helpers/`) required for them to function.

| Category | Contracts | Total lines | Code lines |
|---|--:|--:|--:|
| electoral | 5 | 525 | 343 |
| executive | 8 | 488 | 334 |
| integrations | 14 | 1,504 | 1,009 |
| reform | 5 | 550 | 381 |
| helpers | 7 | 1,168 | 772 |
| **Subtotal** | **39** | **4,235** | **2,839** |

Helpers: `ElectionRegistry`, `SlateRegistry`, `Nominees`, `MandateRegistry`, `PowersFactory`, `PowersDeployer`, `PowersPaymaster`.

### Addons
Tier 4 niche/advanced mandates (`src/addons/mandates/`) plus the addon helper contracts (`src/addons/helpers/`) required for them to function.

| Category | Contracts | Total lines | Code lines |
|---|--:|--:|--:|
| electoral | 4 | 497 | 323 |
| executive | 3 | 201 | 142 |
| integrations | 13 | 2,014 | 1,105 |
| helpers | 2 | 466 | 295 |
| **Subtotal** | **22** | **3,178** | **1,865** |

Helpers: `Governed721`, `ZKPassport_PowersRegistry`.

## Methodology

- **Scope:** all `*.sol` files under `solidity/src/`. Test code (`test/`), scripts (`script/`), and third-party dependencies (`lib/`) are excluded.
- **Contracts:** counted as source files (one primary contract per file).
- **Total lines:** every line in the file, including blanks and comments.
- **Code lines:** total lines minus blank lines and comment-only lines (`//`, `/* … */`, and `*` continuation lines). This is a rough SLOC approximation, not a compiler-accurate statement count.
- Counts were produced with `find` + `awk`; re-run against `src/` to refresh after code changes.
