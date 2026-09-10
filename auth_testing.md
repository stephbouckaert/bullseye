# Auth-Gated App Testing Playbook (Belly Darts League)

Admin is gated by email match against ADMIN_EMAIL (steph.bouckaert@gmail.com).

## Step 1: Create Test Admin User & Session
```
mongosh --eval "
use('test_database');
var userId = 'user_testadmin';
var sessionToken = 'test_session_admin_' + Date.now();
db.users.updateOne(
  {email: 'steph.bouckaert@gmail.com'},
  {\$set: {user_id: userId, email: 'steph.bouckaert@gmail.com', name: 'Steph Bouckaert', picture: '', created_at: new Date().toISOString()}},
  {upsert: true}
);
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('Session token: ' + sessionToken);
"
```

## Step 2: Test Backend
```
curl -X GET "$URL/api/auth/me" -H "Authorization: Bearer <TOKEN>"
curl -X POST "$URL/api/admin/matches" -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{...}'
```

## Step 3: Browser Testing
```
await page.context.add_cookies([{ "name":"session_token","value":"<TOKEN>","domain":"<host>","path":"/","httpOnly":true,"secure":true,"sameSite":"None" }])
await page.goto("<URL>/admin")
```

## Public endpoints (no auth): /api/league/info, /api/players, /api/matches, /api/standings, /api/schedule, POST /api/players/register
```
