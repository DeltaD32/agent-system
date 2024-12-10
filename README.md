# Agent System

A distributed system for managing and orchestrating AI agents using Mistral and OLLAMA.

## Features

- Distributed task processing with worker agents
- Real-time monitoring and metrics
- Web-based UI for system management
- Prometheus metrics integration
- Grafana dashboards
- Docker containerization

## Prerequisites

- Docker and Docker Compose
- OLLAMA with Mistral model installed
- Node.js 14+ (for development)
- Python 3.9+

## Quick Start

1. Clone the repository:
```bash
git clone [repository-url]
cd project
```

2. Create a `.env` file with required environment variables:
```bash
# Database Configuration
POSTGRES_USER=projectuser
POSTGRES_PASSWORD=projectpass
POSTGRES_DB=project_db

# RabbitMQ Configuration
RABBITMQ_DEFAULT_USER=guest
RABBITMQ_DEFAULT_PASS=guest

# Grafana Configuration
GRAFANA_ADMIN_PASSWORD=your_secure_password
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

## Development

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

## Architecture

The system consists of several components:

- **UI**: React-based web interface
- **Orchestrator**: Flask-based API server
- **Worker Agents**: Python-based task processors
- **Message Queue**: RabbitMQ for task distribution
- **Database**: PostgreSQL for data storage
- **Metrics**: Prometheus and Grafana for monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License 