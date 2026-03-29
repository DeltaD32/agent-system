from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime, timezone

class Base(DeclarativeBase):
    pass

class AgentRow(Base):
    __tablename__ = "agents"
    id            = Column(String, primary_key=True)
    name          = Column(String, nullable=False)
    role          = Column(String, nullable=False)
    specialization = Column(String, default="")
    status        = Column(String, default="idle")   # idle/working/walking/blocked/consulting/dismissed
    llm_backend   = Column(String, default="auto")   # auto/local_ollama/remote_ollama/claude_api
    desk_col      = Column(Integer, default=0)
    desk_row      = Column(Integer, default=0)
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class TaskRow(Base):
    __tablename__ = "tasks"
    id            = Column(String, primary_key=True)
    agent_id      = Column(String, ForeignKey("agents.id"), nullable=False)
    description   = Column(Text, nullable=False)
    status        = Column(String, default="pending")  # pending/in_progress/done/blocked
    priority      = Column(Integer, default=1)
    requested_by  = Column(String, default="user")     # user or agent_id
    result        = Column(Text, default="")
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at  = Column(DateTime(timezone=True), nullable=True)

class ProjectRow(Base):
    __tablename__ = "projects"
    id            = Column(String, primary_key=True)
    name          = Column(String, nullable=False)
    description   = Column(Text, default="")
    status        = Column(String, default="active")
    created_at    = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
