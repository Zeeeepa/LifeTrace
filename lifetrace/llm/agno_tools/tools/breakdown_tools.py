"""Task Breakdown Tools

Tools for breaking down complex tasks into subtasks using LLM.
"""

from __future__ import annotations

import json
import re

from lifetrace.llm.agno_tools.base import get_message
from lifetrace.util.logging_config import get_logger

logger = get_logger()


class BreakdownTools:
    """Task breakdown tools mixin"""

    lang: str

    def _msg(self, key: str, **kwargs) -> str:
        return get_message(self.lang, key, **kwargs)

    def breakdown_task(self, task_description: str) -> str:
        """Break down a complex task into subtasks using LLM

        Args:
            task_description: Description of the task to break down

        Returns:
            Formatted list of suggested subtasks
        """
        try:
            from lifetrace.llm.llm_client import LLMClient

            llm_client = LLMClient()
            if not llm_client.is_available():
                return self._msg("breakdown_failed", error="LLM client not available")

            # Get prompt
            prompt = self._msg("breakdown_prompt", task_description=task_description)

            # Call LLM
            messages = [
                {"role": "system", "content": "You are a task planning assistant."},
                {"role": "user", "content": prompt},
            ]

            response_text = ""
            for chunk in llm_client.stream_chat(messages, temperature=0.7):
                response_text += chunk

            # Parse JSON from response
            json_match = re.search(r"```json\s*([\s\S]*?)\s*```", response_text)
            if json_match:
                result_json = json.loads(json_match.group(1))
            else:
                result_json = json.loads(response_text)

            # Format subtasks
            subtasks = result_json.get("subtasks", [])
            if not subtasks:
                return self._msg("breakdown_failed", error="No subtasks generated")

            formatted = []
            for i, task in enumerate(subtasks, 1):
                name = task.get("name", "Unnamed")
                desc = task.get("description", "")
                time_est = task.get("estimated_time", "")
                line = f"{i}. {name}"
                if desc:
                    line += f"\n   {desc}"
                if time_est:
                    line += f"\n   [{time_est}]"
                formatted.append(line)

            return self._msg("breakdown_result", result="\n".join(formatted))

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse breakdown response: {e}")
            return self._msg("breakdown_failed", error="Failed to parse LLM response")
        except Exception as e:
            logger.error(f"Failed to breakdown task: {e}")
            return self._msg("breakdown_failed", error=str(e))
