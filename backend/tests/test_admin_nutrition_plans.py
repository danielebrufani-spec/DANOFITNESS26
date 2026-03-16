"""
Admin Piani AI (Nutrition Plans) Tests
======================================
Tests for the admin nutrition plans features:
- Search bar to find plans by client name
- Client profile cards showing: sesso, età, altezza, peso, obiettivo, calorie, macro, intolleranze
- Reset plan button functionality
- GET /api/admin/nutrition/plans returns profile data without full plan text
"""

import pytest
import requests
import os

# Get backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable not set")

# Test credentials (admin)
ADMIN_EMAIL = "danielebrufani@gmail.com"
ADMIN_PASSWORD = "Mariavittoria23"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token for authenticated tests"""
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


class TestAdminLogin:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """POST /api/auth/login with admin credentials returns token and admin role"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["role"] == "admin", f"Expected admin role, got {data['user']['role']}"
        print(f"✓ Admin login successful: {data['user']['nome']} {data['user']['cognome']}")


class TestAdminNutritionPlans:
    """Admin Piani AI endpoint tests"""
    
    def test_get_nutrition_plans_returns_plans_list(self, auth_headers):
        """GET /api/admin/nutrition/plans returns plans with profile data"""
        response = requests.get(f"{BASE_URL}/api/admin/nutrition/plans", headers=auth_headers)
        assert response.status_code == 200, f"Get plans failed: {response.text}"
        
        data = response.json()
        
        # Check required fields in response
        assert "mese" in data, "Missing 'mese' field"
        assert "piani_generati" in data, "Missing 'piani_generati' field"
        assert "profili_totali" in data, "Missing 'profili_totali' field"
        assert "plans" in data, "Missing 'plans' field"
        assert isinstance(data["plans"], list), "plans should be a list"
        
        print(f"✓ Nutrition plans response: mese={data['mese']}, profili={data['profili_totali']}, piani={data['piani_generati']}")
    
    def test_nutrition_plans_excludes_full_plan_text(self, auth_headers):
        """GET /api/admin/nutrition/plans should exclude 'piano' field for performance"""
        response = requests.get(f"{BASE_URL}/api/admin/nutrition/plans", headers=auth_headers)
        assert response.status_code == 200, f"Get plans failed: {response.text}"
        
        data = response.json()
        
        # Each plan should NOT contain the full 'piano' text
        for plan in data.get("plans", []):
            assert "piano" not in plan, "Full 'piano' text should be excluded from response"
        
        print(f"✓ Plans list excludes full 'piano' text for {len(data.get('plans', []))} plans")
    
    def test_nutrition_plans_include_profile_data(self, auth_headers):
        """GET /api/admin/nutrition/plans should include profile_at_generation with full profile data"""
        response = requests.get(f"{BASE_URL}/api/admin/nutrition/plans", headers=auth_headers)
        assert response.status_code == 200, f"Get plans failed: {response.text}"
        
        data = response.json()
        plans = data.get("plans", [])
        
        if len(plans) == 0:
            pytest.skip("No plans found to validate profile data")
        
        # Check first plan for profile data
        plan = plans[0]
        
        # Verify basic plan fields
        assert "user_id" in plan, "Missing 'user_id' in plan"
        assert "user_nome" in plan, "Missing 'user_nome' in plan"
        assert "user_cognome" in plan, "Missing 'user_cognome' in plan"
        
        # Verify profile_at_generation exists with required fields
        assert "profile_at_generation" in plan, "Missing 'profile_at_generation' in plan"
        profile = plan["profile_at_generation"]
        
        # Check profile fields required for the UI cards
        expected_fields = ["sesso", "eta", "altezza", "peso", "obiettivo", 
                         "calorie_giornaliere", "proteine_g", "carboidrati_g", 
                         "grassi_g", "intolleranze"]
        
        for field in expected_fields:
            assert field in profile, f"Missing '{field}' in profile_at_generation"
        
        print(f"✓ Plan for {plan['user_nome']} {plan['user_cognome']} includes all profile fields:")
        print(f"  - Sesso: {profile.get('sesso')}")
        print(f"  - Età: {profile.get('eta')} anni")
        print(f"  - Altezza: {profile.get('altezza')} cm")
        print(f"  - Peso: {profile.get('peso')} kg")
        print(f"  - Obiettivo: {profile.get('obiettivo')}")
        print(f"  - Calorie: {profile.get('calorie_giornaliere')} kcal")
        print(f"  - P/C/G: {profile.get('proteine_g')}g / {profile.get('carboidrati_g')}g / {profile.get('grassi_g')}g")
        print(f"  - Intolleranze: {profile.get('intolleranze', [])}")
    
    def test_nutrition_plan_marco_bianchi_exists(self, auth_headers):
        """Verify test data: Marco Bianchi plan exists with expected profile"""
        response = requests.get(f"{BASE_URL}/api/admin/nutrition/plans", headers=auth_headers)
        assert response.status_code == 200, f"Get plans failed: {response.text}"
        
        data = response.json()
        plans = data.get("plans", [])
        
        # Find Marco Bianchi's plan
        marco_plan = None
        for plan in plans:
            if plan.get("user_nome") == "Marco" and plan.get("user_cognome") == "Bianchi":
                marco_plan = plan
                break
        
        assert marco_plan is not None, "Marco Bianchi plan not found in nutrition plans"
        
        profile = marco_plan.get("profile_at_generation", {})
        
        # Verify expected values for Marco Bianchi
        assert profile.get("sesso") == "M", f"Expected sesso=M, got {profile.get('sesso')}"
        assert profile.get("eta") == 30, f"Expected eta=30, got {profile.get('eta')}"
        assert profile.get("altezza") == 178, f"Expected altezza=178, got {profile.get('altezza')}"
        assert profile.get("peso") == 75, f"Expected peso=75, got {profile.get('peso')}"
        assert profile.get("obiettivo") == "dimagrire", f"Expected obiettivo=dimagrire, got {profile.get('obiettivo')}"
        assert "lattosio" in profile.get("intolleranze", []), "Expected 'lattosio' in intolleranze"
        
        # Check calorie/macro approximate values
        assert abs(profile.get("calorie_giornaliere", 0) - 1649) < 10, "Calorie should be ~1649"
        
        print(f"✓ Marco Bianchi plan verified with correct profile data")


class TestResetPlanEndpoint:
    """Reset plan endpoint tests"""
    
    def test_reset_plan_nonexistent_user_returns_404(self, auth_headers):
        """DELETE /api/admin/nutrition/reset-plan/{user_id} returns 404 for nonexistent user"""
        response = requests.delete(
            f"{BASE_URL}/api/admin/nutrition/reset-plan/nonexistent_user_123",
            headers=auth_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        print(f"✓ Reset plan returns 404 for nonexistent user: {data['detail']}")
    
    def test_reset_plan_requires_admin(self):
        """DELETE /api/admin/nutrition/reset-plan/{user_id} requires admin authentication"""
        # Without auth
        response = requests.delete(f"{BASE_URL}/api/admin/nutrition/reset-plan/test123")
        assert response.status_code == 403 or response.status_code == 401, \
            f"Expected 401/403 without auth, got {response.status_code}"
        
        print(f"✓ Reset plan requires authentication (got {response.status_code})")


class TestSearchFunctionality:
    """Search functionality tests for filtering plans by client name"""
    
    def test_plans_return_user_names_for_search(self, auth_headers):
        """Plans include user_nome and user_cognome for frontend search filtering"""
        response = requests.get(f"{BASE_URL}/api/admin/nutrition/plans", headers=auth_headers)
        assert response.status_code == 200, f"Get plans failed: {response.text}"
        
        data = response.json()
        plans = data.get("plans", [])
        
        for plan in plans:
            assert "user_nome" in plan, f"Plan missing user_nome"
            assert "user_cognome" in plan, f"Plan missing user_cognome"
            # Names should not be empty
            assert plan["user_nome"], "user_nome is empty"
            assert plan["user_cognome"], "user_cognome is empty"
        
        print(f"✓ All {len(plans)} plans include user_nome and user_cognome for search")
    
    def test_search_by_name_frontend_filter(self, auth_headers):
        """Frontend search filters by user_nome and user_cognome"""
        response = requests.get(f"{BASE_URL}/api/admin/nutrition/plans", headers=auth_headers)
        assert response.status_code == 200, f"Get plans failed: {response.text}"
        
        data = response.json()
        plans = data.get("plans", [])
        
        # Simulate frontend search for "Marco"
        search_term = "marco"
        filtered = [p for p in plans if 
                    search_term.lower() in f"{p.get('user_nome', '')} {p.get('user_cognome', '')}".lower()]
        
        assert len(filtered) >= 1, "Search for 'marco' should find at least 1 plan"
        print(f"✓ Search for 'marco' returns {len(filtered)} plan(s)")
        
        # Simulate frontend search with no results
        no_results = [p for p in plans if 
                      "nonexistent_name_xyz" in f"{p.get('user_nome', '')} {p.get('user_cognome', '')}".lower()]
        
        assert len(no_results) == 0, "Search for nonexistent name should return 0 results"
        print(f"✓ Search for nonexistent name returns 0 plans")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
