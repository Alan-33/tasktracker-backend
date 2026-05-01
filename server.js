require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// FIXED: Explicitly allow your Vercel frontend for production
app.use(cors({
    origin: 'https://tasktracker-frontend-eight.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json()); 

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false 
    }
});

// 1. LOGIN ROUTE
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Matches case-sensitive "Users" table and columns
        const result = await pool.query(
            'SELECT "UserId", "EmpName", "Email", "Role" FROM "Users" WHERE "Email" = $1 AND "Password" = $2', 
            [email, password]
        );
        if (result.rows.length > 0) {
            res.json({ success: true, user: result.rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. DASHBOARD SUMMARY
app.get('/api/dashboard', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                COUNT(*) AS "Total",
                COUNT(*) FILTER (WHERE "Status" = 'Pending') AS "Pending",
                COUNT(*) FILTER (WHERE "Status" = 'Completed') AS "Completed",
                COUNT(*) FILTER (WHERE "DueDate" < CURRENT_DATE AND "Status" != 'Completed') AS "Overdue"
            FROM "Tasks"
        `);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. CREATE PROJECT
app.post('/api/projects', async (req, res) => {
    const { projectName } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO "Projects" ("ProjectName") VALUES ($1) RETURNING *',
            [projectName]
        );
        res.json({ success: true, project: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. FETCH PROJECTS
app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM "Projects" ORDER BY "ProjectId" DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. FETCH USERS
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT "UserId", "EmpName" FROM "Users" WHERE "Role" = \'Member\'');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. FETCH TASKS
app.get('/api/tasks', async (req, res) => {
    const { userId, role } = req.query;
    try {
        let query = `
            SELECT t."TaskId", t."TaskName", t."Status", t."DueDate", u."EmpName" as "AssignedToName", p."ProjectName"
            FROM "Tasks" t
            LEFT JOIN "Users" u ON t."AssignedTo" = u."UserId"
            LEFT JOIN "Projects" p ON t."ProjectId" = p."ProjectId"
        `;
        let values = [];
        if (role === 'Member') {
            query += ' WHERE t."AssignedTo" = $1';
            values.push(userId);
        }
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. CREATE TASK
app.post('/api/tasks', async (req, res) => {
    const { taskName, assignedTo, projectId, dueDate } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO "Tasks" ("TaskName", "AssignedTo", "ProjectId", "DueDate", "Status") VALUES ($1, $2, $3, $4, \'Pending\') RETURNING *',
            [taskName, assignedTo, projectId, dueDate]
        );
        res.json({ success: true, task: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. UPDATE TASK STATUS
app.put('/api/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await pool.query('UPDATE "Tasks" SET "Status" = $1 WHERE "TaskId" = $2', [status, id]);
        res.json({ success: true, message: 'Task updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});