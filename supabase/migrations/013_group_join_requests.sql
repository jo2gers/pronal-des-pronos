-- Migration 013: Group join requests (admin approval flow)

CREATE TABLE IF NOT EXISTS public.group_join_requests (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(group_id, user_id)
);

ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

-- Requester can see their own requests; admins see requests for their groups
CREATE POLICY "See own requests or admin sees group requests"
  ON group_join_requests FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_join_requests.group_id
        AND gm.user_id = auth.uid()
        AND gm.role = 'admin'
    )
  );

-- Any authenticated user can create a request for themselves
CREATE POLICY "Users can create their own join requests"
  ON group_join_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can update (approve/decline) requests for their groups
CREATE POLICY "Admins can update join requests"
  ON group_join_requests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_join_requests.group_id
      AND gm.user_id = auth.uid()
      AND gm.role = 'admin'
  ));

-- Requester can cancel their own pending request
CREATE POLICY "Users can delete own pending requests"
  ON group_join_requests FOR DELETE
  USING (user_id = auth.uid());
