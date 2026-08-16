# MeloRank Backend

Backend API for MeloRank application, built with Express.js and Supabase.

## Features

- User authentication (register, login)
- JWT token-based authorization
- User data storage API
- Supabase database integration

## Prerequisites

- Node.js 16+ installed
- A Supabase account and project

## Setup

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy the `.env` file and update the values:
   ```bash
   cp .env .env.local
   ```
   - Edit `.env.local` and fill in your Supabase credentials:
     - `SUPABASE_URL` - Your Supabase project URL
     - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
     - `JWT_SECRET` - A secret key for JWT token generation

4. **Set up Supabase tables**
   - Create a `users` table with the following columns:
     - `id` (UUID, primary key, default: `gen_random_uuid()`)
     - `username` (VARCHAR, not null)
     - `email` (VARCHAR, not null, unique)
     - `password` (VARCHAR, not null)
     - `created_at` (TIMESTAMPTZ, default: `now()`)
     - `updated_at` (TIMESTAMPTZ, default: `now()`)

   - Create a `user_data` table with the following columns:
     - `id` (UUID, primary key, default: `gen_random_uuid()`)
     - `user_id` (UUID, foreign key to `users.id`)
     - `type` (VARCHAR, not null)
     - `data` (JSONB, not null)
     - `created_at` (TIMESTAMPTZ, default: `now()`)
     - `updated_at` (TIMESTAMPTZ, default: `now()`)

## Running the Server

### Development mode
```bash
npm run dev
```
This will start the server with nodemon, which automatically restarts on file changes.

### Production mode
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/auth/me` - Get current user info (protected)

### Data Storage
- `POST /api/data` - Save or update user data (protected)
- `GET /api/data/:type` - Get user data by type (protected)
- `GET /api/data` - Get all user data (protected)
- `DELETE /api/data/:type` - Delete user data by type (protected)

## Example Requests

### Register a user
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com", "password": "password123"}'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

### Save user data
```bash
curl -X POST http://localhost:5000/api/data \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"type": "ranking", "data": {"topSongs": ["Song 1", "Song 2"]}}'
```

## License

MIT