#!/usr/bin/env python3
"""
KinEcho 老人端 MCP Server (简化版)
直接通过服务端API对接，无需传递 family_id 和 elderly_id
适用于一对一家属-老人关系
"""

import os
import sys
import json
import logging
import requests
from typing import Any, Dict, List, Optional

try:
    from mcp.server import Server
    from mcp.types import Tool, TextContent
    import mcp.server.stdio
except ImportError:
    print("MCP库未安装，请运行: pip install mcp")
    sys.exit(1)

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("elderly_mcp")

# KinEcho 服务端API地址
API_BASE_URL = os.getenv('KINECHO_API_URL', 'http://127.0.0.1:8000')
DEFAULT_FAMILY_ID = os.getenv('KINECHO_FAMILY_ID', 'family_001')
DEFAULT_ELDERLY_ID = int(os.getenv('KINECHO_ELDERLY_ID', '1'))  # 默认老人ID为1

class ElderlyMCPManager:
    """老人端MCP管理核心类 - 简化版"""

    def __init__(self):
        self.api_base_url = API_BASE_URL
        self.family_id = DEFAULT_FAMILY_ID
        self.elderly_id = DEFAULT_ELDERLY_ID  # 一对一关系，使用固定的elderly_id
        logger.info(f"MCP Manager initialized: API={self.api_base_url}, Family={self.family_id}, Elderly={self.elderly_id}")

    # ==================== 联系家属功能 ====================

    def contact_family(self, message: str, is_emergency: bool = False,
                      location: Optional[str] = None) -> Dict[str, Any]:
        """联系家属"""
        try:
            alert_type = 'sos_emergency' if is_emergency else 'contact_family'
            level = 'high' if is_emergency else 'medium'
            title = '紧急联系请求' if is_emergency else '老人想联系您'

            payload = {
                "family_id": self.family_id,
                "alert_type": alert_type,
                "level": level,
                "title": title,
                "message": message,
                "source": "elderly"
            }

            if location:
                payload["metadata"] = json.dumps({"location": location})

            url = f"{self.api_base_url}/api/family/alerts"
            response = requests.post(url, json=payload, timeout=10)

            if response.status_code in [200, 201]:
                logger.info(f"联系家属成功: {'紧急' if is_emergency else '普通'}")

                # Toast通知现在由老人端Alert轮询自动处理，无需在此创建
                return {
                    "success": True,
                    "message": f"已发送{'紧急' if is_emergency else ''}联系请求给家属"
                }
            else:
                return {"success": False, "message": f"服务端错误: {response.status_code}"}

        except Exception as e:
            logger.error(f"联系家属失败: {e}")
            return {"success": False, "message": str(e)}

    # ==================== 情绪记录功能 ====================

    def record_emotion(self, mood_type: str, mood_score: int = 5,
                      note: Optional[str] = None, trigger_event: Optional[str] = None) -> Dict[str, Any]:
        """记录情绪"""
        try:
            valid_moods = ['happy', 'calm', 'sad', 'anxious', 'angry', 'tired']
            if mood_type not in valid_moods:
                return {"success": False, "message": f"无效的情绪类型: {mood_type}"}

            if not 1 <= mood_score <= 10:
                return {"success": False, "message": "情绪分数必须在1-10之间"}

            payload = {
                "family_id": self.family_id,
                "mood_type": mood_type,
                "mood_score": mood_score,
                "note": note or "",
                "source": "manual",
                "trigger_event": trigger_event or ""
            }

            url = f"{self.api_base_url}/api/elderly/moods"
            response = requests.post(url, json=payload, timeout=10)

            if response.status_code in [200, 201]:
                logger.info(f"情绪记录成功: {mood_type} ({mood_score}/10)")
                return {
                    "success": True,
                    "message": "情绪记录成功",
                    "mood_type_cn": self._mood_to_cn(mood_type)
                }
            else:
                return {"success": False, "message": f"服务端错误: {response.status_code}"}

        except Exception as e:
            logger.error(f"记录情绪失败: {e}")
            return {"success": False, "message": str(e)}

    def get_current_emotion(self, limit: int = 1) -> Dict[str, Any]:
        """获取最近情绪记录"""
        try:
            url = f"{self.api_base_url}/api/elderly/moods"
            params = {"family_id": self.family_id, "limit": limit}
            response = requests.get(url, params=params, timeout=10)

            if response.status_code == 200:
                result = response.json()
                records = result.get('records', [])
                for r in records:
                    r['mood_type_cn'] = self._mood_to_cn(r.get('mood_type', ''))
                return {"success": True, "message": f"找到 {len(records)} 条记录", "records": records}
            else:
                return {"success": False, "message": f"服务端错误: {response.status_code}"}

        except Exception as e:
            logger.error(f"获取情绪失败: {e}")
            return {"success": False, "message": str(e)}

    def _mood_to_cn(self, mood: str) -> str:
        """情绪翻译"""
        mapping = {'happy': '开心', 'calm': '平静', 'sad': '难过',
                  'anxious': '焦虑', 'angry': '生气', 'tired': '疲惫'}
        return mapping.get(mood, mood)

    # ==================== 媒体展示功能 ====================

    def get_media_list(self, tags: Optional[List[str]] = None,
                      media_type: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
        """获取媒体列表"""
        try:
            url = f"{self.api_base_url}/api/family/media"
            params = {"family_id": self.family_id}

            response = requests.get(url, params=params, timeout=10)

            if response.status_code == 200:
                result = response.json()
                media_list = result.get('media', [])  # API返回的字段是'media'不是'media_list'

                # 媒体类型过滤
                if media_type:
                    media_list = [m for m in media_list if m.get('media_type') == media_type]

                # 标签过滤
                if tags:
                    filtered = []
                    for m in media_list:
                        media_tags = m.get('tags', [])
                        if isinstance(media_tags, str):
                            media_tags = media_tags.split(',')
                        # 检查是否有任何标签匹配
                        if any(tag.strip() in [t.strip() for t in media_tags] for tag in tags):
                            filtered.append(m)
                    media_list = filtered

                # 限制数量
                media_list = media_list[:limit]

                # 格式化描述
                descriptions = []
                for m in media_list:
                    desc = f"ID:{m['id']} - {m['title']}"
                    if m.get('description'):
                        desc += f" ({m['description']})"
                    if m.get('tags'):
                        tag_str = ','.join(m['tags']) if isinstance(m['tags'], list) else m['tags']
                        desc += f" [标签: {tag_str}]"
                    descriptions.append(desc)

                # 简化的媒体列表，只包含必要字段，确保AI正确识别media_id
                simplified_media = [
                    {
                        "media_id": m['id'],  # 明确使用media_id字段名
                        "id": m['id'],  # 保留原始id字段
                        "title": m['title'],
                        "media_type": m['media_type'],
                        "tags": m.get('tags', []),
                        "description": m.get('description', '')
                    }
                    for m in media_list
                ]

                return {
                    "success": True,
                    "message": f"找到 {len(media_list)} 个媒体",
                    "media_list": simplified_media,
                    "descriptions": descriptions,
                    "note": "请使用media_list中的media_id字段调用display_media工具"
                }
            else:
                return {"success": False, "message": f"服务端错误: {response.status_code}"}

        except Exception as e:
            logger.error(f"获取媒体失败: {e}")
            return {"success": False, "message": str(e)}

    def display_media(self, media_id: int) -> Dict[str, Any]:
        """播放媒体"""
        try:
            # 先获取媒体信息
            media_url = f"{self.api_base_url}/api/family/media/{media_id}"
            logger.info(f"正在获取媒体信息: {media_url}")
            media_response = requests.get(media_url, timeout=10)

            if media_response.status_code == 404:
                return {
                    "success": False,
                    "message": f"媒体ID {media_id} 不存在。请先使用 get_all_media 或 get_media_by_tags 工具查看可用的媒体列表和ID"
                }
            elif media_response.status_code != 200:
                return {
                    "success": False,
                    "message": f"获取媒体信息失败: HTTP {media_response.status_code}"
                }

            media_info = media_response.json()

            # 使用 show-media API 来展示媒体给老人
            url = f"{self.api_base_url}/api/elderly/show-media"
            payload = {
                "media_title": media_info.get('title', f'Media-{media_id}'),
                "avatar_text": f"来看看{media_info.get('title', '这个')}吧",
                "duration": 60,  # 默认展示60秒
                "family_id": self.family_id
            }
            response = requests.post(url, json=payload, timeout=10)

            if response.status_code in [200, 201]:
                # 同时记录播放历史
                play_url = f"{self.api_base_url}/api/elderly/media/{media_id}/play"
                play_payload = {
                    "elderly_id": self.elderly_id,
                    "triggered_by": "manual",
                    "completed": 0  # 默认未完成，由老人端更新
                }
                requests.post(play_url, json=play_payload, timeout=10)

                logger.info(f"播放媒体成功: ID={media_id}, 标题={media_info.get('title')}")
                return {
                    "success": True,
                    "message": f"正在老人端展示: {media_info.get('title')}",
                    "media_info": media_info
                }
            else:
                return {"success": False, "message": f"服务端错误: {response.status_code}"}

        except Exception as e:
            logger.error(f"播放媒体失败: {e}")
            return {"success": False, "message": str(e)}

    def hide_media(self) -> Dict[str, Any]:
        """关闭老人端当前显示的媒体"""
        try:
            url = f"{self.api_base_url}/api/elderly/hide-media"
            payload = {"family_id": self.family_id}

            logger.info("正在发送关闭媒体请求")
            response = requests.post(url, json=payload, timeout=10)

            if response.status_code in [200, 201]:
                logger.info("关闭媒体成功")
                return {
                    "success": True,
                    "message": "已关闭老人端的媒体显示"
                }
            else:
                return {
                    "success": False,
                    "message": f"服务端错误: HTTP {response.status_code}"
                }

        except Exception as e:
            logger.error(f"关闭媒体失败: {e}")
            return {"success": False, "message": str(e)}

    # ==================== 日程管理功能 ====================

    def get_schedules(self, schedule_type: Optional[str] = None,
                     status: str = 'pending', limit: int = 20) -> Dict[str, Any]:
        """获取日程列表"""
        try:
            # 使用 family/schedules 端点，然后过滤
            url = f"{self.api_base_url}/api/family/schedules"
            params = {"family_id": self.family_id}

            response = requests.get(url, params=params, timeout=10)

            if response.status_code == 200:
                result = response.json()
                schedules = result.get('schedules', [])

                # 过滤状态和类型
                filtered = []
                for s in schedules:
                    if status and s.get('status') != status:
                        continue
                    if schedule_type and s.get('schedule_type') != schedule_type:
                        continue
                    filtered.append(s)

                # 限制数量
                filtered = filtered[:limit]

                return {"success": True, "message": f"找到 {len(filtered)} 个日程", "schedules": filtered}
            else:
                return {"success": False, "message": f"服务端错误: {response.status_code}"}

        except Exception as e:
            logger.error(f"获取日程失败: {e}")
            return {"success": False, "message": str(e)}

    def get_current_toast(self) -> Dict[str, Any]:
        """获取当前弹窗日程"""
        try:
            # 获取今日待处理的日程
            url = f"{self.api_base_url}/api/elderly/schedules/today"
            params = {"family_id": self.family_id}
            response = requests.get(url, params=params, timeout=10)

            if response.status_code == 200:
                result = response.json()
                schedules = result.get('schedules', [])

                # 筛选出待处理状态的日程
                pending_schedules = [s for s in schedules if s.get('status') == 'pending']

                if pending_schedules:
                    # 返回第一个待处理的日程
                    return {
                        "success": True,
                        "has_toast": True,
                        "schedule": pending_schedules[0]
                    }
                else:
                    return {
                        "success": True,
                        "has_toast": False,
                        "message": "没有待处理的日程提醒"
                    }
            else:
                return {"success": False, "message": f"服务端错误: {response.status_code}"}

        except Exception as e:
            logger.error(f"获取弹窗失败: {e}")
            return {"success": False, "message": str(e)}

    def mark_toast(self, schedule_id: int, action: str, delay_minutes: int = 0) -> Dict[str, Any]:
        """标记弹窗日程"""
        try:
            if action not in ['ignore', 'complete', 'delay']:
                return {"success": False, "message": "无效的操作类型"}

            # 将操作类型映射到schedule状态
            status_map = {
                'ignore': 'skipped',
                'complete': 'completed',
                'delay': 'pending'  # 延迟保持pending状态
            }

            action_text = {
                'ignore': '忽略',
                'complete': '完成',
                'delay': '延迟'
            }.get(action, action)

            # 更新schedule状态
            url = f"{self.api_base_url}/api/elderly/schedules/{schedule_id}/status"
            payload = {"status": status_map[action]}

            response = requests.post(url, json=payload, timeout=10)

            if response.status_code in [200, 201]:
                logger.info(f"标记日程成功: schedule_id={schedule_id}, action={action}")

                # TODO: 如果是延迟，需要创建新的提醒
                if action == 'delay' and delay_minutes > 0:
                    logger.warning("延迟功能暂未完全实现，需要服务端支持")

                return {"success": True, "message": f"日程已{action_text}"}
            else:
                return {"success": False, "message": f"服务端错误: {response.status_code}"}

        except Exception as e:
            logger.error(f"标记日程失败: {e}")
            return {"success": False, "message": str(e)}

# 全局管理器实例
manager = ElderlyMCPManager()

# 创建MCP服务器
server = Server("kinecho-elderly")

@server.list_tools()
async def handle_list_tools() -> List[Tool]:
    """工具列表"""
    return [
        # 联系家属
        Tool(
            name="contact_family",
            description="联系家属（非紧急）",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "想对家人说的话"}
                },
                "required": ["message"]
            }
        ),
        Tool(
            name="contact_family_emergency",
            description="紧急联系家属（用于跌倒、不适等紧急情况）",
            inputSchema={
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "紧急情况描述"},
                    "location": {"type": "string", "description": "当前位置（可选）"}
                },
                "required": ["message"]
            }
        ),

        # 情绪记录
        Tool(
            name="record_emotion",
            description="记录当前情绪",
            inputSchema={
                "type": "object",
                "properties": {
                    "mood_type": {
                        "type": "string",
                        "enum": ["happy", "calm", "sad", "anxious", "angry", "tired"],
                        "description": "情绪类型"
                    },
                    "mood_score": {
                        "type": "integer",
                        "description": "情绪分数1-10",
                        "minimum": 1,
                        "maximum": 10,
                        "default": 5
                    },
                    "note": {"type": "string", "description": "备注（可选）"},
                    "trigger_event": {"type": "string", "description": "触发事件（可选）"}
                },
                "required": ["mood_type"]
            }
        ),
        Tool(
            name="get_current_emotion",
            description="获取最近的情绪记录",
            inputSchema={
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "返回数量",
                        "default": 1,
                        "minimum": 1,
                        "maximum": 10
                    }
                }
            }
        ),

        # 媒体展示
        Tool(
            name="get_all_media",
            description="获取所有媒体列表",
            inputSchema={
                "type": "object",
                "properties": {
                    "media_type": {
                        "type": "string",
                        "enum": ["photo", "video"],
                        "description": "媒体类型（可选）"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回数量",
                        "default": 20,
                        "minimum": 1,
                        "maximum": 100
                    }
                }
            }
        ),
        Tool(
            name="get_media_by_tags",
            description="根据标签获取媒体",
            inputSchema={
                "type": "object",
                "properties": {
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "标签列表，如['孙女小米', '生日']"
                    }
                },
                "required": ["tags"]
            }
        ),
        Tool(
            name="display_media",
            description="播放指定媒体",
            inputSchema={
                "type": "object",
                "properties": {
                    "media_id": {"type": "integer", "description": "媒体ID"}
                },
                "required": ["media_id"]
            }
        ),
        Tool(
            name="hide_media",
            description="关闭老人端当前显示的媒体窗口",
            inputSchema={"type": "object", "properties": {}}
        ),

        # 日程管理
        Tool(
            name="get_schedules",
            description="获取日程列表",
            inputSchema={
                "type": "object",
                "properties": {
                    "schedule_type": {
                        "type": "string",
                        "enum": ["medication", "exercise", "meal", "checkup", "other"],
                        "description": "日程类型（可选）"
                    },
                    "status": {
                        "type": "string",
                        "enum": ["pending", "completed", "skipped", "missed"],
                        "description": "日程状态",
                        "default": "pending"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "返回数量",
                        "default": 20
                    }
                }
            }
        ),
        Tool(
            name="get_current_toast_schedule",
            description="获取当前弹窗的日程提醒",
            inputSchema={"type": "object", "properties": {}}
        ),
        Tool(
            name="mark_toast_schedule",
            description="标记弹窗日程（忽略/完成/延迟）。注意：这是操作schedule（日程），不是alert（告警）",
            inputSchema={
                "type": "object",
                "properties": {
                    "schedule_id": {"type": "integer", "description": "日程ID"},
                    "action": {
                        "type": "string",
                        "enum": ["ignore", "complete", "delay"],
                        "description": "操作类型"
                    },
                    "delay_minutes": {
                        "type": "integer",
                        "description": "延迟分钟数（action=delay时需要）",
                        "minimum": 1,
                        "maximum": 1440
                    }
                },
                "required": ["schedule_id", "action"]
            }
        )
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
    """处理工具调用"""

    # 联系家属
    if name == "contact_family":
        result = manager.contact_family(arguments["message"])
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    elif name == "contact_family_emergency":
        result = manager.contact_family(
            arguments["message"],
            is_emergency=True,
            location=arguments.get("location")
        )
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    # 情绪记录
    elif name == "record_emotion":
        result = manager.record_emotion(
            arguments["mood_type"],
            arguments.get("mood_score", 5),
            arguments.get("note"),
            arguments.get("trigger_event")
        )
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    elif name == "get_current_emotion":
        result = manager.get_current_emotion(arguments.get("limit", 1))
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    # 媒体展示
    elif name == "get_all_media":
        result = manager.get_media_list(
            media_type=arguments.get("media_type"),
            limit=arguments.get("limit", 20)
        )
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    elif name == "get_media_by_tags":
        result = manager.get_media_list(tags=arguments["tags"])
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    elif name == "display_media":
        result = manager.display_media(arguments["media_id"])
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    elif name == "hide_media":
        result = manager.hide_media()
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    # 日程管理
    elif name == "get_schedules":
        result = manager.get_schedules(
            arguments.get("schedule_type"),
            arguments.get("status", "pending"),
            arguments.get("limit", 20)
        )
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    elif name == "get_current_toast_schedule":
        result = manager.get_current_toast()
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    elif name == "mark_toast_schedule":
        result = manager.mark_toast(
            arguments["schedule_id"],
            arguments["action"],
            arguments.get("delay_minutes", 0)
        )
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]

    else:
        return [TextContent(type="text", text=f"未知工具: {name}")]

async def main():
    """主函数"""
    logger.info("KinEcho 老人端 MCP Server 启动中...")

    try:
        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            logger.info("MCP连接已建立")
            init_opts = server.create_initialization_options()
            await server.run(read_stream, write_stream, init_opts)
    except KeyboardInterrupt:
        logger.info("收到中断信号")
    except Exception as e:
        logger.error(f"MCP服务器错误: {e}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        logger.info("MCP服务器已关闭")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
