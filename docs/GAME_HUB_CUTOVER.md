# Game module cut-over to HIU TMC Game Hub

Study OS now hands the `garden` tab over to the Game Hub when `VITE_GAME_HUB_URL` is set (Vercel env, build time).

- Unset: behaviour unchanged (in-app Garden + social hub).
- Set: the tab shows a "moved to Game Hub" card; the button opens the Hub with the same SSO bridge as the ecosystem home (`ecosystem_sso` fragment).
- Data does not move: Garden and Y Quán state stay in the shared Supabase project; the Hub is the only place that plays them. Old components stay in the tree for a compatibility window and are removed in a later PR after the Hub has been live for a few weeks.
- Rollback: unset `VITE_GAME_HUB_URL` and redeploy.
