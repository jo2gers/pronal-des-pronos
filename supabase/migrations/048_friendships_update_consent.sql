-- 048: only the addressee may accept/decline a friend request.
--
-- friendships_update USING allowed either party to change status, so a direct
-- PostgREST PATCH by the REQUESTER could flip their own pending request to
-- 'accepted' without the addressee's consent. Gate it with a WITH CHECK on the
-- resulting row (all the new row's columns are visible there):
--   • a transition TO 'accepted'/'declined' requires being the addressee
--     (the app's accept/decline flow, friends + profile/[id] ?/respond);
--   • a transition TO 'pending' requires being the (new) requester
--     (re-opening a previously declined row as a fresh request).
-- USING stays "either party" so both can attempt; the WITH CHECK is what blocks
-- the self-accept.

drop policy if exists friendships_update on public.friendships;

create policy friendships_update on public.friendships
  for update to public
  using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (
    (status = 'pending' and auth.uid() = requester_id)
    or (status in ('accepted', 'declined') and auth.uid() = addressee_id)
  );
