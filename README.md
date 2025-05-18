# Lendify Pre-Launch Page

A pre-launch landing page for Lendify, a cryptocurrency platform founded by Emmanuel Obaze.

## Features

- Information about Lendify and its unique approach to cryptocurrency
- Email subscription for waitlist
- Interactive sentiment tracking (agree/disagree)
- Responsive design for all devices

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- PostgreSQL database

### Local Development

1. Clone the repository
   ```bash
   git clone <repository-url>
   cd lendify-prelaunch
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=1991
   DB_NAME=prelunch_db
   PORT=3000
   ```

4. Start the server
   ```bash
   npm start
   ```

5. Visit `http://localhost:3000` in your browser

### Deployment on Render

#### Option 1: Manual Deployment

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the build command to `npm install`
4. Set the start command to `node server.js`
5. Add environment variables:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: (Connect to a Render PostgreSQL database)

6. Create a PostgreSQL database on Render
7. Link the database to your web service

#### Option 2: Using render.yaml (Blueprint)

1. Push the `render.yaml` file to your repository
2. Go to the Render Dashboard and select "Blueprint" when creating a new service
3. Connect to your repository
4. Render will automatically set up both the web service and database

## Database Schema

The application uses two tables:

1. `subscribers` - Stores email addresses of users who join the waitlist
2. `sentiment` - Tracks user sentiment (agree/disagree) about the Lendify concept
