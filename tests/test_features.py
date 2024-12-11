import unittest
import requests
import json
import os
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TestImplementedFeatures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.BASE_URL = os.getenv('UI_URL', 'http://localhost:3000')
        cls.API_URL = os.getenv('API_URL', 'http://localhost:5000/api')
        cls.GRAFANA_URL = os.getenv('GRAFANA_URL', 'http://localhost:3001')
        
        # Try to login and get token
        try:
            response = requests.post(f"{cls.API_URL}/login", json={
                "username": "admin",
                "password": "adminadmin"
            })
            response.raise_for_status()
            cls.token = response.json()['token']
            cls.headers = {
                'Authorization': f'Bearer {cls.token}',
                'Content-Type': 'application/json'
            }
            logger.info("Successfully authenticated")
        except Exception as e:
            logger.error(f"Failed to authenticate: {str(e)}")
            raise

    def setUp(self):
        logger.info(f"Starting test: {self._testMethodName}")

    def tearDown(self):
        logger.info(f"Finished test: {self._testMethodName}")

    def make_request(self, method, endpoint, data=None, expected_status=200):
        """Helper method to make requests with proper error handling"""
        try:
            url = f"{self.API_URL}/{endpoint}"
            logger.info(f"Making {method} request to {url}")
            
            if method.lower() == 'get':
                response = requests.get(url, headers=self.headers)
            elif method.lower() == 'post':
                response = requests.post(url, headers=self.headers, json=data)
            elif method.lower() == 'put':
                response = requests.put(url, headers=self.headers, json=data)
            elif method.lower() == 'delete':
                response = requests.delete(url, headers=self.headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            if response.status_code != expected_status:
                logger.error(f"Request failed: {response.text}")
            
            self.assertEqual(response.status_code, expected_status)
            return response
        except Exception as e:
            logger.error(f"Request failed: {str(e)}")
            raise

    def test_project_management(self):
        """Test project management features"""
        # Test project templates
        self.make_request('get', 'project-templates')
        
        # Test project creation
        project_data = {
            "name": "Test Project",
            "description": "Test project description",
            "template_id": 1
        }
        response = self.make_request('post', 'projects', project_data, 201)
        project_id = response.json()['id']
        
        # Test project archiving
        self.make_request('post', f'projects/{project_id}/archive')

    def test_user_experience(self):
        """Test user experience features"""
        self.make_request('get', 'user/preferences')
        self.make_request('get', 'dashboard/layouts')
        self.make_request('get', 'activity')

    def test_collaboration_features(self):
        """Test collaboration features"""
        self.make_request('get', 'team')
        
        task_data = {
            "title": "Test Task",
            "description": "Test task description",
            "assignee": "test_user"
        }
        self.make_request('post', 'tasks', task_data, 201)
        self.make_request('get', 'permissions')

    def test_ai_features(self):
        """Test AI-related features"""
        task_data = {
            "tasks": [
                {"id": 1, "description": "Critical bug fix"},
                {"id": 2, "description": "New feature implementation"}
            ]
        }
        self.make_request('post', 'ai/prioritize', task_data)
        self.make_request('get', 'projects/1/status')
        
        nlp_data = {
            "description": "Create a new login page with OAuth integration"
        }
        self.make_request('post', 'ai/create-task', nlp_data, 201)

    def test_analytics_reporting(self):
        """Test analytics and reporting features"""
        report_data = {
            "type": "project_progress",
            "project_id": 1,
            "date_range": "last_30_days"
        }
        self.make_request('post', 'reports/generate', report_data)
        self.make_request('get', 'projects/1/health')
        self.make_request('get', 'team/performance')

    def test_security_features(self):
        """Test security features"""
        self.make_request('get', 'session/status')
        
        password_data = {
            "password": "TestPassword123!"
        }
        self.make_request('post', 'validate-password', password_data)
        self.make_request('get', 'audit-logs')

    def test_mobile_features(self):
        """Test mobile features"""
        headers = {**self.headers, 'User-Agent': 'Mobile Device'}
        try:
            response = requests.get(f"{self.API_URL}/dashboard", headers=headers)
            self.assertEqual(response.status_code, 200)
        except Exception as e:
            logger.error(f"Mobile test failed: {str(e)}")
            raise

    def test_admin_tools(self):
        """Test administration tools"""
        self.make_request('get', 'system/health')
        self.make_request('post', 'system/backup')
        self.make_request('get', 'system/activity-logs')

    def test_workflow_automation(self):
        """Test workflow automation features"""
        workflow_data = {
            "name": "Test Workflow",
            "steps": [
                {"type": "create_task", "params": {"title": "Step 1"}},
                {"type": "notify_team", "params": {"message": "Task created"}}
            ]
        }
        self.make_request('post', 'workflows', workflow_data, 201)
        self.make_request('post', 'tasks/auto-create', None, 201)
        
        notification_data = {
            "type": "email",
            "recipient": "test@example.com",
            "subject": "Test Notification",
            "message": "This is a test notification"
        }
        self.make_request('post', 'notifications/send', notification_data)

    def test_performance_optimizations(self):
        """Test performance optimization features"""
        # Test data caching
        start_time = datetime.now()
        self.make_request('get', 'projects')
        self.make_request('get', 'projects')
        end_time = datetime.now()
        self.assertTrue((end_time - start_time).total_seconds() < 2)
        
        # Test lazy loading
        self.make_request('get', 'projects/1/tasks?page=1&limit=10')

if __name__ == '__main__':
    unittest.main() 