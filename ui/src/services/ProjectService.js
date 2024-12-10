import axios from 'axios';
import { API_BASE_URL } from '../config';

class ProjectService {
    async listProjects() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/projects`);
            return response.data;
        } catch (error) {
            console.error('Error listing projects:', error);
            throw error;
        }
    }

    async createProject(projectData) {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/projects`, projectData);
            return response.data;
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    }

    async getProject(projectId) {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/projects/${projectId}`);
            return response.data;
        } catch (error) {
            console.error('Error getting project:', error);
            throw error;
        }
    }

    async updateProject(projectId, projectData) {
        try {
            const response = await axios.put(`${API_BASE_URL}/api/projects/${projectId}`, projectData);
            return response.data;
        } catch (error) {
            console.error('Error updating project:', error);
            throw error;
        }
    }

    async deleteProject(projectId) {
        try {
            const response = await axios.delete(`${API_BASE_URL}/api/projects/${projectId}`);
            return response.data;
        } catch (error) {
            console.error('Error deleting project:', error);
            throw error;
        }
    }
}

export default new ProjectService(); 