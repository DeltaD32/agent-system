# AI Agent Orchestration System

A distributed system for managing and orchestrating AI agents using Mistral and OLLAMA, with real-time monitoring and project management capabilities.

## Features

### Core Features
- Distributed task processing with worker agents
- Project templates and task management
- Real-time monitoring and metrics
- Web-based UI for system management
- Authentication and authorization

### Project Management
- Project creation from templates
- Task assignment and tracking
- Progress monitoring
- Dependencies management
- Priority-based scheduling

### Analytics & Monitoring
- Prometheus metrics integration
- Grafana dashboards
- System health monitoring
- Agent performance tracking
- Real-time status updates

### Security
- JWT-based authentication
- Role-based access control
- Secure API endpoints
- Environment variable management

### AI Integration
- OLLAMA integration for AI tasks
- Mistral model support
- Extensible agent system
- Task result analysis

## Feature Status

### Project Management Enhancements
- ✅ Project templates - Implemented
- ⏳ Task dependencies visualization - In Progress
- ❌ Gantt chart view - Planned
- ❌ Project milestones - Planned
- ❌ File attachments - Planned
- ✅ Project comments/discussion threads - Implemented
- ✅ Project archiving - Implemented

### User Experience
- ✅ Dark/Light theme toggle - Implemented
- ✅ Customizable dashboard layouts - Implemented
- ⏳ Notification system - In Progress
- ✅ Activity feed - Implemented
- ⏳ Search functionality - In Progress
- ❌ Keyboard shortcuts - Planned
- ❌ Export data to CSV/PDF - Planned

### Collaboration Features
- ✅ Team management - Implemented
- ⏳ Real-time chat - In Progress
- ❌ Shared calendars - Planned
- ❌ Document collaboration - Planned
- ✅ @mentions in comments - Implemented
- ✅ Task assignments - Implemented
- ✅ Team permissions - Implemented

### AI Enhancements
- ✅ AI-powered task prioritization - Implemented
- ✅ Automated project status updates - Implemented
- ⏳ Smart task assignment recommendations - In Progress
- ❌ Project timeline predictions - Planned
- ✅ Natural language processing for task creation - Implemented
- ⏳ Anomaly detection in project metrics - In Progress

### Analytics & Reporting
- ✅ Custom report builder - Implemented
- ✅ Project health scores - Implemented
- ✅ Team performance metrics - Implemented
- ⏳ Resource utilization tracking - In Progress
- ❌ Cost tracking and budgeting - Planned
- ✅ Time tracking integration - Implemented
- ✅ Export capabilities - Implemented

### Integration Possibilities
- ✅ GitHub/GitLab integration - Implemented
- ❌ Calendar integration - Planned
- ⏳ Slack/Discord notifications - In Progress
- ✅ Email integration - Implemented
- ✅ CI/CD pipeline integration - Implemented
- ❌ Cloud storage integration - Planned

### Security Enhancements
- ✅ Two-factor authentication - Implemented
- ✅ OAuth integration - Implemented
- ✅ Audit logs - Implemented
- ⏳ IP whitelisting - In Progress
- ✅ Session management - Implemented
- ✅ Password policies - Implemented
- ✅ Data encryption at rest - Implemented

### Mobile Features
- ⏳ Progressive Web App (PWA) - In Progress
- ✅ Mobile-optimized views - Implemented
- ❌ Push notifications - Planned
- ❌ Offline mode - Planned
- ✅ Touch-friendly interfaces - Implemented

### Administration Tools
- ✅ System health dashboard - Implemented
- ✅ Backup/restore functionality - Implemented
- ✅ User activity logs - Implemented
- ✅ Resource usage monitoring - Implemented
- ✅ Configuration management - Implemented
- ✅ API usage metrics - Implemented

### Workflow Automation
- ✅ Custom workflow builder - Implemented
- ✅ Automated task creation - Implemented
- ✅ Email notifications - Implemented
- ⏳ Scheduled reports - In Progress
- ✅ Integration webhooks - Implemented
- ✅ Event-driven actions - Implemented

### Documentation & Help
- ⏳ Interactive tutorials - In Progress
- ✅ Contextual help - Implemented
- ✅ API documentation - Implemented
- ⏳ Knowledge base - In Progress
- ❌ Video tutorials - Planned
- ✅ Tooltips and guides - Implemented

### Performance Optimizations
- ✅ Data caching - Implemented
- ✅ Lazy loading - Implemented
- ✅ Image optimization - Implemented
- ✅ Database indexing - Implemented
- ✅ Query optimization - Implemented
- ✅ Load balancing - Implemented

## Architecture

### Components
1. **Frontend (UI)**
   - React-based web interface
   - Material-UI components
   - Real-time WebSocket updates
   - Embedded Grafana dashboards

2. **Backend (Orchestrator)**
   - Flask REST API
   - WebSocket server
   - Task distribution
   - Project management

3. **Worker Agents**
   - Distributed task processing
   - Mistral model integration
   - Automatic task queue management
   - Health reporting

4. **Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - System health checks
   - Performance tracking

5. **Message Queue**
   - RabbitMQ for task distribution
   - Durable message storage
   - Worker load balancing

6. **Database**
   - PostgreSQL for data persistence
   - Project and task storage
   - Agent state management

## Prerequisites

- Docker and Docker Compose
- OLLAMA with Mistral model installed
- Node.js 14+ (for development)
- Python 3.9+
- PostgreSQL 13+
- RabbitMQ 3+

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/agent-orchestration.git
cd agent-orchestration
```

2. Create a `.env` file:
```bash
# Database Configuration
POSTGRES_USER=projectuser
POSTGRES_PASSWORD=projectpass
POSTGRES_DB=project_db

# RabbitMQ Configuration
RABBITMQ_DEFAULT_USER=guest
RABBITMQ_DEFAULT_PASS=guest

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRATION_HOURS=24

# Grafana Configuration
GF_SECURITY_ADMIN_PASSWORD=admin
GF_AUTH_ANONYMOUS_ENABLED=true
```

3. Start the services:
```bash
docker-compose up -d
```

4. Access the services:
- UI: http://localhost:3000
- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090
- RabbitMQ Management: http://localhost:15672

## Development Setup

1. Install dependencies:
```bash
# UI dependencies
cd ui
npm install

# Orchestrator dependencies
cd ../orchestrator
pip install -r requirements.txt

# Worker dependencies
cd ../worker_agent
pip install -r requirements.txt
```

2. Start development servers:
```bash
# UI development server
cd ui
npm start

# Orchestrator development server
cd ../orchestrator
python app.py

# Worker development
cd ../worker_agent
python worker.py
```

## API Documentation

### Authentication
- POST `/api/login` - Get JWT token
- POST `/api/logout` - Invalidate token

### Projects
- GET `/api/projects` - List all projects
- POST `/api/project` - Create new project
- GET `/api/project/<id>` - Get project details
- PUT `/api/project/<id>` - Update project
- DELETE `/api/project/<id>` - Delete project

### Tasks
- GET `/api/tasks` - List all tasks
- POST `/api/tasks` - Create new task
- GET `/api/tasks/<id>` - Get task details
- PUT `/api/tasks/<id>` - Update task
- POST `/api/tasks/<id>/assign` - Assign task to agent

### Templates
- GET `/api/templates` - List all templates
- POST `/api/templates` - Create new template
- DELETE `/api/templates/<id>` - Delete template

### Monitoring
- GET `/health` - System health status
- GET `/metrics` - Prometheus metrics

## Testing

Run the test suite:
```bash
# Run backend tests
cd orchestrator
python -m pytest

# Run frontend tests
cd ../ui
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details 