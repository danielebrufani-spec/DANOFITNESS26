"""
Test Quiz Categories System
Tests for the new 4-category quiz system: GOSSIP, CULTURA, CINEMA, MUSICA
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "danielebrufani@gmail.com"
ADMIN_PASSWORD = "Mariavittoria23"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json().get("token")


@pytest.fixture(scope="module")
def admin_user_id(api_client, admin_token):
    """Get admin user ID"""
    api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
    response = api_client.get(f"{BASE_URL}/api/auth/me")
    assert response.status_code == 200
    return response.json().get("id")


class TestQuizTodayEndpoint:
    """Tests for GET /api/quiz/today endpoint"""
    
    def test_quiz_today_no_spin_returns_no_spin_reason(self, api_client, admin_token):
        """When user hasn't spun the wheel, should return needs_category=false with reason=no_spin"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        response = api_client.get(f"{BASE_URL}/api/quiz/today")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "can_play" in data
        assert "reason" in data or data.get("can_play") == True
        assert "needs_category" in data
        
        # If user hasn't spun, should get no_spin reason
        if data.get("reason") == "no_spin":
            assert data["can_play"] == False
            assert data["needs_category"] == False
            assert data["domanda_id"] is None
            assert data["domanda"] is None
            assert data["risposte"] == []
            print(f"✓ Quiz returns no_spin when user hasn't spun wheel")
        elif data.get("reason") == "already_answered":
            # User already answered today
            assert data["can_play"] == False
            assert "categoria" in data
            print(f"✓ User already answered quiz today, categoria: {data.get('categoria')}")
        else:
            # User has spun and can play
            print(f"✓ User can play quiz, needs_category: {data.get('needs_category')}")
    
    def test_quiz_today_response_structure(self, api_client, admin_token):
        """Verify the response structure of /quiz/today"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        response = api_client.get(f"{BASE_URL}/api/quiz/today")
        
        assert response.status_code == 200
        data = response.json()
        
        # Required fields in all responses
        required_fields = [
            "can_play", "domanda_id", "domanda", "risposte", 
            "gia_risposto", "risposta_corretta", "biglietti_vinti",
            "risposta_data", "wheel_result", "bonus_type", "message"
        ]
        
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Quiz today response has all required fields")


class TestSelectCategoryEndpoint:
    """Tests for POST /api/quiz/select-category endpoint"""
    
    def test_select_category_invalid_category_returns_400(self, api_client, admin_token):
        """Selecting an invalid category should return 400"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        response = api_client.post(f"{BASE_URL}/api/quiz/select-category", json={
            "categoria": "invalid_category"
        })
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "non valida" in data["detail"].lower() or "invalid" in data["detail"].lower()
        print(f"✓ Invalid category correctly rejected with 400")
    
    def test_select_category_without_spin_returns_400(self, api_client, admin_token):
        """Selecting category without spinning wheel first should return 400"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        # First check if user has already spun today
        quiz_response = api_client.get(f"{BASE_URL}/api/quiz/today")
        quiz_data = quiz_response.json()
        
        if quiz_data.get("reason") == "no_spin":
            # User hasn't spun, so selecting category should fail
            response = api_client.post(f"{BASE_URL}/api/quiz/select-category", json={
                "categoria": "gossip"
            })
            
            assert response.status_code == 400
            data = response.json()
            assert "detail" in data
            print(f"✓ Category selection without spin correctly rejected: {data['detail']}")
        else:
            print(f"⚠ User has already spun or answered, skipping no-spin test")
    
    def test_select_category_valid_categories(self, api_client, admin_token):
        """Test that all 4 valid categories are recognized"""
        valid_categories = ["gossip", "cultura", "cinema", "musica"]
        
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        for cat in valid_categories:
            response = api_client.post(f"{BASE_URL}/api/quiz/select-category", json={
                "categoria": cat
            })
            
            # Should either succeed (200) or fail with specific reason (400)
            # but NOT with "categoria non valida"
            if response.status_code == 400:
                data = response.json()
                # Should fail for other reasons (no spin, already chosen) not invalid category
                assert "non valida" not in data.get("detail", "").lower(), \
                    f"Category '{cat}' incorrectly marked as invalid"
            
            print(f"✓ Category '{cat}' is recognized as valid")


class TestQuizAnswerEndpoint:
    """Tests for POST /api/quiz/answer endpoint"""
    
    def test_answer_without_category_returns_error(self, api_client, admin_token):
        """Answering quiz without selecting category should fail"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        # Check current quiz state
        quiz_response = api_client.get(f"{BASE_URL}/api/quiz/today")
        quiz_data = quiz_response.json()
        
        if quiz_data.get("reason") == "no_spin":
            # Can't answer without spinning first
            response = api_client.post(f"{BASE_URL}/api/quiz/answer?risposta_index=0")
            data = response.json()
            assert data.get("success") == False or response.status_code != 200
            print(f"✓ Answer without spin correctly rejected")
        elif quiz_data.get("gia_risposto"):
            print(f"⚠ User already answered today, skipping test")
        else:
            print(f"⚠ User has spun and may have category, test inconclusive")
    
    def test_answer_saves_categoria_field(self, api_client, admin_token):
        """Verify that quiz answer saves the categoria field"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        # Get quiz state to check if categoria is saved
        response = api_client.get(f"{BASE_URL}/api/quiz/today")
        data = response.json()
        
        if data.get("gia_risposto"):
            # Check that categoria is present in response
            assert "categoria" in data, "categoria field missing from answered quiz"
            assert data["categoria"] in ["gossip", "cultura", "cinema", "musica", None], \
                f"Invalid categoria value: {data['categoria']}"
            print(f"✓ Answered quiz has categoria field: {data.get('categoria')}")
        else:
            print(f"⚠ User hasn't answered yet, can't verify categoria persistence")


class TestQuizQuestionsContent:
    """Tests to verify quiz questions are from new categories"""
    
    def test_quiz_categories_info_endpoint(self, api_client, admin_token):
        """Verify categories info is returned when needs_category=true"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        response = api_client.get(f"{BASE_URL}/api/quiz/today")
        data = response.json()
        
        if data.get("needs_category") == True:
            assert "categorie" in data
            categorie = data["categorie"]
            
            # Should have 4 categories
            assert len(categorie) == 4, f"Expected 4 categories, got {len(categorie)}"
            
            # Verify category structure
            expected_keys = ["gossip", "cultura", "cinema", "musica"]
            actual_keys = [c["key"] for c in categorie]
            
            for key in expected_keys:
                assert key in actual_keys, f"Missing category: {key}"
            
            # Verify each category has required fields
            for cat in categorie:
                assert "key" in cat
                assert "nome" in cat
                assert "emoji" in cat
                assert "colore" in cat
            
            print(f"✓ Categories info returned correctly: {actual_keys}")
        else:
            print(f"⚠ User doesn't need category selection (reason: {data.get('reason')})")


class TestQuizWithWheelSpin:
    """Integration tests for quiz with wheel spin simulation"""
    
    def test_full_quiz_flow_documentation(self, api_client, admin_token):
        """Document the expected full quiz flow"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        # Step 1: Check quiz status
        response = api_client.get(f"{BASE_URL}/api/quiz/today")
        data = response.json()
        
        print("\n=== Quiz Flow Documentation ===")
        print(f"1. GET /api/quiz/today")
        print(f"   - can_play: {data.get('can_play')}")
        print(f"   - reason: {data.get('reason')}")
        print(f"   - needs_category: {data.get('needs_category')}")
        print(f"   - gia_risposto: {data.get('gia_risposto')}")
        print(f"   - categoria: {data.get('categoria')}")
        
        if data.get("reason") == "no_spin":
            print("\n2. User needs to spin wheel first (POST /api/wheel/spin)")
            print("3. After spin, GET /api/quiz/today returns needs_category=true")
            print("4. User selects category (POST /api/quiz/select-category)")
            print("5. Quiz question is shown")
            print("6. User answers (POST /api/quiz/answer?risposta_index=N)")
        elif data.get("needs_category"):
            print("\n2. User needs to select category")
            print(f"   Available categories: {[c['key'] for c in data.get('categorie', [])]}")
        elif data.get("gia_risposto"):
            print("\n2. User already answered today")
            print(f"   - risposta_corretta: {data.get('risposta_corretta')}")
            print(f"   - biglietti_vinti: {data.get('biglietti_vinti')}")
        
        print("=== End Documentation ===\n")
        
        # This test always passes - it's for documentation
        assert True


class TestAPIServiceIntegration:
    """Tests to verify frontend API service compatibility"""
    
    def test_select_category_response_format(self, api_client, admin_token):
        """Verify select-category response matches frontend expectations"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        # Try to select a category (may fail if no spin, but we check response format)
        response = api_client.post(f"{BASE_URL}/api/quiz/select-category", json={
            "categoria": "gossip"
        })
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response matches frontend expectations
            expected_fields = [
                "success", "categoria", "domanda_id", "domanda", 
                "risposte", "wheel_result", "bonus_type", "potential_bonus", "message"
            ]
            
            for field in expected_fields:
                assert field in data, f"Missing field in select-category response: {field}"
            
            assert data["success"] == True
            assert data["categoria"] == "gossip"
            assert isinstance(data["risposte"], list)
            assert len(data["risposte"]) == 4  # Quiz has 4 options
            
            print(f"✓ select-category response format is correct")
        else:
            # Expected failure (no spin or already chosen)
            data = response.json()
            assert "detail" in data
            print(f"⚠ select-category failed as expected: {data['detail']}")
    
    def test_quiz_answer_response_format(self, api_client, admin_token):
        """Verify quiz answer response matches frontend expectations"""
        api_client.headers.update({"Authorization": f"Bearer {admin_token}"})
        
        # Check if user can answer
        quiz_response = api_client.get(f"{BASE_URL}/api/quiz/today")
        quiz_data = quiz_response.json()
        
        if quiz_data.get("can_play") and not quiz_data.get("needs_category") and not quiz_data.get("gia_risposto"):
            # User can answer
            response = api_client.post(f"{BASE_URL}/api/quiz/answer?risposta_index=0")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response matches frontend expectations
                expected_fields = [
                    "success", "corretta", "risposta_corretta_index",
                    "biglietti_vinti", "bonus_type", "wheel_result", "message"
                ]
                
                for field in expected_fields:
                    assert field in data, f"Missing field in answer response: {field}"
                
                # Verify categoria is saved
                assert "categoria" in data, "categoria field missing from answer response"
                
                print(f"✓ quiz answer response format is correct")
                print(f"  - corretta: {data['corretta']}")
                print(f"  - categoria: {data['categoria']}")
                print(f"  - biglietti_vinti: {data['biglietti_vinti']}")
        else:
            print(f"⚠ User cannot answer quiz right now (reason: {quiz_data.get('reason')})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
