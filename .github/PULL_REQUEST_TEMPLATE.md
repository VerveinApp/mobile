## Summary

<!-- What does this change and why? -->

## Test plan

- [ ] `npm run typecheck`, `npm test`, `npm run lint` pass locally (CI also runs these)
- [ ] Verified on-device/simulator, not just type/unit checks
- [ ] If this touches the engine (`src/lib/engine/**`): no invented numeric thresholds — cites the research vault or an existing constant
- [ ] If this touches a screen with icon+text sibling Pressables: explicit `accessibilityRole`/`accessibilityLabel` set (see known icon-sibling label bug)

## Screenshots

<!-- For UI changes, before/after. Delete this section otherwise. -->
