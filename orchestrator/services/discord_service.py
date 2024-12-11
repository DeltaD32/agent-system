import aiohttp
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class DiscordService:
    def __init__(self):
        self.webhook_url = None
        self.channel_id = None
        self.enabled = False
        self.notify_project_updates = True
        self.notify_task_completion = True
        self.notify_errors = True

    def configure(self, config: Dict[str, Any]) -> None:
        """Configure the Discord service with the provided settings"""
        self.webhook_url = config.get('webhookUrl')
        self.channel_id = config.get('channelId')
        self.enabled = config.get('enabled', False)
        self.notify_project_updates = config.get('notifyOnProjectUpdates', True)
        self.notify_task_completion = config.get('notifyOnTaskCompletion', True)
        self.notify_errors = config.get('notifyOnErrors', True)

    async def send_notification(self, content: str, title: Optional[str] = None, color: int = 0x1976d2) -> bool:
        """Send a notification to Discord using the configured webhook"""
        if not self.enabled or not self.webhook_url:
            return False

        try:
            embed = {
                "title": title if title else "AI Agent System Notification",
                "description": content,
                "color": color,
                "timestamp": datetime.utcnow().isoformat(),
                "footer": {
                    "text": "AI Agent System"
                }
            }

            payload = {
                "embeds": [embed]
            }

            if self.channel_id:
                payload["channel_id"] = self.channel_id

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    if response.status == 204:
                        logger.info("Discord notification sent successfully")
                        return True
                    else:
                        logger.error(f"Failed to send Discord notification. Status: {response.status}")
                        return False

        except Exception as e:
            logger.error(f"Error sending Discord notification: {str(e)}")
            return False

    async def notify_project_update(self, project_name: str, update_type: str, details: str) -> bool:
        """Send a project update notification"""
        if not self.notify_project_updates:
            return False

        content = f"**Project Update: {project_name}**\n"
        content += f"Type: {update_type}\n"
        content += f"Details: {details}"

        return await self.send_notification(
            content=content,
            title="Project Update",
            color=0x4caf50  # Green
        )

    async def notify_task_completed(self, task_name: str, project_name: str, result: str) -> bool:
        """Send a task completion notification"""
        if not self.notify_task_completion:
            return False

        content = f"**Task Completed: {task_name}**\n"
        content += f"Project: {project_name}\n"
        content += f"Result: {result}"

        return await self.send_notification(
            content=content,
            title="Task Completed",
            color=0x2196f3  # Blue
        )

    async def notify_error(self, error_type: str, details: str, severity: str = "error") -> bool:
        """Send an error notification"""
        if not self.notify_errors:
            return False

        content = f"**System {severity.capitalize()}: {error_type}**\n"
        content += f"Details: {details}\n"
        content += f"Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}"

        color = 0xf44336 if severity == "error" else 0xff9800  # Red for errors, Orange for warnings

        return await self.send_notification(
            content=content,
            title=f"System {severity.capitalize()}",
            color=color
        )

# Create a singleton instance
discord_service = DiscordService() 