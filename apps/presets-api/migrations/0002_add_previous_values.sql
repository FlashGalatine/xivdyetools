-- Migration: Add previous_values column for edit revert capability
-- Date: 2025-12-07
-- Purpose: Store pre-edit values when an edit is flagged by content moderation
--          Allows moderators to revert to the previous state

-- Add the previous_values column
-- JSON format: {"name": "...", "description": "...", "tags": [...], "dyes": [...]}
ALTER TABLE presets ADD COLUMN previous_values TEXT;

-- Update moderation_log action comment (documentation only)
-- Valid actions: approve | reject | flag | unflag | revert
