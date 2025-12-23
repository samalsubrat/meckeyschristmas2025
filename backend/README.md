# Meckeys Christmas Sale - Backend Setup

## Project Structure

```
backend/
├── server.js      # Express API server
├── db.js          # NeonDB connection & initialization
├── package.json   # Dependencies
├── .env.example   # Environment variables template
└── .env           # Your actual environment variables (create this)
```

## Setup Instructions

### 1. Create NeonDB Database

1. Go to [https://neon.tech](https://neon.tech) and create an account
2. Create a new project
3. Copy the connection string (looks like `postgresql://username:password@ep-xxxxx.region.aws.neon.tech/dbname?sslmode=require`)

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your values:
   ```
   DATABASE_URL=postgresql://your-connection-string
   PORT=3000
   FRONTEND_URL=https://your-wordpress-site.com
   ```

### 3. Install Dependencies

```bash
cd backend
npm install
```

### 4. Run Locally (for testing)

```bash
npm run dev
```

The server will start at `http://localhost:3000`

### 5. Deploy to Railway

1. Go to [https://railway.app](https://railway.app) and create an account
2. Create a new project → Deploy from GitHub repo (or upload manually)
3. Add environment variables in Railway dashboard:
   - `DATABASE_URL` - Your NeonDB connection string
   - `FRONTEND_URL` - Your WordPress site URL (for CORS)
4. Railway will automatically detect Node.js and deploy

### 6. Update Frontend URLs

After deploying to Railway, you'll get a URL like `https://your-app.railway.app`

Update the `API_URL` in both frontend files:

**index.html** (line ~138):
```javascript
const API_URL = 'https://your-app.railway.app/api';
```

**customize.html** (line ~80):
```javascript
const API_URL = 'https://your-app.railway.app/api';
```

### 7. Upload HTML Files to WordPress

Upload these files to your WordPress server:
- `index.html`
- `customize.html`
- `leave.svg` (if you have it)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/page-data` | Get all page data (hero + sections) |
| GET | `/api/hero` | Get hero data |
| PUT | `/api/hero` | Update hero data |
| GET | `/api/sections` | Get all sections |
| POST | `/api/sections` | Create new section |
| DELETE | `/api/sections/:id` | Delete section |
| PUT | `/api/spotlight/:sectionId` | Update spotlight |
| PUT | `/api/grid/:sectionId` | Update grid |
| POST | `/api/grid/:sectionId/products` | Add product |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| POST | `/api/save-all` | Save complete page data |

## Troubleshooting

### CORS Errors
Make sure `FRONTEND_URL` in `.env` matches your WordPress domain exactly.

### Database Connection Issues
- Verify NeonDB connection string is correct
- Ensure `?sslmode=require` is at the end of the URL

### Railway Deployment Issues
- Check Railway logs for errors
- Ensure all environment variables are set
- Verify the build command is `npm install` and start command is `npm start`
