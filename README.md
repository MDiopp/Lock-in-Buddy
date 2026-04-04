# Lock-In Buddy

A productivity-focused robot buddy paired with a desktop app designed to help users stay locked in! 

---

## Tech Stack

**Frontend**
- React + TypeScript
- Tauri
- Tailwind CSS

**Backend**
- Python + FastAPI
- MediaPipe (face landmark detection)
- OpenCV
- WebSockets (real-time state streaming)

---

## Installation

### Prerequisites
For Tauri: https://tauri.app/start/prerequisites/

For React: Node.js https://nodejs.org/en/download

For Python backend: Python 3.11+ and pip

### Setup

```bash
# Clone the repo
git clone https://github.com/your-username/lockin-buddy.git

# Navigate into the project
cd LockIn\ Buddy/

# Install frontend dependencies
npm install

# Run the Tauri app (dev mode)
npm run tauri dev
```

To run the backend separately:

```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the API server
python -m uvicorn main:app --reload
```

Or use `start.bat` to launch the backend automatically.

---

## Disclaimer

This project was created for **KnightHacks Project Launch 2026** solely for education purposes.

This project includes a design inspired by BMO from Adventure Time.

BMO is a character owned by Cartoon Network.
This project is for educational and non-commercial purposes only.
No copyright infringement is intended.
This project is not affiliated with or endorsed by Cartoon Network.

