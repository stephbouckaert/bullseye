"""Backend tests for Belly Darts League"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://bullseye-matches.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN")
NORMAL_TOKEN = os.environ.get("NORMAL_TOKEN")


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_headers():
    return {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture(scope="session")
def normal_headers():
    return {"Authorization": f"Bearer {NORMAL_TOKEN}"}


# --- Public endpoints ---
class TestPublic:
    def test_league_info(self, s):
        r = s.get(f"{API}/league/info")
        assert r.status_code == 200
        d = r.json()
        assert d["start_date"] == "2026-09-20"
        assert d["weeks"] == 15
        assert d["fee_early"] == 100 and d["fee_late"] == 200
        assert d["early_cutoff"] == "2026-10-31"

    def test_schedule(self, s):
        r = s.get(f"{API}/schedule")
        assert r.status_code == 200
        weeks = r.json()["weeks"]
        assert len(weeks) == 15
        assert weeks[0]["date"] == "2026-09-20"
        assert weeks[-1]["is_finals"] is True
        assert weeks[-1]["date"] == "2026-12-27"

    def test_matches_list(self, s):
        r = s.get(f"{API}/matches")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_standings_all(self, s):
        r = s.get(f"{API}/standings?month=all")
        assert r.status_code == 200
        d = r.json()
        assert "standings" in d and "months" in d
        assert d["selected"] == "all"
        # verify ranking sorted by points desc
        pts = [row["points"] for row in d["standings"]]
        assert pts == sorted(pts, reverse=True)
        # rank starts at 1
        assert d["standings"][0]["rank"] == 1

    def test_standings_by_month(self, s):
        r = s.get(f"{API}/standings?month=2026-09")
        assert r.status_code == 200

    def test_register_fee_tier(self, s):
        from datetime import date
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/players/register", json={"name": "TEST Player", "email": email, "phone": "12345"})
        assert r.status_code == 200
        d = r.json()
        expected_tier = "early" if date.today() <= date(2026, 10, 31) else "late"
        expected_fee = 100 if expected_tier == "early" else 200
        assert d["fee_tier"] == expected_tier
        assert d["fee_amount"] == expected_fee
        assert d["email"] == email
        # duplicate
        r2 = s.post(f"{API}/players/register", json={"name": "TEST Player", "email": email})
        assert r2.status_code == 400


# --- Auth gating ---
class TestAuthGating:
    def test_no_session_401(self, s):
        r = s.post(f"{API}/admin/matches", json={})
        assert r.status_code == 401

    def test_non_admin_403(self, s, normal_headers):
        r = s.get(f"{API}/auth/me", headers=normal_headers)
        assert r.status_code == 200
        assert r.json()["is_admin"] is False
        r = s.post(f"{API}/admin/players", json={"name": "x", "email": "x@x.com"}, headers=normal_headers)
        assert r.status_code == 403

    def test_admin_me(self, s, admin_headers):
        r = s.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["is_admin"] is True


# --- Admin CRUD + Match logic ---
class TestAdminFlows:
    created_player_ids = []
    created_match_ids = []

    def test_admin_add_player(self, s, admin_headers):
        email = f"test_admin_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{API}/admin/players", json={"name": "TEST Admin Player", "email": email}, headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == email and d["paid"] is False
        TestAdminFlows.created_player_ids.append(d["id"])

    def test_admin_toggle_paid(self, s, admin_headers):
        pid = TestAdminFlows.created_player_ids[0]
        r = s.put(f"{API}/admin/players/{pid}", json={"paid": True}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["paid"] is True
        # verify persist via admin endpoint (public /players is redacted)
        r2 = s.get(f"{API}/admin/players", headers={"Authorization": f"Bearer {os.environ.get('ADMIN_TOKEN','')}"})
        found = [p for p in r2.json() if p["id"] == pid]
        assert found and found[0]["paid"] is True

    def test_create_match_and_points(self, s, admin_headers):
        # create two players
        p1 = s.post(f"{API}/admin/players", json={"name": "TEST A", "email": f"a_{uuid.uuid4().hex[:6]}@x.com"}, headers=admin_headers).json()
        p2 = s.post(f"{API}/admin/players", json={"name": "TEST B", "email": f"b_{uuid.uuid4().hex[:6]}@x.com"}, headers=admin_headers).json()
        TestAdminFlows.created_player_ids += [p1["id"], p2["id"]]

        # medley 2-0 (3pts) A wins all
        match = {
            "date": "2026-10-04", "official": True,
            "player_a_id": p1["id"], "player_b_id": p2["id"],
            "medley_winner_id": p1["id"], "medley_score": "2-0",
            "countup_winner_id": p1["id"], "halfit_winner_id": p1["id"],
        }
        r = s.post(f"{API}/admin/matches", json=match, headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["points_a"] == 5  # 3 + 1 + 1
        assert d["points_b"] == 0
        TestAdminFlows.created_match_ids.append(d["id"])

        # medley 2-1 split
        match2 = {**match, "medley_score": "2-1", "countup_winner_id": p2["id"], "halfit_winner_id": p2["id"]}
        r2 = s.post(f"{API}/admin/matches", json=match2, headers=admin_headers)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["points_a"] == 2  # medley 2-1
        assert d2["points_b"] == 2  # 1 + 1
        TestAdminFlows.created_match_ids.append(d2["id"])

    def test_match_validations(self, s, admin_headers):
        p1 = TestAdminFlows.created_player_ids[-2]
        p2 = TestAdminFlows.created_player_ids[-1]
        # same player
        bad = {"date": "2026-10-04", "player_a_id": p1, "player_b_id": p1,
               "medley_winner_id": p1, "medley_score": "2-0",
               "countup_winner_id": p1, "halfit_winner_id": p1}
        r = s.post(f"{API}/admin/matches", json=bad, headers=admin_headers)
        assert r.status_code == 400
        # invalid medley score
        bad2 = {"date": "2026-10-04", "player_a_id": p1, "player_b_id": p2,
                "medley_winner_id": p1, "medley_score": "3-0",
                "countup_winner_id": p1, "halfit_winner_id": p1}
        r = s.post(f"{API}/admin/matches", json=bad2, headers=admin_headers)
        assert r.status_code == 400
        # winner not in match
        other = str(uuid.uuid4())
        bad3 = {"date": "2026-10-04", "player_a_id": p1, "player_b_id": p2,
                "medley_winner_id": other, "medley_score": "2-0",
                "countup_winner_id": p1, "halfit_winner_id": p1}
        r = s.post(f"{API}/admin/matches", json=bad3, headers=admin_headers)
        assert r.status_code == 400

    def test_standings_reflect_new_match(self, s, admin_headers):
        # create two dedicated players and one official match
        pa = s.post(f"{API}/admin/players", json={"name": "TEST Standing A", "email": f"sa_{uuid.uuid4().hex[:6]}@x.com"}, headers=admin_headers).json()
        pb = s.post(f"{API}/admin/players", json={"name": "TEST Standing B", "email": f"sb_{uuid.uuid4().hex[:6]}@x.com"}, headers=admin_headers).json()
        TestAdminFlows.created_player_ids += [pa["id"], pb["id"]]

        match = {"date": "2026-10-11", "official": True,
                 "player_a_id": pa["id"], "player_b_id": pb["id"],
                 "medley_winner_id": pa["id"], "medley_score": "2-0",
                 "countup_winner_id": pa["id"], "halfit_winner_id": pa["id"]}
        m = s.post(f"{API}/admin/matches", json=match, headers=admin_headers).json()
        TestAdminFlows.created_match_ids.append(m["id"])

        r = s.get(f"{API}/standings?month=all")
        rows = {row["player_id"]: row for row in r.json()["standings"]}
        assert rows[pa["id"]]["points"] >= 5
        assert rows[pa["id"]]["medley_wins"] >= 1

        # non-official match should not appear
        match_no = {**match, "official": False, "date": "2026-10-18"}
        mn = s.post(f"{API}/admin/matches", json=match_no, headers=admin_headers).json()
        TestAdminFlows.created_match_ids.append(mn["id"])
        r2 = s.get(f"{API}/standings?month=all")
        rows2 = {row["player_id"]: row for row in r2.json()["standings"]}
        # points didn't change (non-official not counted)
        assert rows2[pa["id"]]["points"] == rows[pa["id"]]["points"]

    def test_delete_match_and_player(self, s, admin_headers):
        for mid in TestAdminFlows.created_match_ids:
            r = s.delete(f"{API}/admin/matches/{mid}", headers=admin_headers)
            assert r.status_code == 200
        for pid in TestAdminFlows.created_player_ids:
            r = s.delete(f"{API}/admin/players/{pid}", headers=admin_headers)
            assert r.status_code == 200



# --- New features: portal lookup, submit-match, moderator confirm/edit, CSV export, rewards ---
class TestPortalAndModeration:
    def test_lookup_unknown_email(self, s):
        r = s.get(f"{API}/players/lookup", params={"email": f"nope_{uuid.uuid4().hex}@x.com"})
        assert r.status_code == 404

    def test_lookup_existing_player(self, s):
        r = s.get(f"{API}/players/lookup", params={"email": "marcus.chan@example.com"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["player"]["email"] == "marcus.chan@example.com"
        assert "stats" in d and d["stats"] is not None
        for k in ("rank", "points", "medley_wins", "countup_wins", "halfit_wins", "matches_played"):
            assert k in d["stats"]
        assert isinstance(d["history"], list)
        assert isinstance(d["upcoming"], list)
        # history rows have needed keys (if any)
        if d["history"]:
            row = d["history"][0]
            for k in ("opponent", "points", "opponent_points", "won", "confirmed", "medley_score"):
                assert k in row

    def _get_two_players(self, s):
        players = s.get(f"{API}/players").json()
        # find marcus and grace
        m = next(p for p in players if p["name"] == "Marcus Chan")
        g = next(p for p in players if p["name"] == "Grace Lam")
        return m, g

    def test_submit_match_pending_and_standings_exclude(self, s, admin_headers):
        marcus, grace = self._get_two_players(s)
        # standings BEFORE
        st_before = s.get(f"{API}/standings?month=all").json()["standings"]
        pts_before = {r["player_id"]: r["points"] for r in st_before}

        payload = {
            "submitter_email": "marcus.chan@example.com",
            "opponent_id": grace["id"],
            "date": "2026-10-25",
            "official": True,
            "medley_winner": "me", "medley_score": "2-0",
            "countup_winner": "me", "halfit_winner": "opp",
        }
        r = s.post(f"{API}/players/submit-match", json=payload)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["confirmed"] is False
        # medley 2-0 = 3, count-up win = 1, half-it lost = 0 => points_a=4
        assert m["points_a"] == 4
        assert m["points_b"] == 1
        match_id = m["id"]

        # standings AFTER submit but BEFORE confirm should be unchanged
        st_pending = s.get(f"{API}/standings?month=all").json()["standings"]
        pts_pending = {r["player_id"]: r["points"] for r in st_pending}
        assert pts_pending.get(marcus["id"], 0) == pts_before.get(marcus["id"], 0)

        # confirm as admin
        r = s.put(f"{API}/admin/matches/{match_id}/confirm", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["confirmed"] is True

        # standings AFTER confirm reflects added points
        st_after = s.get(f"{API}/standings?month=all").json()["standings"]
        pts_after = {r["player_id"]: r["points"] for r in st_after}
        assert pts_after[marcus["id"]] == pts_before.get(marcus["id"], 0) + 4
        assert pts_after[grace["id"]] == pts_before.get(grace["id"], 0) + 1

        # cleanup
        s.delete(f"{API}/admin/matches/{match_id}", headers=admin_headers)

    def test_submit_match_errors(self, s):
        players = s.get(f"{API}/players").json()
        marcus = next(p for p in players if p["name"] == "Marcus Chan")
        # unregistered submitter
        r = s.post(f"{API}/players/submit-match", json={
            "submitter_email": "ghost@example.com", "opponent_id": marcus["id"],
            "date": "2026-10-11", "medley_winner": "me", "medley_score": "2-0",
            "countup_winner": "me", "halfit_winner": "me",
        })
        assert r.status_code == 404
        # same as opponent
        r = s.post(f"{API}/players/submit-match", json={
            "submitter_email": "marcus.chan@example.com", "opponent_id": marcus["id"],
            "date": "2026-10-11", "medley_winner": "me", "medley_score": "2-0",
            "countup_winner": "me", "halfit_winner": "me",
        })
        assert r.status_code == 400

    def test_confirm_auth(self, s, normal_headers):
        # 401 no auth
        r = s.put(f"{API}/admin/matches/some-id/confirm")
        assert r.status_code == 401
        # 403 non-admin
        r = s.put(f"{API}/admin/matches/some-id/confirm", headers=normal_headers)
        assert r.status_code == 403

    def test_edit_match_recomputes_points(self, s, admin_headers):
        marcus, grace = self._get_two_players(s)
        # create an admin match A wins 2-0 sweep => A=5
        match = {"date": "2026-10-18", "official": True,
                 "player_a_id": marcus["id"], "player_b_id": grace["id"],
                 "medley_winner_id": marcus["id"], "medley_score": "2-0",
                 "countup_winner_id": marcus["id"], "halfit_winner_id": marcus["id"]}
        m = s.post(f"{API}/admin/matches", json=match, headers=admin_headers).json()
        mid = m["id"]
        assert m["points_a"] == 5 and m["points_b"] == 0

        # edit: change medley score to 2-1, and countup winner to B
        r = s.put(f"{API}/admin/matches/{mid}",
                  json={"medley_score": "2-1", "countup_winner_id": grace["id"]},
                  headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        # medley 2-1 winner=A => 2pts, countup=B, halfit=A => A=3, B=1
        assert d["points_a"] == 3
        assert d["points_b"] == 1

        # invalid medley score
        r = s.put(f"{API}/admin/matches/{mid}", json={"medley_score": "3-0"}, headers=admin_headers)
        assert r.status_code == 400
        # winner not in match
        r = s.put(f"{API}/admin/matches/{mid}",
                  json={"medley_winner_id": str(uuid.uuid4())}, headers=admin_headers)
        assert r.status_code == 400

        s.delete(f"{API}/admin/matches/{mid}", headers=admin_headers)

    def test_edit_match_auth(self, s, normal_headers):
        r = s.put(f"{API}/admin/matches/some-id", json={"official": True})
        assert r.status_code == 401
        r = s.put(f"{API}/admin/matches/some-id", json={"official": True}, headers=normal_headers)
        assert r.status_code == 403


class TestExportCSV:
    def test_export_unauth(self, s):
        r = s.get(f"{API}/admin/matches/export")
        assert r.status_code == 401

    def test_export_non_admin(self, s, normal_headers):
        r = s.get(f"{API}/admin/matches/export", headers=normal_headers)
        assert r.status_code == 403

    def test_export_ok(self, s, admin_headers):
        r = s.get(f"{API}/admin/matches/export", headers=admin_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        lines = r.text.strip().splitlines()
        assert lines[0].startswith("Date,Player A,Player B")
        assert len(lines) >= 2  # header + at least one seeded match


class TestRewards:
    def test_get_rewards_public(self, s):
        r = s.get(f"{API}/rewards")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 4
        months = [d["month"] for d in data]
        assert months == ["2026-09", "2026-10", "2026-11", "2026-12"]
        for d in data:
            assert d["label"].endswith("2026")
            assert "reward" in d

    def test_set_reward_admin(self, s, admin_headers):
        r = s.put(f"{API}/admin/rewards/2026-09", json={"reward": "TEST Free pint"}, headers=admin_headers)
        assert r.status_code == 200
        # verify persistence via public endpoint
        r2 = s.get(f"{API}/rewards")
        sep = next(x for x in r2.json() if x["month"] == "2026-09")
        assert sep["reward"] == "TEST Free pint"

    def test_set_reward_invalid_month(self, s, admin_headers):
        r = s.put(f"{API}/admin/rewards/2027-01", json={"reward": "x"}, headers=admin_headers)
        assert r.status_code == 400

    def test_set_reward_auth(self, s, normal_headers):
        r = s.put(f"{API}/admin/rewards/2026-09", json={"reward": "x"})
        assert r.status_code == 401
        r = s.put(f"{API}/admin/rewards/2026-09", json={"reward": "x"}, headers=normal_headers)
        assert r.status_code == 403
