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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', '').lower()

# Season config
SEASON_YEAR = 2026
SEASON_START = date(2026, 9, 20)          # first matchday (Sunday)
SEASON_WEEKS = 15
EARLY_BIRD_CUTOFF = date(2026, 9, 12)     # sign up on/before => $100
FEE_EARLY = 100
FEE_LATE = 200

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
    query = {"official": True}
    matches = await db.matches.find(query, {"_id": 0}).to_list(5000)
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

    # available months from matches
    all_matches = await db.matches.find({"official": True}, {"_id": 0, "date": 1}).to_list(5000)
    months = sorted({m["date"][:7] for m in all_matches})
    return {"standings": rows, "months": months, "selected": month}


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
                "id": str(uuid.uuid4()), "date": diso, "official": True,
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
