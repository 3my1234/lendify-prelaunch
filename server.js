require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bodyParser = require('body-parser');
// const nodemailer = require('nodemailer'); // Uncomment if you want to use nodemailer in the future

const app = express();
const PORT = process.env.PORT || 3000;

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Database connection configuration
let dbConfig = {};

// Check if we're in production (Render)
if (process.env.DATABASE_URL) {
    // Use the DATABASE_URL provided by Render
    dbConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Required for Render PostgreSQL
        }
    };
} else {
    // Local development configuration
    dbConfig = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    };
}

// Create the database pool
const pool = new Pool(dbConfig);

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create subscribers table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subscribers (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS email_campaigns (
                id SERIAL PRIMARY KEY,
                subject VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                sent_count INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create sentiment table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sentiment (
                id SERIAL PRIMARY KEY,
                type VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// Removed nodemailer transporter block since it's not used

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/sentiment', async (req, res) => {
    try {
        const agreeResult = await pool.query('SELECT COUNT(*) FROM sentiment WHERE type = $1', ['agree']);
        const disagreeResult = await pool.query('SELECT COUNT(*) FROM sentiment WHERE type = $1', ['disagree']);
        
        const agreeCount = parseInt(agreeResult.rows[0].count);
        const disagreeCount = parseInt(disagreeResult.rows[0].count);
        
        res.json({
            agree: agreeCount,
            disagree: disagreeCount
        });
    } catch (error) {
        console.error('Error fetching sentiment data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/sentiment', async (req, res) => {
    const { type } = req.body;
    
    if (type !== 'agree' && type !== 'disagree') {
        return res.status(400).json({ error: 'Invalid sentiment type' });
    }
    
    try {
        await pool.query('INSERT INTO sentiment (type) VALUES ($1)', [type]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error recording sentiment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/subscribe', async (req, res) => {
    const { email } = req.body;
    
    if (!email || !isValidEmail(email)) {
        return res.status(400).json({ 
            success: false,
            message: 'Please provide a valid email address' 
        });
    }
    
    try {
        await pool.query('INSERT INTO subscribers (email) VALUES ($1)', [email]);
        res.json({ success: true });
    } catch (error) {
        // Check for duplicate email
        if (error.code === '23505') { // PostgreSQL unique violation error code
            return res.json({ 
                success: false,
                message: 'You are already on our waitlist!' 
            });
        }
        
        console.error('Error adding subscriber:', error);
        res.status(500).json({ 
            success: false,
            message: 'Something went wrong. Please try again.' 
        });
    }
});

// Serve the main HTML file for all routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper function to validate email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Start the server
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeDatabase();
});

// Admin API endpoints
app.post('/api/admin/reset-sentiment', async (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (password !== adminPassword) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        await pool.query('TRUNCATE TABLE sentiment');
        res.json({ success: true });
    } catch (error) {
        console.error('Error resetting sentiment data:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/api/admin/subscriber-count', async (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (password !== adminPassword) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const result = await pool.query('SELECT COUNT(*) FROM subscribers');
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Error getting subscriber count:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/api/admin/subscribers', async (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (password !== adminPassword) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const result = await pool.query('SELECT email, created_at FROM subscribers ORDER BY created_at DESC');
        res.json({ subscribers: result.rows });
    } catch (error) {
        console.error('Error getting subscribers:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

app.post('/api/admin/send-email', async (req, res) => {
    const { password, subject, content } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (password !== adminPassword) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    if (!subject || !content) {
        return res.status(400).json({ success: false, message: 'Subject and content are required' });
    }
    
    try {
        // Get all subscriber emails
        const result = await pool.query('SELECT email FROM subscribers');
        const subscribers = result.rows;
        
        if (subscribers.length === 0) {
            return res.json({ success: false, message: 'No subscribers to email' });
        }
        
        // Send emails in batches to avoid rate limits
        const batchSize = 1000; // SendGrid allows up to 1000 recipients per request
        let successCount = 0;
        let errorCount = 0;
        
        // Extract all email addresses
        const allEmails = subscribers.map(sub => sub.email);
        
        // Process in batches
        for (let i = 0; i < allEmails.length; i += batchSize) {
            const batch = allEmails.slice(i, i + batchSize);
            
            try {
                // Send email using SendGrid
                const msg = {
                    to: batch,
                    from: process.env.EMAIL_FROM,
                    subject: subject,
                    html: content,
                };
                
                await sgMail.send(msg);
                successCount += batch.length;
                
                // Add a small delay between batches to avoid rate limits
                if (i + batchSize < allEmails.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.error('Error sending batch:', error);
                errorCount += batch.length;
            }
        }
        
        // Log the results
        console.log(`Email sending complete. Success: ${successCount}, Errors: ${errorCount}`);
        
        // Record the email campaign in the database
        await pool.query(
            'INSERT INTO email_campaigns (subject, content, sent_count) VALUES ($1, $2, $3)',
            [subject, content, successCount]
        ).catch(err => console.error('Error recording email campaign:', err));
        
        // Return success
        res.json({ 
            success: true, 
            message: `Emails sent successfully to ${successCount} subscribers${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
            count: successCount
        });
    } catch (error) {
        console.error('Error sending emails:', error);
        res.status(500).json({ success: false, message: 'Error sending emails. Check server logs.' });
    }
});

app.post('/api/admin/campaigns', async (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (password !== adminPassword) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    try {
        const result = await pool.query(
            'SELECT id, subject, sent_count, created_at FROM email_campaigns ORDER BY created_at DESC'
        );
        res.json({ campaigns: result.rows });
    } catch (error) {
        console.error('Error getting campaigns:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});