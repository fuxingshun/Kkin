"""
KinEcho 服务端 - Flask应用主入口
支持家人端和老人端的日程同步管理
"""
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import asyncio
import base64
import sqlite3
import os
import json
import re
import shutil
import socket
import ssl
import struct
import threading
import time
import requests
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

try:
    import pymysql
    from pymysql.cursors import DictCursor
except ImportError:
    pymysql = None
    DictCursor = None

SERVER_DIR = os.path.dirname(__file__)
load_dotenv(os.path.join(SERVER_DIR, '.env'))

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 北京时区 (UTC+8)
BEIJING_TZ = timezone(timedelta(hours=8))

def get_beijing_time():
    """获取当前北京时间"""
    return datetime.now(BEIJING_TZ)

def utc_to_beijing(utc_str):
    """将UTC时间字符串转换为北京时间字符串"""
    if not utc_str:
        return None
    try:
        # 解析UTC时间（SQLite的CURRENT_TIMESTAMP格式）
        utc_dt = datetime.strptime(utc_str, '%Y-%m-%d %H:%M:%S')
        # 添加UTC时区信息
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)
        # 转换为北京时间
        beijing_dt = utc_dt.astimezone(BEIJING_TZ)
        # 返回不带时区信息的字符串
        return beijing_dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return utc_str

# 数据库配置
HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', '8000'))
DEBUG = os.getenv('FLASK_ENV', 'development') == 'development'
DB_DRIVER = os.getenv('DB_DRIVER', 'mysql').strip().lower()
DATABASE_PATH = os.getenv('DATABASE_PATH', 'kinecho.db')
DB_PATH = DATABASE_PATH if os.path.isabs(DATABASE_PATH) else os.path.join(SERVER_DIR, DATABASE_PATH)
MYSQL_HOST = os.getenv('MYSQL_HOST', '127.0.0.1')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', '3306'))
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'kinecho')
MYSQL_CHARSET = os.getenv('MYSQL_CHARSET', 'utf8mb4')
MYSQL_AUTO_CREATE_DATABASE = os.getenv('MYSQL_AUTO_CREATE_DATABASE', 'true').lower() in ('1', 'true', 'yes', 'on')
SEED_DEMO_DATA = os.getenv('SEED_DEMO_DATA', 'true').lower() in ('1', 'true', 'yes', 'on')
FAY_HTTP_BASE_URL = os.getenv('FAY_HTTP_BASE_URL', 'http://127.0.0.1:5000')
FAY_MCP_BASE_URL = os.getenv('FAY_MCP_BASE_URL', 'http://127.0.0.1:5010')
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY', '').strip()
DEEPSEEK_API_BASE_URL = os.getenv('DEEPSEEK_API_BASE_URL', 'https://api.deepseek.com').rstrip('/')
DEEPSEEK_CHAT_MODEL = os.getenv('DEEPSEEK_CHAT_MODEL', 'deepseek-chat').strip() or 'deepseek-chat'
DEEPSEEK_CHAT_TEMPERATURE = float(os.getenv('DEEPSEEK_CHAT_TEMPERATURE', '0.9'))
DEEPSEEK_CHAT_MAX_TOKENS = int(os.getenv('DEEPSEEK_CHAT_MAX_TOKENS', '500'))
DEEPSEEK_CHAT_TIMEOUT_SECONDS = int(os.getenv('DEEPSEEK_CHAT_TIMEOUT_SECONDS', '45'))
DEEPSEEK_SYSTEM_PROMPT = os.getenv(
    'DEEPSEEK_SYSTEM_PROMPT',
    (
        '你是 KinEcho 里的数字人陪伴助手，正在和一位老人自然聊天。'
        '请用温和、简短、可靠的中文回答，像家人一样陪伴，不要说自己是 AI。'
        '如果涉及疾病、用药、急症或安全风险，不要诊断，提醒联系家属或专业医生。'
        '默认回复控制在 80 个汉字以内，适合直接语音播报。'
    ),
)
AVATAR_CHAT_PROVIDER = os.getenv('AVATAR_CHAT_PROVIDER', 'deepseek').strip().lower() or 'deepseek'

# 文件上传配置
UPLOAD_FOLDER = os.path.join(SERVER_DIR, 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
AVATAR_RELAY_FOLDER = os.path.join(UPLOAD_FOLDER, 'avatar-relay')
AVATAR_RELAY_AUDIO_FOLDER = os.path.join(AVATAR_RELAY_FOLDER, 'audio')
AVATAR_VOICE_UPLOAD_FOLDER = os.path.join(AVATAR_RELAY_FOLDER, 'voice')
AVATAR_RELAY_FRAME_FILENAME = 'latest.jpg'
AVATAR_RENDERER_TIMEOUT_SECONDS = int(os.getenv('AVATAR_RENDERER_TIMEOUT_SECONDS', '15'))
AVATAR_TTS_VOICE = os.getenv('AVATAR_TTS_VOICE', 'zh-CN-XiaoxiaoNeural')
FAY_SAMPLE_AUDIO_FOLDER = os.path.join(SERVER_DIR, '..', '.external', 'fay', 'samples')
AVATAR_FAY_CHAT_TIMEOUT_SECONDS = int(os.getenv('AVATAR_FAY_CHAT_TIMEOUT_SECONDS', '90'))
AVATAR_FAY_HISTORY_WAIT_SECONDS = int(os.getenv('AVATAR_FAY_HISTORY_WAIT_SECONDS', '45'))
AVATAR_ASR_PROVIDER = os.getenv('AVATAR_ASR_PROVIDER', 'funasr_ws').strip().lower() or 'funasr_ws'
AVATAR_ASR_FUNASR_WS_URL = os.getenv('AVATAR_ASR_FUNASR_WS_URL', 'ws://127.0.0.1:10197').strip()
AVATAR_ASR_TIMEOUT_SECONDS = int(os.getenv('AVATAR_ASR_TIMEOUT_SECONDS', '20'))
AVATAR_ENABLE_LOCAL_CHAT_FALLBACK = os.getenv('AVATAR_ENABLE_LOCAL_CHAT_FALLBACK', 'false').lower() in ('1', 'true', 'yes', 'on')
AVATAR_REQUIRE_YUESHEN_RAG = os.getenv('AVATAR_REQUIRE_YUESHEN_RAG', 'false').lower() in ('1', 'true', 'yes', 'on')
YUESHEN_RAG_SERVER_ID = os.getenv('YUESHEN_RAG_SERVER_ID', '').strip()
YUESHEN_RAG_QUERY_TIMEOUT_SECONDS = int(os.getenv('YUESHEN_RAG_QUERY_TIMEOUT_SECONDS', '8'))

# 确保上传目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(os.path.join(UPLOAD_FOLDER, 'thumbnails'), exist_ok=True)
os.makedirs(AVATAR_RELAY_FOLDER, exist_ok=True)
os.makedirs(AVATAR_RELAY_AUDIO_FOLDER, exist_ok=True)
os.makedirs(AVATAR_VOICE_UPLOAD_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

avatar_microphone_enabled = True
avatar_command_queue = []
avatar_command_seq = 0
avatar_renderer_lock = threading.Lock()
avatar_renderer_state = {
    'renderer_updated_ts': 0.0,
    'renderer_updated_at': '',
    'frame_updated_ts': 0.0,
    'frame_updated_at': '',
    'frame_relative_path': '',
    'frame_version': 0,
    'frame_width': 0,
    'frame_height': 0,
    'frame_text': '',
    'frame_speaking': False,
    'sdk_status': 'offline',
    'ws_status': 'disconnected',
    'environment': '',
    'acceleration': '',
    'render_nodes': 0,
    'audio_state': '',
    'last_error': '',
    'last_notice': '',
    'last_voice_state': '',
    'last_command_id': 0,
    'last_command_type': '',
    'last_command_text': '',
    'last_audio_url': '',
    'last_audio_relative_path': '',
    'last_audio_text': '',
    'last_audio_at': '',
}

def allowed_file(filename):
    """检查文件扩展名是否允许"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def generate_video_thumbnail(video_path, filename):
    """使用ffmpeg生成视频缩略图"""
    import subprocess

    thumbnail_filename = filename.rsplit('.', 1)[0] + '_thumb.jpg'
    thumbnail_path = os.path.join(UPLOAD_FOLDER, 'thumbnails', thumbnail_filename)

    try:
        # 使用ffmpeg截取第1秒的帧作为缩略图
        cmd = [
            'ffmpeg', '-i', video_path,
            '-ss', '00:00:01',
            '-vframes', '1',
            '-vf', 'scale=320:-1',
            '-y', thumbnail_path
        ]
        subprocess.run(cmd, capture_output=True, check=True, timeout=30)
        return thumbnail_path
    except Exception as e:
        print(f'生成视频缩略图失败: {e}')
        return None

def generate_photo_thumbnail(photo_path, filename):
    """生成图片缩略图"""
    from PIL import Image

    thumbnail_filename = filename.rsplit('.', 1)[0] + '_thumb.jpg'
    thumbnail_path = os.path.join(UPLOAD_FOLDER, 'thumbnails', thumbnail_filename)

    try:
        with Image.open(photo_path) as img:
            # 转换为RGB（处理PNG等格式）
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')
            # 生成缩略图，保持比例
            img.thumbnail((320, 320))
            img.save(thumbnail_path, 'JPEG', quality=85)
        return thumbnail_path
    except Exception as e:
        print(f'生成图片缩略图失败: {e}')
        return None

mysql_database_ready = False
mysql_database_lock = threading.Lock()


def is_mysql_enabled():
    return DB_DRIVER in ('mysql', 'mariadb')


def normalize_datetime_value(value):
    if isinstance(value, datetime):
        return value.strftime('%Y-%m-%d %H:%M:%S')
    if isinstance(value, Decimal):
        return float(value)
    if hasattr(value, 'isoformat') and value.__class__.__name__ == 'date':
        return value.isoformat()
    return value


def normalize_db_row(row):
    if row is None:
        return None
    if isinstance(row, dict):
        return {key: normalize_datetime_value(value) for key, value in row.items()}
    return row


def validate_mysql_database_name(database_name):
    if not re.match(r'^[A-Za-z0-9_]+$', database_name or ''):
        raise RuntimeError('MYSQL_DATABASE 只能包含字母、数字和下划线')


def ensure_mysql_database():
    global mysql_database_ready
    if mysql_database_ready or not MYSQL_AUTO_CREATE_DATABASE:
        return

    with mysql_database_lock:
        if mysql_database_ready:
            return
        if pymysql is None:
            raise RuntimeError('未安装 PyMySQL，请先执行 pip install -r requirements.txt')

        validate_mysql_database_name(MYSQL_DATABASE)
        conn = pymysql.connect(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            charset=MYSQL_CHARSET,
            autocommit=True,
        )
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    f'CREATE DATABASE IF NOT EXISTS `{MYSQL_DATABASE}` '
                    f'CHARACTER SET {MYSQL_CHARSET} COLLATE {MYSQL_CHARSET}_unicode_ci'
                )
        finally:
            conn.close()
        mysql_database_ready = True


def normalize_mysql_sql(sql):
    normalized = sql
    normalized = normalized.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'INT AUTO_INCREMENT PRIMARY KEY')
    mysql_type_replacements = {
        'username TEXT NOT NULL DEFAULT': 'username VARCHAR(191) NOT NULL DEFAULT',
        'username TEXT DEFAULT': 'username VARCHAR(191) DEFAULT',
        'way TEXT NOT NULL DEFAULT': 'way VARCHAR(64) NOT NULL DEFAULT',
        'user_type TEXT NOT NULL': 'user_type VARCHAR(32) NOT NULL',
        'family_id TEXT NOT NULL': 'family_id VARCHAR(64) NOT NULL',
        'family_id TEXT': 'family_id VARCHAR(64)',
        'phone TEXT': 'phone VARCHAR(64)',
        'schedule_type TEXT': 'schedule_type VARCHAR(64)',
        'repeat_type TEXT DEFAULT': 'repeat_type VARCHAR(64) DEFAULT',
        'status TEXT DEFAULT': 'status VARCHAR(64) DEFAULT',
        'status TEXT': 'status VARCHAR(64)',
        'feedback_type TEXT NOT NULL': 'feedback_type VARCHAR(32) NOT NULL',
        'media_type TEXT NOT NULL': 'media_type VARCHAR(32) NOT NULL',
        'alert_type TEXT NOT NULL': 'alert_type VARCHAR(64) NOT NULL',
        'level TEXT NOT NULL': 'level VARCHAR(32) NOT NULL',
        'source TEXT DEFAULT': 'source VARCHAR(64) DEFAULT',
        'mood_type TEXT NOT NULL': 'mood_type VARCHAR(64) NOT NULL',
        'consultation_type TEXT DEFAULT': 'consultation_type VARCHAR(64) DEFAULT',
        'createtime INTEGER': 'createtime BIGINT',
    }
    for source, target in mysql_type_replacements.items():
        normalized = normalized.replace(source, target)
    normalized = re.sub(r'(?<![A-Za-z0-9_`])read(?![A-Za-z0-9_`])', '`read`', normalized)
    normalized = re.sub(
        r"DATE\('now', '-(\d+) days'\)",
        r'DATE_SUB(CURDATE(), INTERVAL \1 DAY)',
        normalized,
    )
    normalized = normalized.replace("DATE('now')", 'CURDATE()')
    normalized = normalized.replace("datetime('now', '+1 hour')", 'DATE_ADD(NOW(), INTERVAL 1 HOUR)')
    normalized = normalized.replace("datetime('now')", 'NOW()')
    normalized = re.sub(
        r'CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+([A-Za-z0-9_]+)\s+ON\s+',
        r'CREATE INDEX \1 ON ',
        normalized,
        flags=re.IGNORECASE,
    )
    normalized = normalized.replace('?', '%s')
    return normalized


def is_duplicate_index_error(exc):
    error_code = getattr(exc, 'args', [None])[0]
    return error_code in (1061, 1831)


class MySQLCursorAdapter:
    def __init__(self, cursor):
        self.cursor = cursor

    @property
    def lastrowid(self):
        return self.cursor.lastrowid

    @property
    def rowcount(self):
        return self.cursor.rowcount

    def execute(self, sql, params=None):
        normalized_sql = normalize_mysql_sql(sql)
        try:
            return self.cursor.execute(normalized_sql, params or ())
        except Exception as exc:
            if normalized_sql.lstrip().upper().startswith('CREATE INDEX') and is_duplicate_index_error(exc):
                return 0
            raise

    def fetchone(self):
        return normalize_db_row(self.cursor.fetchone())

    def fetchall(self):
        return [normalize_db_row(row) for row in self.cursor.fetchall()]


class MySQLConnectionAdapter:
    def __init__(self, conn):
        self.conn = conn

    def cursor(self):
        return MySQLCursorAdapter(self.conn.cursor())

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()


def get_db():
    """获取数据库连接。默认使用 MySQL，保留 SQLite 仅用于本地兼容。"""
    if is_mysql_enabled():
        if pymysql is None:
            raise RuntimeError('未安装 PyMySQL，请先执行 pip install -r requirements.txt')
        ensure_mysql_database()
        conn = pymysql.connect(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DATABASE,
            charset=MYSQL_CHARSET,
            cursorclass=DictCursor,
            autocommit=False,
        )
        return MySQLConnectionAdapter(conn)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # 返回字典格式
    return conn

def ensure_avatar_interactions_table(cursor):
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS avatar_interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL DEFAULT 'User',
            type TEXT NOT NULL,
            way TEXT NOT NULL DEFAULT 'speak',
            content TEXT NOT NULL,
            createtime INTEGER NOT NULL,
            timetext TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    if is_mysql_enabled():
        cursor.execute('ALTER TABLE avatar_interactions MODIFY createtime BIGINT NOT NULL')


def get_current_epoch_ms():
    return int(get_beijing_time().timestamp() * 1000)


def normalize_history_limit(limit):
    try:
        value = int(limit)
    except (TypeError, ValueError):
        value = 100
    return max(1, min(value, 500))


def record_avatar_interaction(message_type, content, username='User', way='speak'):
    text = (content or '').strip()
    if not text:
        return None

    if message_type == 'fay':
        text = sanitize_avatar_reply_text(text)
        if not text:
            return None

    timestamp_ms = get_current_epoch_ms()
    timetext = get_beijing_time().strftime('%Y-%m-%d %H:%M:%S')
    conn = get_db()
    cursor = conn.cursor()
    ensure_avatar_interactions_table(cursor)
    cursor.execute(
        '''
        INSERT INTO avatar_interactions (username, type, way, content, createtime, timetext)
        VALUES (?, ?, ?, ?, ?, ?)
        ''',
        (username or 'User', message_type, way or 'speak', text, timestamp_ms, timetext),
    )
    conn.commit()
    message_id = cursor.lastrowid
    conn.close()

    return {
        'id': message_id,
        'username': username or 'User',
        'is_adopted': 0,
        'type': message_type,
        'way': way or 'speak',
        'content': text,
        'createtime': timestamp_ms,
        'timetext': timetext,
    }


def safe_record_avatar_interaction(message_type, content, username='User', way='speak'):
    try:
        return record_avatar_interaction(message_type, content, username=username, way=way)
    except Exception as exc:
        print(f'Failed to record avatar interaction: {exc}')
        return None


def get_avatar_interaction_history(username='User', limit=100):
    normalized_limit = normalize_history_limit(limit)
    conn = get_db()
    cursor = conn.cursor()
    ensure_avatar_interactions_table(cursor)
    cursor.execute(
        '''
        SELECT id, username, type, way, content, createtime, timetext
        FROM avatar_interactions
        WHERE username = ?
        ORDER BY createtime DESC, id DESC
        LIMIT ?
        ''',
        (username or 'User', normalized_limit),
    )
    rows = cursor.fetchall()
    conn.close()

    messages = []
    for row in rows:
        item = dict(row)
        content = item.get('content') or ''
        if item.get('type') == 'fay':
            content = sanitize_avatar_reply_text(content)
        else:
            content = content.strip()
        if not content:
            continue

        item['content'] = content
        item['is_adopted'] = 0
        messages.append(item)

    return messages


def clear_avatar_interactions(username=None):
    conn = get_db()
    cursor = conn.cursor()
    ensure_avatar_interactions_table(cursor)
    if username:
        cursor.execute('DELETE FROM avatar_interactions WHERE username = ?', (username,))
    else:
        cursor.execute('DELETE FROM avatar_interactions')
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return max(deleted, 0)


def get_fay_memory_db_path():
    return os.getenv(
        'FAY_MEMORY_DB_PATH',
        os.path.abspath(os.path.join(SERVER_DIR, '..', '.external', 'fay', 'memory', 'fay.db')),
    )


def clear_fay_history_messages(username=None):
    db_path = get_fay_memory_db_path()
    if not os.path.exists(db_path):
        return 0

    try:
        conn = sqlite3.connect(db_path, timeout=3)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='T_Msg'")
        if not cursor.fetchone():
            conn.close()
            return 0

        if username:
            params = (username,)
            where_clause = 'WHERE username = ?'
        else:
            params = ()
            where_clause = ''

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='T_Adopted'")
        has_adopted_table = bool(cursor.fetchone())
        if has_adopted_table:
            try:
                cursor.execute(
                    f'DELETE FROM T_Adopted WHERE msg_id IN (SELECT id FROM T_Msg {where_clause})',
                    params,
                )
            except sqlite3.Error as exc:
                print(f'Failed to clear Fay adopted history: {exc}')

        cursor.execute(f'DELETE FROM T_Msg {where_clause}', params)
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        return max(deleted, 0)
    except Exception as exc:
        print(f'Failed to clear Fay history messages: {exc}')
        return 0


def fetch_fay_messages(username='User', limit=100):
    """从 Fay 服务拉取互动消息，失败时返回错误文本而不是抛出到调用方。"""
    try:
        response = requests.post(
            f'{FAY_HTTP_BASE_URL}/api/get-msg',
            json={
                'username': username,
                'limit': limit
            },
            timeout=2.5
        )

        if not response.ok:
            return None, f'Fay 服务返回异常状态: {response.status_code}'

        payload = response.json()
        if not isinstance(payload, dict):
            return None, 'Fay 服务返回了无效数据'

        messages = payload.get('list', [])
        if not isinstance(messages, list):
            return None, 'Fay 消息列表格式不正确'

        return messages, None
    except requests.RequestException as exc:
        return None, f'Fay 服务暂不可用: {exc}'
    except ValueError:
        return None, 'Fay 服务返回了无法解析的 JSON'


def extract_fay_reply(payload):
    """从 Fay 聊天完成接口里提取可直接展示的文本回复。"""
    if not isinstance(payload, dict):
        return ''

    choices = payload.get('choices')
    if isinstance(choices, list) and choices:
        first_choice = choices[0] or {}
        if isinstance(first_choice, dict):
            message = first_choice.get('message')
            if isinstance(message, dict):
                content = message.get('content')
                if isinstance(content, str) and content.strip():
                    return sanitize_avatar_reply_text(content)

            delta = first_choice.get('delta')
            if isinstance(delta, dict):
                content = delta.get('content')
                if isinstance(content, str) and content.strip():
                    return sanitize_avatar_reply_text(content)

    for key in ('reply', 'content', 'text', 'message'):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return sanitize_avatar_reply_text(value)
        if isinstance(value, dict):
            content = value.get('content')
            if isinstance(content, str) and content.strip():
                return sanitize_avatar_reply_text(content)

    return ''


def sanitize_avatar_reply_text(content):
    if not isinstance(content, str):
        return ''

    normalized = re.sub(r'<think>[\s\S]*?</think>', '', content, flags=re.IGNORECASE)
    normalized = re.sub(r'<prestart[\s\S]*?</prestart>', '', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'<prestart[\s\S]*$', '', normalized, flags=re.IGNORECASE)

    compact = normalized.strip()
    diagnostic_markers = (
        'vector store empty',
        'run ingest_yueshen first',
        'chromadb_yueshen',
        'default_corpus_dir',
    )
    if compact and any(marker in compact for marker in diagnostic_markers):
        return ''

    filtered_lines = []
    for line in normalized.splitlines():
        text = line.strip()
        if not text:
            continue
        if re.match(
            r'^(stats:|skipped:|reason:|query=|where=|embedding_|persist_dir:|collection:|vectors:|default_corpus_dir:|base_url:|model:)',
            text,
            flags=re.IGNORECASE,
        ):
            continue
        if any(marker in text for marker in diagnostic_markers):
            continue
        filtered_lines.append(text)

    return '\n'.join(filtered_lines).strip()


def sanitize_fay_message_item(item):
    if not isinstance(item, dict):
        return None

    sanitized = dict(item)
    content = sanitized.get('content')
    if isinstance(content, str):
        sanitized['content'] = sanitize_avatar_reply_text(content)

    return sanitized


def get_fay_message_timestamp(message):
    if not isinstance(message, dict):
        return 0.0

    for key in ('createtime', 'created_at', 'timestamp', 'time'):
        value = message.get(key)
        if isinstance(value, (int, float)):
            return float(value) / 1000 if value > 9999999999 else float(value)

    timetext = message.get('timetext')
    if isinstance(timetext, str) and timetext.strip():
        for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S'):
            try:
                return datetime.strptime(timetext.strip(), fmt).timestamp()
            except ValueError:
                pass

    return 0.0


def extract_latest_fay_history_reply(username='User', limit=12, after_ts=0.0):
    """从 Fay 历史消息里兜底提取最近一条可展示的数字人回复。"""
    messages, error = fetch_fay_messages(username=username, limit=limit)
    if error or not messages:
        return ''

    sorted_messages = sorted(messages, key=get_fay_message_timestamp, reverse=True)
    for item in sorted_messages:
        if not isinstance(item, dict):
            continue

        if item.get('type') != 'fay':
            continue

        message_ts = get_fay_message_timestamp(item)
        if after_ts and message_ts and message_ts < after_ts - 1:
            continue

        content = item.get('content')
        if isinstance(content, str) and content.strip():
            return sanitize_avatar_reply_text(content)

    return ''


def wait_for_latest_fay_history_reply(username='User', after_ts=0.0, timeout_seconds=None):
    """等待 Fay 工具链真正写入回复，避免过早返回本地兜底文本。"""
    timeout = AVATAR_FAY_HISTORY_WAIT_SECONDS if timeout_seconds is None else timeout_seconds
    deadline = time.time() + max(0, timeout)

    while time.time() < deadline:
        reply = extract_latest_fay_history_reply(username=username, limit=24, after_ts=after_ts)
        if reply:
            return reply
        time.sleep(0.8)

    return ''


def build_fay_error_response(message, status_code=503, detail=None):
    payload = {'error': message}
    if detail:
        payload['detail'] = detail
    return jsonify(payload), status_code


def build_deepseek_user_message(message, observation=''):
    content = (message or '').strip()
    observation_text = (observation or '').strip()
    if observation_text:
        return f'老人说：{content}\n\n补充观察：{observation_text}'
    return content


def call_deepseek_chat_completion(message, observation=''):
    if not DEEPSEEK_API_KEY:
        raise RuntimeError('DeepSeek API key is not configured.')

    payload = {
        'model': DEEPSEEK_CHAT_MODEL,
        'messages': [
            {'role': 'system', 'content': DEEPSEEK_SYSTEM_PROMPT},
            {'role': 'user', 'content': build_deepseek_user_message(message, observation)},
        ],
        'stream': False,
        'temperature': DEEPSEEK_CHAT_TEMPERATURE,
    }
    if DEEPSEEK_CHAT_MAX_TOKENS > 0:
        payload['max_tokens'] = DEEPSEEK_CHAT_MAX_TOKENS

    response = requests.post(
        f'{DEEPSEEK_API_BASE_URL}/chat/completions',
        headers={
            'Authorization': f'Bearer {DEEPSEEK_API_KEY}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=(5, DEEPSEEK_CHAT_TIMEOUT_SECONDS),
    )
    if not response.ok:
        raise RuntimeError(response.text[:300] or f'DeepSeek API returned HTTP {response.status_code}')

    try:
        response_payload = response.json()
    except ValueError as exc:
        raise RuntimeError('DeepSeek API returned invalid JSON.') from exc

    reply = extract_fay_reply(response_payload)
    if not reply:
        raise RuntimeError('DeepSeek API did not return usable assistant content.')

    return reply, response_payload


def record_fay_history_message(message_type, content, username='User', way='speak'):
    text = (content or '').strip()
    if not text:
        return None

    db_path = os.getenv(
        'FAY_MEMORY_DB_PATH',
        os.path.abspath(os.path.join(SERVER_DIR, '..', '.external', 'fay', 'memory', 'fay.db')),
    )
    try:
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        conn = sqlite3.connect(db_path, timeout=3)
        cursor = conn.cursor()
        cursor.execute(
            '''
            CREATE TABLE IF NOT EXISTS T_Msg
            (id INTEGER PRIMARY KEY AUTOINCREMENT,
             type CHAR(10),
             way CHAR(10),
             content TEXT NOT NULL,
             createtime INT,
             username TEXT DEFAULT 'User',
             uid INT)
            '''
        )
        create_ms = int(time.time() * 1000)
        cursor.execute(
            'INSERT INTO T_Msg (type, way, content, createtime, username, uid) VALUES (?, ?, ?, ?, ?, ?)',
            (message_type, way, text, create_ms, username or 'User', 0),
        )
        conn.commit()
        message_id = cursor.lastrowid
        conn.close()
        return {'id': message_id, 'createtime': create_ms}
    except Exception as exc:
        print(f'Failed to record Fay history message: {exc}')
        return None


def should_probe_yueshen_rag(message):
    if not AVATAR_REQUIRE_YUESHEN_RAG:
        return False

    text = (message or '').strip().lower()
    if not text:
        return False

    trivial_messages = {
        'hi',
        'hello',
        'ok',
        'yes',
        'no',
        '你好',
        '您好',
        '嗨',
        '嗯',
        '好',
        '好的',
        '谢谢',
        '再见',
    }
    if text in trivial_messages or len(text) <= 2:
        return False

    return True


def find_yueshen_rag_server_id():
    if YUESHEN_RAG_SERVER_ID:
        try:
            return int(YUESHEN_RAG_SERVER_ID)
        except ValueError:
            pass

    try:
        response = requests.get(f'{FAY_MCP_BASE_URL}/api/mcp/servers', timeout=2.5)
        if not response.ok:
            return None

        servers = response.json()
        if isinstance(servers, dict):
            servers = servers.get('servers') or servers.get('list') or []
        if not isinstance(servers, list):
            return None

        for server in servers:
            if not isinstance(server, dict):
                continue

            server_name = str(server.get('name') or '').lower()
            server_args = ' '.join(str(item) for item in (server.get('args') or []))
            if 'yueshen' in server_name or 'rag' in server_name or 'yueshen_rag' in server_args:
                return int(server.get('id'))
    except Exception:
        return None

    return None


def extract_mcp_text_payload(payload):
    try:
        content = payload.get('result', {}).get('content', [])
        if isinstance(content, list) and content:
            text = content[0].get('text')
            if isinstance(text, str) and text.strip():
                return json.loads(text)
    except Exception:
        return None

    return None


def probe_yueshen_rag(query_text):
    server_id = find_yueshen_rag_server_id()
    if not server_id:
        return {
            'available': False,
            'blocked': True,
            'detail': 'YueShen RAG MCP server was not found or is not connected.',
        }

    try:
        response = requests.post(
            f'{FAY_MCP_BASE_URL}/api/mcp/servers/{server_id}/call',
            json={
                'method': 'query_yueshen',
                'params': {
                    'query': query_text,
                    'top_k': 5,
                    'where': {},
                },
                'is_prestart': True,
            },
            timeout=YUESHEN_RAG_QUERY_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        return {
            'available': False,
            'blocked': True,
            'detail': f'YueShen RAG probe failed: {exc}',
        }

    if not response.ok:
        return {
            'available': False,
            'blocked': True,
            'detail': response.text[:300] or f'YueShen RAG probe returned HTTP {response.status_code}',
        }

    try:
        payload = response.json()
    except ValueError:
        return {
            'available': False,
            'blocked': True,
            'detail': response.text[:300] or 'YueShen RAG probe returned invalid JSON.',
        }

    result = extract_mcp_text_payload(payload) or {}
    reason = str(result.get('reason') or '')
    stats = result.get('stats') if isinstance(result.get('stats'), dict) else {}

    if result.get('skipped') and 'vector store empty' in reason:
        corpus_dir = stats.get('default_corpus_dir') or ''
        return {
            'available': True,
            'blocked': True,
            'detail': f'YueShen RAG vector store is empty. Corpus dir: {corpus_dir}',
            'corpus_dir': corpus_dir,
            'vectors': stats.get('vectors', 0),
        }

    return {
        'available': True,
        'blocked': False,
        'detail': reason,
        'count': result.get('count', 0),
        'skipped': bool(result.get('skipped')),
    }


def build_absolute_asset_url(relative_path):
    if not relative_path:
        return ''

    normalized = relative_path.replace('\\', '/').lstrip('/')
    return f"{request.host_url.rstrip('/')}/{normalized}"


def prune_avatar_audio_files(max_files=16):
    try:
        files = [
            os.path.join(AVATAR_RELAY_AUDIO_FOLDER, item)
            for item in os.listdir(AVATAR_RELAY_AUDIO_FOLDER)
            if item.lower().endswith(('.mp3', '.wav'))
        ]
        files.sort(key=lambda path: os.path.getmtime(path), reverse=True)
        for stale_file in files[max_files:]:
            try:
                os.remove(stale_file)
            except OSError:
                pass
    except OSError:
        pass


def synthesize_avatar_audio(text):
    content = (text or '').strip()
    if not content:
        return '', ''

    try:
        import edge_tts
    except Exception as exc:
        return '', f'edge_tts unavailable: {exc}'

    filename = f"avatar-{int(time.time() * 1000)}.mp3"
    output_path = os.path.join(AVATAR_RELAY_AUDIO_FOLDER, filename)

    try:
        communicate = edge_tts.Communicate(content, AVATAR_TTS_VOICE)
        asyncio.run(communicate.save(output_path))
        if not os.path.exists(output_path) or os.path.getsize(output_path) <= 0:
            try:
                os.remove(output_path)
            except OSError:
                pass
            return '', 'No audio data was generated.'
        prune_avatar_audio_files()
        relative_path = f'uploads/avatar-relay/audio/{filename}'
        absolute_url = build_absolute_asset_url(relative_path)
        with avatar_renderer_lock:
            avatar_renderer_state['last_audio_url'] = absolute_url
            avatar_renderer_state['last_audio_relative_path'] = relative_path
            avatar_renderer_state['last_audio_text'] = content
            avatar_renderer_state['last_audio_at'] = datetime.now().isoformat()
        return absolute_url, ''
    except Exception as exc:
        return '', str(exc)


def mirror_latest_fay_sample_audio(since_ts, text='', timeout_seconds=8):
    deadline = time.time() + timeout_seconds
    latest_sample_path = ''

    while time.time() < deadline:
        try:
            candidates = []
            for item in os.listdir(FAY_SAMPLE_AUDIO_FOLDER):
                if not item.lower().endswith(('.mp3', '.wav')):
                    continue

                sample_path = os.path.join(FAY_SAMPLE_AUDIO_FOLDER, item)
                try:
                    stat = os.stat(sample_path)
                except OSError:
                    continue

                if stat.st_size <= 0 or stat.st_mtime < since_ts - 0.5:
                    continue

                candidates.append((stat.st_mtime, sample_path))

            if candidates:
                candidates.sort(reverse=True)
                latest_sample_path = candidates[0][1]
                break
        except OSError:
            return '', 'Fay sample audio folder is unavailable.'

        time.sleep(0.35)

    if not latest_sample_path:
        return '', 'Fay audio sample was not ready in time.'

    target_filename = f'fay-{secure_filename(os.path.basename(latest_sample_path))}'
    target_path = os.path.join(AVATAR_RELAY_AUDIO_FOLDER, target_filename)

    try:
        shutil.copyfile(latest_sample_path, target_path)
        if not os.path.exists(target_path) or os.path.getsize(target_path) <= 0:
            return '', 'Mirrored Fay audio file is empty.'
        prune_avatar_audio_files()
    except OSError as exc:
        return '', str(exc)

    relative_path = f'uploads/avatar-relay/audio/{target_filename}'
    mirrored_url = build_absolute_asset_url(relative_path)
    with avatar_renderer_lock:
        avatar_renderer_state['last_audio_url'] = mirrored_url
        avatar_renderer_state['last_audio_relative_path'] = relative_path
        avatar_renderer_state['last_audio_text'] = (text or '').strip()
        avatar_renderer_state['last_audio_at'] = datetime.now().isoformat()

    return mirrored_url, ''


def mirror_fay_audio_url(audio_url, text='', audio_at=''):
    source_url = (audio_url or '').strip()
    if not source_url:
        return '', ''

    fay_audio_prefix = f'{FAY_HTTP_BASE_URL.rstrip("/")}/audio/'
    if not source_url.lower().startswith(fay_audio_prefix.lower()):
        return source_url, ''

    filename = source_url[len(fay_audio_prefix):].split('?', 1)[0].split('#', 1)[0]
    filename = secure_filename(os.path.basename(filename))
    if not filename:
        return source_url, ''

    source_path = os.path.join(FAY_SAMPLE_AUDIO_FOLDER, filename)
    if not os.path.exists(source_path) or os.path.getsize(source_path) <= 0:
        return source_url, f'Fay audio file is not ready: {filename}'

    target_filename = f'fay-{filename}'
    target_path = os.path.join(AVATAR_RELAY_AUDIO_FOLDER, target_filename)
    try:
        shutil.copyfile(source_path, target_path)
        prune_avatar_audio_files()
    except OSError as exc:
        return source_url, str(exc)

    relative_path = f'uploads/avatar-relay/audio/{target_filename}'
    mirrored_url = build_absolute_asset_url(relative_path)
    with avatar_renderer_lock:
        avatar_renderer_state['last_audio_url'] = mirrored_url
        avatar_renderer_state['last_audio_relative_path'] = relative_path
        avatar_renderer_state['last_audio_text'] = (text or '').strip()
        avatar_renderer_state['last_audio_at'] = audio_at or datetime.now().isoformat()

    return mirrored_url, ''


def read_exact(sock, length):
    chunks = bytearray()
    while len(chunks) < length:
        chunk = sock.recv(length - len(chunks))
        if not chunk:
            raise RuntimeError('ASR websocket connection closed unexpectedly.')
        chunks.extend(chunk)
    return bytes(chunks)


def send_ws_text_frame(sock, text):
    payload = text.encode('utf-8')
    mask_key = os.urandom(4)
    header = bytearray([0x81])
    length = len(payload)

    if length <= 125:
        header.append(0x80 | length)
    elif length <= 65535:
        header.append(0x80 | 126)
        header.extend(struct.pack('!H', length))
    else:
        header.append(0x80 | 127)
        header.extend(struct.pack('!Q', length))

    masked = bytes(byte ^ mask_key[index % 4] for index, byte in enumerate(payload))
    sock.sendall(bytes(header) + mask_key + masked)


def receive_ws_text_frame(sock, timeout_seconds):
    end_at = time.time() + timeout_seconds

    while time.time() < end_at:
        sock.settimeout(max(0.2, end_at - time.time()))
        first, second = read_exact(sock, 2)
        opcode = first & 0x0F
        masked = bool(second & 0x80)
        length = second & 0x7F

        if length == 126:
            length = struct.unpack('!H', read_exact(sock, 2))[0]
        elif length == 127:
            length = struct.unpack('!Q', read_exact(sock, 8))[0]

        mask_key = read_exact(sock, 4) if masked else b''
        payload = read_exact(sock, length) if length else b''
        if masked:
            payload = bytes(byte ^ mask_key[index % 4] for index, byte in enumerate(payload))

        if opcode == 1:
            return payload.decode('utf-8', errors='ignore').strip()
        if opcode == 8:
            break

    return ''


def recognize_voice_with_funasr_ws(audio_path):
    if not AVATAR_ASR_FUNASR_WS_URL:
        return '', 'FunASR websocket URL is not configured.'

    from urllib.parse import urlparse

    parsed = urlparse(AVATAR_ASR_FUNASR_WS_URL)
    scheme = parsed.scheme or 'ws'
    host = parsed.hostname or '127.0.0.1'
    port = parsed.port or (443 if scheme == 'wss' else 80)
    path = parsed.path or '/'
    if parsed.query:
        path = f'{path}?{parsed.query}'

    raw_sock = socket.create_connection((host, port), timeout=AVATAR_ASR_TIMEOUT_SECONDS)
    sock = ssl.create_default_context().wrap_socket(raw_sock, server_hostname=host) if scheme == 'wss' else raw_sock

    try:
        key = base64.b64encode(os.urandom(16)).decode('ascii')
        host_header = f'{host}:{port}'
        request_lines = [
            f'GET {path} HTTP/1.1',
            f'Host: {host_header}',
            'Upgrade: websocket',
            'Connection: Upgrade',
            f'Sec-WebSocket-Key: {key}',
            'Sec-WebSocket-Version: 13',
            '',
            '',
        ]
        sock.sendall('\r\n'.join(request_lines).encode('ascii'))
        response = b''
        while b'\r\n\r\n' not in response:
            response += sock.recv(4096)
            if len(response) > 8192:
                break
        if b' 101 ' not in response.split(b'\r\n', 1)[0]:
            return '', 'ASR websocket handshake failed.'

        send_ws_text_frame(sock, json.dumps({'url': os.path.abspath(audio_path)}, ensure_ascii=False))
        text = receive_ws_text_frame(sock, AVATAR_ASR_TIMEOUT_SECONDS)
        return text, '' if text else 'ASR did not return recognized text.'
    except Exception as exc:
        return '', str(exc)
    finally:
        try:
            sock.close()
        except Exception:
            pass


def recognize_avatar_voice(audio_path):
    provider = AVATAR_ASR_PROVIDER
    if provider in ('funasr', 'funasr_ws', 'local_funasr'):
        return recognize_voice_with_funasr_ws(audio_path)
    return '', f'Unsupported ASR provider: {provider}'


def call_avatar_chat_internally(message, user='User'):
    with app.test_request_context(
        '/api/elderly/avatar/chat',
        method='POST',
        json={'message': message, 'user': user},
    ):
        result = elderly_avatar_chat()

    status_code = 200
    response = result
    if isinstance(result, tuple):
        response = result[0]
        if len(result) > 1:
            status_code = result[1]
    elif hasattr(response, 'status_code'):
        status_code = response.status_code

    data = response.get_json(silent=True) if hasattr(response, 'get_json') else None
    return data or {}, status_code


def broadcast_avatar_text_via_fay(text, user='User', queue=False):
    content = (text or '').strip()
    username = (user or 'User').strip() or 'User'
    if not content:
        return False, 'missing text'

    payload = {
        'user': username,
        'text': content,
    }
    if queue:
        payload['queue'] = True

    try:
        response = requests.post(
            f'{FAY_HTTP_BASE_URL}/transparent-pass',
            json=payload,
            timeout=(2, 6)
        )
    except requests.RequestException as exc:
        return False, str(exc)

    if not response.ok:
        return False, response.text[:300] or f'HTTP {response.status_code}'

    try:
        data = response.json()
    except ValueError:
        data = {}

    if isinstance(data, dict):
        code = data.get('code')
        if isinstance(code, int) and code >= 400:
            return False, (data.get('message') or data.get('msg') or 'transparent-pass failed').strip()

    return True, ''


def update_avatar_renderer_state(**kwargs):
    now = datetime.now().isoformat()
    with avatar_renderer_lock:
        avatar_renderer_state.update(kwargs)
        avatar_renderer_state['renderer_updated_ts'] = time.time()
        avatar_renderer_state['renderer_updated_at'] = now
        snapshot = dict(avatar_renderer_state)
    return snapshot


def store_avatar_frame(image_bytes, width=0, height=0, text='', speaking=False):
    target_path = os.path.join(AVATAR_RELAY_FOLDER, AVATAR_RELAY_FRAME_FILENAME)
    temp_path = f'{target_path}.tmp'

    with open(temp_path, 'wb') as frame_file:
        frame_file.write(image_bytes)

    os.replace(temp_path, target_path)

    now = datetime.now().isoformat()
    with avatar_renderer_lock:
        avatar_renderer_state['frame_relative_path'] = 'uploads/avatar-relay/latest.jpg'
        avatar_renderer_state['frame_version'] += 1
        avatar_renderer_state['frame_updated_ts'] = time.time()
        avatar_renderer_state['frame_updated_at'] = now
        avatar_renderer_state['frame_width'] = int(width or 0)
        avatar_renderer_state['frame_height'] = int(height or 0)
        avatar_renderer_state['frame_text'] = (text or '').strip()
        avatar_renderer_state['frame_speaking'] = bool(speaking)
        avatar_renderer_state['renderer_updated_ts'] = time.time()
        avatar_renderer_state['renderer_updated_at'] = now
        snapshot = dict(avatar_renderer_state)

    return snapshot


def get_avatar_renderer_snapshot():
    with avatar_renderer_lock:
        snapshot = dict(avatar_renderer_state)

    now_ts = time.time()
    renderer_online = bool(snapshot.get('renderer_updated_ts')) and (
        now_ts - snapshot['renderer_updated_ts'] <= AVATAR_RENDERER_TIMEOUT_SECONDS
    )
    frame_available = bool(snapshot.get('frame_relative_path')) and bool(snapshot.get('frame_updated_ts'))
    frame_age_ms = int(max(0, now_ts - snapshot.get('frame_updated_ts', 0)) * 1000) if frame_available else None
    renderer_age_ms = int(max(0, now_ts - snapshot.get('renderer_updated_ts', 0)) * 1000) if renderer_online else None

    image_url = ''
    if frame_available:
        image_url = build_absolute_asset_url(snapshot['frame_relative_path'])
        separator = '&' if '?' in image_url else '?'
        image_url = f'{image_url}{separator}v={snapshot.get("frame_version", 0)}'

    audio_url = (snapshot.get('last_audio_url') or '').strip()
    if not audio_url and snapshot.get('last_audio_relative_path'):
        audio_url = build_absolute_asset_url(snapshot['last_audio_relative_path'])

    return {
        'renderer_online': renderer_online,
        'renderer_age_ms': renderer_age_ms,
        'frame_available': frame_available,
        'frame_age_ms': frame_age_ms,
        'image_url': image_url,
        'frame_updated_at': snapshot.get('frame_updated_at', ''),
        'frame_version': snapshot.get('frame_version', 0),
        'frame_width': snapshot.get('frame_width', 0),
        'frame_height': snapshot.get('frame_height', 0),
        'frame_text': snapshot.get('frame_text', ''),
        'frame_speaking': snapshot.get('frame_speaking', False),
        'sdk_status': snapshot.get('sdk_status', 'offline'),
        'ws_status': snapshot.get('ws_status', 'disconnected'),
        'environment': snapshot.get('environment', ''),
        'acceleration': snapshot.get('acceleration', ''),
        'render_nodes': snapshot.get('render_nodes', 0),
        'audio_state': snapshot.get('audio_state', ''),
        'last_voice_state': snapshot.get('last_voice_state', ''),
        'last_notice': snapshot.get('last_notice', ''),
        'last_error': snapshot.get('last_error', ''),
        'last_command_id': snapshot.get('last_command_id', 0),
        'last_command_type': snapshot.get('last_command_type', ''),
        'last_command_text': snapshot.get('last_command_text', ''),
        'last_audio_url': audio_url,
        'last_audio_text': snapshot.get('last_audio_text', ''),
        'last_audio_at': snapshot.get('last_audio_at', ''),
    }


def enqueue_avatar_command(command_type, text='', user='User', source='server', metadata=None):
    global avatar_command_seq

    avatar_command_seq += 1
    command = {
        'id': avatar_command_seq,
        'type': command_type,
        'text': text,
        'user': user or 'User',
        'source': source,
        'created_at': datetime.now().isoformat(),
        'metadata': metadata or {},
    }
    avatar_command_queue.append(command)

    if len(avatar_command_queue) > 120:
        del avatar_command_queue[:-80]

    return command


def list_avatar_commands(after_id=0, limit=20):
    return [item for item in avatar_command_queue if item['id'] > after_id][:limit]


def build_local_avatar_reply(message):
    content = (message or '').strip()
    if not content:
        return '我在这里陪着您，您慢慢说，我会认真听。'

    lowered = content.lower()
    if '喝水' in content:
        return '好呀，我来提醒您，先喝几口温水，慢一点就好。'
    if '吃药' in content or '药' in content:
        return '我记住了，我们把吃药这件事放在最重要的位置，我陪您一起记着。'
    if '家人' in content or '孙' in content or '儿子' in content or '女儿' in content:
        return '家人一直惦记着您呢，等会儿我们也可以一起看看他们的留言和照片。'
    if '难受' in content or '不舒服' in content:
        return '我听到了。如果现在身体不舒服，我们先坐稳休息一下，需要的话我也可以帮您提醒家人。'
    if '睡' in content:
        return '好的，等会儿我们把节奏放慢一点，做完手边这件事就安心休息。'
    if '你好' in content or 'hello' in lowered:
        return '您好呀，我在这里陪着您。今天我们慢慢聊，不着急。'
    if '谢谢' in content:
        return '不客气，我会一直在这里陪着您。'

    return f'我听到了，您刚刚说的是“{content}”。我会陪着您，我们一步一步来。'


def get_scalar_count(cursor, sql, params=()):
    cursor.execute(sql, params)
    row = cursor.fetchone()
    if not row:
        return 0
    return int(row.get('count', 0) if isinstance(row, dict) else row['count'])


def seed_demo_data(cursor):
    """为新数据库放入最小可运行数据，避免老人端首屏空白。"""
    family_id = 'family_001'

    user_count = get_scalar_count(
        cursor,
        'SELECT COUNT(*) as count FROM users WHERE family_id = ?',
        (family_id,),
    )
    if user_count == 0:
        cursor.execute(
            'INSERT INTO users (user_type, name, phone, family_id) VALUES (?, ?, ?, ?)',
            ('elderly', '张翠花', '13800138000', family_id),
        )
        cursor.execute(
            'INSERT INTO users (user_type, name, phone, family_id) VALUES (?, ?, ?, ?)',
            ('family', '李小雨', '13800135678', family_id),
        )
        cursor.execute(
            'INSERT INTO users (user_type, name, phone, family_id) VALUES (?, ?, ?, ?)',
            ('family', '张明', '13900139012', family_id),
        )

    schedule_count = get_scalar_count(
        cursor,
        'SELECT COUNT(*) as count FROM schedules WHERE family_id = ? AND is_active = 1',
        (family_id,),
    )
    if schedule_count == 0:
        today = get_beijing_time().strftime('%Y-%m-%d')
        demo_schedules = [
            ('服药提醒', '早餐后服用降压药', 'medication', f'{today} 08:00:00', 'daily'),
            ('饮水提醒', '记得喝一杯温水', 'meal', f'{today} 10:00:00', 'daily'),
            ('活动提醒', '下午散步30分钟', 'exercise', f'{today} 15:00:00', 'daily'),
            ('睡眠提醒', '准备休息，保持良好作息', 'other', f'{today} 21:00:00', 'daily'),
        ]
        for title, description, schedule_type, schedule_time, repeat_type in demo_schedules:
            cursor.execute(
                '''
                INSERT INTO schedules (
                    family_id, title, description, schedule_type, schedule_time,
                    repeat_type, status, auto_remind, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 1, 1)
                ''',
                (family_id, title, description, schedule_type, schedule_time, repeat_type),
            )

    message_count = get_scalar_count(
        cursor,
        'SELECT COUNT(*) as count FROM family_messages WHERE family_id = ? AND is_active = 1',
        (family_id,),
    )
    if message_count == 0:
        scheduled_time = (get_beijing_time() - timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute(
            '''
            INSERT INTO family_messages (
                family_id, content, sender_name, sender_relation, scheduled_time, played, liked, is_active
            ) VALUES (?, ?, ?, ?, ?, 0, 0, 1)
            ''',
            (family_id, '妈妈，记得按时吃药，下午我会视频通话看看您。', '小雨', '女儿', scheduled_time),
        )

    counselor_count = get_scalar_count(cursor, 'SELECT COUNT(*) as count FROM counselors')
    if counselor_count == 0:
        counselors = [
            ('李心怡', '资深心理咨询师', '15年', '老年心理、情绪疏导', '4.9', '李', 1),
            ('王建国', '心理治疗师', '12年', '焦虑调节、睡眠改善', '4.8', '王', 1),
        ]
        for item in counselors:
            cursor.execute(
                '''
                INSERT INTO counselors (
                    name, title, experience, specialty, rating, avatar, available, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                ''',
                item,
            )


def parse_schedule_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).replace('T', ' ').strip()
    if len(text) == 16:
        text += ':00'
    for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
        try:
            return datetime.strptime(text[:19], fmt)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def parse_repeat_days(value):
    if not value:
        return []
    if isinstance(value, list):
        return [int(item) for item in value if str(item).isdigit()]
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [int(item) for item in parsed if str(item).isdigit()]
    except Exception:
        pass
    return [int(item) for item in re.findall(r'\d+', str(value))]


def init_db():
    """初始化数据库"""
    conn = get_db()
    cursor = conn.cursor()

    # 用户表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_type TEXT NOT NULL,  -- 'family' 或 'elderly'
            name TEXT NOT NULL,
            phone TEXT,
            family_id TEXT,  -- 家庭组ID，关联家人和老人
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Backend-owned digital-human chat history for DeepSeek mode.
    ensure_avatar_interactions_table(cursor)

    # 日程/护理计划表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            family_id TEXT NOT NULL,  -- 家庭组ID
            title TEXT NOT NULL,  -- 日程标题
            description TEXT,  -- 详细描述
            schedule_type TEXT,  -- 类型：medication(用药)、exercise(运动)、meal(饮食)、checkup(检查)等
            schedule_time TIMESTAMP NOT NULL,  -- 日程时间
            repeat_type TEXT DEFAULT 'once',  -- 重复类型：once, daily, weekly, monthly
            repeat_days TEXT,  -- 重复的星期几，JSON格式：[1,3,5]
            status TEXT DEFAULT 'pending',  -- 状态：pending(待执行), completed(已完成), skipped(已放弃), missed(已错过)
            completed_at TIMESTAMP,  -- 完成时间
            auto_remind INTEGER DEFAULT 1,  -- 数字人自动播报：1=启用，0=禁用
            is_active INTEGER DEFAULT 1,  -- 是否启用
            created_by INTEGER,  -- 创建者用户ID
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    ''')

    # 提醒记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            schedule_id INTEGER NOT NULL,
            elderly_id INTEGER NOT NULL,  -- 老人用户ID
            remind_time TIMESTAMP NOT NULL,  -- 提醒时间
            status TEXT DEFAULT 'pending',  -- pending, completed, missed, dismissed
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (schedule_id) REFERENCES schedules(id),
            FOREIGN KEY (elderly_id) REFERENCES users(id)
        )
    ''')

    # 媒体文件表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            family_id TEXT NOT NULL,  -- 家庭组ID
            media_type TEXT NOT NULL,  -- 'photo' 或 'video'
            title TEXT NOT NULL,  -- 媒体标题
            description TEXT,  -- 描述
            file_path TEXT NOT NULL,  -- 文件存储路径
            file_size INTEGER,  -- 文件大小（字节）
            duration INTEGER,  -- 视频时长（秒），仅视频有值
            thumbnail_path TEXT,  -- 缩略图路径
            uploaded_by INTEGER,  -- 上传者用户ID
            is_active INTEGER DEFAULT 1,  -- 是否启用
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
    ''')

    # 媒体标签表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS media_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            media_id INTEGER NOT NULL,
            tag TEXT NOT NULL,  -- 标签内容，如 '孙女小米', '生日', '旅行' 等
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
        )
    ''')

    # 媒体触发策略表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS media_policies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            media_id INTEGER NOT NULL,
            time_windows TEXT,  -- 播放时段，JSON格式：["07:00-09:00", "19:00-21:00"]
            moods TEXT,  -- 适合心境，JSON格式：["happy", "sad", "calm"]
            occasions TEXT,  -- 特殊场合，JSON格式：["birthday", "anniversary"]
            cooldown INTEGER DEFAULT 60,  -- 冷却时间（分钟），避免重复播放
            priority INTEGER DEFAULT 5,  -- 优先级 1-10，数字越大优先级越高
            last_played_at TIMESTAMP,  -- 上次播放时间
            play_count INTEGER DEFAULT 0,  -- 播放次数
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
        )
    ''')

    # 媒体播放历史表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS media_play_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            media_id INTEGER NOT NULL,
            elderly_id INTEGER NOT NULL,  -- 老人用户ID
            played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 播放时间
            duration_watched INTEGER,  -- 观看时长（秒）
            completed INTEGER DEFAULT 0,  -- 是否看完：1=是，0=否
            triggered_by TEXT,  -- 触发方式：'auto'=自动, 'manual'=手动, 'mood'=情绪触发等
            mood_before TEXT,  -- 播放前情绪状态
            mood_after TEXT,  -- 播放后情绪状态
            FOREIGN KEY (media_id) REFERENCES media(id),
            FOREIGN KEY (elderly_id) REFERENCES users(id)
        )
    ''')

    # 媒体反馈表（点赞/点踩）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS media_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            media_id INTEGER NOT NULL,
            elderly_id INTEGER NOT NULL,  -- 老人用户ID
            feedback_type TEXT NOT NULL,  -- 'like' 或 'dislike'
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (media_id) REFERENCES media(id),
            FOREIGN KEY (elderly_id) REFERENCES users(id),
            UNIQUE(media_id, elderly_id)  -- 每个老人对每个媒体只能有一个反馈
        )
    ''')

    # 家属留言表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS family_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            family_id TEXT NOT NULL,  -- 家庭组ID
            content TEXT NOT NULL,  -- 留言内容
            sender_name TEXT NOT NULL,  -- 发送者姓名
            sender_relation TEXT NOT NULL,  -- 发送者称呼（儿子、女儿、孙女等）
            scheduled_time TIMESTAMP NOT NULL,  -- 预约播报时间
            played INTEGER DEFAULT 0,  -- 是否已播放：0=未播放，1=已播放
            played_at TIMESTAMP,  -- 实际播报时间
            liked INTEGER DEFAULT 0,  -- 老人是否点赞：0=未点赞，1=已点赞
            is_active INTEGER DEFAULT 1,  -- 是否有效
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 家属端消息/告警表（优化版）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS family_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            family_id TEXT NOT NULL,  -- 家庭组ID
            elderly_id INTEGER,  -- 老人用户ID（可选，用于关联具体老人）
            alert_type TEXT NOT NULL,  -- 消息类型：sos_emergency, contact_family, medication, emotion, inactive, emergency
            level TEXT NOT NULL,  -- 级别：low, medium, high
            title TEXT,  -- 消息标题（简短概要）
            message TEXT NOT NULL,  -- 消息详细内容
            metadata TEXT,  -- 额外元数据，JSON格式，如 {"location": "客厅", "device": "平板"}
            source TEXT DEFAULT 'elderly',  -- 消息来源：elderly(老人端), system(系统自动), family(家属端)
            handled INTEGER DEFAULT 0,  -- 是否已处理：0=未处理，1=已处理
            handled_at TIMESTAMP,  -- 处理时间
            handled_by INTEGER,  -- 处理人用户ID
            reply_message TEXT,  -- 家属回复内容
            read INTEGER DEFAULT 0,  -- 是否已读：0=未读，1=已读
            read_at TIMESTAMP,  -- 阅读时间
            is_active INTEGER DEFAULT 1,  -- 是否有效
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (elderly_id) REFERENCES users(id),
            FOREIGN KEY (handled_by) REFERENCES users(id)
        )
    ''')

    # 情绪记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mood_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            family_id TEXT NOT NULL,  -- 家庭组ID
            elderly_id INTEGER,  -- 老人用户ID
            mood_type TEXT NOT NULL,  -- 情绪类型：happy(开心), calm(平静), sad(难过), anxious(焦虑), angry(生气), tired(疲惫)
            mood_score INTEGER DEFAULT 5,  -- 情绪分数 1-10，数字越大越积极
            note TEXT,  -- 备注说明
            source TEXT DEFAULT 'manual',  -- 来源：manual(手动记录), ai_detect(AI检测), voice(语音分析)
            trigger_event TEXT,  -- 触发事件，如 '看了家人照片', '完成了散步'
            location TEXT,  -- 记录地点
            weather TEXT,  -- 天气情况
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 记录时间
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (elderly_id) REFERENCES users(id)
        )
    ''')

    # 心理咨询师表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS counselors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            title TEXT NOT NULL,
            experience TEXT,
            specialty TEXT,
            rating TEXT,
            avatar TEXT,
            available INTEGER DEFAULT 1,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 咨询预约/记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS consultations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            family_id TEXT NOT NULL,
            elderly_id INTEGER,
            counselor_id INTEGER,
            consultation_type TEXT DEFAULT 'phone',
            scheduled_time TIMESTAMP NOT NULL,
            duration INTEGER DEFAULT 45,
            status TEXT DEFAULT 'scheduled',
            note TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (elderly_id) REFERENCES users(id),
            FOREIGN KEY (counselor_id) REFERENCES counselors(id)
        )
    ''')

    # 情绪记录索引
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_mood_records_family_id
        ON mood_records(family_id)
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_mood_records_elderly_id
        ON mood_records(elderly_id)
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_mood_records_recorded_at
        ON mood_records(recorded_at DESC)
    ''')

    # 创建索引以提高查询性能
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_family_alerts_family_id
        ON family_alerts(family_id)
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_family_alerts_created_at
        ON family_alerts(created_at DESC)
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_family_alerts_handled
        ON family_alerts(handled, created_at DESC)
    ''')

    if SEED_DEMO_DATA:
        seed_demo_data(cursor)

    conn.commit()
    conn.close()

# ==================== 家人端 API ====================

@app.route('/api/family/schedules', methods=['GET'])
def get_family_schedules():
    """获取家庭所有日程"""
    family_id = request.args.get('family_id')
    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT s.*, u.name as creator_name
        FROM schedules s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.family_id = ? AND s.is_active = 1
        ORDER BY s.schedule_time DESC
    ''', (family_id,))

    schedules = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({'schedules': schedules})

@app.route('/api/family/schedules', methods=['POST'])
def create_schedule():
    """创建新日程"""
    data = request.json

    required_fields = ['family_id', 'title', 'schedule_time']
    if not all(field in data for field in required_fields):
        return jsonify({'error': '缺少必需字段'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO schedules (
            family_id, title, description, schedule_type,
            schedule_time, repeat_type, repeat_days, auto_remind, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data['family_id'],
        data['title'],
        data.get('description', ''),
        data.get('schedule_type', 'other'),
        data['schedule_time'],
        data.get('repeat_type', 'once'),
        data.get('repeat_days', ''),
        data.get('auto_remind', 1),
        data.get('created_by')
    ))

    schedule_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'schedule_id': schedule_id}), 201

@app.route('/api/family/schedules/<int:schedule_id>', methods=['PUT'])
def update_schedule(schedule_id):
    """更新日程"""
    data = request.json

    conn = get_db()
    cursor = conn.cursor()

    # 构建更新语句
    update_fields = []
    params = []

    for field in ['title', 'description', 'schedule_type', 'schedule_time', 'repeat_type', 'repeat_days', 'auto_remind', 'status']:
        if field in data:
            update_fields.append(f"{field} = ?")
            params.append(data[field])

    if not update_fields:
        return jsonify({'error': '没有要更新的字段'}), 400

    update_fields.append("updated_at = CURRENT_TIMESTAMP")
    params.append(schedule_id)

    cursor.execute(f'''
        UPDATE schedules
        SET {', '.join(update_fields)}
        WHERE id = ?
    ''', params)

    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/family/schedules/<int:schedule_id>', methods=['DELETE'])
def delete_schedule(schedule_id):
    """删除日程（软删除）"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE schedules
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (schedule_id,))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

# ==================== 家属端消息/告警 API ====================

@app.route('/api/family/alerts', methods=['GET'])
def get_family_alerts():
    """获取家庭所有消息/告警"""
    family_id = request.args.get('family_id')
    status = request.args.get('status')  # all, unhandled, handled
    handled = request.args.get('handled')  # true/false 布尔值
    read = request.args.get('read')  # true/false 布尔值
    alert_type = request.args.get('alert_type')  # 消息类型
    elderly_id = request.args.get('elderly_id', type=int)  # 老人ID
    level = request.args.get('level')  # low, medium, high
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # 构建查询条件
    conditions = ['a.family_id = ?', 'a.is_active = 1']
    params = [family_id]

    # 排除媒体展示事件（这些只用于老人端轮询，不应出现在家属端通知列表）
    conditions.append("a.alert_type != 'media_display'")

    # 支持status参数（兼容旧版）
    if status == 'unhandled':
        conditions.append('a.handled = 0')
    elif status == 'handled':
        conditions.append('a.handled = 1')

    # 支持handled参数（布尔值）
    if handled is not None:
        if handled.lower() == 'true':
            conditions.append('a.handled = 1')
        elif handled.lower() == 'false':
            conditions.append('a.handled = 0')

    # 支持read参数（布尔值）
    if read is not None:
        if read.lower() == 'true':
            conditions.append('a.read = 1')
        elif read.lower() == 'false':
            conditions.append('a.read = 0')

    # 支持alert_type参数
    if alert_type:
        conditions.append('a.alert_type = ?')
        params.append(alert_type)

    # 支持elderly_id参数
    if elderly_id:
        conditions.append('a.elderly_id = ?')
        params.append(elderly_id)

    if level:
        conditions.append('a.level = ?')
        params.append(level)

    where_clause = ' AND '.join(conditions)

    # 查询总数
    cursor.execute(f'''
        SELECT COUNT(*) as total FROM family_alerts a
        WHERE {where_clause}
    ''', params)

    total = cursor.fetchone()['total']

    # 查询数据（包含老人信息）
    cursor.execute(f'''
        SELECT
            a.*,
            u.name as elderly_name,
            h.name as handler_name
        FROM family_alerts a
        LEFT JOIN users u ON a.elderly_id = u.id
        LEFT JOIN users h ON a.handled_by = h.id
        WHERE {where_clause}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
    ''', params + [limit, offset])

    alerts = []
    for row in cursor.fetchall():
        alert = dict(row)
        # 转换布尔值
        alert['handled'] = bool(alert['handled'])
        alert['read'] = bool(alert['read'])
        # 解析元数据JSON
        if alert['metadata']:
            try:
                alert['metadata'] = json.loads(alert['metadata'])
            except:
                alert['metadata'] = {}
        alerts.append(alert)

    conn.close()

    return jsonify({
        'alerts': alerts,
        'total': total,
        'limit': limit,
        'offset': offset
    })

@app.route('/api/family/alerts', methods=['POST'])
def create_alert():
    """创建新消息/告警（由老人端或系统触发）"""
    data = request.json

    required_fields = ['family_id', 'alert_type', 'level', 'message']
    if not all(field in data for field in required_fields):
        return jsonify({'error': '缺少必需字段'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # 处理元数据
    metadata = data.get('metadata', {})
    metadata_json = json.dumps(metadata) if metadata else None

    cursor.execute('''
        INSERT INTO family_alerts (
            family_id, elderly_id, alert_type, level, title, message,
            metadata, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data['family_id'],
        data.get('elderly_id'),
        data['alert_type'],
        data['level'],
        data.get('title'),
        data['message'],
        metadata_json,
        data.get('source', 'elderly')
    ))

    alert_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'alert_id': alert_id}), 201

@app.route('/api/family/alerts/<int:alert_id>/handle', methods=['POST'])
def handle_alert(alert_id):
    """标记消息/告警为已处理"""
    data = request.json or {}

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE family_alerts
        SET handled = 1,
            handled_at = CURRENT_TIMESTAMP,
            handled_by = ?,
            reply_message = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (
        data.get('handled_by'),
        data.get('reply_message'),
        alert_id
    ))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/family/alerts/<int:alert_id>/read', methods=['POST'])
def mark_alert_read(alert_id):
    """标记消息为已读"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE family_alerts
        SET read = 1,
            read_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (alert_id,))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/family/alerts/<int:alert_id>/reply', methods=['POST'])
def reply_alert(alert_id):
    """家属回复消息"""
    data = request.json

    if not data or 'reply_message' not in data:
        return jsonify({'error': '缺少reply_message字段'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE family_alerts
        SET reply_message = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (data['reply_message'], alert_id))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/family/alerts/<int:alert_id>', methods=['DELETE'])
def delete_alert(alert_id):
    """删除消息/告警（软删除）"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE family_alerts
        SET is_active = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (alert_id,))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/family/alerts/stats', methods=['GET'])
def get_alerts_stats():
    """获取消息统计数据"""
    family_id = request.args.get('family_id')

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # 统计各级别消息数量（排除媒体展示事件）
    cursor.execute('''
        SELECT
            level,
            COUNT(*) as count
        FROM family_alerts
        WHERE family_id = ? AND is_active = 1 AND alert_type != 'media_display'
        GROUP BY level
    ''', (family_id,))

    level_stats = {row['level']: row['count'] for row in cursor.fetchall()}

    # 统计各类型消息数量（排除媒体展示事件）
    cursor.execute('''
        SELECT
            alert_type,
            COUNT(*) as count
        FROM family_alerts
        WHERE family_id = ? AND is_active = 1 AND alert_type != 'media_display'
        GROUP BY alert_type
    ''', (family_id,))

    type_stats = {row['alert_type']: row['count'] for row in cursor.fetchall()}

    # 统计已处理/未处理（排除媒体展示事件）
    cursor.execute('''
        SELECT
            COUNT(CASE WHEN handled = 0 THEN 1 END) as unhandled,
            COUNT(CASE WHEN handled = 1 THEN 1 END) as handled,
            COUNT(CASE WHEN read = 0 THEN 1 END) as unread
        FROM family_alerts
        WHERE family_id = ? AND is_active = 1 AND alert_type != 'media_display'
    ''', (family_id,))

    status_stats = dict(cursor.fetchone())

    # 今日新增消息数（排除媒体展示事件）
    cursor.execute('''
        SELECT COUNT(*) as today_count
        FROM family_alerts
        WHERE family_id = ? AND is_active = 1 AND alert_type != 'media_display'
        AND DATE(created_at) = DATE('now')
    ''', (family_id,))

    today_count = cursor.fetchone()['today_count']

    conn.close()

    return jsonify({
        'level_stats': level_stats,
        'type_stats': type_stats,
        'status_stats': status_stats,
        'today_count': today_count
    })

# ==================== 家属留言 API ====================

@app.route('/api/family/messages', methods=['GET'])
def get_family_messages():
    """获取家庭所有留言"""
    family_id = request.args.get('family_id')
    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT * FROM family_messages
        WHERE family_id = ? AND is_active = 1
        ORDER BY created_at DESC
    ''', (family_id,))

    messages = []
    for row in cursor.fetchall():
        msg = dict(row)
        # 转换布尔值
        msg['played'] = bool(msg['played'])
        msg['liked'] = bool(msg['liked'])
        # 转换UTC时间为北京时间
        msg['created_at'] = utc_to_beijing(msg['created_at'])
        msg['updated_at'] = utc_to_beijing(msg['updated_at'])
        if msg.get('played_at'):
            msg['played_at'] = utc_to_beijing(msg['played_at'])
        messages.append(msg)

    conn.close()

    return jsonify({'messages': messages})

@app.route('/api/family/messages', methods=['POST'])
def create_message():
    """创建新留言"""
    data = request.json

    required_fields = ['family_id', 'content', 'sender_name', 'sender_relation', 'scheduled_time']
    if not all(field in data for field in required_fields):
        return jsonify({'error': '缺少必需字段'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO family_messages (
            family_id, content, sender_name, sender_relation, scheduled_time
        ) VALUES (?, ?, ?, ?, ?)
    ''', (
        data['family_id'],
        data['content'],
        data['sender_name'],
        data['sender_relation'],
        data['scheduled_time']
    ))

    message_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message_id': message_id}), 201

@app.route('/api/family/messages/<int:message_id>', methods=['DELETE'])
def delete_message(message_id):
    """删除留言（软删除）"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE family_messages
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (message_id,))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

# ==================== 老人端留言 API ====================

@app.route('/api/elderly/messages', methods=['GET'])
def get_elderly_messages():
    """获取老人端的留言列表（按预约时间排序）"""
    family_id = request.args.get('family_id')
    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT * FROM family_messages
        WHERE family_id = ? AND is_active = 1
        ORDER BY scheduled_time ASC
    ''', (family_id,))

    messages = []
    for row in cursor.fetchall():
        msg = dict(row)
        msg['played'] = bool(msg['played'])
        msg['liked'] = bool(msg['liked'])
        # 转换UTC时间为北京时间
        msg['created_at'] = utc_to_beijing(msg['created_at'])
        msg['updated_at'] = utc_to_beijing(msg['updated_at'])
        if msg.get('played_at'):
            msg['played_at'] = utc_to_beijing(msg['played_at'])
        messages.append(msg)

    conn.close()

    return jsonify({'messages': messages})

@app.route('/api/elderly/messages/pending', methods=['GET'])
def get_pending_messages():
    """获取待播放的留言（预约时间已到但未播放的）"""
    family_id = request.args.get('family_id')
    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # 调试日志 - 使用北京时间
    beijing_now = get_beijing_time()
    current_time = beijing_now.strftime('%Y-%m-%d %H:%M:%S')
    print(f"[DEBUG] 当前北京时间: {current_time}")

    cursor.execute('''
        SELECT * FROM family_messages
        WHERE family_id = ?
          AND is_active = 1
          AND played = 0
        ORDER BY scheduled_time ASC
    ''', (family_id,))

    # 获取所有未播放的消息
    all_messages = []
    for row in cursor.fetchall():
        msg = dict(row)
        print(f"[DEBUG] 留言 ID: {msg['id']}, 预约时间: {msg['scheduled_time']}")
        all_messages.append(msg)

    # 在 Python 中进行时间比较（更可靠） - 使用北京时间
    now = beijing_now.replace(tzinfo=None)  # 移除时区信息以便比较
    messages = []
    for msg in all_messages:
        try:
            # 处理各种可能的时间格式
            scheduled_str = msg['scheduled_time']
            # 移除 'T'，统一为空格分隔
            scheduled_str = scheduled_str.replace('T', ' ')
            # 如果没有秒数，添加 :00
            if len(scheduled_str) == 16:  # YYYY-MM-DD HH:MM
                scheduled_str += ':00'

            scheduled_time = datetime.strptime(scheduled_str, '%Y-%m-%d %H:%M:%S')

            print(f"[DEBUG] 解析后时间: {scheduled_time}, 当前北京时间: {now}, 已到期: {scheduled_time <= now}")

            if scheduled_time <= now:
                msg['played'] = bool(msg['played'])
                msg['liked'] = bool(msg['liked'])
                # 转换UTC时间为北京时间
                msg['created_at'] = utc_to_beijing(msg['created_at'])
                msg['updated_at'] = utc_to_beijing(msg['updated_at'])
                if msg.get('played_at'):
                    msg['played_at'] = utc_to_beijing(msg['played_at'])
                messages.append(msg)
        except Exception as e:
            print(f"[DEBUG] 时间解析错误: {e}, 原始值: {msg['scheduled_time']}")
            continue

    conn.close()

    print(f"[DEBUG] 找到 {len(messages)} 条待播放留言")
    return jsonify({'messages': messages})

@app.route('/api/elderly/messages/<int:message_id>/play', methods=['POST'])
def play_message(message_id):
    """标记留言为已播放"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE family_messages
        SET played = 1,
            played_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (message_id,))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/elderly/messages/<int:message_id>/like', methods=['POST'])
def like_message(message_id):
    """老人点赞留言"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE family_messages
        SET liked = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (message_id,))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/elderly/messages/<int:message_id>/unlike', methods=['POST'])
def unlike_message(message_id):
    """老人取消点赞"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE family_messages
        SET liked = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (message_id,))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

# ==================== 老人端消息/告警 API ====================

@app.route('/api/elderly/alerts', methods=['POST'])
def create_elderly_alert():
    """老人端创建消息（如SOS、联系家人）"""
    data = request.json

    required_fields = ['family_id', 'alert_type', 'level', 'message']
    if not all(field in data for field in required_fields):
        return jsonify({'error': '缺少必需字段'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # 处理元数据
    metadata = data.get('metadata', {})
    metadata_json = json.dumps(metadata) if metadata else None

    cursor.execute('''
        INSERT INTO family_alerts (
            family_id, elderly_id, alert_type, level, title, message,
            metadata, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'elderly')
    ''', (
        data['family_id'],
        data.get('elderly_id'),
        data['alert_type'],
        data['level'],
        data.get('title'),
        data['message'],
        metadata_json
    ))

    alert_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'alert_id': alert_id}), 201

@app.route('/api/elderly/alerts/replies', methods=['GET'])
def get_elderly_alert_replies():
    """获取家属对老人消息的回复"""
    family_id = request.args.get('family_id')
    elderly_id = request.args.get('elderly_id')

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    conditions = ['family_id = ?', 'is_active = 1', 'reply_message IS NOT NULL']
    params = [family_id]

    if elderly_id:
        conditions.append('elderly_id = ?')
        params.append(elderly_id)

    where_clause = ' AND '.join(conditions)

    cursor.execute(f'''
        SELECT
            id, alert_type, level, message, reply_message,
            handled_at, created_at
        FROM family_alerts
        WHERE {where_clause}
        ORDER BY handled_at DESC
        LIMIT 10
    ''', params)

    replies = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({'replies': replies})

# ==================== 情绪记录 API ====================

@app.route('/api/elderly/moods', methods=['POST'])
def create_mood_record():
    """老人端创建情绪记录"""
    data = request.json

    required_fields = ['family_id', 'mood_type']
    if not all(field in data for field in required_fields):
        return jsonify({'error': '缺少必需字段'}), 400

    # 验证情绪类型
    valid_moods = ['happy', 'calm', 'sad', 'anxious', 'angry', 'tired']
    if data['mood_type'] not in valid_moods:
        return jsonify({'error': '无效的情绪类型'}), 400

    # 验证情绪分数范围
    mood_score = data.get('mood_score', 5)
    if not (1 <= mood_score <= 10):
        return jsonify({'error': '情绪分数必须在1-10之间'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO mood_records (
            family_id, elderly_id, mood_type, mood_score, note,
            source, trigger_event, location, weather, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data['family_id'],
        data.get('elderly_id'),
        data['mood_type'],
        mood_score,
        data.get('note', ''),
        data.get('source', 'manual'),
        data.get('trigger_event', ''),
        data.get('location', ''),
        data.get('weather', ''),
        data.get('recorded_at', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    ))

    record_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'record_id': record_id}), 201

@app.route('/api/elderly/moods', methods=['GET'])
def get_elderly_moods():
    """获取老人的情绪记录列表"""
    family_id = request.args.get('family_id')
    elderly_id = request.args.get('elderly_id')
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    conditions = ['family_id = ?']
    params = [family_id]

    if elderly_id:
        conditions.append('elderly_id = ?')
        params.append(elderly_id)

    where_clause = ' AND '.join(conditions)

    # 查询总数
    cursor.execute(f'''
        SELECT COUNT(*) as total FROM mood_records
        WHERE {where_clause}
    ''', params)

    total = cursor.fetchone()['total']

    # 查询数据
    cursor.execute(f'''
        SELECT * FROM mood_records
        WHERE {where_clause}
        ORDER BY recorded_at DESC
        LIMIT ? OFFSET ?
    ''', params + [limit, offset])

    records = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({
        'records': records,
        'total': total,
        'limit': limit,
        'offset': offset
    })

@app.route('/api/elderly/moods/today', methods=['GET'])
def get_today_moods():
    """获取老人今日的情绪记录"""
    family_id = request.args.get('family_id')
    elderly_id = request.args.get('elderly_id')

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    today = datetime.now().strftime('%Y-%m-%d')

    conditions = ['family_id = ?', 'DATE(recorded_at) = DATE(?)']
    params = [family_id, today]

    if elderly_id:
        conditions.append('elderly_id = ?')
        params.append(elderly_id)

    where_clause = ' AND '.join(conditions)

    cursor.execute(f'''
        SELECT * FROM mood_records
        WHERE {where_clause}
        ORDER BY recorded_at DESC
    ''', params)

    records = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({'records': records})

@app.route('/api/elderly/moods/latest', methods=['GET'])
def get_latest_mood():
    """获取老人最新的情绪记录"""
    family_id = request.args.get('family_id')
    elderly_id = request.args.get('elderly_id')

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    conditions = ['family_id = ?']
    params = [family_id]

    if elderly_id:
        conditions.append('elderly_id = ?')
        params.append(elderly_id)

    where_clause = ' AND '.join(conditions)

    cursor.execute(f'''
        SELECT * FROM mood_records
        WHERE {where_clause}
        ORDER BY recorded_at DESC
        LIMIT 1
    ''', params)

    row = cursor.fetchone()
    conn.close()

    if row:
        return jsonify({'record': dict(row)})
    else:
        return jsonify({'record': None})

def _weather_descriptor(code):
    if code == 0:
        return '☀️', '晴'
    if code in (1, 2):
        return '🌤️', '少云'
    if code == 3:
        return '☁️', '阴'
    if code in (45, 48):
        return '🌫️', '雾'
    if code in (51, 53, 55, 56, 57):
        return '🌦️', '毛毛雨'
    if code in (61, 63, 65, 66, 67, 80, 81, 82):
        return '🌧️', '雨'
    if code in (71, 73, 75, 77, 85, 86):
        return '❄️', '雪'
    if code in (95, 96, 99):
        return '⛈️', '雷雨'
    return '🌤️', '天气'

def _format_weather_payload(code=None, temperature=None, source='fallback'):
    icon, label = _weather_descriptor(code)
    temperature_text = ''
    if temperature is not None:
        try:
            temperature_text = f" {round(float(temperature))}°C"
        except (TypeError, ValueError):
            temperature_text = ''

    return {
        'icon': icon,
        'text': f"{label}{temperature_text}".strip() if source != 'fallback' else '天气待同步',
        'source': source,
        'weather_code': code,
        'temperature': temperature
    }

def _get_latest_mood_weather(family_id, elderly_id=None):
    conn = get_db()
    cursor = conn.cursor()

    conditions = ['family_id = ?', "weather IS NOT NULL", "weather != ''"]
    params = [family_id]

    if elderly_id:
        conditions.append('elderly_id = ?')
        params.append(elderly_id)

    where_clause = ' AND '.join(conditions)
    cursor.execute(f'''
        SELECT weather FROM mood_records
        WHERE {where_clause}
        ORDER BY recorded_at DESC
        LIMIT 1
    ''', params)

    row = cursor.fetchone()
    conn.close()
    return row['weather'] if row else None

@app.route('/api/elderly/weather', methods=['GET'])
def get_elderly_weather():
    """老人端天气聚合：优先实时天气，失败时回退最近情绪记录天气"""
    family_id = request.args.get('family_id')
    elderly_id = request.args.get('elderly_id')
    latitude = request.args.get('latitude')
    longitude = request.args.get('longitude')

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    if latitude and longitude:
        try:
            response = requests.get(
                'https://api.open-meteo.com/v1/forecast',
                params={
                    'latitude': latitude,
                    'longitude': longitude,
                    'current': 'temperature_2m,weather_code',
                    'timezone': 'auto'
                },
                timeout=5
            )
            response.raise_for_status()
            current = response.json().get('current') or {}
            weather = _format_weather_payload(
                current.get('weather_code'),
                current.get('temperature_2m'),
                'geolocation'
            )
            return jsonify({'weather': weather})
        except Exception as exc:
            print(f"获取实时天气失败，回退到情绪记录天气: {exc}")

    weather_text = _get_latest_mood_weather(family_id, elderly_id)
    if weather_text:
        return jsonify({
            'weather': {
                'icon': '🌤️',
                'text': weather_text,
                'source': 'mood',
                'weather_code': None,
                'temperature': None
            }
        })

    return jsonify({'weather': _format_weather_payload(source='fallback')})

# ==================== 家属端情绪记录 API ====================

@app.route('/api/family/moods', methods=['GET'])
def get_family_moods():
    """家属端获取老人的情绪记录"""
    family_id = request.args.get('family_id')
    elderly_id = request.args.get('elderly_id')
    mood_type = request.args.get('mood_type')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    conditions = ['m.family_id = ?']
    params = [family_id]

    if elderly_id:
        conditions.append('m.elderly_id = ?')
        params.append(elderly_id)

    if mood_type:
        conditions.append('m.mood_type = ?')
        params.append(mood_type)

    if start_date:
        conditions.append('DATE(m.recorded_at) >= DATE(?)')
        params.append(start_date)

    if end_date:
        conditions.append('DATE(m.recorded_at) <= DATE(?)')
        params.append(end_date)

    where_clause = ' AND '.join(conditions)

    # 查询总数
    cursor.execute(f'''
        SELECT COUNT(*) as total FROM mood_records m
        WHERE {where_clause}
    ''', params)

    total = cursor.fetchone()['total']

    # 查询数据（包含老人信息）
    cursor.execute(f'''
        SELECT
            m.*,
            u.name as elderly_name
        FROM mood_records m
        LEFT JOIN users u ON m.elderly_id = u.id
        WHERE {where_clause}
        ORDER BY m.recorded_at DESC
        LIMIT ? OFFSET ?
    ''', params + [limit, offset])

    records = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({
        'records': records,
        'total': total,
        'limit': limit,
        'offset': offset
    })

@app.route('/api/family/moods/stats', methods=['GET'])
def get_mood_stats():
    """获取情绪统计数据"""
    family_id = request.args.get('family_id')
    elderly_id = request.args.get('elderly_id')
    days = request.args.get('days', 7, type=int)  # 统计最近N天

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    conditions = ['family_id = ?']
    params = [family_id]

    if elderly_id:
        conditions.append('elderly_id = ?')
        params.append(elderly_id)

    # 添加时间范围条件
    conditions.append(f"DATE(recorded_at) >= DATE('now', '-{days} days')")

    where_clause = ' AND '.join(conditions)

    # 按情绪类型统计
    cursor.execute(f'''
        SELECT
            mood_type,
            COUNT(*) as count,
            AVG(mood_score) as avg_score
        FROM mood_records
        WHERE {where_clause}
        GROUP BY mood_type
        ORDER BY count DESC
    ''', params)

    mood_type_stats = []
    for row in cursor.fetchall():
        stat = dict(row)
        stat['avg_score'] = round(stat['avg_score'], 1) if stat['avg_score'] else 0
        mood_type_stats.append(stat)

    # 按日期统计平均分数
    cursor.execute(f'''
        SELECT
            DATE(recorded_at) as date,
            AVG(mood_score) as avg_score,
            COUNT(*) as count
        FROM mood_records
        WHERE {where_clause}
        GROUP BY DATE(recorded_at)
        ORDER BY date DESC
    ''', params)

    daily_stats = []
    for row in cursor.fetchall():
        stat = dict(row)
        stat['avg_score'] = round(stat['avg_score'], 1) if stat['avg_score'] else 0
        daily_stats.append(stat)

    # 计算整体统计
    cursor.execute(f'''
        SELECT
            COUNT(*) as total_records,
            AVG(mood_score) as avg_score,
            MAX(mood_score) as max_score,
            MIN(mood_score) as min_score
        FROM mood_records
        WHERE {where_clause}
    ''', params)

    overall = dict(cursor.fetchone())
    overall['avg_score'] = round(overall['avg_score'], 1) if overall['avg_score'] else 0

    # 今日记录数
    cursor.execute(f'''
        SELECT COUNT(*) as today_count
        FROM mood_records
        WHERE {where_clause.replace(f"DATE(recorded_at) >= DATE('now', '-{days} days')", "DATE(recorded_at) = DATE('now')")}
    ''', params)

    today_count = cursor.fetchone()['today_count']

    conn.close()

    return jsonify({
        'mood_type_stats': mood_type_stats,
        'daily_stats': daily_stats,
        'overall': overall,
        'today_count': today_count,
        'days': days
    })

@app.route('/api/family/moods/trend', methods=['GET'])
def get_mood_trend():
    """获取情绪趋势数据"""
    family_id = request.args.get('family_id')
    elderly_id = request.args.get('elderly_id')
    days = request.args.get('days', 30, type=int)

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    conditions = ['family_id = ?']
    params = [family_id]

    if elderly_id:
        conditions.append('elderly_id = ?')
        params.append(elderly_id)

    conditions.append(f"DATE(recorded_at) >= DATE('now', '-{days} days')")

    where_clause = ' AND '.join(conditions)

    # 按日期获取情绪趋势
    cursor.execute(f'''
        SELECT
            DATE(recorded_at) as date,
            mood_type,
            AVG(mood_score) as avg_score,
            COUNT(*) as count
        FROM mood_records
        WHERE {where_clause}
        GROUP BY DATE(recorded_at), mood_type
        ORDER BY date ASC, count DESC
    ''', params)

    trend_data = []
    for row in cursor.fetchall():
        item = dict(row)
        item['avg_score'] = round(item['avg_score'], 1) if item['avg_score'] else 0
        trend_data.append(item)

    conn.close()

    return jsonify({
        'trend': trend_data,
        'days': days
    })

@app.route('/api/family/interactions', methods=['GET'])
def get_family_interactions():
    """代理获取老人和数字人的互动消息，避免小程序直接访问 Fay 端口。"""
    username = request.args.get('username', 'User')
    limit = request.args.get('limit', 100, type=int)

    if AVATAR_CHAT_PROVIDER == 'deepseek':
        normalized_limit = normalize_history_limit(limit)
        return jsonify({
            'list': get_avatar_interaction_history(username=username, limit=normalized_limit),
            'available': True,
            'error': '',
            'username': username,
            'limit': normalized_limit,
            'source': 'deepseek',
            'knowledge_enabled': AVATAR_REQUIRE_YUESHEN_RAG,
        })

    messages, error = fetch_fay_messages(username=username, limit=limit)

    if error:
        return jsonify({
            'list': [],
            'available': False,
            'error': error,
            'username': username,
            'limit': limit
        })

    cleaned_messages = []
    for item in messages:
        sanitized = sanitize_fay_message_item(item)
        if sanitized and sanitized.get('content'):
            cleaned_messages.append(sanitized)

    return jsonify({
        'list': cleaned_messages,
        'available': True,
        'error': '',
        'username': username,
        'limit': limit
    })


@app.route('/api/family/interactions/clear', methods=['POST'])
def clear_family_interactions():
    data = request.json or {}
    username = (data.get('username') or request.args.get('username') or '').strip()
    scope_username = username or None
    local_deleted = clear_avatar_interactions(scope_username)
    fay_deleted = clear_fay_history_messages(scope_username)

    return jsonify({
        'success': True,
        'username': scope_username or 'all',
        'local_deleted': local_deleted,
        'fay_deleted': fay_deleted,
        'source': AVATAR_CHAT_PROVIDER,
        'knowledge_enabled': AVATAR_REQUIRE_YUESHEN_RAG,
    })

# ==================== 老人端 API ====================

@app.route('/api/elderly/schedules/today', methods=['GET'])
def get_today_schedules():
    """获取老人今日日程"""
    family_id = request.args.get('family_id')
    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT * FROM schedules
        WHERE family_id = ?
        AND is_active = 1
        ORDER BY TIME(schedule_time)
    ''', (family_id,))

    today = get_beijing_time().date()
    today_weekday = int(today.strftime('%w'))
    schedules = []
    for row in cursor.fetchall():
        item = dict(row)
        schedule_time = parse_schedule_datetime(item.get('schedule_time'))
        repeat_type = item.get('repeat_type') or 'once'

        include = False
        if repeat_type == 'daily':
            include = True
        elif repeat_type == 'weekly':
            repeat_days = parse_repeat_days(item.get('repeat_days'))
            include = today_weekday in repeat_days
        elif repeat_type == 'monthly' and schedule_time:
            include = schedule_time.day == today.day
        elif schedule_time:
            include = schedule_time.date() == today

        if include:
            schedules.append(item)

    schedules.sort(key=lambda item: parse_schedule_datetime(item.get('schedule_time')) or datetime.min)
    conn.close()

    return jsonify({'schedules': schedules})

@app.route('/api/elderly/schedules/history', methods=['GET'])
def get_schedule_history():
    """鑾峰彇鑰佷汉绔巻鍙叉棩绋?"""
    family_id = request.args.get('family_id')
    limit = request.args.get('limit', 40, type=int)
    if not family_id:
        return jsonify({'error': '缂哄皯family_id鍙傛暟'}), 400

    normalized_limit = max(1, min(limit or 40, 100))
    now = get_beijing_time().replace(tzinfo=None)

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT * FROM schedules
        WHERE family_id = ?
        AND is_active = 1
        ORDER BY schedule_time DESC
    ''', (family_id,))

    schedules = []
    for row in cursor.fetchall():
        item = dict(row)
        schedule_time = parse_schedule_datetime(item.get('schedule_time'))
        status = (item.get('status') or 'pending').lower()

        include = status in ('completed', 'skipped', 'missed')
        if not include and schedule_time:
            include = schedule_time < now

        if include:
            schedules.append(item)
            if len(schedules) >= normalized_limit:
                break

    schedules.sort(
        key=lambda item: parse_schedule_datetime(item.get('schedule_time')) or datetime.min,
        reverse=True
    )
    conn.close()

    return jsonify({'schedules': schedules, 'limit': normalized_limit})

@app.route('/api/elderly/schedules/upcoming', methods=['GET'])
def get_upcoming_schedules():
    """获取即将到来的日程（下一小时内）"""
    family_id = request.args.get('family_id')
    elderly_id = request.args.get('elderly_id')

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT * FROM schedules
        WHERE family_id = ?
        AND is_active = 1
        AND datetime(schedule_time) BETWEEN datetime('now') AND datetime('now', '+1 hour')
        ORDER BY schedule_time
    ''', (family_id,))

    schedules = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({'schedules': schedules})

@app.route('/api/elderly/reminders/<int:reminder_id>/complete', methods=['POST'])
def complete_reminder(reminder_id):
    """标记提醒为已完成"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE reminders
        SET status = 'completed', completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (reminder_id,))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/elderly/reminders/<int:reminder_id>/dismiss', methods=['POST'])
def dismiss_reminder(reminder_id):
    """忽略提醒"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE reminders
        SET status = 'dismissed'
        WHERE id = ?
    ''', (reminder_id,))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/elderly/schedules/<int:schedule_id>/status', methods=['POST'])
def update_schedule_status(schedule_id):
    """更新日程状态"""
    data = request.json
    status = data.get('status')  # pending, completed, skipped, missed

    if status not in ['pending', 'completed', 'skipped', 'missed']:
        return jsonify({'error': '无效的状态值'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # 如果状态是 completed，记录完成时间
    if status == 'completed':
        cursor.execute('''
            UPDATE schedules
            SET status = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (status, schedule_id))
    else:
        cursor.execute('''
            UPDATE schedules
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (status, schedule_id))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

# ==================== 用户管理 API ====================

@app.route('/api/users', methods=['POST'])
def create_user():
    """创建用户"""
    data = request.json

    required_fields = ['user_type', 'name', 'family_id']
    if not all(field in data for field in required_fields):
        return jsonify({'error': '缺少必需字段'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO users (user_type, name, phone, family_id)
        VALUES (?, ?, ?, ?)
    ''', (
        data['user_type'],
        data['name'],
        data.get('phone', ''),
        data['family_id']
    ))

    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'user_id': user_id}), 201

@app.route('/api/users/<string:family_id>', methods=['GET'])
def get_family_users(family_id):
    """获取家庭成员列表"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT * FROM users
        WHERE family_id = ?
        ORDER BY user_type, created_at
    ''', (family_id,))

    users = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({'users': users})

# ==================== 心理咨询 API ====================

@app.route('/api/counselors', methods=['GET'])
def get_counselors():
    """获取可用咨询师列表"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT *
        FROM counselors
        WHERE is_active = 1
        ORDER BY available DESC, rating DESC, id ASC
    ''')

    counselors = []
    for row in cursor.fetchall():
        item = dict(row)
        item['available'] = bool(item.get('available'))
        counselors.append(item)

    conn.close()
    return jsonify({'counselors': counselors})


@app.route('/api/consultations', methods=['GET'])
def get_consultations():
    """获取咨询预约与历史记录"""
    family_id = request.args.get('family_id')
    elderly_id = request.args.get('elderly_id')
    limit = request.args.get('limit', 20, type=int)

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    conditions = ['c.family_id = ?']
    params = [family_id]

    if elderly_id:
        conditions.append('c.elderly_id = ?')
        params.append(elderly_id)

    where_clause = ' AND '.join(conditions)

    cursor.execute(f'''
        SELECT
            c.*,
            co.name as counselor_name,
            co.title as counselor_title,
            co.avatar as counselor_avatar
        FROM consultations c
        LEFT JOIN counselors co ON c.counselor_id = co.id
        WHERE {where_clause}
        ORDER BY c.scheduled_time DESC
        LIMIT ?
    ''', params + [limit])

    consultations = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'consultations': consultations})


@app.route('/api/consultations', methods=['POST'])
def create_consultation():
    """创建咨询预约"""
    data = request.json or {}

    required_fields = ['family_id', 'scheduled_time']
    if not all(field in data for field in required_fields):
        return jsonify({'error': '缺少必需字段'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO consultations (
            family_id, elderly_id, counselor_id, consultation_type,
            scheduled_time, duration, status, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data['family_id'],
        data.get('elderly_id'),
        data.get('counselor_id'),
        data.get('consultation_type', 'phone'),
        data['scheduled_time'],
        data.get('duration', 45),
        data.get('status', 'scheduled'),
        data.get('note', ''),
    ))

    consultation_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'consultation_id': consultation_id}), 201

@app.route('/api/consultations/<int:consultation_id>', methods=['PUT'])
def update_consultation(consultation_id):
    """更新咨询/随访状态与备注"""
    data = request.json or {}

    update_fields = []
    params = []

    for field in ['consultation_type', 'scheduled_time', 'duration', 'status', 'note', 'counselor_id']:
        if field in data:
            update_fields.append(f'{field} = ?')
            params.append(data[field])

    if not update_fields:
        return jsonify({'error': '没有可更新的字段'}), 400

    update_fields.append('updated_at = CURRENT_TIMESTAMP')
    params.append(consultation_id)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(f'''
        UPDATE consultations
        SET {', '.join(update_fields)}
        WHERE id = ?
    ''', params)
    conn.commit()
    conn.close()

    return jsonify({'success': True})

# ==================== 媒体库 API ====================

@app.route('/api/family/media', methods=['POST'])
def upload_media():
    """家属端上传媒体文件"""
    try:
        print(f"[上传] 收到上传请求")
        print(f"[上传] request.files keys: {list(request.files.keys())}")
        print(f"[上传] request.form keys: {list(request.form.keys())}")

        # 检查是否有文件
        if 'file' not in request.files:
            print("[上传] 错误: 没有上传文件")
            return jsonify({'error': '没有上传文件'}), 400

        file = request.files['file']
        print(f"[上传] 文件名: {file.filename}")

        if file.filename == '':
            print("[上传] 错误: 文件名为空")
            return jsonify({'error': '文件名为空'}), 400

        if not allowed_file(file.filename):
            print(f"[上传] 错误: 不支持的文件类型 - {file.filename}")
            return jsonify({'error': '不支持的文件类型'}), 400

        # 获取其他表单数据
        family_id = request.form.get('family_id')
        title = request.form.get('title')
        description = request.form.get('description', '')
        uploaded_by = request.form.get('uploaded_by')

        print(f"[上传] family_id: {family_id}, title: {title}")

        if not family_id or not title:
            print("[上传] 错误: 缺少必需字段")
            return jsonify({'error': '缺少必需字段'}), 400

        # 保存文件
        # secure_filename 会过滤中文字符，所以只保留扩展名，使用时间戳作为文件名
        original_filename = file.filename
        ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S%f')
        unique_filename = f"{timestamp}.{ext}" if ext else timestamp
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)

        print(f"[上传] 保存路径: {file_path}")
        file.save(file_path)
        print(f"[上传] 文件保存成功")

        # 判断媒体类型
        media_type = 'video' if ext in {'mp4', 'mov', 'avi'} else 'photo'

        # 获取文件大小
        file_size = os.path.getsize(file_path)

        # 生成缩略图
        thumbnail_path = None
        if media_type == 'video':
            thumbnail_path = generate_video_thumbnail(file_path, unique_filename)
        elif media_type == 'photo':
            thumbnail_path = generate_photo_thumbnail(file_path, unique_filename)

        print(f"[上传] 缩略图路径: {thumbnail_path}")

        # 插入数据库
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO media (
                family_id, media_type, title, description,
                file_path, file_size, thumbnail_path, uploaded_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (family_id, media_type, title, description, file_path, file_size, thumbnail_path, uploaded_by))

        media_id = cursor.lastrowid

        # 创建默认触发策略
        cursor.execute('''
            INSERT INTO media_policies (media_id, time_windows, moods, occasions, cooldown, priority)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (media_id, '[]', '[]', '[]', 60, 5))

        conn.commit()
        conn.close()

        print(f"[上传] 上传成功, media_id: {media_id}")

        return jsonify({
            'success': True,
            'media_id': media_id,
            'file_path': file_path,
            'media_type': media_type
        }), 201

    except Exception as e:
        print(f"[上传] 异常: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'上传失败: {str(e)}'}), 500

@app.route('/api/family/media', methods=['GET'])
def get_family_media():
    """获取家庭所有媒体列表"""
    family_id = request.args.get('family_id')
    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # 获取媒体列表及其标签和策略
    cursor.execute('''
        SELECT
            m.*,
            p.time_windows,
            p.moods,
            p.occasions,
            p.cooldown,
            p.priority,
            p.play_count,
            p.last_played_at,
            GROUP_CONCAT(t.tag) as tags
        FROM media m
        LEFT JOIN media_policies p ON m.id = p.media_id
        LEFT JOIN media_tags t ON m.id = t.media_id
        WHERE m.family_id = ? AND m.is_active = 1
        GROUP BY
            m.id, m.family_id, m.media_type, m.title, m.description,
            m.file_path, m.file_size, m.duration, m.thumbnail_path,
            m.uploaded_by, m.is_active, m.created_at, m.updated_at,
            p.time_windows, p.moods, p.occasions, p.cooldown,
            p.priority, p.play_count, p.last_played_at
        ORDER BY m.created_at DESC
    ''', (family_id,))

    media_list = []
    for row in cursor.fetchall():
        media_dict = dict(row)
        # 解析标签
        if media_dict['tags']:
            media_dict['tags'] = media_dict['tags'].split(',')
        else:
            media_dict['tags'] = []

        # 解析JSON字段
        for field in ['time_windows', 'moods', 'occasions']:
            try:
                media_dict[field] = json.loads(media_dict[field]) if media_dict[field] else []
            except:
                media_dict[field] = []

        media_list.append(media_dict)

    conn.close()

    return jsonify({'media': media_list})

@app.route('/api/family/media/<int:media_id>', methods=['GET'])
def get_media_detail(media_id):
    """获取媒体详情"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT
            m.*,
            p.time_windows,
            p.moods,
            p.occasions,
            p.cooldown,
            p.priority,
            p.play_count,
            p.last_played_at
        FROM media m
        LEFT JOIN media_policies p ON m.id = p.media_id
        WHERE m.id = ?
    ''', (media_id,))

    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': '媒体不存在'}), 404

    media_dict = dict(row)

    # 获取标签
    cursor.execute('SELECT tag FROM media_tags WHERE media_id = ?', (media_id,))
    media_dict['tags'] = [row['tag'] for row in cursor.fetchall()]

    # 解析JSON字段
    for field in ['time_windows', 'moods', 'occasions']:
        try:
            media_dict[field] = json.loads(media_dict[field]) if media_dict[field] else []
        except:
            media_dict[field] = []

    # 获取播放统计
    cursor.execute('''
        SELECT
            COUNT(*) as total_plays,
            SUM(CASE WHEN feedback_type = 'like' THEN 1 ELSE 0 END) as likes,
            SUM(CASE WHEN feedback_type = 'dislike' THEN 1 ELSE 0 END) as dislikes
        FROM media_play_history mph
        LEFT JOIN media_feedback mf ON mph.media_id = mf.media_id AND mph.elderly_id = mf.elderly_id
        WHERE mph.media_id = ?
    ''', (media_id,))

    stats = dict(cursor.fetchone())
    media_dict['statistics'] = stats

    # 获取最近播放反馈
    cursor.execute('''
        SELECT
            mph.id,
            mph.elderly_id,
            u.name as elderly_name,
            mph.played_at,
            mph.duration_watched,
            mph.completed,
            mph.triggered_by,
            mph.mood_before,
            mph.mood_after,
            mf.feedback_type
        FROM media_play_history mph
        LEFT JOIN media_feedback mf
            ON mph.media_id = mf.media_id AND mph.elderly_id = mf.elderly_id
        LEFT JOIN users u ON mph.elderly_id = u.id
        WHERE mph.media_id = ?
        ORDER BY mph.played_at DESC
        LIMIT 10
    ''', (media_id,))

    media_dict['history'] = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return jsonify(media_dict)

@app.route('/api/family/media/<int:media_id>', methods=['PUT'])
def update_media(media_id):
    """更新媒体信息和触发策略"""
    data = request.json

    conn = get_db()
    cursor = conn.cursor()

    # 更新媒体基本信息
    if 'title' in data or 'description' in data:
        update_fields = []
        params = []

        if 'title' in data:
            update_fields.append('title = ?')
            params.append(data['title'])

        if 'description' in data:
            update_fields.append('description = ?')
            params.append(data['description'])

        update_fields.append('updated_at = CURRENT_TIMESTAMP')
        params.append(media_id)

        cursor.execute(f'''
            UPDATE media
            SET {', '.join(update_fields)}
            WHERE id = ?
        ''', params)

    # 更新标签
    if 'tags' in data:
        # 删除旧标签
        cursor.execute('DELETE FROM media_tags WHERE media_id = ?', (media_id,))

        # 添加新标签
        for tag in data['tags']:
            cursor.execute('''
                INSERT INTO media_tags (media_id, tag)
                VALUES (?, ?)
            ''', (media_id, tag))

    # 更新触发策略
    policy_fields = ['time_windows', 'moods', 'occasions', 'cooldown', 'priority']
    policy_updates = []
    policy_params = []

    for field in policy_fields:
        if field in data:
            policy_updates.append(f'{field} = ?')
            # JSON字段需要序列化
            if field in ['time_windows', 'moods', 'occasions']:
                policy_params.append(json.dumps(data[field]))
            else:
                policy_params.append(data[field])

    if policy_updates:
        policy_updates.append('updated_at = CURRENT_TIMESTAMP')
        policy_params.append(media_id)

        cursor.execute(f'''
            UPDATE media_policies
            SET {', '.join(policy_updates)}
            WHERE media_id = ?
        ''', policy_params)

    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/family/media/<int:media_id>', methods=['DELETE'])
def delete_media(media_id):
    """删除媒体（软删除）"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE media
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (media_id,))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

# ==================== 老人端媒体 API ====================

@app.route('/api/elderly/media/recommended', methods=['GET'])
def get_recommended_media():
    """获取推荐媒体（基于时段、心境、场合、标签等策略）"""
    family_id = request.args.get('family_id')
    elderly_id = request.args.get('elderly_id')
    current_mood = request.args.get('mood', '')  # 当前心境
    occasion = request.args.get('occasion', '')  # 特殊场合
    filter_tags = request.args.get('tags', '')  # 组合标签筛选，逗号分隔

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    # 解析筛选标签
    required_tags = [t.strip() for t in filter_tags.split(',') if t.strip()] if filter_tags else []

    conn = get_db()
    cursor = conn.cursor()

    # 获取当前时间
    now = datetime.now()
    current_time = now.strftime('%H:%M')

    # 查询符合条件的媒体
    cursor.execute('''
        SELECT
            m.*,
            p.time_windows,
            p.moods,
            p.occasions,
            p.cooldown,
            p.priority,
            p.play_count,
            p.last_played_at,
            GROUP_CONCAT(t.tag) as tags
        FROM media m
        INNER JOIN media_policies p ON m.id = p.media_id
        LEFT JOIN media_tags t ON m.id = t.media_id
        WHERE m.family_id = ? AND m.is_active = 1
        GROUP BY
            m.id, m.family_id, m.media_type, m.title, m.description,
            m.file_path, m.file_size, m.duration, m.thumbnail_path,
            m.uploaded_by, m.is_active, m.created_at, m.updated_at,
            p.time_windows, p.moods, p.occasions, p.cooldown,
            p.priority, p.play_count, p.last_played_at
        ORDER BY p.priority DESC, p.play_count ASC
    ''', (family_id,))

    recommended = []
    all_tags = set()  # 收集所有可用标签

    for row in cursor.fetchall():
        media_dict = dict(row)

        # 解析JSON字段
        time_windows = json.loads(media_dict['time_windows']) if media_dict['time_windows'] else []
        moods = json.loads(media_dict['moods']) if media_dict['moods'] else []
        occasions = json.loads(media_dict['occasions']) if media_dict['occasions'] else []

        # 检查冷却时间
        if media_dict['last_played_at']:
            last_played = datetime.fromisoformat(media_dict['last_played_at'])
            cooldown_minutes = media_dict['cooldown']
            if now - last_played < timedelta(minutes=cooldown_minutes):
                continue  # 还在冷却期，跳过

        # 检查时段匹配
        time_match = not time_windows  # 如果没有设置时段，默认匹配
        for window in time_windows:
            if '-' in window:
                start, end = window.split('-')
                if start <= current_time <= end:
                    time_match = True
                    break

        if not time_match:
            continue

        # 检查心境匹配
        mood_match = not moods or not current_mood or current_mood in moods
        if not mood_match:
            continue

        # 检查场合匹配
        occasion_match = not occasions or not occasion or occasion in occasions
        if not occasion_match:
            continue

        # 解析标签
        if media_dict['tags']:
            media_dict['tags'] = media_dict['tags'].split(',')
        else:
            media_dict['tags'] = []

        # 收集所有标签
        for tag in media_dict['tags']:
            all_tags.add(tag)

        # 检查标签匹配（如果指定了筛选标签，必须全部包含）
        if required_tags:
            media_tags_set = set(media_dict['tags'])
            if not all(tag in media_tags_set for tag in required_tags):
                continue  # 不包含所有要求的标签，跳过

        recommended.append(media_dict)

    conn.close()

    return jsonify({
        'media': recommended,
        'available_tags': sorted(list(all_tags))  # 返回所有可用标签供前端筛选
    })

@app.route('/api/elderly/media/<int:media_id>/play', methods=['POST'])
def record_media_play(media_id):
    """记录媒体播放"""
    data = request.json

    elderly_id = data.get('elderly_id')
    duration_watched = data.get('duration_watched', 0)
    completed = data.get('completed', 0)
    triggered_by = data.get('triggered_by', 'manual')
    mood_before = data.get('mood_before', '')
    mood_after = data.get('mood_after', '')

    if not elderly_id:
        return jsonify({'error': '缺少elderly_id'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # 记录播放历史
    cursor.execute('''
        INSERT INTO media_play_history (
            media_id, elderly_id, duration_watched, completed,
            triggered_by, mood_before, mood_after
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (media_id, elderly_id, duration_watched, completed,
          triggered_by, mood_before, mood_after))

    # 更新媒体策略的播放次数和最后播放时间
    cursor.execute('''
        UPDATE media_policies
        SET play_count = play_count + 1,
            last_played_at = CURRENT_TIMESTAMP
        WHERE media_id = ?
    ''', (media_id,))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/elderly/media/<int:media_id>/feedback', methods=['POST'])
def submit_media_feedback(media_id):
    """提交媒体反馈（点赞/点踩）"""
    data = request.json

    elderly_id = data.get('elderly_id')
    feedback_type = data.get('feedback_type')  # 'like' 或 'dislike'

    if not elderly_id or feedback_type not in ['like', 'dislike']:
        return jsonify({'error': '参数错误'}), 400

    conn = get_db()
    cursor = conn.cursor()

    if is_mysql_enabled():
        cursor.execute('''
            INSERT INTO media_feedback (media_id, elderly_id, feedback_type)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                feedback_type = VALUES(feedback_type),
                created_at = CURRENT_TIMESTAMP
        ''', (media_id, elderly_id, feedback_type))
    else:
        cursor.execute('''
            INSERT OR REPLACE INTO media_feedback (media_id, elderly_id, feedback_type)
            VALUES (?, ?, ?)
        ''', (media_id, elderly_id, feedback_type))

    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/elderly/media/history', methods=['GET'])
def get_media_history():
    """获取媒体播放历史"""
    elderly_id = request.args.get('elderly_id')
    limit = request.args.get('limit', 50, type=int)

    if not elderly_id:
        return jsonify({'error': '缺少elderly_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT
            mph.*,
            m.title,
            m.media_type,
            m.file_path,
            m.thumbnail_path,
            mf.feedback_type
        FROM media_play_history mph
        INNER JOIN media m ON mph.media_id = m.id
        LEFT JOIN media_feedback mf ON mph.media_id = mf.media_id AND mph.elderly_id = mf.elderly_id
        WHERE mph.elderly_id = ?
        ORDER BY mph.played_at DESC
        LIMIT ?
    ''', (elderly_id, limit))

    history = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({'history': history})

@app.route('/api/family/media/recent-plays', methods=['GET'])
def get_recent_plays():
    """获取最近播放的媒体（家属端查看）"""
    family_id = request.args.get('family_id')
    limit = request.args.get('limit', 10)

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT
            m.id,
            m.title,
            m.media_type,
            m.thumbnail_path,
            mph.played_at,
            COUNT(CASE WHEN mf.feedback_type = 'like' THEN 1 END) as likes,
            COUNT(CASE WHEN mf.feedback_type = 'dislike' THEN 1 END) as dislikes
        FROM media m
        INNER JOIN media_play_history mph ON m.id = mph.media_id
        LEFT JOIN media_feedback mf ON m.id = mf.media_id
        WHERE m.family_id = ?
        GROUP BY m.id, m.title, m.media_type, m.thumbnail_path, mph.played_at
        ORDER BY mph.played_at DESC
        LIMIT ?
    ''', (family_id, limit))

    recent = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({'recent_plays': recent})

# ==================== 静态文件服务 ====================

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    """提供上传文件的访问"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# ==================== 数字人媒体展示 API ====================

@app.route('/api/elderly/show-media', methods=['POST'])
def show_media_on_avatar():
    """
    控制老人端在数字人主页中部弹出透明窗口展示媒体文件
    参数:
    - media_title: 媒体标题(用于查找媒体文件)
    - avatar_text: 数字人播报内容
    - duration: 展示时长(秒),默认30秒
    """
    data = request.json

    required_fields = ['media_title', 'avatar_text']
    if not all(field in data for field in required_fields):
        return jsonify({'error': '缺少必需字段: media_title 和 avatar_text'}), 400

    media_title = data['media_title']
    avatar_text = data['avatar_text']
    duration = data.get('duration', 30)  # 默认30秒

    # 从数据库查找媒体文件
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT id, media_type, file_path, title
        FROM media
        WHERE title = ? AND is_active = 1
        LIMIT 1
    ''', (media_title,))

    media_row = cursor.fetchone()

    if not media_row:
        conn.close()
        return jsonify({'error': f'未找到标题为 "{media_title}" 的媒体文件'}), 404

    media_dict = dict(media_row)
    media_type = media_dict['media_type']
    file_path = media_dict['file_path']

    # 提取文件名(不含路径)
    media_filename = os.path.basename(file_path)

    try:
        # 1. 推送播报内容到数字人
        avatar_response = requests.post(
            f'{FAY_HTTP_BASE_URL}/transparent-pass',
            json={
                'user': 'User',
                'text': avatar_text
            },
            timeout=5
        )

        if not avatar_response.ok:
            print(f'推送数字人播报失败: {avatar_response.status_code}')

        # 2. 通知老人端弹出媒体展示窗口
        # 创建媒体展示事件（使用 family_alerts 表的特殊类型）
        cursor.execute('''
            INSERT INTO family_alerts (
                family_id, alert_type, level, title, message, metadata, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('family_id', 'family_001'),
            'media_display',  # 特殊类型：媒体展示
            'low',
            media_title,  # 使用媒体标题作为标题
            avatar_text,
            json.dumps({
                'media_filename': media_filename,
                'media_type': media_type,
                'media_title': media_title,
                'avatar_text': avatar_text,
                'duration': duration,
                'event_type': 'show_media'
            }),
            'system'
        ))

        event_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'event_id': event_id,
            'message': '媒体展示请求已发送'
        }), 201

    except Exception as e:
        print(f'处理媒体展示请求失败: {e}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/elderly/hide-media', methods=['POST'])
def hide_media_on_avatar():
    """
    控制老人端关闭当前显示的媒体窗口
    参数:
    - family_id: 家庭ID（可选，默认family_001）
    """
    data = request.json or {}
    family_id = data.get('family_id', 'family_001')

    conn = get_db()
    cursor = conn.cursor()

    try:
        # 创建隐藏媒体事件
        cursor.execute('''
            INSERT INTO family_alerts (
                family_id, alert_type, level, title, message, metadata, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            family_id,
            'media_display',  # 使用相同类型
            'low',
            '关闭媒体显示',
            '关闭当前显示的媒体',
            json.dumps({
                'event_type': 'hide_media'
            }),
            'system'
        ))

        event_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'event_id': event_id,
            'message': '关闭媒体请求已发送'
        }), 201

    except Exception as e:
        print(f'处理关闭媒体请求失败: {e}')
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/elderly/poll-media-events', methods=['GET'])
def poll_media_events():
    """
    老人端轮询媒体展示事件
    """
    family_id = request.args.get('family_id', 'family_001')

    conn = get_db()
    cursor = conn.cursor()

    # 查询未读的媒体展示事件
    cursor.execute('''
        SELECT * FROM family_alerts
        WHERE family_id = ?
        AND alert_type = 'media_display'
        AND read = 0
        AND is_active = 1
        ORDER BY created_at DESC
        LIMIT 1
    ''', (family_id,))

    row = cursor.fetchone()

    if row:
        alert = dict(row)
        # 解析元数据
        if alert['metadata']:
            try:
                alert['metadata'] = json.loads(alert['metadata'])
            except:
                alert['metadata'] = {}

        # 标记为已读
        cursor.execute('''
            UPDATE family_alerts
            SET read = 1, read_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (alert['id'],))
        conn.commit()
        conn.close()

        return jsonify({'event': alert})
    else:
        conn.close()
        return jsonify({'event': None})

# ==================== 老人端Toast通知 ====================

# 全局变量存储待显示的toast（内存中，重启会丢失）
pending_toasts = {}  # key: family_id, value: list of toast objects

# SSE连接管理
sse_clients = {}  # key: family_id, value: list of response queues

@app.route('/api/elderly/toast', methods=['POST'])
def create_toast():
    """创建老人端Toast通知（供MCP工具调用）"""
    data = request.json

    family_id = data.get('family_id')
    toast_type = data.get('type', 'info')  # success, info, calling
    message = data.get('message')
    duration = data.get('duration', 3000)  # 默认3秒

    if not family_id or not message:
        return jsonify({'error': '缺少必需参数'}), 400

    # 创建toast对象
    toast = {
        'id': int(time.time() * 1000),  # 使用时间戳作为ID
        'type': toast_type,
        'message': message,
        'duration': duration,
        'created_at': datetime.now().isoformat()
    }

    # 添加到待显示列表（备用轮询方式）
    if family_id not in pending_toasts:
        pending_toasts[family_id] = []
    pending_toasts[family_id].append(toast)

    # 通过SSE推送给连接的客户端
    if family_id in sse_clients:
        for client_queue in sse_clients[family_id]:
            try:
                client_queue.put(toast)
            except:
                pass  # 客户端可能已断开

    return jsonify({'success': True, 'toast_id': toast['id']}), 201

@app.route('/api/elderly/toast/poll', methods=['GET'])
def poll_toast():
    """老人端轮询获取待显示的Toast（备用方案）"""
    family_id = request.args.get('family_id')

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    # 获取并清空该family的待显示toast
    toasts = pending_toasts.get(family_id, [])
    if toasts:
        # 返回最新的toast，并从列表中移除
        toast = toasts.pop(0)
        return jsonify({'toast': toast})

    return jsonify({'toast': None})

@app.route('/api/elderly/toast/stream', methods=['GET'])
def toast_stream():
    """SSE端点：实时推送Toast通知"""
    family_id = request.args.get('family_id')

    if not family_id:
        return jsonify({'error': '缺少family_id参数'}), 400

    def generate():
        import queue

        # 为此客户端创建队列
        client_queue = queue.Queue()

        # 注册客户端
        if family_id not in sse_clients:
            sse_clients[family_id] = []
        sse_clients[family_id].append(client_queue)

        try:
            # 发送连接成功消息
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"

            # 持续监听队列
            while True:
                try:
                    # 等待新的toast（30秒超时，发送心跳）
                    toast = client_queue.get(timeout=30)
                    yield f"data: {json.dumps(toast)}\n\n"
                except queue.Empty:
                    # 发送心跳保持连接
                    yield f": heartbeat\n\n"
        finally:
            # 客户端断开时清理
            if family_id in sse_clients:
                sse_clients[family_id].remove(client_queue)
                if not sse_clients[family_id]:
                    del sse_clients[family_id]

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )

# ==================== 健康检查 ====================

@app.route('/api/elderly/avatar/renderer/status', methods=['GET'])
def get_avatar_renderer_status():
    return jsonify(get_avatar_renderer_snapshot())


@app.route('/api/elderly/avatar/renderer/status', methods=['POST'])
def update_avatar_renderer_runtime_status():
    data = request.json or {}
    last_audio_url = (data.get('last_audio_url') or data.get('lastAudioUrl') or '').strip()
    last_audio_text = (data.get('last_audio_text') or data.get('lastAudioText') or '').strip()
    last_audio_at = (data.get('last_audio_at') or data.get('lastAudioAt') or '').strip()
    audio_updates = {}

    if last_audio_url:
        mirrored_audio_url, audio_mirror_error = mirror_fay_audio_url(
            last_audio_url,
            text=last_audio_text,
            audio_at=last_audio_at,
        )
        audio_updates = {
            'last_audio_url': mirrored_audio_url or last_audio_url,
            'last_audio_text': last_audio_text,
            'last_audio_at': last_audio_at or datetime.now().isoformat(),
        }
        if audio_mirror_error:
            audio_updates['last_error'] = audio_mirror_error

    snapshot = update_avatar_renderer_state(
        sdk_status=(data.get('sdk_status') or data.get('sdkStatus') or 'offline').strip() or 'offline',
        ws_status=(data.get('ws_status') or data.get('wsStatus') or 'disconnected').strip() or 'disconnected',
        environment=(data.get('environment') or '').strip(),
        acceleration=(data.get('acceleration') or '').strip(),
        render_nodes=int(data.get('render_nodes') or data.get('renderNodes') or 0),
        audio_state=(data.get('audio_state') or data.get('audioState') or '').strip(),
        last_voice_state=(data.get('last_voice_state') or data.get('lastVoiceState') or '').strip(),
        last_notice=(data.get('last_notice') or data.get('lastNotice') or '').strip(),
        last_error=(data.get('last_error') or data.get('lastError') or '').strip(),
        last_command_id=int(data.get('last_command_id') or data.get('lastCommandId') or 0),
        last_command_type=(data.get('last_command_type') or data.get('lastCommandType') or '').strip(),
        last_command_text=(data.get('last_command_text') or data.get('lastCommandText') or '').strip(),
        **audio_updates,
    )

    return jsonify({
        'success': True,
        'renderer_updated_at': snapshot['renderer_updated_at'],
    })


@app.route('/api/elderly/avatar/renderer/frame', methods=['POST'])
def upload_avatar_renderer_frame():
    data = request.json or {}
    raw_frame = data.get('frame') or data.get('image_data') or data.get('imageData') or ''
    if not isinstance(raw_frame, str) or not raw_frame.strip():
        return jsonify({'error': 'missing frame data'}), 400

    frame_payload = raw_frame.strip()
    if ',' in frame_payload:
        frame_payload = frame_payload.split(',', 1)[1]

    try:
        image_bytes = base64.b64decode(frame_payload)
    except Exception:
        return jsonify({'error': 'invalid frame payload'}), 400

    snapshot = store_avatar_frame(
        image_bytes=image_bytes,
        width=data.get('width') or data.get('frame_width') or data.get('frameWidth') or 0,
        height=data.get('height') or data.get('frame_height') or data.get('frameHeight') or 0,
        text=data.get('text') or data.get('frame_text') or data.get('frameText') or '',
        speaking=bool(data.get('speaking') or data.get('frame_speaking') or data.get('frameSpeaking')),
    )

    return jsonify({
        'success': True,
        'frame_version': snapshot['frame_version'],
        'image_url': build_absolute_asset_url(snapshot['frame_relative_path']),
    })


@app.route('/api/elderly/avatar/renderer/commands', methods=['GET'])
def get_avatar_renderer_commands():
    after_id = request.args.get('after_id', 0, type=int)
    limit = request.args.get('limit', 20, type=int)
    commands = list_avatar_commands(after_id=max(after_id, 0), limit=max(1, min(limit, 50)))
    return jsonify({
        'commands': commands,
        'server_time': datetime.now().isoformat(),
    })


@app.route('/api/elderly/avatar/chat', methods=['POST'])
def elderly_avatar_chat():
    data = request.json or {}
    message = (data.get('message') or data.get('text') or '').strip()
    user = (data.get('user') or 'User').strip() or 'User'
    observation = (data.get('observation') or '').strip()
    request_started_ts = time.time()

    if not message and not observation:
        return jsonify({'error': 'missing message'}), 400

    if should_probe_yueshen_rag(message):
        rag_probe = probe_yueshen_rag(message)
        if rag_probe.get('blocked'):
            return build_fay_error_response(
                '悦身知识库还没有完成入库，当前问题不会返回可靠检索结果。请先把 PDF/DOCX 放到 Fay 的 新知识库 目录后运行 ingest_yueshen。',
                status_code=503,
                detail=rag_probe.get('detail')
            )

    if AVATAR_CHAT_PROVIDER == 'deepseek':
        payload = {}
        provider_available = True
        provider_error = ''
        try:
            safe_record_avatar_interaction('member', message, username=user)
            reply, payload = call_deepseek_chat_completion(message, observation=observation)
            safe_record_avatar_interaction('fay', reply, username=user)
        except Exception as exc:
            provider_available = False
            provider_error = str(exc)
            reply = build_local_avatar_reply(message or observation)
            safe_record_avatar_interaction('fay', reply, username=user)

        command = None
        audio_url = ''
        audio_error = ''
        fay_audio_started_at = time.time()
        playback_ok, playback_error = broadcast_avatar_text_via_fay(reply, user=user)
        if not playback_ok:
            command = enqueue_avatar_command(
                'speak',
                text=reply,
                user=user,
                source='avatar-chat',
                metadata={
                    'origin': 'chat',
                    'message': message,
                    'chat_provider': 'deepseek',
                },
            )
        if playback_ok:
            audio_url, audio_error = mirror_latest_fay_sample_audio(fay_audio_started_at, text=reply)
        if not audio_url:
            audio_url, audio_error = synthesize_avatar_audio(reply)
        if not audio_url and playback_error:
            audio_error = f'{playback_error}; {audio_error}' if audio_error else playback_error
        update_avatar_renderer_state(
            last_notice=reply,
            last_command_id=command['id'] if command else 0,
            last_command_type=command['type'] if command else 'fay-broadcast',
            last_command_text=reply,
        )

        return jsonify({
            'success': True,
            'message': message,
            'reply': reply,
            'chat_provider': 'deepseek',
            'provider_available': provider_available,
            'provider_error': provider_error,
            'fay_available': True,
            'fay_error': '',
            'no_reply': False,
            'audio_url': audio_url,
            'audio_error': audio_error,
            'renderer_command_id': command['id'] if command else None,
            'result': payload,
        })

    fay_payload = {
        'model': 'fay',
        'stream': False,
        'messages': [{'role': user, 'content': message}] if message else []
    }

    if observation:
        fay_payload['observation'] = observation

    payload = {}
    fay_available = True
    fay_error = ''

    try:
        response = requests.post(
            f'{FAY_HTTP_BASE_URL}/api/send/v1/chat/completions',
            json=fay_payload,
            timeout=(3, AVATAR_FAY_CHAT_TIMEOUT_SECONDS)
        )
    except requests.RequestException as exc:
        fay_available = False
        fay_error = str(exc)
        response = None

    if response is not None:
        if not response.ok:
            fay_available = False
            fay_error = response.text[:300] or f'Fay service returned HTTP {response.status_code}'
        else:
            try:
                payload = response.json()
            except ValueError:
                fay_available = False
                fay_error = response.text[:300] or 'Fay service returned invalid JSON'

    reply = extract_fay_reply(payload)
    if not reply:
        reply = extract_latest_fay_history_reply(user, after_ts=request_started_ts)
    if not reply:
        reply = wait_for_latest_fay_history_reply(user, after_ts=request_started_ts)
    reply = sanitize_avatar_reply_text(reply)
    if not reply and not fay_available and AVATAR_ENABLE_LOCAL_CHAT_FALLBACK:
        reply = build_local_avatar_reply(message)

    if not reply:
        status_code = 504 if not fay_available else 502
        return build_fay_error_response(
            'Fay 没有返回有效回复，已停止使用本地模板兜底。',
            status_code=status_code,
            detail=fay_error or 'Fay completed without a usable assistant reply.'
        )

    command = None
    audio_url = ''
    audio_error = ''
    if reply:
        fay_audio_started_at = time.time()
        playback_ok, playback_error = broadcast_avatar_text_via_fay(reply, user=user)
        if not playback_ok:
            command = enqueue_avatar_command(
                'speak',
                text=reply,
                user=user,
                source='avatar-chat',
                metadata={
                    'origin': 'chat',
                    'message': message,
                },
            )
        if playback_ok:
            audio_url, audio_error = mirror_latest_fay_sample_audio(fay_audio_started_at, text=reply)
        if not audio_url:
            audio_url, audio_error = synthesize_avatar_audio(reply)
        if not audio_url and playback_error:
            audio_error = f'{playback_error}; {audio_error}' if audio_error else playback_error
        update_avatar_renderer_state(
            last_notice=reply,
            last_command_id=command['id'] if command else 0,
            last_command_type=command['type'] if command else 'fay-broadcast',
            last_command_text=reply,
        )

    return jsonify({
        'success': True,
        'message': message,
        'reply': reply,
        'fay_available': fay_available,
        'fay_error': fay_error,
        'no_reply': bool(payload.get('no_reply')) or not bool(reply),
        'audio_url': audio_url,
        'audio_error': audio_error,
        'renderer_command_id': command['id'] if command else None,
        'result': payload,
    })


@app.route('/api/elderly/avatar/voice-chat', methods=['POST'])
def elderly_avatar_voice_chat():
    voice_file = request.files.get('file') or request.files.get('voice') or request.files.get('audio')
    user = (request.form.get('user') or 'User').strip() or 'User'

    if not voice_file or not voice_file.filename:
        return jsonify({'error': 'missing voice file'}), 400

    ext = secure_filename(voice_file.filename).rsplit('.', 1)[-1].lower() if '.' in voice_file.filename else 'mp3'
    if ext not in {'mp3', 'aac', 'm4a', 'wav', 'pcm', 'silk'}:
        return jsonify({'error': f'unsupported voice format: {ext}'}), 400

    filename = f'{datetime.now().strftime("%Y%m%d%H%M%S%f")}.{ext}'
    voice_path = os.path.join(AVATAR_VOICE_UPLOAD_FOLDER, filename)
    voice_file.save(voice_path)

    transcript, asr_error = recognize_avatar_voice(voice_path)
    transcript = (transcript or '').strip()
    if not transcript:
        return jsonify({
            'error': '语音没有识别出文字，请确认 ASR 服务已启动后再试。',
            'asr_error': asr_error,
            'asr_provider': AVATAR_ASR_PROVIDER,
        }), 422

    chat_payload, status_code = call_avatar_chat_internally(transcript, user=user)
    if status_code < 200 or status_code >= 300:
        chat_payload = dict(chat_payload or {})
        chat_payload['transcript'] = transcript
        return jsonify(chat_payload), status_code

    chat_payload = dict(chat_payload or {})
    chat_payload.update({
        'success': chat_payload.get('success', True),
        'transcript': transcript,
        'asr_provider': AVATAR_ASR_PROVIDER,
    })
    return jsonify(chat_payload)


@app.route('/api/elderly/avatar/speak', methods=['POST'])
def elderly_avatar_speak():
    data = request.json or {}
    text = (data.get('text') or '').strip()
    user = (data.get('user') or 'User').strip() or 'User'

    if not text:
        return jsonify({'error': 'missing text'}), 400
    fay_audio_started_at = time.time()
    playback_ok, playback_error = broadcast_avatar_text_via_fay(text, user=user)
    command = None
    audio_url = ''
    audio_error = ''
    if not playback_ok:
        command = enqueue_avatar_command(
            'speak',
            text=text,
            user=user,
            source='avatar-speak',
            metadata={
                'origin': data.get('origin') or 'manual',
            },
        )
    if playback_ok:
        audio_url, audio_error = mirror_latest_fay_sample_audio(fay_audio_started_at, text=text)
    if not audio_url:
        audio_url, audio_error = synthesize_avatar_audio(text)
    if not audio_url and playback_error:
        audio_error = f'{playback_error}; {audio_error}' if audio_error else playback_error
    update_avatar_renderer_state(
        last_notice=text,
        last_command_id=command['id'] if command else 0,
        last_command_type=command['type'] if command else 'fay-broadcast',
        last_command_text=text,
    )

    return jsonify({
        'success': True,
        'audio_url': audio_url,
        'audio_error': audio_error,
        'renderer_command_id': command['id'] if command else None,
        'result': {
            'message': 'queued for renderer' if command else 'broadcast through fay',
        },
    })


@app.route('/api/elderly/avatar/microphone', methods=['POST'])
def elderly_avatar_microphone():
    global avatar_microphone_enabled
    data = request.json or {}
    payload = {}

    if 'enabled' in data:
        payload['enabled'] = bool(data.get('enabled'))

    try:
        response = requests.post(
            f'{FAY_HTTP_BASE_URL}/api/toggle-microphone',
            json=payload,
            timeout=2
        )
    except requests.RequestException as exc:
        return build_fay_error_response('Fay microphone service is unavailable', detail=str(exc))

    if not response.ok:
        return build_fay_error_response(
            'Fay microphone service returned an error',
            status_code=response.status_code,
            detail=response.text[:300]
        )

    payload = {}
    try:
        payload = response.json()
    except ValueError:
        payload = {'raw': response.text[:300]}

    if 'enabled' in payload:
        avatar_microphone_enabled = bool(payload.get('enabled'))
    elif 'enabled' in data:
        avatar_microphone_enabled = bool(data.get('enabled'))

    update_avatar_renderer_state(
        last_notice='microphone enabled' if avatar_microphone_enabled else 'microphone disabled',
        last_command_type='microphone',
        last_command_text='enabled' if avatar_microphone_enabled else 'disabled',
    )

    return jsonify({
        'success': True,
        'result': payload
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

if __name__ == '__main__':
    # 初始化数据库
    init_db()
    print("数据库初始化完成")

    # 启动应用
    app.run(host=HOST, port=PORT, debug=DEBUG, use_reloader=False)
