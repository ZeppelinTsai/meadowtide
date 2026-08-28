import { STORY_EVENTS } from "../src/story/story-registry";
import { auditStoryRegistry } from "../src/story/story-audit";

const result = auditStoryRegistry(STORY_EVENTS);
for (const warning of result.warnings) console.warn(`[story-audit] WARNING: ${warning}`);
if (result.errors.length) {
  for (const error of result.errors) console.error(`[story-audit] ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`[story-audit] OK: ${STORY_EVENTS.length} event(s)`);
}
