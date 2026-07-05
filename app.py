import os
from flask import Flask, request, jsonify, send_from_directory, session, send_file
from flask_cors import CORS
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from flask_socketio import SocketIO, join_room, leave_room, emit
import json
import io
from fpdf import FPDF
import arabic_reshaper
from bidi.algorithm import get_display

app = Flask(__name__, static_folder='.')
app.secret_key = 'super-secret-mrh-academy-key'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

DB_FILE = 'database.db'

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'student',
            balance REAL DEFAULT 0.0,
            total_hours_taught REAL DEFAULT 0.0
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tutor_id INTEGER,
            student_id INTEGER,
            scheduled_time TEXT,
            status TEXT DEFAULT 'scheduled',
            room_id TEXT,
            price REAL DEFAULT 15.0,
            duration_hours REAL DEFAULT 1.0,
            FOREIGN KEY(tutor_id) REFERENCES users(id),
            FOREIGN KEY(student_id) REFERENCES users(id)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            room_id TEXT,
            issue_type TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    conn.commit()
    
    # Ensure new columns exist for existing databases
    try:
        c.execute("ALTER TABLE users ADD COLUMN balance REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN total_hours_taught REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE lessons ADD COLUMN price REAL DEFAULT 15.0")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE lessons ADD COLUMN duration_hours REAL DEFAULT 1.0")
    except sqlite3.OperationalError:
        pass
        
    # Tutor profile columns
    try:
        c.execute("ALTER TABLE users ADD COLUMN subject TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN bio TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN tags TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN avatar TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN price REAL DEFAULT 15.0")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN country TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN languages TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN phone TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN timezone TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN experience TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN motivation TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN certificates TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN education TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN video_link TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE reviews ADD COLUMN approved INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN experience_years TEXT DEFAULT '5+ years'")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN students_count INTEGER DEFAULT 50")
    except sqlite3.OperationalError:
        pass
    try:
        c.execute("ALTER TABLE users ADD COLUMN lessons_count INTEGER DEFAULT 200")
    except sqlite3.OperationalError:
        pass

    # Create reviews table
    c.execute('''
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tutor_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
            comment TEXT,
            approved INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(tutor_id) REFERENCES users(id),
            FOREIGN KEY(student_id) REFERENCES users(id)
        )
     ''')
     
    # Create employees table
    c.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL,
            permissions TEXT NOT NULL
        )
    ''')

    # Create settings table
    c.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')

    # Create courses table
    c.execute('''
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            tutor_name TEXT NOT NULL,
            price REAL NOT NULL,
            students_count INTEGER DEFAULT 0
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS tutor_availability (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tutor_id INTEGER,
            day_of_week INTEGER,
            time_slot TEXT,
            FOREIGN KEY(tutor_id) REFERENCES users(id)
        )
    ''')
    
    # Create demo accounts if they don't exist
    c.execute("SELECT id FROM users WHERE email='student@demo.com'")
    student = c.fetchone()
    if not student:
        c.execute("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", 
                  ('Demo Student', 'student@demo.com', generate_password_hash('123456'), 'student'))
        
    c.execute("SELECT id FROM users WHERE email='admin@mrhacademy.com'")
    admin = c.fetchone()
    if not admin:
        c.execute("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", 
                  ('المدير العام', 'admin@mrhacademy.com', generate_password_hash('123456'), 'admin'))
        
    # Seed fekrah23451@gmail.com as admin
    c.execute("SELECT id FROM users WHERE email='fekrah23451@gmail.com'")
    owner_admin = c.fetchone()
    if not owner_admin:
        c.execute("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", 
                  ('مدير الموقع', 'fekrah23451@gmail.com', generate_password_hash('123456'), 'admin'))
    else:
        c.execute("UPDATE users SET role = 'admin' WHERE email = 'fekrah23451@gmail.com'")
        
    # Seed Sarah (Sarah.alazzeh87@gmail.com)
    c.execute("SELECT id FROM users WHERE email='Sarah.alazzeh87@gmail.com'")
    if not c.fetchone():
        c.execute("INSERT INTO users (name, email, password, role, subject, bio, tags, avatar, price, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                  ('Sarah', 'Sarah.alazzeh87@gmail.com', generate_password_hash('123456'), 'tutor', 
                   'English', 'Experienced English tutor helping students achieve fluency and build confidence in reading, writing, and speaking.',
                   'Conversation,Business,Grammar', 'assets/tutor_1.png', 15.0, 1))
    else:
        c.execute("UPDATE users SET approved = 1 WHERE email='Sarah.alazzeh87@gmail.com'")

    # Seed Yasmeen Ayman Abdelghany (yasmenaiman1@gmail.com)
    c.execute("SELECT id FROM users WHERE email='yasmenaiman1@gmail.com'")
    if not c.fetchone():
        c.execute("INSERT INTO users (name, email, password, role, subject, bio, tags, avatar, price, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                  ('Yasmeen Ayman Abdelghany', 'yasmenaiman1@gmail.com', generate_password_hash('123456'), 'tutor', 
                   'Arabic', 'Native Arabic speaker specializing in teaching Modern Standard Arabic and dialects to all levels using interactive methods.',
                   'Beginners,Conversation,Kids', 'assets/tutor_2.png', 12.0, 1))
    else:
        c.execute("UPDATE users SET approved = 1 WHERE email='yasmenaiman1@gmail.com'")

    # Seed Fatimetou zahra Abdellahi (fatimetouzehra27@gmail.com)
    c.execute("SELECT id FROM users WHERE email='fatimetouzehra27@gmail.com'")
    if not c.fetchone():
        c.execute("INSERT INTO users (name, email, password, role, subject, bio, tags, avatar, price, approved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                  ('Fatimetou zahra Abdellahi', 'fatimetouzehra27@gmail.com', generate_password_hash('123456'), 'tutor', 
                   'Arabic', 'Professional Arabic language tutor. Dynamic, engaging, and personalized lessons tailored to your learning pace and goals.',
                   'Conversation,Academic,Grammar', 'assets/tutor_3.png', 13.0, 1))
    else:
        c.execute("UPDATE users SET approved = 1 WHERE email='fatimetouzehra27@gmail.com'")

    # Seed student (hkprivat50@gmail.com)
    c.execute("SELECT id FROM users WHERE email='hkprivat50@gmail.com'")
    if not c.fetchone():
        c.execute("INSERT INTO users (name, email, password, role, balance) VALUES (?, ?, ?, ?, ?)",
                  ('موسيقا عميقة', 'hkprivat50@gmail.com', generate_password_hash('123456'), 'student', 50.0))

    # Seed default employees
    c.execute("SELECT COUNT(*) FROM employees")
    if c.fetchone()[0] == 0:
        c.execute("INSERT INTO employees (name, email, role, permissions) VALUES (?, ?, ?, ?)",
                  ('محمد الدوسري', 'mohammed@mrhacademy.com', 'مدقق حسابات (Moderator)', 'قبول/رفض طلبات المدرسين,حذف/تعديل الكورسات المسجلة'))
        c.execute("INSERT INTO employees (name, email, role, permissions) VALUES (?, ?, ?, ?)",
                  ('لمى سعيد', 'lama@mrhacademy.com', 'دعم فني (Support)', 'الوصول لبلاغات قاعات الدروس,مراسلة الطلاب والمدرسين'))

    # Seed default settings
    c.execute("SELECT COUNT(*) FROM settings")
    if c.fetchone()[0] == 0:
        c.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ('platform_name', 'Mr.H Academy'))
        c.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ('contact_email', 'hello@mrhacademy.com'))
        c.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ('default_lesson_price', '15'))
        c.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ('maintenance_mode', 'false'))

    # Seed default courses
    c.execute("SELECT COUNT(*) FROM courses")
    if c.fetchone()[0] == 0:
        c.execute("INSERT INTO courses (title, tutor_name, price, students_count) VALUES (?, ?, ?, ?)",
                  ('العربية الفصحى لغير الناطقين بها', 'Yasmeen Ayman Abdelghany', 120.0, 15))
        c.execute("INSERT INTO courses (title, tutor_name, price, students_count) VALUES (?, ?, ?, ?)",
                  ('English Conversation Masterclass', 'Sarah', 150.0, 24))
        c.execute("INSERT INTO courses (title, tutor_name, price, students_count) VALUES (?, ?, ?, ?)",
                  ('تجهيز اختبار الآيلتس (IELTS)', 'Sarah', 200.0, 12))

    conn.commit()
    conn.close()

init_db()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    
    if not name or not email or not password:
        return jsonify({'error': 'جميع الحقول مطلوبة'}), 400
        
    hashed_pw = generate_password_hash(password)
    
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        role = 'admin' if email == 'fekrah23451@gmail.com' else 'student'
        c.execute('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', (name, email, hashed_pw, role))
        conn.commit()
        user_id = c.lastrowid
        conn.close()
        
        session['user_id'] = user_id
        session['role'] = role
        return jsonify({'success': True, 'message': 'تم إنشاء الحساب بنجاح', 'role': role})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'البريد الإلكتروني مسجل مسبقاً'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'يرجى إدخال البريد الإلكتروني وكلمة المرور'}), 400
        
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE email = ?', (email,))
    user = c.fetchone()
    conn.close()
    
    if user and check_password_hash(user['password'], password):
        session['user_id'] = user['id']
        session['role'] = user['role']
        return jsonify({'success': True, 'message': 'تم تسجيل الدخول', 'role': user['role']})
    else:
        return jsonify({'error': 'البريد الإلكتروني أو كلمة المرور غير صحيحة'}), 401

@app.route('/api/me', methods=['GET'])
def me():
    if 'user_id' not in session:
        return jsonify({'logged_in': False}), 401
        
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    try:
        c.execute('SELECT id, name, email, role, balance, total_hours_taught, phone, timezone, price FROM users WHERE id = ?', (session['user_id'],))
    except sqlite3.OperationalError:
        c.execute('SELECT id, name, email, role FROM users WHERE id = ?', (session['user_id'],))
    user = c.fetchone()
    conn.close()
    
    if user:
        user_dict = dict(user)
        if user_dict.get('email') == 'student@demo.com':
            user_dict['photoURL'] = 'https://randomuser.me/api/portraits/men/45.jpg'
        return jsonify({
            'logged_in': True, 
            'user': user_dict, 
            'impersonating': 'admin_user_id' in session
        })
    return jsonify({'logged_in': False}), 401

@app.route('/api/user/update-profile', methods=['POST'])
def update_profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
    
    data = request.json
    first_name = data.get('firstName', '').strip()
    last_name = data.get('lastName', '').strip()
    phone = data.get('phone', '').strip()
    timezone = data.get('timezone', '').strip()
    
    if not first_name:
        return jsonify({'error': 'First name is required'}), 400
        
    full_name = f"{first_name} {last_name}".strip()
    
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        UPDATE users 
        SET name = ?, phone = ?, timezone = ?
        WHERE id = ?
    ''', (full_name, phone, timezone, session['user_id']))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Profile updated successfully'})

@app.route('/api/user/update-password', methods=['POST'])
def update_password():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
        
    data = request.json
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')
    
    if not current_password or not new_password:
        return jsonify({'error': 'All fields are required'}), 400
        
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT password FROM users WHERE id = ?', (session['user_id'],))
    user = c.fetchone()
    
    if not user or not check_password_hash(user['password'], current_password):
        conn.close()
        return jsonify({'error': 'Current password is incorrect'}), 400
        
    hashed_pw = generate_password_hash(new_password)
    c.execute('UPDATE users SET password = ? WHERE id = ?', (hashed_pw, session['user_id']))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Password updated successfully'})

@app.route('/api/user/update-email', methods=['POST'])
def update_email():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
        
    data = request.json
    new_email = data.get('newEmail', '').strip()
    
    if not new_email:
        return jsonify({'error': 'Email is required'}), 400
        
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    try:
        c.execute('UPDATE users SET email = ? WHERE id = ?', (new_email, session['user_id']))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Email is already in use by another account'}), 400
    conn.close()
    
    return jsonify({'success': True, 'message': 'Email updated successfully'})

@app.route('/api/switch-role', methods=['POST'])
def switch_role():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
        
    data = request.json
    new_role = data.get('role')
    
    if new_role not in ['student', 'tutor']:
        return jsonify({'error': 'Invalid role'}), 400
        
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('UPDATE users SET role = ? WHERE id = ?', (new_role, session['user_id']))
    conn.commit()
    conn.close()
    
    session['role'] = new_role
    return jsonify({'success': True, 'role': new_role})

@app.route('/api/tutor/update-price', methods=['POST'])
def tutor_update_price():
    if 'user_id' not in session or session.get('role') != 'tutor':
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json or {}
    price = data.get('price')
    if price is None or float(price) <= 0:
        return jsonify({'error': 'سعر غير صالح'}), 400
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute('UPDATE users SET price = ? WHERE id = ?', (float(price), session['user_id']))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'تم تحديث السعر بنجاح'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/lessons', methods=['GET'])
def get_lessons():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
        
    user_id = session['user_id']
    role = session.get('role', 'student')
    
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    if role == 'tutor':
        c.execute('''
            SELECT l.*, u.name as other_name, u.avatar as other_avatar 
            FROM lessons l 
            JOIN users u ON l.student_id = u.id 
            WHERE l.tutor_id = ?
        ''', (user_id,))
    else:
        c.execute('''
            SELECT l.*, u.name as other_name, u.avatar as other_avatar 
            FROM lessons l 
            JOIN users u ON l.tutor_id = u.id 
            WHERE l.student_id = ?
        ''', (user_id,))
        
    lessons = [dict(row) for row in c.fetchall()]
    conn.close()
    
    return jsonify({'success': True, 'lessons': lessons})

def get_platform_fee_percentage(hours):
    if hours <= 20: return 0.30
    if hours <= 50: return 0.24
    if hours <= 200: return 0.20
    if hours <= 400: return 0.18
    return 0.12

@app.route('/api/lessons/<int:lesson_id>/complete', methods=['POST'])
def complete_lesson(lesson_id):
    if 'user_id' not in session or session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
        
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    c.execute('SELECT * FROM lessons WHERE id = ? AND student_id = ?', (lesson_id, session['user_id']))
    lesson = c.fetchone()
    
    if not lesson:
        conn.close()
        return jsonify({'error': 'Lesson not found'}), 404
        
    if lesson['status'] == 'completed':
        conn.close()
        return jsonify({'error': 'Lesson already completed'}), 400
        
    try:
        c.execute('SELECT balance, total_hours_taught FROM users WHERE id = ?', (lesson['tutor_id'],))
        tutor = c.fetchone()
    except sqlite3.OperationalError:
        tutor = None
        
    if not tutor:
        conn.close()
        return jsonify({'error': 'Tutor not found'}), 404
        
    current_hours = tutor['total_hours_taught'] if tutor['total_hours_taught'] is not None else 0.0
    price = lesson['price'] if 'price' in lesson.keys() and lesson['price'] is not None else 15.0
    duration = lesson['duration_hours'] if 'duration_hours' in lesson.keys() and lesson['duration_hours'] is not None else 1.0
    
    fee_percentage = get_platform_fee_percentage(current_hours)
    platform_fee = price * fee_percentage
    tutor_share = price - platform_fee
    
    c.execute('UPDATE lessons SET status = ? WHERE id = ?', ('completed', lesson_id))
    c.execute('UPDATE users SET balance = balance + ?, total_hours_taught = total_hours_taught + ? WHERE id = ?', 
              (tutor_share, duration, lesson['tutor_id']))
              
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True, 
        'message': 'تم تأكيد الدرس بنجاح',
        'tutor_share': tutor_share,
        'platform_fee': platform_fee
    })

@app.route('/api/report', methods=['POST'])
def submit_report():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401
        
    data = request.json
    issue_type = data.get('issue_type')
    description = data.get('description')
    room_id = data.get('room_id')
    
    if not issue_type:
        return jsonify({'error': 'نوع المشكلة مطلوب'}), 400
        
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute('INSERT INTO reports (user_id, room_id, issue_type, description) VALUES (?, ?, ?, ?)',
                  (session['user_id'], room_id, issue_type, description))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'تم استلام بلاغك بنجاح. سيقوم فريق الدعم بمراجعته.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports', methods=['GET'])
def get_reports():
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('''
            SELECT r.*, u.name as user_name, u.email as user_email, u.role as user_role
            FROM reports r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.created_at DESC
        ''')
        reports = [dict(row) for row in c.fetchall()]
        conn.close()
        return jsonify({'success': True, 'reports': reports})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tutors/top', methods=['GET'])
def get_top_tutors():
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        query = '''
            SELECT u.id, u.name, u.subject, u.bio, u.avatar, u.price, u.tags,
                   COALESCE(AVG(r.rating), 0.0) as avg_rating,
                   COUNT(r.id) as review_count
            FROM users u
            LEFT JOIN reviews r ON u.id = r.tutor_id AND r.approved = 1
            WHERE u.role = 'tutor' AND u.subject IS NOT NULL AND u.approved = 1
            GROUP BY u.id
            ORDER BY avg_rating DESC, review_count DESC
            LIMIT 3
        '''
        c.execute(query)
        tutors = c.fetchall()
        conn.close()
        
        result = []
        for t in tutors:
            t_dict = dict(t)
            t_dict['tags'] = [tag.strip() for tag in t_dict['tags'].split(',')] if t_dict.get('tags') else []
            result.append(t_dict)
            
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tutors/<int:tutor_id>', methods=['GET'])
def get_tutor(tutor_id):
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute('''
            SELECT u.id, u.name, u.subject, u.bio, u.avatar, u.price, u.tags,
                   u.approved, u.experience, u.motivation, u.certificates, u.education,
                   u.experience_years, 
                   (COALESCE(u.students_count, 0) + (SELECT COUNT(DISTINCT student_id) FROM lessons WHERE tutor_id = u.id)) as students_count,
                   (COALESCE(u.lessons_count, 0) + (SELECT COUNT(*) FROM lessons WHERE tutor_id = u.id AND status = 'completed')) as lessons_count,
                   COALESCE(AVG(r.rating), 0.0) as avg_rating,
                   COUNT(r.id) as review_count
            FROM users u
            LEFT JOIN reviews r ON u.id = r.tutor_id AND r.approved = 1
            WHERE u.id = ? AND u.role = 'tutor'
            GROUP BY u.id
        ''', (tutor_id,))
        tutor = c.fetchone()
        
        if not tutor:
            conn.close()
            return jsonify({'error': 'المدرس غير موجود'}), 404
            
        c.execute('''
            SELECT r.id, r.rating, r.comment, r.created_at, u.name as reviewer_name
            FROM reviews r
            JOIN users u ON r.student_id = u.id
            WHERE r.tutor_id = ? AND r.approved = 1
            ORDER BY r.created_at DESC
        ''', (tutor_id,))
        reviews = c.fetchall()
        conn.close()
        
        tutor_dict = dict(tutor)
        tutor_dict['tags'] = [tag.strip() for tag in tutor_dict['tags'].split(',')] if tutor_dict.get('tags') else []
        
        reviews_list = [dict(rv) for rv in reviews]
            
        return jsonify({
            'tutor': tutor_dict,
            'reviews': reviews_list
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tutors/<int:tutor_id>/reviews', methods=['POST'])
def add_tutor_review(tutor_id):
    if 'user_id' not in session:
        return jsonify({'error': 'يجب تسجيل الدخول لإضافة تقييم'}), 401
        
    student_id = session['user_id']
    data = request.json
    rating = data.get('rating')
    comment = data.get('comment', '')
    
    if not rating or not (1 <= int(rating) <= 5):
        return jsonify({'error': 'تقييم غير صالح. يجب أن يكون بين 1 و 5'}), 400
        
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        
        c.execute("SELECT id FROM users WHERE id = ? AND role = 'tutor'", (tutor_id,))
        if not c.fetchone():
            conn.close()
            return jsonify({'error': 'المدرس غير موجود'}), 404
            
        # Check if student has booked a lesson with this tutor
        c.execute("SELECT id FROM lessons WHERE student_id = ? AND tutor_id = ?", (student_id, tutor_id))
        if not c.fetchone():
            conn.close()
            return jsonify({'error': 'لا يمكنك تقييم المدرس إلا بعد حجز درس معه'}), 403
            
        c.execute('''
            INSERT INTO reviews (tutor_id, student_id, rating, comment)
            VALUES (?, ?, ?, ?)
        ''', (tutor_id, student_id, int(rating), comment))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'تم إرسال تقييمك بنجاح وسيكون ظاهراً بعد مراجعة الإدارة.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # 1. Total Tutors
        c.execute("SELECT COUNT(*) FROM users WHERE role = 'tutor'")
        total_tutors = c.fetchone()[0]
        
        # 2. Total Students
        c.execute("SELECT COUNT(*) FROM users WHERE role = 'student'")
        total_students = c.fetchone()[0]
        
        # 3. Total Lessons
        c.execute("SELECT COUNT(*) FROM lessons")
        total_lessons = c.fetchone()[0]
        
        # 4. Active Issues
        c.execute("SELECT COUNT(*) FROM reports")
        total_issues = c.fetchone()[0]
        
        # 5. Total Earnings (Sum of platform fees from completed lessons)
        c.execute('''
            SELECT l.price, u.total_hours_taught 
            FROM lessons l
            JOIN users u ON l.tutor_id = u.id
            WHERE l.status = 'completed'
        ''')
        completed_lessons = c.fetchall()
        
        total_earnings = 0.0
        for lesson in completed_lessons:
            price = lesson['price'] if lesson['price'] is not None else 15.0
            hours = lesson['total_hours_taught'] if lesson['total_hours_taught'] is not None else 0.0
            fee_pct = get_platform_fee_percentage(hours)
            total_earnings += price * fee_pct
            
        conn.close()
        
        return jsonify({
            'success': True,
            'total_tutors': total_tutors,
            'total_students': total_students,
            'total_lessons': total_lessons,
            'total_issues': total_issues,
            'total_earnings': round(total_earnings, 2)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/lessons', methods=['GET'])
def get_admin_lessons():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute('''
            SELECT l.id, l.scheduled_time, l.status, l.room_id, l.price, l.duration_hours,
                   t.name as tutor_name, s.name as student_name
            FROM lessons l
            LEFT JOIN users t ON l.tutor_id = t.id
            LEFT JOIN users s ON l.student_id = s.id
            ORDER BY l.id DESC
        ''')
        lessons = [dict(row) for row in c.fetchall()]
        conn.close()
        return jsonify({'success': True, 'lessons': lessons})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/tutors', methods=['GET'])
def get_admin_tutors():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute('''
            SELECT u.id, u.name, u.email, u.subject, u.balance, u.total_hours_taught, u.price, u.approved,
                   u.experience_years, 
                   (COALESCE(u.students_count, 0) + (SELECT COUNT(DISTINCT student_id) FROM lessons WHERE tutor_id = u.id)) as students_count,
                   (COALESCE(u.lessons_count, 0) + (SELECT COUNT(*) FROM lessons WHERE tutor_id = u.id AND status = 'completed')) as lessons_count,
                   u.bio, u.country,
                   u.languages, u.certificates, u.education, u.tags,
                   COALESCE(AVG(r.rating), 0.0) as avg_rating,
                   COUNT(r.id) as review_count
            FROM users u
            LEFT JOIN reviews r ON u.id = r.tutor_id AND r.approved = 1
            WHERE u.role = 'tutor'
            GROUP BY u.id
            ORDER BY avg_rating DESC, u.name ASC
        ''')
        tutors = [dict(row) for row in c.fetchall()]
        conn.close()
        return jsonify({'success': True, 'tutors': tutors})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/students', methods=['GET'])
def get_admin_students():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        c.execute('''
            SELECT u.id, u.name, u.email, u.balance,
                   COUNT(l.id) as lesson_count
            FROM users u
            LEFT JOIN lessons l ON u.id = l.student_id
            WHERE u.role = 'student'
            GROUP BY u.id
            ORDER BY u.name ASC
        ''')
        students = [dict(row) for row in c.fetchall()]
        conn.close()
        return jsonify({'success': True, 'students': students})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/students/<int:student_id>/lessons', methods=['GET'])
def get_admin_student_lessons(student_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Get student details
        c.execute("SELECT id, name, email, balance FROM users WHERE id = ? AND role = 'student'", (student_id,))
        student_row = c.fetchone()
        if not student_row:
            conn.close()
            return jsonify({'error': 'Student not found'}), 404
        student = dict(student_row)
        
        # Get lessons
        c.execute('''
            SELECT l.*, t.name as tutor_name, t.avatar as tutor_avatar, t.subject as tutor_subject, t.price as tutor_price
            FROM lessons l
            JOIN users t ON l.tutor_id = t.id
            WHERE l.student_id = ?
            ORDER BY l.scheduled_time DESC
        ''', (student_id,))
        lessons = [dict(row) for row in c.fetchall()]
        
        # Get unique list of tutors they had lessons with
        c.execute('''
            SELECT DISTINCT t.id, t.name, t.avatar, t.subject, t.price
            FROM lessons l
            JOIN users t ON l.tutor_id = t.id
            WHERE l.student_id = ?
        ''', (student_id,))
        tutors = [dict(row) for row in c.fetchall()]
        
        conn.close()
        return jsonify({
            'success': True,
            'student': student,
            'lessons': lessons,
            'tutors': tutors
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/employees', methods=['GET'])
def get_admin_employees():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT id, name, email, role, permissions FROM employees ORDER BY id ASC")
        employees = [dict(row) for row in c.fetchall()]
        conn.close()
        return jsonify({'success': True, 'employees': employees})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/employees', methods=['POST'])
def add_admin_employee():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    name = data.get('name')
    email = data.get('email')
    role = data.get('role')
    permissions = data.get('permissions', '')
    
    if not name or not email or not role:
        return jsonify({'error': 'جميع الحقول مطلوبة'}), 400
        
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("INSERT INTO employees (name, email, role, permissions) VALUES (?, ?, ?, ?)",
                  (name, email, role, permissions))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'تم إضافة الموظف بنجاح'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'البريد الإلكتروني مسجل مسبقاً لموظف آخر'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/employees/<int:emp_id>', methods=['PUT'])
def update_admin_employee(emp_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    name = data.get('name')
    email = data.get('email')
    role = data.get('role')
    permissions = data.get('permissions', '')
    
    if not name or not email or not role:
        return jsonify({'error': 'جميع الحقول مطلوبة'}), 400
        
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute('''
            UPDATE employees 
            SET name = ?, email = ?, role = ?, permissions = ?
            WHERE id = ?
        ''', (name, email, role, permissions, emp_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'تم تحديث الموظف بنجاح'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'البريد الإلكتروني مسجل مسبقاً لموظف آخر'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/employees/<int:emp_id>', methods=['DELETE'])
def delete_admin_employee(emp_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("DELETE FROM employees WHERE id = ?", (emp_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'تم حذف الموظف بنجاح'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/settings', methods=['GET'])
def get_admin_settings():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT key, value FROM settings")
        rows = c.fetchall()
        conn.close()
        
        settings_dict = {row['key']: row['value'] for row in rows}
        return jsonify({'success': True, 'settings': settings_dict})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/settings', methods=['POST'])
def update_admin_settings():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        for key, val in data.items():
            c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(val)))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'تم حفظ الإعدادات بنجاح'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/courses', methods=['GET'])
def get_admin_courses():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT id, title, tutor_name, price, students_count FROM courses ORDER BY id DESC")
        courses = [dict(row) for row in c.fetchall()]
        conn.close()
        return jsonify({'success': True, 'courses': courses})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/courses', methods=['POST'])
def add_admin_course():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json or {}
    title = data.get('title')
    tutor_name = data.get('tutor_name')
    price = data.get('price')
    
    if not title or not tutor_name or price is None:
        return jsonify({'error': 'جميع الحقول مطلوبة'}), 400
        
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("INSERT INTO courses (title, tutor_name, price) VALUES (?, ?, ?)",
                  (title, tutor_name, float(price)))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'تم إضافة الكورس بنجاح'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/courses/<int:course_id>', methods=['DELETE'])
def delete_admin_course(course_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("DELETE FROM courses WHERE id = ?", (course_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'تم حذف الكورس بنجاح'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tutors', methods=['GET'])
def get_tutors():
    subject = request.args.get('subject') # e.g. English or Arabic
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        query = '''
            SELECT u.id, u.name, u.email, u.subject, u.bio, u.avatar, u.price, u.tags, u.country,
                   COALESCE(AVG(r.rating), 0.0) as avg_rating,
                   COUNT(r.id) as review_count
            FROM users u
            LEFT JOIN reviews r ON u.id = r.tutor_id AND r.approved = 1
            WHERE u.role = 'tutor' AND u.approved = 1
        '''
        params = []
        if subject:
            query += ' AND u.subject = ?'
            params.append(subject)
            
        query += ' GROUP BY u.id ORDER BY u.name ASC'
        
        c.execute(query, params)
        tutors = c.fetchall()
        conn.close()
        
        result = []
        for t in tutors:
            t_dict = dict(t)
            t_dict['tags'] = [tag.strip() for tag in t_dict['tags'].split(',')] if t_dict.get('tags') else []
            result.append(t_dict)
            
        return jsonify({'success': True, 'tutors': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/reviews', methods=['GET'])
def get_admin_reviews():
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute('''
            SELECT r.id, r.rating, r.comment, r.created_at, 
                   s.name as student_name, s.email as student_email,
                   t.name as tutor_name
            FROM reviews r
            JOIN users s ON r.student_id = s.id
            JOIN users t ON r.tutor_id = t.id
            WHERE r.approved = 0
            ORDER BY r.created_at DESC
        ''')
        reviews = [dict(row) for row in c.fetchall()]
        conn.close()
        return jsonify({'success': True, 'reviews': reviews})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/reviews/<int:review_id>/approve', methods=['POST'])
def approve_admin_review(review_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("UPDATE reviews SET approved = 1 WHERE id = ?", (review_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'تم الموافقة على التقييم بنجاح'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/reviews/<int:review_id>', methods=['DELETE'])
def delete_admin_review(review_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("DELETE FROM reviews WHERE id = ?", (review_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'تم حذف/رفض التقييم بنجاح'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tutors/apply', methods=['POST'])
def tutor_apply():
    data = request.json
    fname = data.get('fname', '')
    lname = data.get('lname', '')
    email = data.get('email', '')
    country = data.get('country', '')
    subject = data.get('subject', '')
    phone = data.get('phone', '')
    languages = data.get('languages', '')
    timezone = data.get('timezone', '')
    bio_intro = data.get('bio_intro', '')
    bio_experience = data.get('bio_experience', '')
    bio_motivation = data.get('bio_motivation', '')
    bio_title = data.get('bio_title', '')
    price = data.get('price', 15.0)
    video_link = data.get('video_link', '')
    certificates = data.get('certificates', '')
    education = data.get('education', '')

    if not fname or not lname or not email or not subject:
        return jsonify({'error': 'الاسم والبريد الإلكتروني والمادة مطلوبة'}), 400

    full_name = f"{fname} {lname}"
    full_bio = f"{bio_title}\n\n{bio_intro}\n\n{bio_experience}\n\n{bio_motivation}"

    # Default avatar placeholder
    avatar = 'assets/default_avatar.png'
    if subject == 'English':
        avatar = 'assets/tutor_1.png'
    else:
        avatar = 'assets/tutor_2.png'

    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        
        c.execute("SELECT id, role FROM users WHERE email = ?", (email,))
        existing_user = c.fetchone()
        
        default_pw_hash = generate_password_hash('123456')
        
        if existing_user:
            c.execute('''
                UPDATE users 
                SET name = ?, role = 'tutor', approved = 0, subject = ?, bio = ?, price = ?, 
                    country = ?, languages = ?, phone = ?, timezone = ?, 
                    experience = ?, motivation = ?, certificates = ?, education = ?, video_link = ?, avatar = ?
                WHERE id = ?
            ''', (full_name, subject, full_bio, price, country, languages, phone, timezone,
                  bio_experience, bio_motivation, certificates, education, video_link, avatar, existing_user[0]))
        else:
            c.execute('''
                INSERT INTO users (name, email, password, role, approved, subject, bio, price, 
                                   country, languages, phone, timezone, experience, motivation, 
                                   certificates, education, video_link, avatar)
                VALUES (?, ?, ?, 'tutor', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (full_name, email, default_pw_hash, subject, full_bio, price, country, languages, 
                  phone, timezone, bio_experience, bio_motivation, certificates, education, video_link, avatar))
            
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'تم تقديم طلبك بنجاح وهو قيد المراجعة حالياً.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/tutors/<int:tutor_id>/approve', methods=['POST'])
def approve_tutor(tutor_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("UPDATE users SET approved = 1 WHERE id = ? AND role = 'tutor'", (tutor_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'تمت الموافقة على المدرس وتفعيل ملفه الشخصي بنجاح.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/tutors/<int:tutor_id>', methods=['PUT'])
def update_admin_tutor(tutor_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json or {}
    name = data.get('name')
    subject = data.get('subject')
    price = data.get('price')
    bio = data.get('bio')
    country = data.get('country')
    experience_years = data.get('experience_years')
    students_count = data.get('students_count')
    lessons_count = data.get('lessons_count')
    languages = data.get('languages')
    certificates = data.get('certificates')
    education = data.get('education')
    tags = data.get('tags')
    
    if not name or not subject or price is None:
        return jsonify({'error': 'الاسم والمادة والسعر مطلوبين'}), 400
        
    try:
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute('''
            UPDATE users
            SET name = ?, subject = ?, price = ?, bio = ?, country = ?,
                experience_years = ?, students_count = ?, lessons_count = ?,
                languages = ?, certificates = ?, education = ?, tags = ?
            WHERE id = ? AND role = 'tutor'
        ''', (name, subject, float(price), bio, country,
              experience_years, int(students_count), int(lessons_count),
              languages, certificates, education, tags, tutor_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'تم تعديل ملف المدرس بنجاح.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/tutors/<int:tutor_id>/pdf', methods=['GET'])
def get_tutor_pdf(tutor_id):
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE id = ? AND role = 'tutor'", (tutor_id,))
        t = c.fetchone()
        conn.close()
        
        if not t:
            return jsonify({'error': 'المدرس غير موجود'}), 404
            
        t_dict = dict(t)
        
        # Build PDF
        pdf = FPDF()
        pdf.add_page()
        
        # Add tahoma fonts
        pdf.add_font("Tahoma", "", "C:/Windows/Fonts/tahoma.ttf", uni=True)
        pdf.add_font("Tahoma", "B", "C:/Windows/Fonts/tahomabd.ttf", uni=True)
        
        # Title
        pdf.set_font("Tahoma", "B", 18)
        title_text = "طلب انضمام مدرس جديد - Mr.H Academy"
        pdf.cell(0, 15, get_display(arabic_reshaper.reshape(title_text)), ln=1, align='C')
        pdf.ln(10)
        
        # Divider Line
        pdf.line(10, 35, 200, 35)
        
        # Details
        pdf.set_font("Tahoma", "B", 12)
        pdf.cell(0, 10, get_display(arabic_reshaper.reshape("البيانات الشخصية والأساسية:")), ln=1, align='R')
        pdf.set_font("Tahoma", "", 10)
        
        def add_field(label, val):
            label_reshaped = get_display(arabic_reshaper.reshape(label))
            val_reshaped = get_display(arabic_reshaper.reshape(str(val) if val is not None else ''))
            pdf.cell(90, 8, val_reshaped, align='R')
            pdf.cell(100, 8, label_reshaped + " :", align='R', ln=1)
            
        add_field("الاسم الكامل", t_dict.get('name', ''))
        add_field("البريد الإلكتروني", t_dict.get('email', ''))
        add_field("بلد الميلاد", t_dict.get('country', 'لم يحدد'))
        add_field("رقم الهاتف", t_dict.get('phone', 'لم يحدد'))
        add_field("المنطقة الزمنية", t_dict.get('timezone', 'لم يحدد'))
        add_field("المادة المراد تدريسها", t_dict.get('subject', 'لم يحدد'))
        add_field("سعر الدرس المقترح ($/ساعة)", t_dict.get('price', 15.0))
        add_field("اللغات التي يتحدث بها", t_dict.get('languages', 'لم يحدد'))
        
        pdf.ln(10)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(5)
        
        pdf.set_font("Tahoma", "B", 12)
        pdf.cell(0, 10, get_display(arabic_reshaper.reshape("السيرة الذاتية والوصف:")), ln=1, align='R')
        pdf.set_font("Tahoma", "", 10)
        
        bio = t_dict.get('bio', '')
        if bio:
            lines = bio.split('\n')
            for line in lines:
                if line.strip():
                    reshaped_line = get_display(arabic_reshaper.reshape(line))
                    pdf.multi_cell(0, 8, reshaped_line, align='R')
        
        # Certifications
        certs = t_dict.get('certificates', '')
        if certs:
            pdf.ln(5)
            pdf.set_font("Tahoma", "B", 12)
            pdf.cell(0, 10, get_display(arabic_reshaper.reshape("الشهادات المهنية:")), ln=1, align='R')
            pdf.set_font("Tahoma", "", 10)
            
            try:
                certs_data = json.loads(certs)
                if isinstance(certs_data, list):
                    for idx, c_item in enumerate(certs_data):
                        cert_str = f"- {c_item.get('subject', '')} : {c_item.get('name', '')} ({c_item.get('from', '')} - {c_item.get('to', '')})"
                        pdf.multi_cell(0, 8, get_display(arabic_reshaper.reshape(cert_str)), align='R')
                else:
                    pdf.multi_cell(0, 8, get_display(arabic_reshaper.reshape(certs)), align='R')
            except Exception:
                pdf.multi_cell(0, 8, get_display(arabic_reshaper.reshape(certs)), align='R')

        # Education
        edu = t_dict.get('education', '')
        if edu:
            pdf.ln(5)
            pdf.set_font("Tahoma", "B", 12)
            pdf.cell(0, 10, get_display(arabic_reshaper.reshape("التعليم والدرجات العلمية:")), ln=1, align='R')
            pdf.set_font("Tahoma", "", 10)
            
            try:
                edu_data = json.loads(edu)
                if isinstance(edu_data, list):
                    for idx, e_item in enumerate(edu_data):
                        edu_str = f"- {e_item.get('degree', '')} in {e_item.get('major', '')} at {e_item.get('university', '')} ({e_item.get('from', '')} - {e_item.get('to', '')})"
                        pdf.multi_cell(0, 8, get_display(arabic_reshaper.reshape(edu_str)), align='R')
                else:
                    pdf.multi_cell(0, 8, get_display(arabic_reshaper.reshape(edu)), align='R')
            except Exception:
                pdf.multi_cell(0, 8, get_display(arabic_reshaper.reshape(edu)), align='R')
                
        # Video Intro Link
        video = t_dict.get('video_link', '')
        if video:
            pdf.ln(5)
            pdf.set_font("Tahoma", "B", 12)
            pdf.cell(0, 10, get_display(arabic_reshaper.reshape("فيديو تعريفي:")), ln=1, align='R')
            pdf.set_font("Tahoma", "", 10)
            pdf.cell(0, 8, get_display(arabic_reshaper.reshape(video)), ln=1, align='R')
            
        # Return PDF as downloadable file
        pdf_output = pdf.output(dest='S')
        if isinstance(pdf_output, str):
            pdf_bytes = pdf_output.encode('latin1')
        else:
            pdf_bytes = bytes(pdf_output)
            
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"tutor_{t_dict.get('name')}_profile.pdf"
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

whiteboard_state = {}

@socketio.on('join_lesson')
def on_join(data):
    room = data.get('room_id')
    user_name = data.get('user_name', 'User')
    if room:
        join_room(room)
        emit('chat_message', {'sender': 'System', 'text': f'{user_name} joined the classroom.', 'time': 'Now'}, to=room)
        emit('peer_joined', {'user_name': user_name}, to=room, include_self=False)
        
        # Send existing whiteboard state to the user joining
        if room in whiteboard_state:
            emit('whiteboard_sync', {'pages': whiteboard_state[room]}, to=request.sid)

@socketio.on('send_chat')
def on_chat(data):
    room = data.get('room_id')
    if room:
        emit('chat_message', {'sender': data.get('sender'), 'text': data.get('text'), 'time': data.get('time')}, to=room)

@socketio.on('canvas_draw')
def on_draw(data):
    room = data.get('room_id')
    page_id = data.get('page_id', 1)
    if room:
        if room not in whiteboard_state:
            whiteboard_state[room] = {}
        whiteboard_state[room][str(page_id)] = data.get('html')
        emit('canvas_update', data, to=room, include_self=False)

@socketio.on('whiteboard_page_change')
def on_page_change(data):
    room = data.get('room_id')
    if room:
        emit('whiteboard_page_change', data, to=room, include_self=False)

@socketio.on('webrtc_offer')
def webrtc_offer(data):
    emit('webrtc_offer', data, to=data.get('room_id'), include_self=False)

@socketio.on('webrtc_answer')
def webrtc_answer(data):
    emit('webrtc_answer', data, to=data.get('room_id'), include_self=False)

@socketio.on('webrtc_ice_candidate')
def webrtc_ice_candidate(data):
    emit('webrtc_ice_candidate', data, to=data.get('room_id'), include_self=False)

@socketio.on('webrtc_end')
def webrtc_end(data):
    emit('webrtc_end', data, to=data.get('room_id'), include_self=False)

@socketio.on('camera_offer')
def camera_offer(data):
    emit('camera_offer', data, to=data.get('room_id'), include_self=False)

@socketio.on('camera_answer')
def camera_answer(data):
    emit('camera_answer', data, to=data.get('room_id'), include_self=False)

@socketio.on('camera_ice_candidate')
def camera_ice_candidate(data):
    emit('camera_ice_candidate', data, to=data.get('room_id'), include_self=False)

@socketio.on('camera_ready')
def camera_ready(data):
    emit('camera_ready', data, to=data.get('room_id'), include_self=False)

# API to GET a tutor's availability (for any logged in user)
@app.route('/api/tutors/<int:tutor_id>/availability', methods=['GET'])
def get_tutor_availability(tutor_id):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT day_of_week, time_slot FROM tutor_availability WHERE tutor_id = ?", (tutor_id,))
    slots = [{"day_of_week": row[0], "time_slot": row[1]} for row in c.fetchall()]
    conn.close()
    return jsonify({"success": True, "slots": slots})

# API to GET the logged-in tutor's own availability
@app.route('/api/tutor/availability', methods=['GET'])
def get_own_availability():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    user = c.fetchone()
    if not user or user[0] != 'tutor':
        conn.close()
        return jsonify({"success": False, "message": "Forbidden"}), 403
        
    c.execute("SELECT day_of_week, time_slot FROM tutor_availability WHERE tutor_id = ?", (user_id,))
    slots = [{"day_of_week": row[0], "time_slot": row[1]} for row in c.fetchall()]
    conn.close()
    return jsonify({"success": True, "slots": slots})

# API to SAVE the logged-in tutor's availability
@app.route('/api/tutor/availability', methods=['POST'])
def save_own_availability():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    user = c.fetchone()
    if not user or user[0] != 'tutor':
        conn.close()
        return jsonify({"success": False, "message": "Forbidden"}), 403
        
    data = request.json or {}
    slots = data.get("slots", []) # List of {"day_of_week": X, "time_slot": "HH:MM"}
    
    try:
        c.execute("DELETE FROM tutor_availability WHERE tutor_id = ?", (user_id,))
        for s in slots:
            c.execute("INSERT INTO tutor_availability (tutor_id, day_of_week, time_slot) VALUES (?, ?, ?)",
                      (user_id, s.get("day_of_week"), s.get("time_slot")))
        conn.commit()
        success = True
        message = "Availability saved successfully"
    except Exception as e:
        conn.rollback()
        success = False
        message = str(e)
    conn.close()
    return jsonify({"success": success, "message": message})

# API for student to BOOK a lesson
@app.route('/api/lessons/book', methods=['POST'])
def book_lesson():
    student_id = session.get('user_id')
    if not student_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    c.execute("SELECT role, balance, email FROM users WHERE id = ?", (student_id,))
    student = c.fetchone()
    if not student or student['role'] != 'student':
        conn.close()
        return jsonify({"success": False, "message": "Only students can book lessons"}), 403
        
    data = request.json or {}
    tutor_id = data.get("tutor_id")
    scheduled_time = data.get("scheduled_time") # format "YYYY-MM-DD HH:MM"
    duration_minutes = data.get("duration_minutes", 25) # 25 or 50
    
    if not tutor_id or not scheduled_time:
        conn.close()
        return jsonify({"success": False, "message": "Missing tutor_id or scheduled_time"}), 400
        
    c.execute("SELECT price, name FROM users WHERE id = ? AND role = 'tutor'", (tutor_id,))
    tutor = c.fetchone()
    if not tutor:
        conn.close()
        return jsonify({"success": False, "message": "Tutor not found"}), 404
        
    required_lessons = 0.5 if duration_minutes == 25 else 1.0
    if student['balance'] < required_lessons:
        conn.close()
        return jsonify({"success": False, "message": "Insufficient lesson balance. Please top up."}), 400
        
    c.execute("SELECT id FROM lessons WHERE tutor_id = ? AND scheduled_time = ? AND status != 'cancelled'", 
              (tutor_id, scheduled_time))
    if c.fetchone():
        conn.close()
        return jsonify({"success": False, "message": "This slot is already booked."}), 400

    try:
        new_balance = student['balance'] - required_lessons
        c.execute("UPDATE users SET balance = ? WHERE id = ?", (new_balance, student_id))
        
        import uuid
        room_id = f"room-{uuid.uuid4().hex[:8]}"
        price = tutor['price'] * (duration_minutes / 60.0)
        c.execute("""
            INSERT INTO lessons (tutor_id, student_id, scheduled_time, status, room_id, price, duration_hours) 
            VALUES (?, ?, ?, 'scheduled', ?, ?, ?)
        """, (tutor_id, student_id, scheduled_time, room_id, price, duration_minutes / 60.0))
        
        conn.commit()
        success = True
        message = "Lesson scheduled successfully!"
    except Exception as e:
        conn.rollback()
        success = False
        message = str(e)
        
    conn.close()
    return jsonify({"success": success, "message": message})

# API to GET all contacts (tutors/students that this user has conversed with)
@app.route('/api/messages/contacts', methods=['GET'])
def get_message_contacts():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session['user_id']
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # Query distinct contacts from sender_id and receiver_id
    query = """
        SELECT DISTINCT 
            CASE 
                WHEN sender_id = ? THEN receiver_id 
                ELSE sender_id 
            END as contact_id
        FROM messages 
        WHERE sender_id = ? OR receiver_id = ?
    """
    c.execute(query, (user_id, user_id, user_id))
    contact_ids = [row['contact_id'] for row in c.fetchall()]
    
    # Also include tutors they have lessons with, even if no messages yet, so they can start a chat
    c.execute("""
        SELECT DISTINCT 
            CASE 
                WHEN student_id = ? THEN tutor_id 
                ELSE student_id 
            END as contact_id
        FROM lessons 
        WHERE student_id = ? OR tutor_id = ?
    """, (user_id, user_id, user_id))
    for row in c.fetchall():
        if row['contact_id'] not in contact_ids:
            contact_ids.append(row['contact_id'])
            
    contacts = []
    for cid in contact_ids:
        c.execute("SELECT id, name, role, avatar, balance FROM users WHERE id = ?", (cid,))
        u = c.fetchone()
        if u:
            # Get last message
            c.execute("""
                SELECT content, timestamp 
                FROM messages 
                WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) 
                ORDER BY timestamp DESC LIMIT 1
            """, (user_id, cid, cid, user_id))
            last_msg = c.fetchone()
            snippet = last_msg['content'] if last_msg else "No messages yet"
            time = last_msg['timestamp'] if last_msg else ""
            
            contacts.append({
                'id': u['id'],
                'name': u['name'],
                'role': u['role'],
                'avatar': u['avatar'],
                'balance': u['balance'],
                'snippet': snippet,
                'time': time
            })
            
    conn.close()
    return jsonify({'success': True, 'contacts': contacts})

# API to GET message history with a contact
@app.route('/api/messages/<int:contact_id>', methods=['GET'])
def get_message_history(contact_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session['user_id']
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    c.execute("""
        SELECT sender_id, receiver_id, content, timestamp 
        FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) 
        ORDER BY timestamp ASC
    """, (user_id, contact_id, contact_id, user_id))
    
    messages = []
    for row in c.fetchall():
        messages.append({
            'sender_id': row['sender_id'],
            'receiver_id': row['receiver_id'],
            'content': row['content'],
            'timestamp': row['timestamp']
        })
        
    conn.close()
    return jsonify({'success': True, 'messages': messages})

# API to POST a new message
@app.route('/api/messages', methods=['POST'])
def send_new_message():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session['user_id']
    data = request.json
    receiver_id = data.get('receiver_id')
    content = data.get('content')
    
    if not receiver_id or not content:
        return jsonify({'success': False, 'message': 'Missing fields'}), 400
        
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)", (user_id, receiver_id, content))
    conn.commit()
    conn.close()
    
    return jsonify({'success': True})

# API for Admin to Impersonate a user
@app.route('/api/admin/impersonate', methods=['POST'])
def admin_impersonate():
    # Only a user who is currently an admin can impersonate
    if 'user_id' not in session or session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
        
    data = request.json or {}
    target_user_id = data.get('user_id')
    if not target_user_id:
        return jsonify({'success': False, 'message': 'Missing user_id'}), 400
        
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT id, role FROM users WHERE id = ?", (target_user_id,))
    target_user = c.fetchone()
    conn.close()
    
    if not target_user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
        
    # If the admin is not already impersonating, save their admin_user_id
    if 'admin_user_id' not in session:
        session['admin_user_id'] = session['user_id']
        
    # Switch session
    session['user_id'] = target_user['id']
    session['role'] = target_user['role']
    
    return jsonify({'success': True, 'message': 'Impersonating user'})

# API for Admin to return to their admin account
@app.route('/api/admin/unimpersonate', methods=['POST'])
def admin_unimpersonate():
    if 'admin_user_id' in session:
        session['user_id'] = session['admin_user_id']
        session['role'] = 'admin'
        session.pop('admin_user_id', None)
        return jsonify({'success': True, 'message': 'Returned to admin'})
    # API for tutor to schedule a lesson for a student
@app.route('/api/tutor/schedule', methods=['POST'])
def tutor_schedule_lesson():
    if 'user_id' not in session or session.get('role') != 'tutor':
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    tutor_id = session['user_id']
    data = request.json or {}
    student_id = data.get("student_id")
    scheduled_time = data.get("scheduled_time") # format "YYYY-MM-DD HH:MM"
    duration_minutes = data.get("duration_minutes", 50) # 25 or 50 or 90
    
    if not student_id or not scheduled_time:
        return jsonify({"success": False, "message": "Missing student_id or scheduled_time"}), 400
        
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # Get student info
    c.execute("SELECT role, balance, email FROM users WHERE id = ?", (student_id,))
    student = c.fetchone()
    if not student or student['role'] != 'student':
        conn.close()
        return jsonify({"success": False, "message": "Student not found"}), 404
        
    # Get tutor info
    c.execute("SELECT price, name FROM users WHERE id = ? AND role = 'tutor'", (tutor_id,))
    tutor = c.fetchone()
    if not tutor:
        conn.close()
        return jsonify({"success": False, "message": "Tutor not found"}), 404
        
    required_lessons = 0.5 if duration_minutes == 25 else 1.0
    if student['balance'] < required_lessons:
        conn.close()
        return jsonify({"success": False, "message": f"Student has insufficient lesson balance ({student['balance']} lessons left)."}), 400
        
    # Check if slot is already booked for this tutor
    c.execute("SELECT id FROM lessons WHERE tutor_id = ? AND scheduled_time = ? AND status != 'cancelled'", 
              (tutor_id, scheduled_time))
    if c.fetchone():
        conn.close()
        return jsonify({"success": False, "message": "This slot is already booked."}), 400
        
    try:
        # Deduct student balance
        new_balance = student['balance'] - required_lessons
        c.execute("UPDATE users SET balance = ? WHERE id = ?", (new_balance, student_id))
        
        # Insert lesson
        import uuid
        room_id = f"room-{uuid.uuid4().hex[:8]}"
        price = tutor['price'] * (duration_minutes / 60.0)
        c.execute("""
            INSERT INTO lessons (tutor_id, student_id, scheduled_time, status, room_id, price, duration_hours) 
            VALUES (?, ?, ?, 'scheduled', ?, ?, ?)
        """, (tutor_id, student_id, scheduled_time, room_id, price, duration_minutes / 60.0))
        
        conn.commit()
        success = True
        message = "Lesson scheduled successfully!"
    except Exception as e:
        conn.rollback()
        success = False
        message = str(e)
        
    conn.close()
    return jsonify({"success": success, "message": message})

# API for students to submit payment (Credit Card, PayPal, Vodafone, Instapay, Binance, Bank Transfer)
@app.route('/api/payments/submit', methods=['POST'])
def submit_payment():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401

    student_id = session['user_id']
    method = request.form.get('method', '')
    amount_str = request.form.get('amount', '5.0')
    try:
        amount = float(amount_str)
    except ValueError:
        amount = 5.0
        
    paypal_email = request.form.get('paypal_email', '')
    paypal_txn = request.form.get('paypal_txn', '')
    bank_fullname = request.form.get('bank_fullname', '')
    bank_country = request.form.get('bank_country', '')
    bank_email = request.form.get('bank_email', '')
    bank_phone = request.form.get('bank_phone', '')
    sender_info = request.form.get('sender_info', '')
    
    status = 'pending'
    screenshot_filename = ''

    # Handle file upload for screenshot (Vodafone, Instapay, Binance)
    if 'screenshot' in request.files:
        file = request.files['screenshot']
        if file and file.filename != '':
            uploads_dir = os.path.join('assets', 'uploads', 'payments')
            if not os.path.exists(uploads_dir):
                os.makedirs(uploads_dir)
            import uuid
            ext = os.path.splitext(file.filename)[1]
            screenshot_filename = f"{uuid.uuid4().hex}{ext}"
            file.save(os.path.join(uploads_dir, screenshot_filename))

    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    try:
        # Direct Card/PayPal payments are auto-approved and add balance instantly
        if method == 'card' or method == 'paypal':
            status = 'approved'
            # Update user balance: convert $ amount to lesson credits (e.g. 1 lesson credit per $10 or $12, or just add cash value/credits directly)
            # Let's add the value to balance. Since balance is currently in REAL (lessons count), let's convert the payment to lesson units.
            # Assuming a standard lesson rate of $15/lesson (or we can just increase balance by (amount / 15.0) lessons, or simply amount in credits).
            # Looking at the user's balance table, let's see how much balance is. In student-dashboard it shows e.g. '4 hours left' or '4 lessons'.
            # Let's say: balance = balance + (amount / 15.0) lessons! (or we can just add 1 lesson per $15)
            # If the amount is $15, they get 1 lesson. If $30 they get 2 lessons.
            # Let's use 1 lesson per 15.0 USD (or equivalent). Let's calculate lessons_added:
            lessons_added = amount / 15.0
            c.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (lessons_added, student_id))
            
        c.execute("""
            INSERT INTO payments (
                student_id, method, amount, status, screenshot, 
                paypal_email, paypal_txn, bank_name, bank_country, 
                bank_email, bank_phone, bank_consultation_type, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        """, (
            student_id, method, amount, status, screenshot_filename,
            paypal_email or sender_info, paypal_txn, bank_fullname, bank_country,
            bank_email, bank_phone, '',
        ))
        conn.commit()
        success = True
        message = "Payment submitted successfully!"
    except Exception as e:
        conn.rollback()
        success = False
        message = str(e)
        
    conn.close()
    return jsonify({'success': success, 'message': message, 'status': status})

# API for Admin to list all payments
@app.route('/api/admin/payments', methods=['GET'])
def admin_payments():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT role FROM users WHERE id = ?", (session['user_id'],))
    role = c.fetchone()
    if not role or role[0] != 'admin':
        conn.close()
        return jsonify({'error': 'Forbidden'}), 403

    c.execute("""
        SELECT p.*, u.name as student_name, u.email as student_email 
        FROM payments p
        JOIN users u ON p.student_id = u.id
        ORDER BY p.created_at DESC
    """)
    columns = [col[0] for col in c.description]
    payments = []
    for row in c.fetchall():
        payments.append(dict(zip(columns, row)))
    conn.close()
    return jsonify({'payments': payments})

# API for Admin to approve payment
@app.route('/api/admin/payments/<int:payment_id>/approve', methods=['POST'])
def admin_approve_payment(payment_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT role FROM users WHERE id = ?", (session['user_id'],))
    role = c.fetchone()
    if not role or role[0] != 'admin':
        conn.close()
        return jsonify({'error': 'Forbidden'}), 403

    c.execute("SELECT student_id, amount, status FROM payments WHERE id = ?", (payment_id,))
    pay = c.fetchone()
    if not pay:
        conn.close()
        return jsonify({'error': 'Payment not found'}), 404
    
    student_id, amount, status = pay
    if status != 'pending':
        conn.close()
        return jsonify({'error': 'Payment already processed'}), 400

    try:
        # Approve payment and increase student lesson balance
        lessons_added = amount / 15.0
        c.execute("UPDATE payments SET status = 'approved' WHERE id = ?", (payment_id,))
        c.execute("UPDATE users SET balance = balance + ? WHERE id = ?", (lessons_added, student_id))
        conn.commit()
        success = True
    except Exception as e:
        conn.rollback()
        success = False
        
    conn.close()
    return jsonify({'success': success})

# API for Admin to reject payment
@app.route('/api/admin/payments/<int:payment_id>/reject', methods=['POST'])
def admin_reject_payment(payment_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT role FROM users WHERE id = ?", (session['user_id'],))
    role = c.fetchone()
    if not role or role[0] != 'admin':
        conn.close()
        return jsonify({'error': 'Forbidden'}), 403

    c.execute("SELECT status FROM payments WHERE id = ?", (payment_id,))
    pay = c.fetchone()
    if not pay:
        conn.close()
        return jsonify({'error': 'Payment not found'}), 404
    
    status = pay[0]
    if status != 'pending':
        conn.close()
        return jsonify({'error': 'Payment already processed'}), 400

    try:
        c.execute("UPDATE payments SET status = 'rejected' WHERE id = ?", (payment_id,))
        conn.commit()
        success = True
    except Exception as e:
        conn.rollback()
        success = False
        
    conn.close()
    return jsonify({'success': success})

# API for students to get their payment and booking history
@app.route('/api/student/payment-history', methods=['GET'])
def student_payment_history():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    student_id = session['user_id']
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    history = []
    
    # 1. Fetch payments (purchases)
    try:
        c.execute("""
            SELECT id, method, amount, status, created_at 
            FROM payments 
            WHERE student_id = ?
            ORDER BY created_at DESC
        """, (student_id,))
        payments_rows = c.fetchall()
        
        for row in payments_rows:
            pid, method, amount, status, created_at = row
            
            method_str = "بطاقة ائتمان" if method == 'card' else method.upper()
            if method == 'vodafone': method_str = "فودافون كاش"
            elif method == 'instapay': method_str = "إنستا باي"
            elif method == 'bank': method_str = "حوالة بنكية"
            
            desc = f"شراء باقة حصص ({method_str})"
            
            status_str = "Successful"
            if status == 'pending': status_str = "Pending"
            elif status == 'rejected': status_str = "Failed"
            
            history.append({
                'date': created_at,
                'description': desc,
                'amount': f"${amount:.2f}",
                'status': status_str,
                'raw_date': created_at
            })
    except Exception as e:
        print("Error fetching payments history:", e)
        
    # 2. Fetch booked lessons
    try:
        c.execute("""
            SELECT l.id, l.scheduled_time, l.status, l.price, l.duration_hours, u.name as tutor_name
            FROM lessons l
            JOIN users u ON l.tutor_id = u.id
            WHERE l.student_id = ?
            ORDER BY l.scheduled_time DESC
        """, (student_id,))
        lessons_rows = c.fetchall()
        
        for row in lessons_rows:
            lid, scheduled_time, status, price, duration, tutor_name = row
            
            is_trial = duration <= 0.5 or price <= 15.0
            desc = f"درس تجريبي مع {tutor_name}" if is_trial else f"حجز درس مع {tutor_name}"
            
            status_str = "Successful"
            if status == 'cancelled': status_str = "Cancelled"
            
            history.append({
                'date': scheduled_time,
                'description': desc,
                'amount': f"${price:.2f}",
                'status': status_str,
                'raw_date': scheduled_time
            })
    except Exception as e:
        print("Error fetching lessons history:", e)
        
    # Sort history by raw_date descending
    history.sort(key=lambda x: x['raw_date'], reverse=True)
    
    conn.close()
    return jsonify({'history': history})

# API for user to delete their account permanently
@app.route('/api/user/delete', methods=['POST'])
def delete_account():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Unauthorized'}), 401
    
    user_id = session['user_id']
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    try:
        # Delete user reviews, lessons, messages, payments, reports, and user record
        c.execute("DELETE FROM reviews WHERE student_id = ? OR tutor_id = ?", (user_id, user_id))
        c.execute("DELETE FROM lessons WHERE student_id = ? OR tutor_id = ?", (user_id, user_id))
        c.execute("DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?", (user_id, user_id))
        c.execute("DELETE FROM payments WHERE student_id = ?", (user_id,))
        c.execute("DELETE FROM reports WHERE user_id = ?", (user_id,))
        c.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        
        # Clear session
        session.clear()
        success = True
        message = "Account deleted successfully."
    except Exception as e:
        conn.rollback()
        success = False
        message = str(e)
        
    conn.close()
    return jsonify({'success': success, 'message': message})

if __name__ == '__main__':
    print("🚀 Starting Mr.H Academy Backend on http://0.0.0.0:5000")
    socketio.run(app, host='0.0.0.0', debug=True, port=5000, allow_unsafe_werkzeug=True)
