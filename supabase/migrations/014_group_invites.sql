-- Create group_invites table for admin/member invites to groups
CREATE TABLE IF NOT EXISTS public.group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Enable RLS
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Users can view invites sent to them
CREATE POLICY "Users can view their own invites"
  ON public.group_invites
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can respond to their own invites
CREATE POLICY "Users can update their own invites"
  ON public.group_invites
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can create invites for their groups
CREATE POLICY "Admins can create invites for their groups"
  ON public.group_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = group_invites.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.role = 'admin'
    )
  );

-- Create an index for faster lookups
CREATE INDEX idx_group_invites_user_id ON public.group_invites(user_id);
CREATE INDEX idx_group_invites_group_id ON public.group_invites(group_id);
CREATE INDEX idx_group_invites_status ON public.group_invites(status);
