# Telenovela Agent v2

AI-powered telenovela script generation with state machine-based microservices architecture.

## Architecture

This version implements an **object-centric** architecture where each entity (ideas, characters, locations, episodes, images, videos) has its own state machine. This allows for:

- Querying objects by state (e.g., "show all images pending approval")
- Independent state transitions with proper guards
- Microsite-style UI where each page shows objects filtered by their state

## 12-Step Workflow

| Step | Name | Type | Description |
|------|------|------|-------------|
| 1 | Generate Ideas | AI | Generate 3 telenovela concepts |
| 2 | Select Idea | Human | Choose one idea to develop |
| 3 | Generate Structure | AI | Create characters, locations, episode arc |
| 4 | Approve Structure | Human | Review and approve/modify structure |
| 5 | Generate Scripts | AI | Generate full episode scripts with dialogue |
| 6 | Generate Image Prompts | AI | Create prompts for scene images |
| 7 | Generate References | AI | Create character/location reference images |
| 8 | Generate Images | AI | Generate scene images (Gemini 3 Pro) |
| 9 | Generate Thumbnails | AI | Create episode thumbnail prompts |
| 10 | Review Images | Human | Approve/reject generated images |
| 11 | Generate Video Prompts | AI | Create prompts for video clips |
| 12 | Generate Videos | AI | Generate video clips (Veo 2) |

## Database Schema (14 Tables)

- **projects** - Main project container
- **ideas** - Generated telenovela concepts
- **characters** - Character definitions
- **locations** - Location definitions  
- **episode_summaries** - High-level episode outlines
- **episodes** - Full episode containers
- **scenes** - Individual scenes within episodes
- **dialogue_lines** - Dialogue for each scene
- **image_prompts** - Prompts for scene images
- **character_refs** - Character reference images
- **location_refs** - Location reference images
- **generated_images** - AI-generated scene images
- **thumbnails** - Episode thumbnail images
- **video_prompts** - Prompts for video generation
- **generated_videos** - AI-generated video clips

## State Machines

Each object type has its own state machine:

- **Ideas**: draft → approved/rejected
- **Structure** (characters, locations, summaries): draft → modified → approved
- **Episodes**: pending → generating → generated → approved
- **Image/Video Prompts**: pending → generated → approved
- **Media** (images, videos, thumbnails, refs): pending → generating → generated → approved/rejected

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- Gemini API key

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Set API key
export GEMINI_API_KEY="your-api-key"

# Run server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

## API Endpoints

### Projects
- `POST /projects` - Create project
- `GET /projects` - List all projects
- `GET /projects/{id}` - Get project details
- `DELETE /projects/{id}` - Delete project
- `GET /projects/{id}/progress` - Get step progress
- `POST /projects/{id}/advance-step` - Move to next step

### Ideas (Steps 1-2)
- `GET /projects/{id}/ideas` - List ideas
- `POST /projects/{id}/ideas/generate` - Generate ideas
- `POST /ideas/{id}/approve` - Select an idea
- `POST /ideas/{id}/reject` - Reject an idea

### Structure (Steps 3-4)
- `POST /projects/{id}/structure/generate` - Generate all structure
- `GET /projects/{id}/characters` - List characters
- `PUT /characters/{id}` - Update character
- `POST /characters/{id}/approve` - Approve character
- (Similar for locations and episode-summaries)
- `POST /projects/{id}/structure/approve-all` - Approve all

### Episodes (Step 5)
- `GET /projects/{id}/episodes` - List episodes
- `POST /projects/{id}/episodes/generate` - Generate batch
- `GET /episodes/{id}` - Get full episode with scenes/dialogue

### Images (Steps 6-10)
- `POST /projects/{id}/image-prompts/generate` - Generate prompts
- `POST /projects/{id}/references/generate` - Generate ref prompts
- `POST /projects/{id}/images/generate` - Generate images
- `POST /projects/{id}/thumbnails/generate` - Generate thumbnails
- `GET /projects/{id}/images/review` - Get images for review
- `POST /generated-images/{id}/approve` - Approve image
- `POST /generated-images/{id}/reject` - Reject image
- `POST /generated-images/{id}/regenerate` - Queue regeneration

### Videos (Steps 11-12)
- `POST /projects/{id}/video-prompts/generate` - Generate prompts
- `POST /projects/{id}/videos/generate` - Generate videos

### Export
- `GET /projects/{id}/export` - Full project JSON
- `GET /projects/{id}/export/scripts` - Scripts only
- `GET /projects/{id}/export/prompts` - All prompts

## Tech Stack

### Backend
- **FastAPI** - API framework
- **SQLAlchemy** - ORM with state machine support
- **Pydantic** - Request/response validation
- **Gemini 2.5 Pro** - AI generation
- **SQLite** - Database (easily swappable)

### Frontend
- **React 18** - UI framework
- **React Router** - Client-side routing
- **Vite** - Build tool
- CSS Variables - Theming

## Notes

- The system creates records in PENDING state, ready for actual API integration
- All prompts are generated and stored, so you can use them with any image/video API

## License

MIT
