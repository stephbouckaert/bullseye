from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date, timedelta
import requests
import httpx
import re
import ipaddress
import io
import csv
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '').lower()

# Email (Emergent managed Resend)
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Belly Darts League")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

# Season config
SEASON_YEAR = 2026
SEASON_START = date(2026, 9, 20)          # first matchday (Sunday)
SEASON_WEEKS = 15
EARLY_BIRD_CUTOFF = date(2026, 10, 31)    # sign up on/before => $100 (early bird)
FEE_EARLY = 100
FEE_LATE = 200
SEASON_MONTHS = [("2026-09", "September"), ("2026-10", "October"),
                 ("2026-11", "November"), ("2026-12", "December")]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ----------------------------- Models -----------------------------
class PlayerRegister(BaseModel):
    name: str
    nickname: Optional[str] = ""
    email: EmailStr
    phone: Optional[str] = ""


class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    nickname: Optional[str] = None
    phone: Optional[str] = None
    paid: Optional[bool] = None
    fee_amount: Optional[int] = None
    approved: Optional[bool] = None


class MatchGameResult(BaseModel):
    date: str                      # ISO date of matchday e.g. "2026-09-20"
    official: bool = True
    player_a_id: str
    player_b_id: str
    medley_winner_id: str          # must be a or b
    medley_score: str              # "2-0" or "2-1"
    countup_winner_id: str         # a or b
    halfit_winner_id: str          # a or b


class PlayerMatchSubmit(BaseModel):
    submitter_email: EmailStr
    opponent_id: str
    date: str
    official: bool = True
    medley_winner: str             # "me" or "opp"
    medley_score: str
    countup_winner: str            # "me" or "opp"
    halfit_winner: str             # "me" or "opp"


class MatchEdit(BaseModel):
    official: Optional[bool] = None
    medley_winner_id: Optional[str] = None
    medley_score: Optional[str] = None
    countup_winner_id: Optional[str] = None
    halfit_winner_id: Optional[str] = None
    confirmed: Optional[bool] = None


class RewardUpdate(BaseModel):
    reward: str


# ----------------------------- Helpers -----------------------------
def now_utc():
    return datetime.now(timezone.utc)


def compute_fee(reg_date: date):
    if reg_date <= EARLY_BIRD_CUTOFF:
        return "early", FEE_EARLY
    return "late", FEE_LATE


def medley_points(score: str) -> int:
    return 3 if score == "2-0" else 2


async def get_current_user(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("email", "").lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ----------------------------- Auth Routes -----------------------------
@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session id")

    resp = requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": session_id},
        timeout=15,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Failed to authenticate")
    data = resp.json()

    email = data["email"].lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name"), "picture": data.get("picture")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name"),
            "picture": data.get("picture"),
            "created_at": now_utc().isoformat(),
        })

    session_token = data["session_token"]
    expires_at = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": now_utc().isoformat(),
    })

    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none", path="/",
        max_age=7 * 24 * 60 * 60,
    )
    is_admin = email == ADMIN_EMAIL
    return {
        "user_id": user_id, "email": email,
        "name": data.get("name"), "picture": data.get("picture"),
        "is_admin": is_admin,
    }


@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    return {
        "user_id": user["user_id"], "email": user["email"],
        "name": user.get("name"), "picture": user.get("picture"),
        "is_admin": user.get("email", "").lower() == ADMIN_EMAIL,
    }


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ----------------------------- League Info -----------------------------
@api_router.get("/league/info")
async def league_info():
    schedule_dates = [(SEASON_START + timedelta(weeks=i)).isoformat() for i in range(SEASON_WEEKS)]
    return {
        "name": "Belly Darts League",
        "venue": "Belly and the Beer",
        "address": "21 Elgin Street, Soho, Hong Kong",
        "start_date": SEASON_START.isoformat(),
        "finals_date": schedule_dates[-1],
        "weeks": SEASON_WEEKS,
        "match_time": "3:00 PM - 6:00 PM",
        "match_day": "Sundays",
        "early_cutoff": EARLY_BIRD_CUTOFF.isoformat(),
        "fee_early": FEE_EARLY,
        "fee_late": FEE_LATE,
        "season_year": SEASON_YEAR,
    }


# ----------------------------- Players -----------------------------
@api_router.post("/players/register")
async def register_player(body: PlayerRegister):
    email = body.email.lower()
    existing = await db.players.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="This email is already registered")

    reg_date = date.today()
    tier, amount = compute_fee(reg_date)
    player = {
        "id": str(uuid.uuid4()),
        "name": body.name,
        "nickname": body.nickname or "",
        "email": email,
        "phone": body.phone or "",
        "registered_at": now_utc().isoformat(),
        "fee_tier": tier,
        "fee_amount": amount,
        "paid": False,
        "approved": True,
    }
    await db.players.insert_one(player)
    player.pop("_id", None)
    try:
        await send_welcome_email(player["email"], player["name"], player["fee_tier"], player["fee_amount"])
    except Exception as e:
        logger.error(f"Welcome email failed: {e}")
    return player


@api_router.get("/players")
async def list_players():
    players = await db.players.find(
        {}, {"_id": 0, "id": 1, "name": 1, "nickname": 1}
    ).sort("name", 1).to_list(1000)
    return players


@api_router.get("/admin/players")
async def list_players_admin(admin=Depends(require_admin)):
    players = await db.players.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return players


@api_router.put("/admin/players/{player_id}")
async def update_player(player_id: str, body: PlayerUpdate, admin=Depends(require_admin)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.players.update_one({"id": player_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Player not found")
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    return player


@api_router.post("/admin/players")
async def admin_create_player(body: PlayerRegister, admin=Depends(require_admin)):
    email = body.email.lower()
    existing = await db.players.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="This email is already registered")
    reg_date = date.today()
    tier, amount = compute_fee(reg_date)
    player = {
        "id": str(uuid.uuid4()), "name": body.name, "nickname": body.nickname or "",
        "email": email, "phone": body.phone or "", "registered_at": now_utc().isoformat(),
        "fee_tier": tier, "fee_amount": amount, "paid": False, "approved": True,
    }
    await db.players.insert_one(player)
    player.pop("_id", None)
    return player


@api_router.delete("/admin/players/{player_id}")
async def delete_player(player_id: str, admin=Depends(require_admin)):
    await db.players.delete_one({"id": player_id})
    return {"ok": True}


# ----------------------------- Matches -----------------------------
@api_router.get("/matches")
async def list_matches():
    matches = await db.matches.find({}, {"_id": 0}).sort("date", -1).to_list(2000)
    return matches


@api_router.post("/admin/matches")
async def create_match(body: MatchGameResult, admin=Depends(require_admin)):
    if body.player_a_id == body.player_b_id:
        raise HTTPException(status_code=400, detail="A match needs two different players")
    if body.medley_score not in ("2-0", "2-1"):
        raise HTTPException(status_code=400, detail="Medley score must be 2-0 or 2-1")

    ids = {body.player_a_id, body.player_b_id}
    for field, val in [("medley", body.medley_winner_id), ("countup", body.countup_winner_id), ("halfit", body.halfit_winner_id)]:
        if val not in ids:
            raise HTTPException(status_code=400, detail=f"{field} winner must be one of the two players")

    pa = await db.players.find_one({"id": body.player_a_id}, {"_id": 0})
    pb = await db.players.find_one({"id": body.player_b_id}, {"_id": 0})
    if not pa or not pb:
        raise HTTPException(status_code=404, detail="Player not found")

    match = {
        "id": str(uuid.uuid4()),
        "date": body.date,
        "official": body.official,
        "player_a_id": body.player_a_id,
        "player_a_name": pa["name"],
        "player_b_id": body.player_b_id,
        "player_b_name": pb["name"],
        "medley_winner_id": body.medley_winner_id,
        "medley_score": body.medley_score,
        "countup_winner_id": body.countup_winner_id,
        "halfit_winner_id": body.halfit_winner_id,
        "confirmed": True,
        "created_at": now_utc().isoformat(),
    }
    # points per player for this match
    match["points_a"] = _points_for(match, body.player_a_id)
    match["points_b"] = _points_for(match, body.player_b_id)
    await db.matches.insert_one(match)
    match.pop("_id", None)
    return match


@api_router.delete("/admin/matches/{match_id}")
async def delete_match(match_id: str, admin=Depends(require_admin)):
    await db.matches.delete_one({"id": match_id})
    return {"ok": True}


@api_router.post("/players/submit-match")
async def submit_match(body: PlayerMatchSubmit):
    submitter = await db.players.find_one({"email": body.submitter_email.lower().strip()}, {"_id": 0})
    if not submitter:
        raise HTTPException(status_code=404, detail="We couldn't find your player profile. Register first.")
    if submitter["id"] == body.opponent_id:
        raise HTTPException(status_code=400, detail="Pick a different opponent")
    opp = await db.players.find_one({"id": body.opponent_id}, {"_id": 0})
    if not opp:
        raise HTTPException(status_code=404, detail="Opponent not found")
    if body.medley_score not in ("2-0", "2-1"):
        raise HTTPException(status_code=400, detail="Medley score must be 2-0 or 2-1")

    def resolve(w):
        return submitter["id"] if w == "me" else opp["id"]

    match = {
        "id": str(uuid.uuid4()),
        "date": body.date,
        "official": body.official,
        "player_a_id": submitter["id"], "player_a_name": submitter["name"],
        "player_b_id": opp["id"], "player_b_name": opp["name"],
        "medley_winner_id": resolve(body.medley_winner),
        "medley_score": body.medley_score,
        "countup_winner_id": resolve(body.countup_winner),
        "halfit_winner_id": resolve(body.halfit_winner),
        "confirmed": False,
        "submitted_by": submitter["email"],
        "created_at": now_utc().isoformat(),
    }
    match["points_a"] = _points_for(match, submitter["id"])
    match["points_b"] = _points_for(match, opp["id"])
    await db.matches.insert_one(match)
    match.pop("_id", None)
    return match


@api_router.put("/admin/matches/{match_id}/confirm")
async def confirm_match(match_id: str, admin=Depends(require_admin)):
    res = await db.matches.update_one({"id": match_id}, {"$set": {"confirmed": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Match not found")
    return await db.matches.find_one({"id": match_id}, {"_id": 0})


@api_router.put("/admin/matches/{match_id}")
async def edit_match(match_id: str, body: MatchEdit, admin=Depends(require_admin)):
    m = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Match not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates.get("medley_score") and updates["medley_score"] not in ("2-0", "2-1"):
        raise HTTPException(status_code=400, detail="Medley score must be 2-0 or 2-1")
    ids = {m["player_a_id"], m["player_b_id"]}
    for f in ["medley_winner_id", "countup_winner_id", "halfit_winner_id"]:
        if f in updates and updates[f] not in ids:
            raise HTTPException(status_code=400, detail=f"{f} must be one of the two players")
    m.update(updates)
    updates["points_a"] = _points_for(m, m["player_a_id"])
    updates["points_b"] = _points_for(m, m["player_b_id"])
    await db.matches.update_one({"id": match_id}, {"$set": updates})
    return await db.matches.find_one({"id": match_id}, {"_id": 0})


@api_router.get("/rewards")
async def get_rewards():
    stored = {r["month"]: r for r in await db.rewards.find({}, {"_id": 0}).to_list(100)}
    return [{"month": m, "label": f"{lbl} 2026", "reward": stored.get(m, {}).get("reward", "")}
            for m, lbl in SEASON_MONTHS]


@api_router.put("/admin/rewards/{month}")
async def set_reward(month: str, body: RewardUpdate, admin=Depends(require_admin)):
    valid = {m for m, _ in SEASON_MONTHS}
    if month not in valid:
        raise HTTPException(status_code=400, detail="Invalid month")
    await db.rewards.update_one({"month": month}, {"$set": {"month": month, "reward": body.reward}}, upsert=True)
    return {"month": month, "reward": body.reward}


def _points_for(match, pid):
    pts = 0
    if match["medley_winner_id"] == pid:
        pts += medley_points(match["medley_score"])
    if match["countup_winner_id"] == pid:
        pts += 1
    if match["halfit_winner_id"] == pid:
        pts += 1
    return pts


# ----------------------------- Standings -----------------------------
@api_router.get("/standings")
async def standings(month: str = "all"):
    rows, months = await compute_standings(month)
    return {"standings": rows, "months": months, "selected": month}


async def compute_standings(month: str = "all"):
    matches = await db.matches.find({"official": True, "confirmed": {"$ne": False}}, {"_id": 0}).to_list(5000)
    all_months = sorted({m["date"][:7] for m in matches})
    if month != "all":
        matches = [m for m in matches if m["date"].startswith(month)]

    players = await db.players.find({}, {"_id": 0}).to_list(1000)
    table = {}
    for p in players:
        table[p["id"]] = {
            "player_id": p["id"], "name": p["name"], "nickname": p.get("nickname", ""),
            "points": 0, "matches_played": 0, "medley_wins": 0,
            "countup_wins": 0, "halfit_wins": 0, "medley_20": 0, "medley_21": 0,
        }

    for m in matches:
        for pid, pts_key in [(m["player_a_id"], "points_a"), (m["player_b_id"], "points_b")]:
            if pid not in table:
                continue
            row = table[pid]
            row["matches_played"] += 1
            row["points"] += m.get(pts_key, _points_for(m, pid))
            if m["medley_winner_id"] == pid:
                row["medley_wins"] += 1
                if m["medley_score"] == "2-0":
                    row["medley_20"] += 1
                else:
                    row["medley_21"] += 1
            if m["countup_winner_id"] == pid:
                row["countup_wins"] += 1
            if m["halfit_winner_id"] == pid:
                row["halfit_wins"] += 1

    rows = sorted(table.values(), key=lambda r: (-r["points"], -r["medley_wins"], r["name"]))
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return rows, all_months


@api_router.get("/players/lookup")
async def player_lookup(email: str):
    email = email.lower().strip()
    player = await db.players.find_one({"email": email}, {"_id": 0})
    if not player:
        raise HTTPException(status_code=404, detail="No player found with that email. Register first!")

    rows, _ = await compute_standings("all")
    stats = next((r for r in rows if r["player_id"] == player["id"]), None)

    raw = await db.matches.find(
        {"$or": [{"player_a_id": player["id"]}, {"player_b_id": player["id"]}]},
        {"_id": 0},
    ).sort("date", -1).to_list(1000)
    history = []
    for m in raw:
        is_a = m["player_a_id"] == player["id"]
        my_pts = m.get("points_a") if is_a else m.get("points_b")
        opp_pts = m.get("points_b") if is_a else m.get("points_a")
        history.append({
            "id": m["id"], "date": m["date"],
            "opponent": m["player_b_name"] if is_a else m["player_a_name"],
            "points": my_pts, "opponent_points": opp_pts,
            "medley_score": m["medley_score"], "official": m["official"],
            "confirmed": m.get("confirmed", True),
            "won": (my_pts or 0) > (opp_pts or 0),
        })

    today = date.today()
    upcoming = [(SEASON_START + timedelta(weeks=i)).isoformat()
                for i in range(SEASON_WEEKS)
                if (SEASON_START + timedelta(weeks=i)) >= today]

    return {
        "player": {k: player.get(k) for k in ["id", "name", "nickname", "fee_tier", "fee_amount", "paid", "email"]},
        "stats": stats,
        "history": history,
        "upcoming": upcoming,
    }


@api_router.get("/admin/matches/export")
async def export_matches(admin=Depends(require_admin)):
    matches = await db.matches.find({}, {"_id": 0}).sort("date", 1).to_list(5000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Date", "Player A", "Player B", "Medley Winner", "Medley Score",
                "Count Up Winner", "Half It Winner", "Official", "Points A", "Points B"])
    for m in matches:
        def nm(pid):
            return m["player_a_name"] if pid == m["player_a_id"] else m["player_b_name"]
        w.writerow([
            m["date"], m["player_a_name"], m["player_b_name"],
            nm(m["medley_winner_id"]), m["medley_score"],
            nm(m["countup_winner_id"]), nm(m["halfit_winner_id"]),
            "Yes" if m["official"] else "No", m.get("points_a"), m.get("points_b"),
        ])
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=belly-darts-matches.csv"})


@api_router.get("/schedule")
async def schedule():
    dates = [(SEASON_START + timedelta(weeks=i)) for i in range(SEASON_WEEKS)]
    matches = await db.matches.find({}, {"_id": 0}).to_list(5000)
    by_date = {}
    for m in matches:
        by_date.setdefault(m["date"], []).append(m)

    weeks = []
    today = date.today()
    for i, d in enumerate(dates):
        diso = d.isoformat()
        day_matches = by_date.get(diso, [])
        weeks.append({
            "week": i + 1,
            "date": diso,
            "is_finals": i == SEASON_WEEKS - 1,
            "is_past": d < today,
            "match_count": len(day_matches),
            "matches": day_matches,
        })
    return {"weeks": weeks}


# ----------------------------- Email helpers -----------------------------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    async with httpx.AsyncClient(timeout=30) as http_client:
        resp = await http_client.post(
            f"{EMAIL_BASE_URL}/api/v1/email/send",
            headers={"X-Email-Key": EMAIL_KEY},
            json=payload,
        )
    resp.raise_for_status()
    return resp.json().get("id")


def welcome_email_html(name: str, tier: str, amount: int) -> str:
    tier_label = "Early Bird" if tier == "early" else "Standard"
    return (
        '<table role="presentation" width="100%" style="background:#0F1115;padding:24px"><tr><td>'
        '<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#161B22;border-radius:16px;font-family:Arial,Helvetica,sans-serif;color:#E5E7EB">'
        '<tr><td style="padding:28px 28px 6px">'
        '<h1 style="color:#F59E0B;font-size:26px;margin:0 0 4px;text-transform:uppercase">Belly Darts League</h1>'
        '<p style="color:#9CA3AF;font-size:11px;margin:0;text-transform:uppercase;letter-spacing:2px">Belly and the Beer &middot; Hong Kong</p>'
        '</td></tr>'
        '<tr><td style="padding:10px 28px">'
        f'<p style="font-size:16px;margin:0 0 6px">Welcome to the league, <strong style="color:#fff">{escape(name)}</strong>!</p>'
        '<p style="font-size:14px;color:#9CA3AF;margin:0 0 12px">Your spot is locked in. Here are your entry details:</p>'
        '<table role="presentation" width="100%" style="background:#0F1115;border-radius:12px;margin:8px 0">'
        '<tr><td style="padding:18px 20px">'
        '<p style="margin:0 0 4px;color:#9CA3AF;font-size:12px;text-transform:uppercase;letter-spacing:1px">Entry Tier</p>'
        f'<p style="margin:0 0 14px;color:#fff;font-size:18px;font-weight:bold">{tier_label}</p>'
        '<p style="margin:0 0 4px;color:#9CA3AF;font-size:12px;text-transform:uppercase;letter-spacing:1px">Entry Fee</p>'
        f'<p style="margin:0;color:#F59E0B;font-size:30px;font-weight:bold">${amount}</p>'
        '</td></tr></table>'
        '<p style="font-size:14px;color:#E5E7EB">The season runs <strong>September 20 &ndash; December 27</strong>, every Sunday from <strong>3:00 PM to 6:00 PM</strong>. Pay your entry fee at the venue on your first matchday.</p>'
        '<p style="font-size:14px;color:#E5E7EB">See you at Belly and the Beer, 21 Elgin Street, Soho, Hong Kong. Game on!</p>'
        '</td></tr>'
        '<tr><td style="padding:10px 28px 28px">'
        '<p style="font-size:11px;color:#6B7280;border-top:1px solid rgba(255,255,255,0.12);padding-top:14px;margin:0">Sent by Belly Darts League. We never ask for your password or payment details by email.</p>'
        '</td></tr></table></td></tr></table>'
    )


async def send_welcome_email(email: str, name: str, tier: str, amount: int):
    return await send_email(
        to=email,
        subject="You're in \u2014 Belly Darts League",
        html=welcome_email_html(name, tier, amount),
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def seed_data():
    if await db.players.count_documents({}) > 0:
        return
    import random
    names = [
        ("Marcus Chan", "The Hammer"), ("Sarah Wong", "Bullseye"), ("Danny Lee", "Lucky D"),
        ("Priya Sharma", "Triple 20"), ("Tom Fischer", "The German"), ("Aisha Khan", "Sniper"),
        ("Leo Martins", "Southpaw"), ("Grace Lam", "Ice"), ("Ryan O'Brien", "Paddy"),
        ("Mei Ling", "Dragon"), ("Carlos Ruiz", "El Toro"), ("Steph Bouckaert", "Skipper"),
        ("Jasmine Ho", "Jazz"), ("Kenji Sato", "Samurai"),
    ]
    players = []
    for i, (name, nick) in enumerate(names):
        tier = "early" if i % 3 != 0 else "late"
        players.append({
            "id": str(uuid.uuid4()), "name": name, "nickname": nick,
            "email": name.lower().replace(" ", ".").replace("'", "") + "@example.com",
            "phone": "+852 9" + str(random.randint(1000000, 9999999)),
            "registered_at": now_utc().isoformat(),
            "fee_tier": tier, "fee_amount": FEE_EARLY if tier == "early" else FEE_LATE,
            "paid": random.random() > 0.25, "approved": True,
        })
    await db.players.insert_many([dict(p) for p in players])

    # generate matches across first several weeks
    dates = [(SEASON_START + timedelta(weeks=i)).isoformat() for i in range(6)]
    matches = []
    for diso in dates:
        # each matchday: sample players and create matches
        pool = random.sample(players, k=random.randint(8, 12))
        used_pairs = set()
        for _ in range(random.randint(6, 10)):
            a, b = random.sample(pool, 2)
            key = tuple(sorted([a["id"], b["id"]]) + [diso])
            if key in used_pairs:
                continue
            used_pairs.add(key)
            score = random.choice(["2-0", "2-1", "2-0", "2-1"])
            medley_w = random.choice([a["id"], b["id"]])
            m = {
                "id": str(uuid.uuid4()), "date": diso, "official": True, "confirmed": True,
                "player_a_id": a["id"], "player_a_name": a["name"],
                "player_b_id": b["id"], "player_b_name": b["name"],
                "medley_winner_id": medley_w, "medley_score": score,
                "countup_winner_id": random.choice([a["id"], b["id"]]),
                "halfit_winner_id": random.choice([a["id"], b["id"]]),
                "created_at": now_utc().isoformat(),
            }
            m["points_a"] = _points_for(m, a["id"])
            m["points_b"] = _points_for(m, b["id"])
            matches.append(m)
    if matches:
        await db.matches.insert_many([dict(m) for m in matches])
    logger.info(f"Seeded {len(players)} players and {len(matches)} matches")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
