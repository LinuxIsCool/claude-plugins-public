-- plug.lua - Claude Code Plugin Specification
--
-- This file declares all plugins that Plug should manage.
-- Run `plug sync` to install/update plugins to match this spec.
--
-- Format:
--   'username/repo'                    -- Simple GitHub plugin
--   'username/repo/subpath'            -- Plugin in subdirectory
--   { 'username/repo', opts }          -- Plugin with options
--   { dir = '~/path', name = 'name' }  -- Local plugin

return {
  -- ═══════════════════════════════════════════════════════════════════════════
  -- Core
  -- ═══════════════════════════════════════════════════════════════════════════

  -- Plug manages itself (after bootstrap)
  -- { dir = '~/.claude/plugins/plug', name = 'plug' },

  -- ═══════════════════════════════════════════════════════════════════════════
  -- Official Plugins (from Anthropic's collection)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- Development workflow
  'anthropics/claude-code/plugins/feature-dev',
  'anthropics/claude-code/plugins/commit-commands',
  'anthropics/claude-code/plugins/code-review',

  -- Frontend
  'anthropics/claude-code/plugins/frontend-design',

  -- Output customization
  'anthropics/claude-code/plugins/explanatory-output-style',

  -- ═══════════════════════════════════════════════════════════════════════════
  -- Community Plugins
  -- ═══════════════════════════════════════════════════════════════════════════

  -- Add community plugins here as they become available
  -- 'username/claude-plugin-name',

  -- ═══════════════════════════════════════════════════════════════════════════
  -- Pinned Versions
  -- ═══════════════════════════════════════════════════════════════════════════

  -- Pin to a specific version when stability matters
  -- {
  --   'anthropics/claude-code/plugins/security-guidance',
  --   tag = 'v1.0.0',
  -- },

  -- ═══════════════════════════════════════════════════════════════════════════
  -- Local Development
  -- ═══════════════════════════════════════════════════════════════════════════

  -- Local plugins for development (symlinked, not cloned)
  -- {
  --   dir = '~/Workspace/my-claude-plugin',
  --   name = 'my-plugin',
  -- },

  -- ═══════════════════════════════════════════════════════════════════════════
  -- Disabled Plugins
  -- ═══════════════════════════════════════════════════════════════════════════

  -- Keep in spec but don't install (useful for temporary disable)
  -- {
  --   'username/heavy-plugin',
  --   enabled = false,
  -- },
}
