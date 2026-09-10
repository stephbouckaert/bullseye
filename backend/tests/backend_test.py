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
        assert d["early_cutoff"] == "2026-09-12"

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
        expected_tier = "early" if date.today() <= date(2026, 9, 12) else "late"
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
        # verify persist
        r2 = s.get(f"{API}/players")
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
