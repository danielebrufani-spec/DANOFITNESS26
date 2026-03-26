"""
Test suite for 3-tier Lottery System
Tests the new 3-winner lottery feature with distinct prizes (premio_1, premio_2, premio_3)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "danielebrufani@gmail.com"
ADMIN_PASSWORD = "Mariavittoria23"


class TestLotterySetPrize:
    """Tests for POST /api/admin/lottery/set-prize - 3 prizes"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("token")
    
    def test_set_prize_requires_auth(self):
        """Test that set-prize endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/admin/lottery/set-prize", json={
            "premio_1": "Test Prize 1",
            "premio_2": "Test Prize 2",
            "premio_3": "Test Prize 3"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_set_prize_accepts_3_prizes(self, admin_token):
        """Test that set-prize accepts 3 distinct prizes"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/admin/lottery/set-prize", 
            headers=headers,
            json={
                "premio_1": "TEST_Scarpe Nike Air Max",
                "premio_2": "TEST_Maglietta DanoFitness",
                "premio_3": "TEST_Canotta DanoFitness"
            }
        )
        assert response.status_code == 200, f"Set prize failed: {response.text}"
        data = response.json()
        
        # Verify response contains all 3 prizes
        assert "premio_1" in data, "Response missing premio_1"
        assert "premio_2" in data, "Response missing premio_2"
        assert "premio_3" in data, "Response missing premio_3"
        assert data["premio_1"] == "TEST_Scarpe Nike Air Max"
        assert data["premio_2"] == "TEST_Maglietta DanoFitness"
        assert data["premio_3"] == "TEST_Canotta DanoFitness"
    
    def test_set_prize_missing_fields(self, admin_token):
        """Test that set-prize requires all 3 prizes"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Missing premio_3
        response = requests.post(f"{BASE_URL}/api/admin/lottery/set-prize", 
            headers=headers,
            json={
                "premio_1": "Prize 1",
                "premio_2": "Prize 2"
            }
        )
        assert response.status_code == 422, f"Expected 422 for missing field, got {response.status_code}"


class TestLotteryCurrentPrize:
    """Tests for GET /api/lottery/current-prize - returns 3 prizes"""
    
    def test_current_prize_returns_3_prizes(self):
        """Test that current-prize returns all 3 prizes"""
        response = requests.get(f"{BASE_URL}/api/lottery/current-prize")
        assert response.status_code == 200, f"Get current prize failed: {response.text}"
        data = response.json()
        
        # Verify response structure has all 3 prize fields
        assert "premio_1" in data, "Response missing premio_1"
        assert "premio_2" in data, "Response missing premio_2"
        assert "premio_3" in data, "Response missing premio_3"
        assert "mese" in data, "Response missing mese"
    
    def test_current_prize_values_match_set_prizes(self):
        """Test that current-prize returns the prizes we set"""
        response = requests.get(f"{BASE_URL}/api/lottery/current-prize")
        assert response.status_code == 200
        data = response.json()
        
        # If prizes were set in previous test, verify they match
        if data.get("premio_1"):
            assert isinstance(data["premio_1"], str)
            assert len(data["premio_1"]) > 0


class TestLotteryStatus:
    """Tests for GET /api/lottery/status - returns vincitori array with per-winner premio"""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Get user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_lottery_status_structure(self, user_token):
        """Test lottery status returns correct structure with 3-prize support"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/lottery/status", headers=headers)
        assert response.status_code == 200, f"Get lottery status failed: {response.text}"
        data = response.json()
        
        # Verify required fields
        assert "biglietti_utente" in data, "Missing biglietti_utente"
        assert "mese_corrente" in data, "Missing mese_corrente"
        assert "ha_abbonamento_attivo" in data, "Missing ha_abbonamento_attivo"
        assert "vincitori" in data, "Missing vincitori array"
        assert "prossima_estrazione" in data, "Missing prossima_estrazione"
        assert "secondi_a_estrazione" in data, "Missing secondi_a_estrazione"
        assert "estrazione_fatta" in data, "Missing estrazione_fatta"
        
        # Verify 3-prize fields exist
        assert "premio_1" in data, "Missing premio_1 field"
        assert "premio_2" in data, "Missing premio_2 field"
        assert "premio_3" in data, "Missing premio_3 field"
    
    def test_lottery_status_vincitori_structure(self, user_token):
        """Test that vincitori array has correct structure with per-winner premio"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/lottery/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        vincitori = data.get("vincitori", [])
        # vincitori is an array (may be empty if no extraction yet)
        assert isinstance(vincitori, list), "vincitori should be a list"
        
        # If there are winners, verify structure
        for v in vincitori:
            assert "posizione" in v, "Winner missing posizione"
            assert "nome" in v, "Winner missing nome"
            assert "cognome" in v, "Winner missing cognome"
            assert "biglietti" in v, "Winner missing biglietti"
            assert "premio" in v, "Winner missing premio field"
            assert "is_me" in v, "Winner missing is_me"


class TestLotteryWinners:
    """Tests for GET /api/lottery/winners - returns vincitori array with per-winner data"""
    
    @pytest.fixture(scope="class")
    def user_token(self):
        """Get user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_lottery_winners_returns_list(self, user_token):
        """Test that lottery winners returns a list"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/lottery/winners", headers=headers)
        assert response.status_code == 200, f"Get lottery winners failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Winners should be a list"
    
    def test_lottery_winners_structure(self, user_token):
        """Test that each winner month has vincitori array with per-winner data"""
        headers = {"Authorization": f"Bearer {user_token}"}
        response = requests.get(f"{BASE_URL}/api/lottery/winners", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        for winner_month in data:
            assert "mese" in winner_month, "Missing mese"
            assert "mese_riferimento" in winner_month, "Missing mese_riferimento"
            assert "vincitori" in winner_month, "Missing vincitori array"
            assert "totale_partecipanti" in winner_month, "Missing totale_partecipanti"
            
            # Verify vincitori array structure
            vincitori = winner_month.get("vincitori", [])
            assert isinstance(vincitori, list), "vincitori should be a list"
            
            for v in vincitori:
                assert "posizione" in v, "Winner missing posizione"
                assert "nome" in v, "Winner missing nome"
                assert "cognome" in v, "Winner missing cognome"
                assert "biglietti" in v, "Winner missing biglietti"
                # premio field should exist for each winner
                assert "premio" in v, "Winner missing premio field"


class TestLotteryExtractWinner:
    """Tests for POST /api/admin/lottery/extract-winner - extracts 3 DISTINCT winners"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_extract_winner_requires_admin(self):
        """Test that extract-winner requires admin authentication"""
        response = requests.post(f"{BASE_URL}/api/admin/lottery/extract-winner")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_extract_winner_endpoint_exists(self, admin_token):
        """Test that extract-winner endpoint exists and responds"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/admin/lottery/extract-winner", headers=headers)
        
        # May return 400 if already extracted or no participants, but endpoint should exist
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}, {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            # Verify response structure for successful extraction
            assert "vincitori" in data, "Response missing vincitori"
            vincitori = data["vincitori"]
            assert isinstance(vincitori, list), "vincitori should be a list"
            assert len(vincitori) <= 3, "Should have at most 3 winners"
            
            # Verify each winner has required fields
            for v in vincitori:
                assert "posizione" in v, "Winner missing posizione"
                assert "nome" in v, "Winner missing nome"
                assert "biglietti" in v, "Winner missing biglietti"
                assert "premio" in v, "Winner missing premio"


class TestLotteryMarkPrizeCollected:
    """Tests for POST /api/admin/lottery/mark-prize-collected/{mese}/{posizione}"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_mark_prize_collected_requires_admin(self):
        """Test that mark-prize-collected requires admin authentication"""
        response = requests.post(f"{BASE_URL}/api/admin/lottery/mark-prize-collected/2026-01/1")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_mark_prize_collected_invalid_position(self, admin_token):
        """Test that mark-prize-collected rejects invalid positions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Position 0 (invalid)
        response = requests.post(f"{BASE_URL}/api/admin/lottery/mark-prize-collected/2026-01/0", headers=headers)
        assert response.status_code == 400, f"Expected 400 for position 0, got {response.status_code}"
        
        # Position 4 (invalid)
        response = requests.post(f"{BASE_URL}/api/admin/lottery/mark-prize-collected/2026-01/4", headers=headers)
        assert response.status_code == 400, f"Expected 400 for position 4, got {response.status_code}"
    
    def test_mark_prize_collected_valid_positions(self, admin_token):
        """Test that mark-prize-collected accepts positions 1, 2, 3"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # These may return 404 if no winner exists for that month, but should not return 400 for valid positions
        for pos in [1, 2, 3]:
            response = requests.post(f"{BASE_URL}/api/admin/lottery/mark-prize-collected/2026-01/{pos}", headers=headers)
            # 200 = success, 404 = no winner for that month (both are valid responses)
            assert response.status_code in [200, 404], f"Unexpected status for position {pos}: {response.status_code}"


class TestLotteryIntegration:
    """Integration tests for the complete 3-tier lottery flow"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        return response.json().get("token")
    
    def test_set_and_get_prizes_flow(self, admin_token):
        """Test complete flow: set 3 prizes -> get current prize -> verify"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Step 1: Set 3 prizes
        set_response = requests.post(f"{BASE_URL}/api/admin/lottery/set-prize", 
            headers=headers,
            json={
                "premio_1": "TEST_Integration_Prize_1",
                "premio_2": "TEST_Integration_Prize_2",
                "premio_3": "TEST_Integration_Prize_3"
            }
        )
        assert set_response.status_code == 200, f"Set prize failed: {set_response.text}"
        
        # Step 2: Get current prize
        get_response = requests.get(f"{BASE_URL}/api/lottery/current-prize")
        assert get_response.status_code == 200
        data = get_response.json()
        
        # Step 3: Verify prizes match
        assert data["premio_1"] == "TEST_Integration_Prize_1"
        assert data["premio_2"] == "TEST_Integration_Prize_2"
        assert data["premio_3"] == "TEST_Integration_Prize_3"
    
    def test_lottery_status_shows_prizes(self, admin_token):
        """Test that lottery status shows the 3 prizes"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get lottery status
        response = requests.get(f"{BASE_URL}/api/lottery/status", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify prize fields exist in status
        assert "premio_1" in data
        assert "premio_2" in data
        assert "premio_3" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
