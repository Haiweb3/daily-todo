from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='static')
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

DATE_FORMAT = '%Y-%m-%d'

def parse_date(date_str):
    try:
        return datetime.strptime(date_str, DATE_FORMAT)
    except ValueError:
        return None

def get_data_path(date_str):
    """获取指定日期的数据文件路径"""
    date = parse_date(date_str)
    if not date:
        return None
    year_dir = os.path.join(DATA_DIR, str(date.year))
    month_dir = os.path.join(year_dir, f'{date.month:02d}')
    os.makedirs(month_dir, exist_ok=True)
    return os.path.join(month_dir, f'{date.day:02d}.json')

def find_task_file(date_str):
    """尝试找到与日期匹配的数据文件（兼容文件名与内容日期不一致的情况）"""
    canonical_path = get_data_path(date_str)
    if canonical_path and os.path.exists(canonical_path):
        return canonical_path, canonical_path

    parsed = parse_date(date_str)
    if not parsed:
        return None, canonical_path

    month_dir = os.path.join(DATA_DIR, str(parsed.year), f'{parsed.month:02d}')
    if not os.path.exists(month_dir):
        return None, canonical_path

    for filename in os.listdir(month_dir):
        if not filename.endswith('.json'):
            continue
        candidate_path = os.path.join(month_dir, filename)
        try:
            with open(candidate_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if data.get('date') == date_str:
                return candidate_path, canonical_path
        except (OSError, json.JSONDecodeError):
            continue

    return None, canonical_path

def load_tasks(date_str, auto_save=True):
    """加载指定日期的任务"""
    path, canonical_path = find_task_file(date_str)

    if path and os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        data['date'] = date_str

        # 兼容旧路径
        if canonical_path and path != canonical_path:
            save_tasks(date_str, data)
            try:
                os.remove(path)
            except OSError:
                pass
    else:
        # 新日期，返回空任务列表，不自动迁移
        data = {'date': date_str, 'tasks': []}

    return data

def save_tasks(date_str, data):
    """保存任务到文件"""
    path = get_data_path(date_str)
    if path:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    return False

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api/tasks/<date_str>', methods=['GET'])
def get_tasks(date_str):
    """获取指定日期的任务列表"""
    data = load_tasks(date_str)
    return jsonify(data)

@app.route('/api/tasks/<date_str>', methods=['POST'])
def add_task(date_str):
    """添加新任务"""
    data = load_tasks(date_str)
    task = request.json
    task['id'] = datetime.now().strftime('%Y%m%d%H%M%S%f')
    task['completed'] = False
    task['createdAt'] = datetime.now().isoformat()
    data['tasks'].append(task)
    save_tasks(date_str, data)
    return jsonify(task), 201

@app.route('/api/tasks/<date_str>/<task_id>', methods=['PUT'])
def update_task(date_str, task_id):
    """更新任务"""
    data = load_tasks(date_str)
    updates = request.json
    for task in data['tasks']:
        if task['id'] == task_id:
            task.update(updates)
            save_tasks(date_str, data)
            return jsonify(task)
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<date_str>/<task_id>', methods=['DELETE'])
def delete_task(date_str, task_id):
    """删除任务"""
    data = load_tasks(date_str)
    original_len = len(data['tasks'])
    data['tasks'] = [t for t in data['tasks'] if t['id'] != task_id]
    if len(data['tasks']) < original_len:
        save_tasks(date_str, data)
        return jsonify({'success': True})
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/stats/<year>/<month>', methods=['GET'])
def get_monthly_stats(year, month):
    """获取月度统计"""
    month_dir = os.path.join(DATA_DIR, year, month)
    stats = {'days': {}, 'totalTasks': 0, 'completedTasks': 0}
    
    if os.path.exists(month_dir):
        for filename in os.listdir(month_dir):
            if filename.endswith('.json'):
                with open(os.path.join(month_dir, filename), 'r', encoding='utf-8') as f:
                    data = json.load(f)
                day = filename.replace('.json', '')
                data_date = data.get('date')
                parsed = parse_date(data_date) if data_date else None
                if parsed and parsed.year == int(year) and parsed.month == int(month):
                    day = f'{parsed.day:02d}'
                total = len(data.get('tasks', []))
                completed = sum(1 for t in data.get('tasks', []) if t.get('completed'))
                stats['days'][day] = {'total': total, 'completed': completed}
                stats['totalTasks'] += total
                stats['completedTasks'] += completed
    
    return jsonify(stats)

if __name__ == '__main__':
    os.makedirs(DATA_DIR, exist_ok=True)
    print('🗓️  每日计划表已启动: http://localhost:5001')
    app.run(debug=True, port=5001)
