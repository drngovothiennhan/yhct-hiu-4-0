-- YHCT HIU 4.0 — notification kind compatibility for versioned platform modules.
-- Keep the allow-list explicit so new modules cannot silently emit arbitrary notification kinds.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in (
    'comment',
    'endorsement',
    'follow',
    'topic_post',
    'repost',
    'mod_verified',
    'drl_published',
    'system',
    'academic_post_submitted',
    'academic_post_review',
    'academic_post_moderated',
    'message_received',
    'feedback_received',
    'feedback_resolved',
    'herb_garden_planted',
    'herb_garden_water_due',
    'herb_garden_fertilizer_due',
    'herb_garden_mature',
    'herb_garden_dead'
  ));

comment on constraint notifications_kind_check on public.notifications is
  'Explicit notification kinds for social, DRL, moderation, messaging, feedback, and Herb Garden lifecycle modules.';
