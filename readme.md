# Authentication Boilerplate

A complete, production-ready authentication system built with Node.js, Express, JWT, and PostgreSQL. This boilerplate provides secure user authentication with access/refresh tokens, password hashing, and multi-session support.

## Features

- ✅ **User Registration & Login** - Secure signup and login with validation
- ✅ **JWT Authentication** - Access tokens (15min) + Refresh tokens (7 days)
- ✅ **Password Security** - Bcrypt hashing with salt rounds
- ✅ **Multi-Session Support** - Users can be logged in on multiple devices
- ✅ **Protected Routes** - Middleware for authentication-required endpoints
- ✅ **Token Refresh** - Seamless token renewal without re-login
- ✅ **Secure Logout** - Proper session invalidation
- ✅ **Multi-Tenancy Ready** - Organization/workspace structure prepared
- ✅ **Input Validation** - Comprehensive request validation
- ✅ **Error Handling** - Proper HTTP status codes and error messages

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** PostgreSQL (Supabase)
- **Authentication:** JWT (jsonwebtoken)
- **Password Hashing:** bcrypt
- **Environment:** dotenv
- **CORS:** Enabled for cross-origin requests

## Installation

1. **Clone the repository:**
```bash
   git clone https://github.com/YOUR-USERNAME/auth-boilerplate.git
   cd auth-boilerplate
```

2. **Install dependencies:**
```bash
   npm install
```

3. **Set up environment variables:**
   
   Create a `.env` file in the root directory:
```
   DATABASE_URL=your-postgresql-connection-string
   PORT=3000
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_REFRESH_SECRET=your-super-secret-refresh-key-different-from-above
   JWT_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
```

   **Generate secure secrets:**
```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

4. **Set up the database:**
   
   Run these SQL commands in your PostgreSQL database:
```sql
   -- Users table
   CREATE TABLE users (
       id SERIAL PRIMARY KEY,
       email VARCHAR(255) UNIQUE NOT NULL,
       password_hash TEXT NOT NULL,
       name VARCHAR(100),
       email_verified BOOLEAN DEFAULT false,
       verification_token TEXT,
       reset_token TEXT,
       reset_token_expires TIMESTAMP,
       created_at TIMESTAMP DEFAULT NOW(),
       updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Refresh tokens table
   CREATE TABLE refresh_tokens (
       id SERIAL PRIMARY KEY,
       user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
       token TEXT UNIQUE NOT NULL,
       expires_at TIMESTAMP NOT NULL,
       created_at TIMESTAMP DEFAULT NOW()
   );

   CREATE INDEX idx_refresh_token ON refresh_tokens(token);

   -- Organizations table (for multi-tenancy)
   CREATE TABLE organizations (
       id SERIAL PRIMARY KEY,
       name VARCHAR(255) NOT NULL,
       owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
       created_at TIMESTAMP DEFAULT NOW()
   );

   -- Organization members table
   CREATE TABLE organization_members (
       organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
       user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
       role VARCHAR(50) DEFAULT 'member',
       joined_at TIMESTAMP DEFAULT NOW(),
       PRIMARY KEY (organization_id, user_id)
   );
```

5. **Start the server:**
```bash
   npm start
   # or for development with auto-restart:
   npm run dev
```

   Server will run on `http://localhost:3000`

## API Endpoints

### Authentication Routes

#### 1. User Registration
**POST** `/api/auth/signup`

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"John Doe"}' | python -m json.tool
```

---

#### 2. User Login
**POST** `/api/auth/login`

Authenticate user and return tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** Same as signup

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' | python -m json.tool
```

---

#### 3. Refresh Token
**POST** `/api/auth/refresh`

Get new access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}' | python -m json.tool
```

---

#### 4. Logout
**POST** `/api/auth/logout`

Invalidate refresh token and log out user.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}' | python -m json.tool
```

---

### Protected Routes

#### Get User Profile
**GET** `/api/profile`

Get current user's profile information. Requires valid access token.

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2024-02-09T10:30:00.000Z"
  }
}
```

**cURL Example:**
```bash
curl http://localhost:3000/api/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" | python -m json.tool
```

---

## Authentication Flow

### 1. Registration/Login Flow
```
1. User signs up/logs in
2. Server validates credentials
3. Server generates access token (15min) + refresh token (7 days)
4. Server stores refresh token in database
5. Client receives both tokens
6. Client stores tokens (localStorage/secure cookies)
```

### 2. API Request Flow
```
1. Client sends request with access token in Authorization header
2. Server validates access token using middleware
3. If valid: request proceeds, if invalid: return 403
4. Server processes request and returns response
```

### 3. Token Refresh Flow
```
1. Access token expires (15 minutes)
2. Client gets 403 error on next API request
3. Client sends refresh token to /api/auth/refresh
4. Server validates refresh token and checks database
5. If valid: generate new access + refresh tokens
6. Client updates stored tokens and retries original request
```

### 4. Logout Flow
```
1. Client sends refresh token to /api/auth/logout
2. Server removes refresh token from database
3. Client clears stored tokens
4. User is logged out
```

---

## Security Features

### Password Security
- **Bcrypt hashing** with 10 salt rounds
- **Minimum 6 characters** password requirement
- **No plain text storage** - only hashed passwords in database

### JWT Security
- **Short-lived access tokens** (15 minutes) - limits exposure window
- **Separate refresh secret** - different key for refresh tokens
- **Token expiration** - all tokens have expiry times
- **Database validation** - refresh tokens verified against database

### Multi-Session Management
- **Multiple device support** - users can be logged in on multiple devices
- **Per-session tokens** - each login gets unique refresh token
- **Selective logout** - can invalidate specific sessions

### Input Validation
- **Email format validation**
- **Password strength requirements**
- **Required field validation**
- **SQL injection prevention** with parameterized queries

---

## Database Schema

### users
```sql
id (SERIAL PRIMARY KEY)
email (VARCHAR UNIQUE NOT NULL)
password_hash (TEXT NOT NULL)
name (VARCHAR)
email_verified (BOOLEAN DEFAULT false)
verification_token (TEXT)
reset_token (TEXT)
reset_token_expires (TIMESTAMP)
created_at (TIMESTAMP DEFAULT NOW())
updated_at (TIMESTAMP DEFAULT NOW())
```

### refresh_tokens
```sql
id (SERIAL PRIMARY KEY)
user_id (INTEGER → users.id)
token (TEXT UNIQUE NOT NULL)
expires_at (TIMESTAMP NOT NULL)
created_at (TIMESTAMP DEFAULT NOW())
```

### organizations (Multi-tenancy ready)
```sql
id (SERIAL PRIMARY KEY)
name (VARCHAR NOT NULL)
owner_id (INTEGER → users.id)
created_at (TIMESTAMP DEFAULT NOW())
```

### organization_members
```sql
organization_id (INTEGER → organizations.id)
user_id (INTEGER → users.id)
role (VARCHAR DEFAULT 'member')
joined_at (TIMESTAMP DEFAULT NOW())
PRIMARY KEY (organization_id, user_id)
```

---

## Project Structure
```
auth-boilerplate/
├── server.js              # Main application entry point
├── routes/
│   └── auth.js            # Authentication routes
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── utils/
│   └── jwt.js             # JWT token utilities
├── db.js                  # Database connection
├── .env                   # Environment variables (not committed)
├── .gitignore             # Git ignore rules
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

---

## Middleware Usage

### Protecting Routes
```javascript
const { authenticateToken } = require('./middleware/auth');

// Protect any route by adding the middleware
app.get('/api/protected-route', authenticateToken, (req, res) => {
    // req.userId is available here
    res.json({ message: 'This is protected!', userId: req.userId });
});
```

### Using in Your Own Projects

1. Copy `middleware/auth.js` and `utils/jwt.js` to your project
2. Set up the database tables
3. Add JWT secrets to your `.env`
4. Import and use the middleware on routes that need protection

---

## Development Tips

### Pretty Print JSON Responses
```bash
# Use Python's json.tool for readable output
curl http://localhost:3000/api/profile \
  -H "Authorization: Bearer TOKEN" | python -m json.tool
```

### Auto-Restart During Development
```bash
npm run dev  # Uses nodemon for auto-restart on file changes
```

### Generate Secure Secrets
```bash
# Generate random secrets for JWT
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Error Codes Reference

| Status Code | Meaning | Common Causes |
|-------------|---------|---------------|
| 200 | OK | Successful request |
| 201 | Created | User successfully registered |
| 400 | Bad Request | Missing fields, invalid input |
| 401 | Unauthorized | Missing access token |
| 403 | Forbidden | Invalid/expired token |
| 404 | Not Found | User/resource not found |
| 500 | Internal Server Error | Database/server error |

---

## Common Usage Patterns

### Frontend Integration
```javascript
// Store tokens after login
localStorage.setItem('accessToken', response.accessToken);
localStorage.setItem('refreshToken', response.refreshToken);

// Add to all API requests
const accessToken = localStorage.getItem('accessToken');
fetch('/api/protected-endpoint', {
    headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    }
});

// Handle token refresh on 403 errors
if (response.status === 403) {
    const refreshToken = localStorage.getItem('refreshToken');
    const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
    });
    // Update tokens and retry request
}
```

---

## Extending This Boilerplate

### For Your SaaS Projects

1. **Add Organization Context:**
```javascript
   // Add to your protected routes
   app.get('/api/data', authenticateToken, async (req, res) => {
       const orgId = req.headers['x-organization-id'];
       // Filter data by organization
   });
```

2. **Add Role-Based Access:**
```javascript
   function requireRole(role) {
       return async (req, res, next) => {
           // Check user's role in organization
           const userRole = await getUserRole(req.userId, orgId);
           if (userRole !== role) return res.status(403).json({error: 'Insufficient permissions'});
           next();
       };
   }
```

3. **Add Email Verification:**
   - Generate verification tokens
   - Send verification emails
   - Verify email endpoint

4. **Add Password Reset:**
   - Generate reset tokens with expiry
   - Send reset emails
   - Reset password endpoint

---

## Security Considerations

### Production Checklist

- [ ] Use strong JWT secrets (64+ characters)
- [ ] Enable HTTPS in production
- [ ] Set secure cookie flags if using cookies
- [ ] Implement rate limiting for auth endpoints
- [ ] Add CORS configuration for your domain
- [ ] Use environment variables for all secrets
- [ ] Regular security audits with `npm audit`
- [ ] Consider implementing 2FA for high-security use cases

### Environment Variables Security
```bash
# Never commit these to version control
DATABASE_URL=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# Use different values for development/staging/production
```

---

## Future Enhancements

Potential features to add based on your needs:

- [ ] **Email Verification** - Verify user emails on signup
- [ ] **Password Reset** - Allow users to reset forgotten passwords  
- [ ] **Two-Factor Authentication** - SMS/TOTP 2FA support
- [ ] **Social Login** - OAuth integration (Google, GitHub, etc.)
- [ ] **Rate Limiting** - Prevent brute force attacks
- [ ] **Account Lockout** - Lock accounts after failed login attempts
- [ ] **Audit Logging** - Track authentication events
- [ ] **Session Management** - View and revoke active sessions
- [ ] **Role-Based Access Control** - Granular permissions
- [ ] **API Key Management** - Generate API keys for programmatic access

---

## Troubleshooting

### Common Issues

**"Invalid or expired token" errors:**
- Check if access token has expired (15 min lifetime)
- Verify JWT_SECRET matches between token generation and validation
- Ensure Authorization header format: `Bearer TOKEN`

**"Database connection error":**
- Verify DATABASE_URL in .env is correct
- Check database server is running
- Ensure database tables are created

**"Refresh token expired or invalid":**
- Refresh tokens expire after 7 days
- Check if refresh token exists in database
- Verify JWT_REFRESH_SECRET is correct

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is open source and available under the MIT License.

---

## Author

Built as part of a 30-day web development learning journey.

**Project Timeline:** Day 19-20 of 30-day learning path

**Related Projects:**
- Days 15-16: Blog API, URL Shortener  
- Days 17-18: Todo API with Sharing
- Days 21-30: AI-powered SaaS applications

---

**⭐ Star this repo if it helped you build secure authentication!**