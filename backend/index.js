const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = 5000;
const SECRET_KEY = 'super-secret-mrh-academy-key';

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Database opening error: ', err);
});

// Middleware to check JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.post('/api/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = email === 'fekrah23451@gmail.com' ? 'admin' : 'student';

    db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`, [name, email, hashedPassword, role], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
            return res.status(500).json({ error: err.message });
        }
        const token = jwt.sign({ id: this.lastID, role }, SECRET_KEY);
        res.json({ success: true, message: 'تم إنشاء الحساب بنجاح', role, token });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }
        const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY);
        res.json({ success: true, message: 'تم تسجيل الدخول', role: user.role, token });
    });
});

app.get('/api/me', authenticateToken, (req, res) => {
    db.get(`SELECT id, name, email, role, balance, total_hours_taught, phone, timezone, price FROM users WHERE id = ?`, [req.user.id], (err, user) => {
        if (err || !user) return res.status(401).json({ logged_in: false });
        res.json({ logged_in: true, user });
    });
});

io.on('connection', (socket) => {
    console.log('User connected', socket.id);
    socket.on('join_room', (data) => {
        socket.join(data.room);
        io.to(data.room).emit('system_message', { msg: `${data.username} انضم للغرفة` });
    });
    socket.on('leave_room', (data) => {
        socket.leave(data.room);
        io.to(data.room).emit('system_message', { msg: `${data.username} غادر الغرفة` });
    });
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
