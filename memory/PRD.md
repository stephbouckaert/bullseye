# Belly Darts League — PRD

## Original Problem Statement
Darts league manager for "Belly Darts League" at "Belly and the Beer", 21 Elgin Street, Soho, Hong Kong.
- Season: starts Sep 20, 15 weeks, finals + party Dec 27. Matches Sundays 3:00–6:00 PM.
- Entry fee: $100 if signed up by Sep 12 (early bird), else $200.
- Match day: up to 3 matches vs 3 different opponents; players agree if match is "official"; closest-to-bullseye throws first; staff record scores.
- Match format (1v1) = 3 games: Medley (win 2-0 = 3 pts, 2-1 = 2 pts), Count Up (winner +1), Half It (winner +1). Max 15 pts/day (5/match × 3).
- Prizes: monthly top scorer; season Top 3 trophies at finals.

## User Choices
- Public standings page + admin panel
- Google login for admin (Emergent-managed OAuth), gated by ADMIN_EMAIL = steph.bouckaert@gmail.com
- Features v1: player registration & entry-fee tracking, match-day score entry, standings/leaderboard, schedule/timeline
- Design: bold & sporty (dark tavern + athletic). Branding: Belly and the Beer / Hong Kong.

## Architecture
- Frontend: React (CRA/craco), Tailwind, framer-motion, lucide-react, sonner. Pages: Home, Standings, Schedule, Rules, Register, Login, Admin. Auth via cookie session (AuthContext + AuthCallback on hash session_id).
- Backend: FastAPI + Motor/MongoDB, all routes /api prefixed. Emergent OAuth session exchange. Admin gate by email == ADMIN_EMAIL.
- Collections: players, matches, users, user_sessions, status_checks.

## User Personas
- Venue staff/admin (Steph): records scores, manages players & fees.
- Players / public: register, view standings, schedule, rules.

## Implemented (2026-06)
- Public league info, registration with auto fee-tier (early/late), redacted public player list.
- Standings (overall + monthly) with points/medley/countup/halfit breakdown + podium.
- 15-week schedule with per-matchday match listings, finals flag.
- Admin dashboard: Google login, stat cards (players, matches, fees paid, revenue), score entry (3-game with auto point calc + official toggle), player CRUD + paid toggle, match log with delete.
- Seed data: 14 players + ~6 weeks of matches.
- Tested: backend 100% (15 pytest), frontend 100%.

## Implemented (2026-06 · iteration 2)
- Player Portal (/portal): email-only lookup → rank/points/stats, upcoming matchdays, match history; players submit results (go in as PENDING).
- Moderator flow: players submit → admin confirms or edits (recomputes points) before matches count in standings. Standings exclude confirmed=false.
- Finals bracket (/finals): top-8 seeded from standings + "Crown the Champion" confetti celebration.
- Welcome email on registration via Emergent-managed Resend (fee/tier details). Verified 202 Accepted.
- Score export: admin one-tap CSV of all matches (/api/admin/matches/export).
- Monthly rewards: admin sets a different reward per season month (Rewards tab); shown publicly on Home.
- Clarifications applied: early-bird cutoff moved to 31 Oct 2026; Medley = Game1 701 / Game2 Cricket / Game3 choice of 701 or Cricket.
- Tested: backend 29/29 pytest (100%), all new frontend flows verified.

## Backlog / Remaining
- P1: Player self-portal (login to see own stats/schedule).
- P2: Email confirmations on registration (Resend).
- P2: Export scores to CSV for staff.
- P2: Bracket/finals view for Dec 27.
- P2: Payment collection online (currently pay-at-venue).

## Next Tasks
- Await user feedback on v1.
