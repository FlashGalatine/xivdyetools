# REFACTOR-003: Inconsistent Handler Function Signatures

## Priority
MEDIUM

## Category
Maintainability / Inconsistency

## Location
- File(s): src/index.ts (handleCommand switch), all handlers in src/handlers/commands/
- Scope: architecture level

## Current State
Command handler functions have inconsistent signatures:
- `handleAboutCommand(interaction, env, ctx)` — no logger
- `handleHarmonyCommand(interaction, env, ctx, logger)` — with logger
- `handleDyeCommand(interaction, env, ctx)` — no logger
- `handleLanguageCommand(interaction, env, ctx)` — no logger
- `handleStatsCommand(interaction, env, ctx, logger)` — with logger

This means the `handleCommand` router must maintain different call patterns per command.

## Issues
- Handlers without logger can't perform structured error logging
- Adding logger to a handler requires changing both the handler AND the router
- New commands must decide ad-hoc whether to accept logger
- Makes it harder to add cross-cutting concerns (e.g., request tracing)

## Proposed Refactoring
Standardize all handler signatures with a context object:

```typescript
interface CommandContext {
  interaction: DiscordInteraction;
  env: Env;
  ctx: ExecutionContext;
  logger: ExtendedLogger;
  userId: string;
}

// All handlers use the same signature
type CommandHandler = (context: CommandContext) => Promise<Response>;

// Registry pattern
const commandHandlers: Record<string, CommandHandler> = {
  'about': handleAboutCommand,
  'harmony': handleHarmonyCommand,
  // ...
};
```

## Benefits
- Consistent API across all handlers
- Easy to add new cross-cutting context (e.g., translator, preferences)
- Eliminates the 17-case switch statement
- Makes handler registration declarative

## Effort Estimate
HIGH

## Risk Assessment
Medium risk — touches every command handler. Should be done incrementally, one handler at a time.
