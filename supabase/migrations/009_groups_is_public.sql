-- Migration 009: Add is_public column to groups table
-- Public groups: any member can invite friends
-- Private groups: only the admin can invite members

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- Update RLS policies: allow members to insert group_members if group is public
-- (existing insert policy only covers admins; extend it for public groups)

-- Drop old insert policy if it exists
DROP POLICY IF EXISTS "Members can insert group_members" ON group_members;
DROP POLICY IF EXISTS "Admins can insert group_members" ON group_members;

-- New policy: allow insert if the group is public (any member) OR if the actor is admin
CREATE POLICY "Members can add to public groups or admins add to any"
  ON group_members FOR INSERT
  WITH CHECK (
    -- The inserting user must be a member of the group
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
    )
    AND (
      -- Either the group is public...
      EXISTS (
        SELECT 1 FROM groups g
        WHERE g.id = group_members.group_id
          AND g.is_public = true
      )
      OR
      -- ...or the inserting user is admin
      EXISTS (
        SELECT 1 FROM group_members gm
        WHERE gm.group_id = group_members.group_id
          AND gm.user_id = auth.uid()
          AND gm.role = 'admin'
      )
    )
  );
