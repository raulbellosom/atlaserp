# Spec-Driven Development Methodology — Design

Date: 2026-05-08
Status: Approved
Author: Claude (brainstorming session)

## 1. Feature title

Spec-Driven Development Methodology for Atlas ERP

## 2. Status

Approved

## 3. Context

Atlas ERP has accumulated 14 spec files and 14 plan files under `docs/superpowers/` as the project grew from Phase 0 to Phase 9. These documents were written iteratively and share a common intent (spec before code), but lacked a formal, repeatable methodology with explicit templates, naming conventions, a mandatory checklist, and agent mode rules.

## 4. Problem

Without a formal SDD methodology:
- Specs varied in depth and completeness, making them unreliable as implementation sources of truth.
- There was no defined approval gate between spec, plan, and implementation.
- AI agents could begin coding without a complete spec or plan.
- No templates existed, so each spec was structured differently.
- There was no decision log system for when implementations deviated from specs.
- No single document explained the full workflow to a new developer or agent.

## 5. Goals

1. Establish a mandatory, documented workflow: Discovery -> Spec -> Plan -> Approval Gate -> Implementation -> Verification -> Maintenance.
2. Create annotated templates for spec, plan, verification checklist, and decision log.
3. Formalize folder conventions and file naming.
4. Define the 28 required sections for every Atlas ERP feature spec.
5. Define the 16-step Atlas module implementation checklist.
6. Establish agent mode declaration rules.
7. Add a concise SDD reference to CLAUDE.md and codex/00_MASTER_PROMPT.md.

## 6. Non-goals

1. Retroactively reformatting the 14 existing specs to the new template.
2. Implementing any new business feature module.
3. Modifying existing architecture, API, or data model.
4. Introducing CI enforcement of spec existence.

## 7. User stories

- As a developer starting a new feature, I want a template and checklist so that I do not skip required artifacts.
- As an AI agent implementing a feature, I want a mode declaration rule so that I do not accidentally begin coding before the spec is approved.
- As a reviewer, I want all specs to follow a consistent 28-section structure so that I can verify completeness quickly.

## 8. UX requirements

N/A — this is a documentation feature with no UI.

## 9. Routes/screens

N/A

## 10. Data model

N/A — no Prisma models required. This feature is documentation only.

## 11. Prisma impact

None. No migration required.

## 12. API contract

N/A

## 13. SDK contract

N/A

## 14. Validator contract

N/A

## 15. Module manifest impact

None. SDD is a methodology, not an Atlas module.

## 16. Navigation impact

N/A

## 17. Blueprint impact

N/A

## 18. RBAC/permissions

N/A

## 19. Multi-company behavior

N/A

## 20. Files/storage impact

N/A

## 21. Export/import requirements

N/A

## 22. Audit log requirements

N/A

## 23. Edge cases

1. An AI agent that is mid-implementation when this methodology is adopted must declare its current mode at the next work session start and create any missing spec or plan retroactively before continuing.
2. A feature that was fully implemented before SDD was adopted does not need to be retroactively specced, but its TASKS.md entry must still carry verification evidence.

## 24. Risks

1. Risk: Agents ignore the mode declaration rule and skip directly to code. Mitigation: CLAUDE.md and codex/00_MASTER_PROMPT.md reference the SDD doc, making the rule present in every agent session context.
2. Risk: Spec templates become outdated as Atlas evolves. Mitigation: Templates are annotated, so adding a new required field requires only updating the template and the 28-section list in spec-driven-development.md.

## 25. Acceptance criteria

1. Given a developer starting a new feature, when they follow the SDD workflow, then they can locate the template, fill it in, and produce a complete spec without reading multiple disconnected documents.
2. Given an AI agent at session start, when it reads CLAUDE.md, then it knows SDD exists and where to find the full methodology.
3. Given the docs/superpowers/ folder, when a reviewer opens it, then README.md lists all existing specs and plans and explains the workflow.

## 26. Verification plan

- Confirm all 6 new files exist at their expected paths.
- Confirm CLAUDE.md contains the SDD section.
- Confirm codex/00_MASTER_PROMPT.md contains principle #12.
- Confirm `docs/superpowers/templates/` directory contains 4 template files.
- Confirm `docs/superpowers/README.md` exists and lists all 14 existing specs.

## 27. Rollback plan

All changes are documentation files and two small additions to CLAUDE.md and codex. Rollback is a git revert. No migration or data change is involved.

## 28. Future enhancements

1. CI check that enforces spec file existence before a PR can be merged for a new module.
2. A script that scaffolds spec + plan files from a feature name argument.
3. A lint rule that checks spec files for missing sections.
