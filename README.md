# 🧠 Sign Language Video Calling Web App  

![GitHub stars](https://img.shields.io/github/stars/Shivam09xc/Sign-Language-Video-Calling?style=social)
![GitHub forks](https://img.shields.io/github/forks/Shivam09xc/Sign-Language-Video-Calling?style=social)
![GitHub issues](https://img.shields.io/github/issues/Shivam09xc/Sign-Language-Video-Calling)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

> 🚀 Real-time AI-powered video calling platform that translates sign language into text for seamless communication.

---

## 📸 Screenshots

| Video Call | Gesture Detection | Output |
|------------|------------------|--------|


---

## 🌟 Features

- 🎥 Real-time video calling (WebRTC)  
- ✋ Sign language gesture recognition (A–Z)  
- 💬 Live subtitle output  
- 🧠 AI-based hand tracking (MediaPipe)  
- 🔗 Room-based connection system  
- 👥 Multi-user support  
- ⚡ Smooth real-time performance (optimized)  
- 🎯 Low-latency communication  

---

## 🧩 How It Works

```text
Camera → Frame Capture → MediaPipe → Hand Landmarks → ML Model → Prediction → Subtitle Output

👉 The system enables communication between deaf and normal users using AI-powered gesture recognition.

🏗️ Architecture

Frontend (React + WebRTC)
        ↓
WebSocket / Socket.IO
        ↓
Backend (FastAPI + AI Model)
        ↓
Prediction → Frontend Overlay

🛠️ Tech Stack

🔹 Frontend
React.js
WebRTC
Socket.IO
🔹 Backend
FastAPI
TensorFlow / Keras
MediaPipe
🔹 Other
OpenCV
NumPy
WebSockets

📁 Project Structure

Sign-Language-Video-Calling/
│
├── frontend/        # React app
├── backend/         # FastAPI + AI
├── socket/          # Signaling server
├── model/           # Trained model (.h5)
├── dataset/         # Training data
└── README.md

⚙️ Installation

1️⃣ Clone Repo
git clone https://github.com/Shivam09xc/Sign-Language-Video-Calling.git
cd Sign-Language-Video-Calling
2️⃣ Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
3️⃣ Frontend
cd frontend
npm install
npm start
4️⃣ Socket Server
cd socket
npm install
node server.js

🚀 Usage

Open app in browser
Create / Join Room
Start video call
Show gestures ✋
Get real-time text output 💬

⚡ Performance Optimizations

Frame throttling (process every 2–3 frames)
Landmark smoothing (moving average)
Prediction buffering (majority voting)
Confidence filtering
Async processing

📊 Limitations

Needs good lighting
Limited gestures (A–Z)
Performance depends on device

🔮 Future Scope

Sentence-level recognition (LSTM / Transformers)
Voice output (Text-to-Speech)
Mobile app (React Native)
Multi-language support
Face & pose detection

🤝 Contributing

Pull requests are welcome!
For major changes, open an issue first.

📜 License

MIT License

👨‍💻 Author

Shivam Soni
🎓 BTech CSE
🚀 AI + Full Stack Developer

⭐ Support

If you like this project, give it a ⭐ on GitHub and share it!


---
