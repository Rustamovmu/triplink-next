Go outside pf this project and read tripLink/AGENTS.md first!

# tripLink Frontend Modification Instructions

This client project is being migrated from nestar-next to tripLink-next


## Rules

- Preserve current project architecture
- Keep GraphQL/Apollo integration
- Do not rewrite the whole app
- Improve UI incrementally

## Backent Context

Before making any changes, read!

- tripLink/AGENTS.md
- tripLink/docs/backend-acceptance.md

## Workflow

1. Analyze before editing.
2. Backend is running on port http://localhost:3007/graphql now.
3. Make small incremental changes.
4. Run typecheck after each phase.
5. Do not remove working logic unless replaced safely.
6. Update petoria/docs/ai/COMPLETED_TASKS.md after major changes.