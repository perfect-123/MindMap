# MindMap
🧠 MindMap

MindMap is an AI-powered browser extension that passively tracks and categorizes your online content consumption, turning it into a visual “nutrition label” for your attention. It also includes an interactive AR brain that reflects your habits in real time.

🚀 Overview

MindMap helps users understand how they spend time online. Instead of guessing, it automatically tracks what you watch or interact with and shows clear insights through a dashboard and an AR experience.

The goal is simple:
make your attention visible.

✨ Features
🔍 Passive Tracking
Chrome extension tracks content on sites like YouTube
Captures metadata such as title and source
Runs in the background with no manual input
🤖 AI Categorization
Uses AI to classify content into categories
Example: coding, entertainment, sports
Estimates time spent per category
📊 Dashboard Analytics
Visual breakdown of time spent by category
Weekly trends and usage patterns
Time-of-day heatmap
🧠 AR Brain Visualization
Interactive 3D brain rendered in AR
Brain state reflects your habits:
Thriving
Healthy
Sluggish
Rotting
Changes color and animation based on your behavior
🏗️ Tech Stack
Frontend
React (Vite)
Recharts (data visualization)
Backend
Supabase (database + API)
Extension
Chrome Extension (Manifest V3)
AI
Gemini API for content categorization
AR / 3D
Three.js
MindAR.js
Deployment
Netlify
⚙️ How It Works
Extension captures activity
Detects content on supported sites
Extracts metadata (title, channel, context)
AI processes data
Sends metadata to AI
Returns category and duration
Data stored in backend
Saved in Supabase database
Dashboard updates
Displays charts and insights in real time
AR brain reacts
Fetches user data
Updates brain state visually
📂 Project Structure (High-Level)
/extension       → Chrome extension (tracking + AI)
/dashboard       → React app (analytics UI)
/ar              → AR brain experience (Three.js + MindAR)
🧩 Core Data Model

events table

id
user_id
category
duration_mins
recorded_at
🚦 Getting Started
1. Clone the repo
git clone <repo-url>
cd mindmap
2. Setup Supabase
Create a project
Add the events table
Copy API keys
3. Run Dashboard
cd dashboard
npm install
npm run dev
4. Load Extension
Go to Chrome → Extensions
Enable Developer Mode
Load unpacked /extension folder
5. Run AR App
Open deployed link or local server
Use phone browser for AR experience
⚠️ Important Note

Backend must be set up first before:

AI categorization works
Dashboard shows real data
AR brain updates
🎯 Use Cases
Students tracking study vs entertainment time
Developers improving focus habits
Anyone curious about digital consumption
📸 Demo Flow
Open YouTube
Play a video
Data is tracked and categorized
Dashboard updates instantly
AR brain reflects your usage
🏁 Future Improvements
Multi-platform tracking (mobile + desktop)
User accounts and personalization
Notifications for unhealthy usage patterns
More detailed AI insights
👥 Team
Perfect — Extension & AI
Prosper — Dashboard & Backend
Derrick — AR & Demo