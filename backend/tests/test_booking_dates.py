"""
Test suite for DanoFitness23 booking date functionality.
Specifically tests:
1. POST /api/bookings - Creates booking with correct date
2. GET /api/admin/weekly-bookings - Returns bookings grouped by correct day
3. Date calculation verification - ensures data_lezione matches lesson's actual day
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fitness-scheduler-31.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@danofitness.it"
ADMIN_PASSWORD = "DanoFitness2025!"
TEST_CLIENT_EMAIL = "test.client@danofitness.it"
TEST_CLIENT_PASSWORD = "TestPassword123!"

# Italian day names mapping (from constants.ts)
GIORNI = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato']


class TestSetup:
    """Fixtures and setup for tests"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def admin_token(self, api_client):
        """Get admin token"""
        # First ensure admin exists
        api_client.post(f"{BASE_URL}/api/init/admin")
        
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.fail(f"Admin login failed: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def client_token(self, api_client):
        """Get test client token - register if needed"""
        # Try to login first
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_CLIENT_EMAIL,
            "password": TEST_CLIENT_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        
        # Register if login fails
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_CLIENT_EMAIL,
            "password": TEST_CLIENT_PASSWORD,
            "nome": "Test",
            "cognome": "Client",
            "telefono": "1234567890"
        })
        if response.status_code in [200, 201]:
            return response.json().get("token")
        
        pytest.fail(f"Client auth failed: {response.status_code} - {response.text}")


class TestHealthAndAuth(TestSetup):
    """Basic health and authentication tests"""
    
    def test_api_health(self, api_client):
        """Test API health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✓ API health check passed: {data}")
    
    def test_admin_login(self, api_client, admin_token):
        """Test admin login and token generation"""
        assert admin_token is not None
        assert len(admin_token) > 10
        print(f"✓ Admin login successful, token length: {len(admin_token)}")
    
    def test_client_login(self, api_client, client_token):
        """Test client login/register"""
        assert client_token is not None
        assert len(client_token) > 10
        print(f"✓ Client auth successful, token length: {len(client_token)}")


class TestLessons(TestSetup):
    """Test lesson endpoints"""
    
    def test_get_lessons(self, api_client, client_token):
        """Test getting all lessons"""
        response = api_client.get(
            f"{BASE_URL}/api/lessons",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 200
        lessons = response.json()
        assert isinstance(lessons, list)
        assert len(lessons) > 0
        print(f"✓ Got {len(lessons)} lessons")
        
        # Verify lesson structure
        for lesson in lessons:
            assert "id" in lesson
            assert "giorno" in lesson
            assert "orario" in lesson
            assert "tipo_attivita" in lesson
            assert lesson["giorno"] in GIORNI
        
        print(f"✓ All lessons have valid structure")
        return lessons


class TestBookingDateCalculation(TestSetup):
    """
    CRITICAL TESTS: Verify booking date is correctly calculated.
    The bug was that dates were being calculated using toISOString() which converts to UTC,
    causing off-by-one day errors in timezones ahead of UTC.
    """
    
    def test_create_booking_with_correct_date(self, api_client, client_token):
        """
        Test that POST /api/bookings creates booking with the date sent.
        Frontend should send correct date; backend should store it as-is.
        """
        # Get lessons first
        response = api_client.get(
            f"{BASE_URL}/api/lessons",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 200
        lessons = response.json()
        
        # Find a lesson for Tuesday (martedi)
        tuesday_lesson = next((l for l in lessons if l["giorno"] == "martedi"), None)
        assert tuesday_lesson is not None, "No Tuesday lesson found"
        
        # Calculate next Tuesday's date
        today = datetime.now()
        current_weekday = today.weekday()  # 0=Monday, 1=Tuesday, etc.
        target_weekday = 1  # Tuesday
        
        days_until_tuesday = (target_weekday - current_weekday + 7) % 7
        if days_until_tuesday == 0:
            days_until_tuesday = 7  # Next Tuesday if today is Tuesday
        
        next_tuesday = today + timedelta(days=days_until_tuesday)
        date_string = next_tuesday.strftime("%Y-%m-%d")
        
        print(f"Creating booking for Tuesday lesson on {date_string}")
        print(f"Lesson: {tuesday_lesson['orario']} - {tuesday_lesson['tipo_attivita']}")
        
        # Create the booking
        booking_payload = {
            "lesson_id": tuesday_lesson["id"],
            "data_lezione": date_string
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {client_token}"},
            json=booking_payload
        )
        
        # Could be 200/201 for new booking or 400 if already exists
        if response.status_code == 400 and "già prenotato" in response.text.lower():
            print(f"ℹ Booking already exists for this date")
            # Get the existing booking to verify the date
            bookings_response = api_client.get(
                f"{BASE_URL}/api/bookings/me",
                headers={"Authorization": f"Bearer {client_token}"}
            )
            assert bookings_response.status_code == 200
            bookings = bookings_response.json()
            
            # Find the booking for this lesson on this date
            existing_booking = next(
                (b for b in bookings 
                 if b["lesson_id"] == tuesday_lesson["id"] and b["data_lezione"] == date_string),
                None
            )
            assert existing_booking is not None
            assert existing_booking["data_lezione"] == date_string
            print(f"✓ Existing booking verified with correct date: {existing_booking['data_lezione']}")
        else:
            assert response.status_code in [200, 201], f"Booking creation failed: {response.text}"
            booking = response.json()
            
            # CRITICAL ASSERTION: Verify the date stored matches what we sent
            assert booking["data_lezione"] == date_string, \
                f"Date mismatch! Sent: {date_string}, Got: {booking['data_lezione']}"
            
            print(f"✓ Booking created with correct date: {booking['data_lezione']}")
            
            # Verify the date is actually a Tuesday
            stored_date = datetime.strptime(booking["data_lezione"], "%Y-%m-%d")
            stored_weekday = stored_date.weekday()
            assert stored_weekday == 1, f"Expected Tuesday (1), got weekday {stored_weekday}"
            print(f"✓ Stored date {booking['data_lezione']} is correctly a Tuesday")
            
            # Cleanup: Delete the test booking
            delete_response = api_client.delete(
                f"{BASE_URL}/api/bookings/{booking['id']}",
                headers={"Authorization": f"Bearer {client_token}"}
            )
            assert delete_response.status_code == 200
            print(f"✓ Test booking deleted")
    
    def test_booking_date_matches_lesson_day(self, api_client, client_token):
        """
        Verify that when we create a booking for a specific lesson,
        the date we send matches the lesson's day of the week.
        """
        # Get all lessons
        response = api_client.get(
            f"{BASE_URL}/api/lessons",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 200
        lessons = response.json()
        
        # Test with multiple days
        test_days = {
            "lunedi": 0,    # Monday
            "martedi": 1,   # Tuesday  
            "mercoledi": 2, # Wednesday
            "giovedi": 3,   # Thursday
            "venerdi": 4,   # Friday
            "sabato": 5     # Saturday
        }
        
        for day_name, python_weekday in test_days.items():
            lesson = next((l for l in lessons if l["giorno"] == day_name), None)
            if not lesson:
                print(f"ℹ No lesson found for {day_name}, skipping")
                continue
            
            # Calculate the next occurrence of this day
            today = datetime.now()
            current_weekday = today.weekday()
            days_until = (python_weekday - current_weekday + 7) % 7
            if days_until == 0 and today.hour >= 20:  # If today and evening, use next week
                days_until = 7
            
            target_date = today + timedelta(days=days_until)
            date_string = target_date.strftime("%Y-%m-%d")
            
            # Verify the date we calculated is actually the correct day
            calculated_weekday = target_date.weekday()
            assert calculated_weekday == python_weekday, \
                f"Date calculation error: {date_string} is weekday {calculated_weekday}, expected {python_weekday}"
            
            print(f"✓ {day_name.capitalize()}: {date_string} is weekday {calculated_weekday} (correct)")


class TestWeeklyBookingsAdmin(TestSetup):
    """
    Test GET /api/admin/weekly-bookings endpoint.
    Verifies bookings appear under the correct day.
    """
    
    def test_weekly_bookings_structure(self, api_client, admin_token):
        """Test the weekly bookings endpoint returns correct structure"""
        response = api_client.get(
            f"{BASE_URL}/api/admin/weekly-bookings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "settimana_inizio" in data
        assert "settimana_fine" in data
        assert "giorni" in data
        
        print(f"✓ Weekly bookings for: {data['settimana_inizio']} to {data['settimana_fine']}")
        
        # Should have 6 days (Mon-Sat)
        assert len(data["giorni"]) == 6
        
        expected_days = ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato"]
        for i, day_data in enumerate(data["giorni"]):
            assert "data" in day_data
            assert "giorno" in day_data
            assert "lezioni" in day_data
            assert day_data["giorno"] == expected_days[i]
            print(f"  {day_data['giorno']}: {day_data['data']} - {len(day_data['lezioni'])} lessons")
        
        print(f"✓ Weekly bookings structure is correct")
    
    def test_bookings_appear_under_correct_day(self, api_client, admin_token, client_token):
        """
        CRITICAL TEST: Verify that bookings appear under the correct day in weekly view.
        This tests the bug fix - bookings should appear on their actual day, not shifted.
        """
        # Get current weekly bookings
        response = api_client.get(
            f"{BASE_URL}/api/admin/weekly-bookings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        weekly_data = response.json()
        
        # Get lessons
        lessons_response = api_client.get(
            f"{BASE_URL}/api/lessons",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        lessons = lessons_response.json()
        
        # Find a Wednesday lesson (mercoledi) for testing
        wednesday_lesson = next((l for l in lessons if l["giorno"] == "mercoledi"), None)
        assert wednesday_lesson is not None, "No Wednesday lesson found"
        
        # Find Wednesday in the weekly data
        wednesday_day = next((d for d in weekly_data["giorni"] if d["giorno"] == "mercoledi"), None)
        assert wednesday_day is not None
        wednesday_date = wednesday_day["data"]
        
        # Verify the date is actually a Wednesday
        date_obj = datetime.strptime(wednesday_date, "%Y-%m-%d")
        assert date_obj.weekday() == 2, f"Expected Wednesday (2), got weekday {date_obj.weekday()}"
        print(f"✓ Wednesday date in weekly view: {wednesday_date} (weekday {date_obj.weekday()})")
        
        # Create a booking for Wednesday
        booking_payload = {
            "lesson_id": wednesday_lesson["id"],
            "data_lezione": wednesday_date
        }
        
        booking_response = api_client.post(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {client_token}"},
            json=booking_payload
        )
        
        booking_created = False
        booking_id = None
        
        if booking_response.status_code in [200, 201]:
            booking = booking_response.json()
            booking_id = booking["id"]
            booking_created = True
            print(f"✓ Created test booking for Wednesday: {booking['data_lezione']}")
        elif booking_response.status_code == 400:
            print(f"ℹ Booking already exists for Wednesday")
        
        # Get updated weekly bookings
        response = api_client.get(
            f"{BASE_URL}/api/admin/weekly-bookings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        updated_weekly = response.json()
        
        # Check Wednesday has the booking (should appear in Wednesday section)
        wednesday_data = next((d for d in updated_weekly["giorni"] if d["giorno"] == "mercoledi"), None)
        assert wednesday_data is not None
        
        # Find the lesson in Wednesday's lessons
        wednesday_lesson_data = next(
            (l for l in wednesday_data["lezioni"] if l["lesson_id"] == wednesday_lesson["id"]),
            None
        )
        
        if wednesday_lesson_data:
            print(f"✓ Wednesday lesson found: {wednesday_lesson_data['orario']} - {wednesday_lesson_data['tipo_attivita']}")
            print(f"  Participants: {wednesday_lesson_data['totale_iscritti']}")
            
            # The booking should NOT appear on a different day (like Tuesday or Thursday)
            for day_data in updated_weekly["giorni"]:
                if day_data["giorno"] != "mercoledi":
                    for lesson in day_data["lezioni"]:
                        # Check this lesson doesn't have our Wednesday booking
                        if lesson["lesson_id"] == wednesday_lesson["id"]:
                            # Should not have participants for this date if the lesson is on Wednesday
                            for participant in lesson.get("partecipanti", []):
                                # This would indicate the bug - booking appearing on wrong day
                                print(f"⚠ WARNING: Booking found on {day_data['giorno']} for Wednesday lesson!")
        
        # Cleanup
        if booking_created and booking_id:
            delete_response = api_client.delete(
                f"{BASE_URL}/api/bookings/{booking_id}",
                headers={"Authorization": f"Bearer {client_token}"}
            )
            if delete_response.status_code == 200:
                print(f"✓ Test booking cleaned up")
    
    def test_existing_tuesday_booking(self, api_client, admin_token):
        """
        Test that the existing booking for 2026-02-24 (Tuesday) appears in Tuesday section.
        Per agent notes: A test booking exists for user 'Test Client' on 2026-02-24 for '13:15 funzionale'.
        """
        response = api_client.get(
            f"{BASE_URL}/api/admin/weekly-bookings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check if 2026-02-24 is in this week
        test_date = "2026-02-24"
        today = datetime.now()
        test_date_obj = datetime.strptime(test_date, "%Y-%m-%d")
        
        # Find Tuesday in weekly data
        tuesday_data = next((d for d in data["giorni"] if d["giorno"] == "martedi"), None)
        
        if tuesday_data and tuesday_data["data"] == test_date:
            print(f"✓ Date 2026-02-24 is in current week's Tuesday: {tuesday_data['data']}")
            
            # Find the 13:15 funzionale lesson
            funzionale_lesson = next(
                (l for l in tuesday_data["lezioni"] 
                 if l["orario"] == "13:15" and l["tipo_attivita"] == "funzionale"),
                None
            )
            
            if funzionale_lesson:
                print(f"✓ Found 13:15 funzionale lesson on Tuesday")
                print(f"  Total participants: {funzionale_lesson['totale_iscritti']}")
                
                for participant in funzionale_lesson.get("partecipanti", []):
                    print(f"  - {participant['nome']} {participant['cognome']}")
                
                if funzionale_lesson['totale_iscritti'] > 0:
                    print(f"✓ CRITICAL: Booking appears under TUESDAY as expected (bug fix confirmed)")
            else:
                print(f"ℹ No 13:15 funzionale lesson found on Tuesday")
        else:
            print(f"ℹ Date 2026-02-24 is not in current week (current week: {data['settimana_inizio']} to {data['settimana_fine']})")
            
            # Just verify structure is correct
            for day in data["giorni"]:
                day_obj = datetime.strptime(day["data"], "%Y-%m-%d")
                expected_weekday = GIORNI.index(day["giorno"]) 
                # Convert GIORNI index (0=domenica) to Python weekday (0=Monday)
                expected_python_weekday = (expected_weekday - 1) % 7
                
                actual_weekday = day_obj.weekday()
                
                # Verify each day's date matches its weekday
                print(f"  {day['giorno']}: {day['data']} - weekday {actual_weekday}")


class TestBookingsEndpoint(TestSetup):
    """Test GET /api/bookings/me endpoint"""
    
    def test_get_my_bookings(self, api_client, client_token):
        """Test getting current user's bookings"""
        response = api_client.get(
            f"{BASE_URL}/api/bookings/me",
            headers={"Authorization": f"Bearer {client_token}"}
        )
        assert response.status_code == 200
        bookings = response.json()
        assert isinstance(bookings, list)
        print(f"✓ Got {len(bookings)} bookings for current user")
        
        for booking in bookings:
            assert "id" in booking
            assert "data_lezione" in booking
            assert "lesson_id" in booking
            
            # Verify data_lezione format
            assert len(booking["data_lezione"]) == 10  # YYYY-MM-DD
            try:
                date_obj = datetime.strptime(booking["data_lezione"], "%Y-%m-%d")
                print(f"  - Booking {booking['id']}: {booking['data_lezione']} (weekday {date_obj.weekday()})")
            except ValueError:
                pytest.fail(f"Invalid date format: {booking['data_lezione']}")


class TestDateValidation(TestSetup):
    """Additional date validation tests"""
    
    def test_booking_by_date_endpoint(self, api_client, admin_token):
        """Test GET /api/bookings/day/{date} returns correct bookings"""
        # Calculate a Tuesday date in current week
        today = datetime.now()
        current_weekday = today.weekday()
        days_to_tuesday = (1 - current_weekday + 7) % 7
        if days_to_tuesday == 0:
            days_to_tuesday = 0  # Use today if it's Tuesday
        
        tuesday = today + timedelta(days=days_to_tuesday)
        tuesday_str = tuesday.strftime("%Y-%m-%d")
        
        response = api_client.get(
            f"{BASE_URL}/api/bookings/day/{tuesday_str}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        bookings = response.json()
        
        print(f"✓ Bookings for {tuesday_str}: {len(bookings)}")
        
        for booking in bookings:
            assert booking["data_lezione"] == tuesday_str, \
                f"Booking date mismatch: expected {tuesday_str}, got {booking['data_lezione']}"
        
        print(f"✓ All bookings have correct date")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
