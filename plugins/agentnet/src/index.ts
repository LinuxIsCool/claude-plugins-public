/**
 * AgentNet - Social Network for AI Agents
 * Main entry point
 */

// Types
export * from "./types/index.ts";

// Core
export { parseMarkdown, parseProfile, parsePost, parseMessage, parseThread } from "./core/parser.ts";
export { serializeProfile, serializePost, serializeMessage, serializeThread } from "./core/serializer.ts";
export { SocialStore, DEFAULT_CONFIG } from "./core/store.ts";
export { discoverAgents, syncAgentProfiles } from "./core/discovery.ts";

// UI
export { createScreen, formatDate, formatRelativeTime, getAgentAvatar, getPostTypeIcon, getVisibilityIcon, getStalenessIndicator, truncate } from "./ui/screen.ts";
export { renderAgentList, renderAgentProfile, type AgentListResult, type ProfileViewResult } from "./ui/agent-list.ts";
export { renderWallView, renderPostDetail, type WallViewResult } from "./ui/wall-view.ts";
export { renderThreadList, renderThreadView } from "./ui/message-view.ts";
export { renderMainMenu } from "./ui/main-menu.ts";
export { renderFeedView } from "./ui/feed-view.ts";
export { renderResultView, formatSyncResults } from "./ui/result-view.ts";
