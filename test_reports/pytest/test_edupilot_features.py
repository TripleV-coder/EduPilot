"""
EduPilot Feature Tests - Finance, RBAC, Multi-tenancy
Tests for pre-deployment validation of critical features
"""
import pytest
import requests
import os
import json

BASE_URL = "http://localhost:3000"

# Test credentials
SUPER_ADMIN_EMAIL = "admin@edupilot.com"
SUPER_ADMIN_PASSWORD = "admin123"
SCHOOL_ADMIN_EMAIL = "schooladmin@edupilot.com"
SCHOOL_ADMIN_PASSWORD = "school123"
SCHOOL_ID = "cmn35hv4u0001mzglxs1uy9up"


class AuthHelper:
    """Helper class for authentication"""
    
    @staticmethod
    def get_authenticated_session(email: str, password: str) -> requests.Session:
        """Get an authenticated session with cookies"""
        session = requests.Session()
        
        # Get CSRF token
        csrf_response = session.get(f"{BASE_URL}/api/auth/csrf")
        csrf_data = csrf_response.json()
        csrf_token = csrf_data.get("csrfToken")
        
        # Login
        login_response = session.post(
            f"{BASE_URL}/api/auth/callback/credentials",
            data={
                "csrfToken": csrf_token,
                "email": email,
                "password": password
            },
            allow_redirects=False
        )
        
        return session
    
    @staticmethod
    def get_session_info(session: requests.Session) -> dict:
        """Get current session info"""
        response = session.get(f"{BASE_URL}/api/auth/session")
        return response.json()


# ============================================
# AUTHENTICATION TESTS
# ============================================

class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_super_admin_login_success(self):
        """Test SUPER_ADMIN can login successfully"""
        session = AuthHelper.get_authenticated_session(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
        session_info = AuthHelper.get_session_info(session)
        
        assert "user" in session_info, "Session should contain user info"
        assert session_info["user"]["email"] == SUPER_ADMIN_EMAIL
        assert session_info["user"]["role"] == "SUPER_ADMIN"
        print(f"✓ SUPER_ADMIN login successful: {session_info['user']['email']}")
    
    def test_school_admin_login_success(self):
        """Test SCHOOL_ADMIN can login successfully"""
        session = AuthHelper.get_authenticated_session(SCHOOL_ADMIN_EMAIL, SCHOOL_ADMIN_PASSWORD)
        session_info = AuthHelper.get_session_info(session)
        
        assert "user" in session_info, "Session should contain user info"
        assert session_info["user"]["email"] == SCHOOL_ADMIN_EMAIL
        assert session_info["user"]["role"] == "SCHOOL_ADMIN"
        assert session_info["user"]["schoolId"] == SCHOOL_ID
        print(f"✓ SCHOOL_ADMIN login successful: {session_info['user']['email']}")
    
    def test_invalid_credentials_rejected(self):
        """Test invalid credentials are rejected"""
        session = requests.Session()
        
        # Get CSRF token
        csrf_response = session.get(f"{BASE_URL}/api/auth/csrf")
        csrf_token = csrf_response.json().get("csrfToken")
        
        # Try login with wrong password
        login_response = session.post(
            f"{BASE_URL}/api/auth/callback/credentials",
            data={
                "csrfToken": csrf_token,
                "email": "admin@edupilot.com",
                "password": "wrongpassword"
            },
            allow_redirects=False
        )
        
        # Check session is empty
        session_info = AuthHelper.get_session_info(session)
        # Session info can be None, empty dict, or dict without user
        if session_info is None:
            session_info = {}
        assert session_info.get("user") is None or "user" not in session_info or session_info == {}
        print("✓ Invalid credentials correctly rejected")


# ============================================
# RBAC TESTS
# ============================================

class TestRBAC:
    """Role-Based Access Control tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated sessions for different roles"""
        self.super_admin_session = AuthHelper.get_authenticated_session(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
        self.school_admin_session = AuthHelper.get_authenticated_session(SCHOOL_ADMIN_EMAIL, SCHOOL_ADMIN_PASSWORD)
    
    def test_super_admin_has_all_permissions(self):
        """Test SUPER_ADMIN has all required permissions"""
        session_info = AuthHelper.get_session_info(self.super_admin_session)
        permissions = session_info["user"]["permissions"]
        
        required_permissions = [
            "school:create", "school:read", "school:update", "school:delete",
            "user:create", "user:read", "user:update", "user:delete",
            "finance:create", "finance:read", "finance:update", "finance:delete",
            "payment:create", "payment:read", "payment:update", "payment:delete",
            "class:create", "class:read", "class:update", "class:delete",
            "student:create", "student:read", "student:update", "student:delete"
        ]
        
        for perm in required_permissions:
            assert perm in permissions, f"SUPER_ADMIN should have {perm} permission"
        
        print(f"✓ SUPER_ADMIN has all {len(required_permissions)} required permissions")
    
    def test_school_admin_has_school_permissions(self):
        """Test SCHOOL_ADMIN has appropriate permissions"""
        session_info = AuthHelper.get_session_info(self.school_admin_session)
        permissions = session_info["user"]["permissions"]
        
        # Should have
        should_have = [
            "school:read", "school:update",
            "user:create", "user:read", "user:update", "user:delete",
            "finance:create", "finance:read", "finance:update", "finance:delete",
            "class:create", "class:read", "class:update", "class:delete"
        ]
        
        # Should NOT have
        should_not_have = ["school:create", "school:delete"]
        
        for perm in should_have:
            assert perm in permissions, f"SCHOOL_ADMIN should have {perm} permission"
        
        for perm in should_not_have:
            assert perm not in permissions, f"SCHOOL_ADMIN should NOT have {perm} permission"
        
        print(f"✓ SCHOOL_ADMIN has correct permissions (has {len(should_have)}, missing {len(should_not_have)} as expected)")
    
    def test_super_admin_can_access_schools_api(self):
        """Test SUPER_ADMIN can access schools management API"""
        response = self.super_admin_session.get(f"{BASE_URL}/api/schools")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "data" in data, "Response should contain data"
        print(f"✓ SUPER_ADMIN can access schools API: {len(data['data'])} schools found")
    
    def test_school_admin_can_access_finance_api(self):
        """Test SCHOOL_ADMIN can access finance APIs"""
        # Finance Dashboard
        response = self.school_admin_session.get(f"{BASE_URL}/api/finance/dashboard")
        assert response.status_code == 200, f"Finance dashboard: Expected 200, got {response.status_code}"
        
        # Finance Stats
        response = self.school_admin_session.get(f"{BASE_URL}/api/finance/stats")
        assert response.status_code == 200, f"Finance stats: Expected 200, got {response.status_code}"
        
        # Finance Fees
        response = self.school_admin_session.get(f"{BASE_URL}/api/finance/fees")
        assert response.status_code == 200, f"Finance fees: Expected 200, got {response.status_code}"
        
        print("✓ SCHOOL_ADMIN can access all finance APIs")


# ============================================
# MULTI-TENANCY TESTS
# ============================================

class TestMultiTenancy:
    """Multi-tenancy isolation tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated sessions"""
        self.super_admin_session = AuthHelper.get_authenticated_session(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
        self.school_admin_session = AuthHelper.get_authenticated_session(SCHOOL_ADMIN_EMAIL, SCHOOL_ADMIN_PASSWORD)
    
    def test_school_admin_cannot_access_other_school_data(self):
        """Test SCHOOL_ADMIN cannot access data from another school"""
        fake_school_id = "fake-school-id-12345"
        
        # Try to access classes with different schoolId
        response = self.school_admin_session.get(f"{BASE_URL}/api/classes?schoolId={fake_school_id}")
        
        assert response.status_code == 403, f"Expected 403 Forbidden, got {response.status_code}"
        data = response.json()
        assert "error" in data
        assert "isolation" in data["error"].lower() or "interdit" in data["error"].lower()
        print(f"✓ Multi-tenancy isolation working: {data['error']}")
    
    def test_school_admin_cannot_access_other_school_students(self):
        """Test SCHOOL_ADMIN cannot access students from another school"""
        fake_school_id = "fake-school-id-12345"
        
        # The students API doesn't take schoolId directly, but let's verify isolation
        # by checking that the school admin only sees their school's students
        response = self.school_admin_session.get(f"{BASE_URL}/api/students")
        
        assert response.status_code == 200
        data = response.json()
        
        # All students should belong to the school admin's school
        for student in data.get("data", []):
            if student.get("user", {}).get("schoolId"):
                assert student["user"]["schoolId"] == SCHOOL_ID, \
                    f"Student {student['id']} belongs to wrong school"
        
        print(f"✓ Students API returns only school's students: {len(data.get('data', []))} students")
    
    def test_school_admin_cannot_access_other_school_finance(self):
        """Test SCHOOL_ADMIN cannot access finance data from another school"""
        fake_school_id = "fake-school-id-12345"
        
        # Try to access finance dashboard with different schoolId
        response = self.school_admin_session.get(f"{BASE_URL}/api/finance/dashboard?schoolId={fake_school_id}")
        
        assert response.status_code == 403, f"Expected 403 Forbidden, got {response.status_code}"
        print("✓ Finance API multi-tenancy isolation working")
    
    def test_super_admin_can_access_any_school(self):
        """Test SUPER_ADMIN can access any school's data"""
        # SUPER_ADMIN should be able to access data without schoolId restriction
        response = self.super_admin_session.get(f"{BASE_URL}/api/classes")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ SUPER_ADMIN can access data across schools")


# ============================================
# FINANCE MODULE TESTS
# ============================================

class TestFinanceModule:
    """Finance module API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = AuthHelper.get_authenticated_session(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    
    def test_finance_dashboard_returns_correct_structure(self):
        """Test finance dashboard returns expected data structure"""
        response = self.session.get(f"{BASE_URL}/api/finance/dashboard")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "summary" in data, "Response should contain summary"
        assert "recentPayments" in data, "Response should contain recentPayments"
        assert "overdueStudents" in data, "Response should contain overdueStudents"
        assert "paymentsTrend" in data, "Response should contain paymentsTrend"
        
        # Check summary structure
        summary = data["summary"]
        assert "totalFees" in summary
        assert "totalCollected" in summary
        assert "totalPending" in summary
        assert "collectionRate" in summary
        
        print(f"✓ Finance dashboard structure correct: totalFees={summary['totalFees']}, collectionRate={summary['collectionRate']}%")
    
    def test_finance_stats_returns_correct_structure(self):
        """Test finance stats returns expected data structure"""
        response = self.session.get(f"{BASE_URL}/api/finance/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "totalRevenue" in data
        assert "totalPending" in data
        assert "collectionRate" in data
        assert "revenueByMonth" in data
        assert "revenueByCycle" in data
        assert "revenueGrowth" in data
        assert "pendingGrowth" in data
        
        print(f"✓ Finance stats structure correct: totalRevenue={data['totalRevenue']}, revenueGrowth={data['revenueGrowth']}%")
    
    def test_finance_fees_api(self):
        """Test finance fees API"""
        response = self.session.get(f"{BASE_URL}/api/finance/fees")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return array of fees
        assert isinstance(data, list), "Fees should be a list"
        print(f"✓ Finance fees API working: {len(data)} fees found")
    
    def test_finance_payments_api(self):
        """Test finance payments API"""
        response = self.session.get(f"{BASE_URL}/api/finance/payments")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "data" in data, "Response should contain data"
        assert "meta" in data, "Response should contain meta"
        
        meta = data["meta"]
        assert "total" in meta
        assert "page" in meta
        assert "pageSize" in meta
        
        print(f"✓ Finance payments API working: {meta['total']} payments found")


# ============================================
# CLASSES MANAGEMENT TESTS
# ============================================

class TestClassesManagement:
    """Classes management API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = AuthHelper.get_authenticated_session(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    
    def test_classes_list_api(self):
        """Test classes list API"""
        response = self.session.get(f"{BASE_URL}/api/classes")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check pagination structure
        assert "data" in data
        assert "pagination" in data
        
        pagination = data["pagination"]
        assert "page" in pagination
        assert "limit" in pagination
        assert "total" in pagination
        assert "totalPages" in pagination
        
        print(f"✓ Classes API working: {pagination['total']} classes found")
    
    def test_classes_search(self):
        """Test classes search functionality"""
        response = self.session.get(f"{BASE_URL}/api/classes?search=test")
        
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        print(f"✓ Classes search working: {len(data['data'])} results for 'test'")


# ============================================
# STUDENTS MANAGEMENT TESTS
# ============================================

class TestStudentsManagement:
    """Students management API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = AuthHelper.get_authenticated_session(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    
    def test_students_list_api(self):
        """Test students list API"""
        response = self.session.get(f"{BASE_URL}/api/students")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check pagination structure
        assert "data" in data
        assert "pagination" in data
        
        # Check student structure if any exist
        if data["data"]:
            student = data["data"][0]
            assert "id" in student
            assert "matricule" in student
            assert "user" in student
            assert "firstName" in student["user"]
            assert "lastName" in student["user"]
        
        print(f"✓ Students API working: {data['pagination']['total']} students found")
    
    def test_students_search(self):
        """Test students search functionality"""
        response = self.session.get(f"{BASE_URL}/api/students?search=test")
        
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        print(f"✓ Students search working: {len(data['data'])} results for 'test'")
    
    def test_students_filter_by_status(self):
        """Test students filter by status"""
        response = self.session.get(f"{BASE_URL}/api/students?status=ACTIVE")
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned students should be active
        for student in data.get("data", []):
            if student.get("user"):
                assert student["user"]["isActive"] == True, "All students should be active"
        
        print(f"✓ Students status filter working: {len(data['data'])} active students")


# ============================================
# API SECURITY TESTS
# ============================================

class TestAPISecurity:
    """API security tests"""
    
    def test_unauthenticated_access_blocked(self):
        """Test unauthenticated requests are blocked"""
        session = requests.Session()
        
        endpoints = [
            "/api/finance/dashboard",
            "/api/finance/stats",
            "/api/finance/fees",
            "/api/classes",
            "/api/students"
        ]
        
        for endpoint in endpoints:
            response = session.get(f"{BASE_URL}{endpoint}")
            assert response.status_code in [401, 403], \
                f"Endpoint {endpoint} should require auth, got {response.status_code}"
        
        print(f"✓ All {len(endpoints)} endpoints require authentication")
    
    def test_csrf_protection(self):
        """Test CSRF protection is enabled"""
        response = requests.get(f"{BASE_URL}/api/auth/csrf")
        
        assert response.status_code == 200
        data = response.json()
        assert "csrfToken" in data
        assert len(data["csrfToken"]) > 20  # Token should be substantial
        
        print("✓ CSRF protection is enabled")


# ============================================
# DASHBOARD NAVIGATION TESTS
# ============================================

class TestDashboardNavigation:
    """Dashboard navigation API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = AuthHelper.get_authenticated_session(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    
    def test_academic_years_api(self):
        """Test academic years API"""
        response = self.session.get(f"{BASE_URL}/api/academic-years")
        
        assert response.status_code == 200
        print("✓ Academic years API accessible")
    
    def test_class_levels_api(self):
        """Test class levels API"""
        response = self.session.get(f"{BASE_URL}/api/class-levels")
        
        assert response.status_code == 200
        print("✓ Class levels API accessible")
    
    def test_schools_api(self):
        """Test schools API"""
        response = self.session.get(f"{BASE_URL}/api/schools")
        
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        print(f"✓ Schools API accessible: {len(data['data'])} schools")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
