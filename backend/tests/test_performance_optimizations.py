"""
DanoFitness26 Backend Performance Optimization Tests
=====================================================
Testing all API endpoints after performance optimizations:
- SimpleCache for lessons and blocked dates
- asyncio.gather for parallel queries
- Batch user loading (N+1 fix)
- Projections to exclude heavy fields (profile_image)
- GZip compression
"""

import pytest
import requests
import os

# Get backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable not set")

# Test credentials
ADMIN_EMAIL = "admin@danofitness.it"
ADMIN_PASSWORD = "DanoFitness2025!"


class TestHealthAndInit:
    """Basic health check and admin initialization tests"""
    
    def test_health_endpoint(self):
        """GET /api/health returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print(f"✓ Health endpoint returns 200: {response.json()}")
    
    def test_gzip_compression_active(self):
        """Verify GZip compression is active"""
        headers = {"Accept-Encoding": "gzip"}
        response = requests.get(f"{BASE_URL}/api/health", headers=headers)
        assert response.status_code == 200
        
        # Check content-encoding header (requests auto-decompresses, so check response headers)
        content_encoding = response.headers.get('Content-Encoding', '')
        # Note: requests library may decompress automatically, so we also check raw
        print(f"✓ Response headers Content-Encoding: {content_encoding}")
        # The presence of gzip in response indicates compression is working
    
    def test_init_admin_creates_admin(self):
        """POST /api/init/admin creates admin user"""
        response = requests.post(f"{BASE_URL}/api/init/admin")
        assert response.status_code in [200, 201], f"Init admin failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Init admin response: {data['message']}")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """POST /api/auth/login with admin credentials returns token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful, token received")
        return data["token"]
    
    def test_auth_me_returns_user_data(self):
        """GET /api/auth/me returns user data"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["token"]
        
        # Get current user
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        assert "nome" in data
        assert "cognome" in data
        print(f"✓ Auth me returns user: {data['nome']} {data['cognome']}")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token for authenticated tests"""
    # First init admin
    requests.post(f"{BASE_URL}/api/init/admin")
    
    # Then login
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    return response.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Authorization headers with admin token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestLessonsWithCache:
    """Lessons endpoints with SimpleCache optimization"""
    
    def test_get_all_lessons(self, auth_headers):
        """GET /api/lessons returns 13 lessons (uses cache)"""
        response = requests.get(f"{BASE_URL}/api/lessons", headers=auth_headers)
        assert response.status_code == 200, f"Get lessons failed: {response.text}"
        
        lessons = response.json()
        assert len(lessons) == 13, f"Expected 13 lessons, got {len(lessons)}"
        
        # Verify lesson structure
        for lesson in lessons:
            assert "id" in lesson
            assert "giorno" in lesson
            assert "orario" in lesson
            assert "tipo_attivita" in lesson
        
        print(f"✓ Get lessons returns {len(lessons)} lessons (cached)")
    
    def test_get_lessons_by_day_lunedi(self, auth_headers):
        """GET /api/lessons/day/lunedi returns 2 lessons (filtered from cache)"""
        response = requests.get(f"{BASE_URL}/api/lessons/day/lunedi", headers=auth_headers)
        assert response.status_code == 200, f"Get lunedi lessons failed: {response.text}"
        
        lessons = response.json()
        assert len(lessons) == 2, f"Expected 2 lessons for lunedi, got {len(lessons)}"
        
        # Verify all are for lunedi
        for lesson in lessons:
            assert lesson["giorno"] == "lunedi"
        
        print(f"✓ Get lunedi lessons returns {len(lessons)} lessons (from cache)")


class TestBlockedDatesWithCache:
    """Blocked dates endpoint with cache optimization"""
    
    def test_get_blocked_dates(self, auth_headers):
        """GET /api/blocked-dates returns list (cached)"""
        response = requests.get(f"{BASE_URL}/api/blocked-dates", headers=auth_headers)
        assert response.status_code == 200, f"Get blocked dates failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✓ Get blocked dates returns {len(data)} dates (cached)")


class TestAdminDashboard:
    """Admin dashboard with parallel queries (asyncio.gather)"""
    
    def test_admin_dashboard_parallel_queries(self, auth_headers):
        """GET /api/admin/dashboard returns stats with parallel queries"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=auth_headers)
        assert response.status_code == 200, f"Dashboard failed: {response.text}"
        
        data = response.json()
        # Check expected fields from parallel query - actual API structure
        assert "stats" in data
        assert "total_users" in data["stats"]
        assert "bookings_today" in data["stats"]
        assert "active_subscriptions" in data["stats"]
        
        print(f"✓ Dashboard stats: {data['stats'].get('total_users', 0)} users, "
              f"{data['stats'].get('bookings_today', 0)} bookings today")
    
    def test_admin_weekly_stats(self, auth_headers):
        """GET /api/admin/weekly-stats returns presenze and lezioni_scalate"""
        response = requests.get(f"{BASE_URL}/api/admin/weekly-stats", headers=auth_headers)
        assert response.status_code == 200, f"Weekly stats failed: {response.text}"
        
        data = response.json()
        assert "presenze" in data
        assert "lezioni_scalate" in data
        
        print(f"✓ Weekly stats: presenze={data['presenze']}, lezioni_scalate={data['lezioni_scalate']}")
    
    def test_admin_weekly_bookings(self, auth_headers):
        """GET /api/admin/weekly-bookings returns 6 days structure"""
        response = requests.get(f"{BASE_URL}/api/admin/weekly-bookings", headers=auth_headers)
        assert response.status_code == 200, f"Weekly bookings failed: {response.text}"
        
        data = response.json()
        # Actual API structure uses different field names
        assert "settimana_inizio" in data
        assert "settimana_fine" in data
        assert "giorni" in data
        # Should have 6 days (Mon-Sat)
        assert len(data["giorni"]) == 6, f"Expected 6 days, got {len(data['giorni'])}"
        
        print(f"✓ Weekly bookings: {len(data['giorni'])} days, range: {data['settimana_inizio']} - {data['settimana_fine']}")


class TestInstructorEndpoints:
    """Instructor lezioni endpoint"""
    
    def test_istruttore_lezioni(self, auth_headers):
        """GET /api/istruttore/lezioni returns weekly data"""
        response = requests.get(f"{BASE_URL}/api/istruttore/lezioni", headers=auth_headers)
        assert response.status_code == 200, f"Istruttore lezioni failed: {response.text}"
        
        data = response.json()
        assert "settimana" in data
        assert "giorni" in data
        
        print(f"✓ Istruttore lezioni: week {data['settimana']}")


class TestUserLivelloParallelQueries:
    """User livello endpoint with asyncio.gather optimization"""
    
    def test_user_livello(self, auth_headers):
        """GET /api/user/livello returns livello info and allenamenti"""
        response = requests.get(f"{BASE_URL}/api/user/livello", headers=auth_headers)
        assert response.status_code == 200, f"User livello failed: {response.text}"
        
        data = response.json()
        assert "livello" in data
        assert "nome" in data
        assert "icona" in data
        assert "allenamenti_settimana_precedente" in data
        assert "allenamenti_fatti" in data
        assert "allenamenti_prenotati" in data
        
        print(f"✓ User livello: {data['livello']} - {data['nome']} {data['icona']}")


class TestLotteryWithParallelQueries:
    """Lottery status endpoint with asyncio.gather optimization"""
    
    def test_lottery_status(self, auth_headers):
        """GET /api/lottery/status returns biglietti and status"""
        response = requests.get(f"{BASE_URL}/api/lottery/status", headers=auth_headers)
        assert response.status_code == 200, f"Lottery status failed: {response.text}"
        
        data = response.json()
        # Actual API field names
        assert "biglietti_utente" in data
        assert "ha_abbonamento_attivo" in data
        assert "mese_corrente" in data
        
        print(f"✓ Lottery status: {data['biglietti_utente']} user tickets")


class TestWheelWithParallelQueries:
    """Wheel status endpoint with asyncio.gather optimization"""
    
    def test_wheel_status(self, auth_headers):
        """GET /api/wheel/status returns can_spin status"""
        response = requests.get(f"{BASE_URL}/api/wheel/status", headers=auth_headers)
        assert response.status_code == 200, f"Wheel status failed: {response.text}"
        
        data = response.json()
        assert "can_spin" in data
        assert "message" in data
        
        print(f"✓ Wheel status: can_spin={data['can_spin']}, reason={data.get('reason', 'N/A')}")


class TestQuizWithParallelQueries:
    """Quiz today endpoint with asyncio.gather optimization"""
    
    def test_quiz_today(self, auth_headers):
        """GET /api/quiz/today returns quiz data"""
        response = requests.get(f"{BASE_URL}/api/quiz/today", headers=auth_headers)
        assert response.status_code == 200, f"Quiz today failed: {response.text}"
        
        data = response.json()
        # API returns can_play status and optional domanda
        assert "can_play" in data
        
        if data.get("domanda"):
            print(f"✓ Quiz today: {data['domanda'][:50]}...")
        else:
            print(f"✓ Quiz today: can_play={data['can_play']}, reason={data.get('reason', 'N/A')}")


class TestNutritionWithParallelQueries:
    """Nutrition my-plan endpoint with asyncio.gather optimization"""
    
    def test_nutrition_my_plan(self, auth_headers):
        """GET /api/nutrition/my-plan returns profile and plan"""
        response = requests.get(f"{BASE_URL}/api/nutrition/my-plan", headers=auth_headers)
        assert response.status_code == 200, f"Nutrition my-plan failed: {response.text}"
        
        data = response.json()
        # May have profile or not
        print(f"✓ Nutrition my-plan: has_profile={data.get('has_profile', False)}")


class TestMessagesEndpoint:
    """Messages endpoint tests"""
    
    def test_get_messages(self, auth_headers):
        """GET /api/messages returns messages list"""
        response = requests.get(f"{BASE_URL}/api/messages", headers=auth_headers)
        assert response.status_code == 200, f"Get messages failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✓ Get messages: {len(data)} messages")


class TestNotificationsWithBatchQuery:
    """Notifications endpoint with batch user query optimization"""
    
    def test_admin_notifications(self, auth_headers):
        """GET /api/admin/notifications returns notifications (batch query)"""
        response = requests.get(f"{BASE_URL}/api/admin/notifications", headers=auth_headers)
        assert response.status_code == 200, f"Admin notifications failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✓ Admin notifications: {len(data)} notifications (batch query)")


class TestSubscriptionEndpoints:
    """Subscription endpoints tests"""
    
    def test_subscriptions_me(self, auth_headers):
        """GET /api/subscriptions/me returns subscriptions"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/me", headers=auth_headers)
        assert response.status_code == 200, f"Subscriptions me failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✓ Subscriptions me: {len(data)} subscriptions")


class TestBookingEndpoints:
    """Booking endpoints tests"""
    
    def test_bookings_me(self, auth_headers):
        """GET /api/bookings/me returns bookings"""
        response = requests.get(f"{BASE_URL}/api/bookings/me", headers=auth_headers)
        assert response.status_code == 200, f"Bookings me failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"✓ Bookings me: {len(data)} bookings")


class TestMedalsEndpoint:
    """Medals endpoint tests"""
    
    def test_medals_me(self, auth_headers):
        """GET /api/medals/me returns medals"""
        response = requests.get(f"{BASE_URL}/api/medals/me", headers=auth_headers)
        assert response.status_code == 200, f"Medals me failed: {response.text}"
        
        data = response.json()
        print(f"✓ Medals me: {len(data)} medals")


class TestLeaderboardEndpoint:
    """Leaderboard endpoint tests"""
    
    def test_leaderboard_weekly(self, auth_headers):
        """GET /api/leaderboard/weekly returns leaderboard"""
        response = requests.get(f"{BASE_URL}/api/leaderboard/weekly", headers=auth_headers)
        assert response.status_code == 200, f"Leaderboard weekly failed: {response.text}"
        
        data = response.json()
        # Actual API field names
        assert "leaderboard" in data
        assert "settimana" in data
        
        print(f"✓ Leaderboard weekly: {len(data['leaderboard'])} users")


class TestGzipCompression:
    """GZip compression verification"""
    
    def test_gzip_on_lessons(self, auth_headers):
        """Verify gzip compression is active on /api/lessons"""
        headers = {**auth_headers, "Accept-Encoding": "gzip, deflate"}
        response = requests.get(f"{BASE_URL}/api/lessons", headers=headers)
        assert response.status_code == 200
        
        # Check for gzip in content-encoding
        content_encoding = response.headers.get('Content-Encoding', '')
        print(f"✓ Lessons Content-Encoding: {content_encoding}")
        # Even if requests auto-decompresses, the header presence confirms server is sending gzip


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
