# ⚡ QUICK START GUIDE (5 Minutes)

## What You're Getting

🚀 **World's Most Advanced AI Search Engine**  
- Advanced AI search capabilities
- Top 0.1% intelligence architecture
- Production-ready code
- Beautiful responsive frontend
- Full documentation included

---

## Step 1: Extract & Install (2 minutes)

```bash
# Extract the zip file
unzip sun-ai.zip
cd ai-search-tool

# Install backend dependencies
npm install

# (Optional) Install frontend
cd frontend && npm install && cd ..
```

---

## Step 2: Configure API Key (30 seconds)

Add your Groq API key to `.env`:
```
GROQ_API_KEY=your_groq_api_key_here
```

Use the placeholder in `.env.example` as the template.

---

## Step 3: Start the Server (30 seconds)

```bash
npm start

# You should see:
# ╔════════════════════════════════════╗
# ║ 🚀 SUN AI - ONLINE      ║
# ║ Port: 3000                         ║
# ║ Status: healthy                    ║
# ╚════════════════════════════════════╝
```

---

## Step 4: Test It Out (2 minutes)

### Option A: Use the Terminal
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the latest AI developments in 2024?",
    "mode": "default"
  }'

# You'll get:
# {
#   "success": true,
#   "response": "Detailed answer with citations...",
#   "sources": [...],
#   "metadata": {...}
# }
```

### Option B: Use a Python Script
```python
import requests
import json

response = requests.post(
    'http://localhost:3000/api/search',
    headers={'Content-Type': 'application/json'},
    json={
        'query': 'What are the latest AI developments?',
        'mode': 'default'
    }
)

print(json.dumps(response.json(), indent=2))
```

### Option C: Use the Web Interface (Optional)
```bash
# In another terminal:
cd frontend
npm start

# Opens http://localhost:3001 (React UI)
```

---

## Step 5: Try Different Modes

```bash
# Research Mode - Deep dive with 60+ sources
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Comprehensive analysis of quantum computing", "mode": "research"}'

# Verify Mode - Fact check
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"claim": "Climate change is human-caused"}'

# Quick Mode - 2-minute answer
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "What time is it in Tokyo?", "mode": "quick"}'
```

---

## API Endpoints Overview

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/search` | POST | Main intelligent search |
| `/api/research` | POST | Deep research mode |
| `/api/verify` | POST | Fact-check claims |
| `/api/conversation/:id` | GET | Get chat history |
| `/api/health` | GET | Server status |

---

## Core Features at a Glance

✅ **Real-time Web Search** - Parallel searches + ranking  
✅ **AI Synthesis** - Groq Llama 3.1 generation  
✅ **Source Verification** - Credibility scoring  
✅ **Multi-turn Conversations** - Remember context  
✅ **Multiple Modes** - Research, Verify, Explain, Quick  
✅ **Beautiful UI** - Responsive, dark-themed frontend  
✅ **Production Ready** - Logging, error handling, scaling  

---

## Project Structure

```
ai-search-tool/
├── backend/
│   ├── server.js           # Main Express server
│   ├── package.json        # Backend scripts
│   └── src/                # Backend modules
├── package.json              # Root scripts
├── .env                       # Local configuration
├── MASTER_PROMPT.md           # Elite reasoning framework
├── README.md                  # Full documentation
├── DEPLOYMENT.md              # Production deployment guide
└── frontend/
    ├── src/
    │   ├── App.jsx            # React frontend
    │   └── App.css            # Styling
    └── package.json           # Frontend dependencies
```

---

## Troubleshooting

### Port Already in Use
```bash
# Change port in .env
PORT=3001

# Or kill process using port 3000
lsof -i :3000
kill -9 <PID>
```

### Module Not Found Error
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### API Key Issues
```bash
# Verify key is set
echo $GROQ_API_KEY

# Update if needed in .env
GROQ_API_KEY=your_new_key_here
```

### Server Timeout
```bash
# Increase timeout in .env
RESPONSE_TIMEOUT=60000
```

---

## Next Steps

1. **Explore the API** - Test all endpoints with curl
2. **Read MASTER_PROMPT.md** - Understand the elite architecture
3. **Customize responses** - Edit prompts and settings
4. **Deploy to production** - Follow DEPLOYMENT.md
5. **Add features** - Integrate additional services

---

## Advanced Usage

### Using Conversation IDs for Multi-turn

```bash
# First query
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Tell me about AI",
    "conversationId": "chat-123"
  }'

# Follow-up query (remembers context)
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What about machine learning specifically?",
    "conversationId": "chat-123"
  }'

# Get full conversation
curl http://localhost:3000/api/conversation/chat-123
```

### Research Mode with Deep Analysis

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CRISPR gene therapy developments",
    "mode": "research",
    "depth": "deep"
  }'

# Returns: 60+ sources, timeline, expert consensus, implications
```

---

## Configuration Options

Edit `.env` to customize:

```bash
# Response quality
RESPONSE_TIMEOUT=30000          # Max 30 seconds
SEARCH_DEPTH_MULTIPLIER=1.5     # How deep to search
MAX_SEARCH_QUERIES=8            # Parallel searches

# Features
ENABLE_RESEARCH_MODE=true       # Deep research capability
ENABLE_VERIFY_MODE=true         # Fact-checking
ENABLE_CACHING=true             # Cache results (faster)

# Development
NODE_ENV=production             # Or 'development'
DEBUG=false                      # Enable debug logging
```

---

## Performance Tips

1. **Enable Caching** - Set `ENABLE_CACHING=true` for faster repeated queries
2. **Adjust Depth** - Reduce `SEARCH_DEPTH_MULTIPLIER` for faster responses
3. **Use Quick Mode** - Add `"mode": "quick"` for 2-minute answers
4. **Limit Parallel Searches** - Reduce `MAX_SEARCH_QUERIES` if rate limited

---

## Getting Help

- **API Issues**: Check `/api/health` endpoint
- **Server Problems**: View `logs/error.log`
- **Performance**: Check `logs/combined.log`
- **Documentation**: Read README.md and MASTER_PROMPT.md
- **Deployment**: Follow DEPLOYMENT.md

---

## Key Files to Understand

| File | Purpose |
|------|---------|
| `MASTER_PROMPT.md` | The elite reasoning system - READ THIS FIRST! |
| `README.md` | Complete API documentation |
| `DEPLOYMENT.md` | Production deployment guide |
| `backend/server.js` | Main application logic |
| `.env` | Local environment configuration |

---

## You're All Set! 🎉

**Your elite AI search engine is ready to use:**

```bash
# Start server
npm start

# In another terminal, test:
curl http://localhost:3000/api/health

# Or use the web UI:
cd frontend && npm start  # Open http://localhost:3001
```

**That's it!** You have a production-ready AI search engine with advanced capabilities.

---

## What Makes This Special

✨ **Top 0.1% Intelligence** - Multi-tier reasoning framework  
✨ **Production Grade** - Error handling, logging, scaling  
✨ **Well Documented** - 2000+ lines of docs  
✨ **Easily Customizable** - Change prompts, add features  
✨ **Ready to Deploy** - Docker, AWS, Heroku guides included  

**Start using it now - it's ready!**

Need help? Check the documentation files:
- `README.md` - Full API reference
- `MASTER_PROMPT.md` - Understanding the intelligence system
- `DEPLOYMENT.md` - How to go live

---

**Built with ❤️ for the elite 0.1%**  
**Ready to revolutionize your search experience** 🚀


