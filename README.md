# AI Agent System

A modern, scalable system for managing and monitoring AI agents, featuring a beautiful UI and powerful integrations.

## Features

### Core Features
- Modern, responsive UI with Material Design
- Real-time agent monitoring and management
- Project creation and management with templates
- Task distribution and monitoring
- Comprehensive metrics and analytics
- Role-based access control with JWT authentication
- WebSocket-based real-time updates
- Async task processing with RabbitMQ

### Integrations
- Discord integration for real-time updates and notifications
- Ollama integration for AI model inference
- Prometheus metrics collection
- Grafana dashboards for visualization
- Node exporter for system metrics

### System Features
- Containerized architecture using Docker
- Message queue system with RabbitMQ
- Metrics collection with Prometheus
- Beautiful dashboards with Grafana
- Automated backups and system monitoring
- Health checks for all services
- Automatic service dependency management

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 14+ (for development)
- Python 3.9+ (for development)
- Ollama (optional, for AI features)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/agent-system.git
cd agent-system
```

2. Create a .env file with the following variables:
```bash
POSTGRES_USER=projectuser
POSTGRES_PASSWORD=projectpass
POSTGRES_DB=project_db
RABBITMQ_DEFAULT_USER=guest
RABBITMQ_DEFAULT_PASS=guest
GRAFANA_ADMIN_PASSWORD=admin
```

3. Start the system:
```bash
docker-compose up -d
```

4. Access the services:
- Main UI: http://localhost:3000
- Grafana Dashboards: http://localhost:3001 (admin/admin)
- Prometheus: http://localhost:9090
- RabbitMQ Management: http://localhost:15672 (guest/guest)

### Default Credentials
- UI: admin/adminadmin
- Grafana: admin/admin
- RabbitMQ: guest/guest

### Configuration

#### Discord Integration
1. Create a Discord webhook in your server
2. Go to Settings > Integrations in the UI
3. Enable Discord integration
4. Enter your webhook URL and channel ID
5. Configure notification preferences:
   - Project updates
   - Task completion
   - System errors

#### Ollama Integration
1. Install Ollama on your host machine
2. Start the Ollama service
3. The system will automatically connect to Ollama at http://host.docker.internal:11434

## Architecture

### Components
- Frontend: React with Material-UI
- Backend: Python with Quart (async Flask)
- Message Queue: RabbitMQ
- Metrics: Prometheus & Grafana
- Database: PostgreSQL
- Agents: Python-based worker nodes
- AI: Ollama integration

### Ports
- 3000: Main UI
- 5000: Orchestrator API
- 5432: PostgreSQL
- 5672: RabbitMQ
- 15672: RabbitMQ Management
- 9090: Prometheus
- 3001: Grafana
- 9100: Node Exporter

### Directory Structure
```
project/
├── ui/                 # Frontend React application
├── orchestrator/       # Backend API and orchestration
├── worker_agent/      # Agent implementation
├── config/            # Configuration files
├── grafana/           # Grafana dashboards
├── prometheus/        # Prometheus configuration
└── tests/            # Test suites
```

## API Documentation

### Authentication
All API endpoints (except /health and /metrics) require JWT authentication.
Obtain a JWT token by sending a POST request to /api/login with:
```json
{
  "username": "admin",
  "password": "adminadmin"
}
```

### Core Endpoints
- POST `/api/login` - Authenticate and get JWT token
- GET `/api/projects` - List all projects
- POST `/api/projects` - Create new project
- GET `/api/projects/<id>` - Get project details
- PUT `/api/projects/<id>` - Update project
- DELETE `/api/projects/<id>` - Delete project
- GET `/api/agents` - List all agents
- GET `/api/metrics` - Get system metrics

### Monitoring
- GET `/health` - System health status
- GET `/metrics` - Prometheus metrics

## Development

### Local Development
1. Start dependencies:
```bash
docker-compose up -d database message_queue prometheus grafana
```

2. Start backend:
```bash
cd orchestrator
pip install -r requirements.txt
python app.py
```

3. Start frontend:
```bash
cd ui
npm install
npm start
```

### Running Tests
```bash
# Run backend tests
cd orchestrator
python -m pytest

# Run frontend tests
cd ui
npm test

# Run integration tests
cd tests
python -m pytest
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details 