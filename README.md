# 🧠 Sign Language Video Calling Web App

A real-time AI-powered video calling web application that enables communication between deaf/mute users and normal users using **sign language recognition**.

---

## 🌟 Features

- 🎥 Real-time video calling using WebRTC  
- ✋ Sign language gesture recognition (A–Z)  
- 💬 Live subtitle output from gestures  
- 🧠 AI-based hand tracking using MediaPipe  
- 🔗 Room-based connection system  
- 👥 Multi-user support (join via Room ID)  
- ⚡ Real-time prediction with smoothing  
- 🎯 Optimized for low latency and smooth performance  

---

## 🧩 How It Works

1. User joins or creates a room  
2. Video call is established using WebRTC  
3. Camera frames are captured  
4. MediaPipe extracts hand landmarks  
5. ML model predicts gesture  
6. Output is displayed as text in real-time  

👉 The system bridges communication gap between deaf and non-sign users using AI. :contentReference[oaicite:0]{index=0}  

---

## 🏗️ System Architecture

```text
User Video → Frame Capture → MediaPipe → Landmarks → ML Model → Prediction → UI Overlay
🛠️ Tech Stack
Frontend
React.js
WebRTC
Socket.IO
Backend
FastAPI (Python)
TensorFlow / Keras
MediaPipe
Other
OpenCV
NumPy
WebSockets
📁 Project Structure
Sign-Language-Video-Calling/
│
├── frontend/        # React frontend
├── backend/         # FastAPI + AI model
├── socket/          # WebRTC signaling server
├── model/           # Trained model (.h5)
├── dataset/         # Training dataset
└── README.md
⚙️ Installation & Setup
🔹 Clone Repo
git clone https://github.com/Shivam09xc/Sign-Language-Video-Calling.git
cd Sign-Language-Video-Calling
🔹 Backend Setup
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
🔹 Frontend Setup
cd frontend
npm install
npm start
🔹 Socket Server
cd socket
npm install
node server.js
🚀 Usage
Open the app in browser
Create a room or join using Room ID
Start video call
Show hand gestures to camera
See real-time text output
⚡ Optimization Techniques Used
Frame throttling (process every 2–3 frames)
Landmark smoothing (moving average)
Prediction buffering (majority voting)
Confidence threshold filtering
Async processing for AI
📊 Limitations
Works best with good lighting
Limited gesture vocabulary (A–Z)
Performance depends on device and network

👉 Sign language translation is complex due to multiple body movements and lack of standardized datasets.

🔮 Future Improvements
Full sentence recognition (LSTM / Transformer)
Multi-language support
Text-to-speech integration
Mobile app version
Face + pose detection
🤝 Contributing

Contributions are welcome!
Feel free to fork and improve the project.

📜 License

This project is open-source and available under the MIT License.

👨‍💻 Author

Shivam Soni
📌 BTech CSE Student
🚀 AI & Full Stack Developer

⭐ Support

If you like this project, give it a ⭐ on GitHub!


---

# 🔥 Bro Final Tips

👉 README me ye add kare:
- Demo video link  
- Screenshots (bahut important)  
- Live URL  

👉 Ye tera project bana deta hai:
💬 **“Production-level AI Communication Platform”**

---
