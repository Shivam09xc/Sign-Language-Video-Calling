import os
import sys

# EXTREME MEMORY CONSTRAINTS FOR CLOUD FREE TIERS (MUST BE BEFORE TENSORFLOW IMPORT)
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import numpy as np
import cv2
import mediapipe as mp
import tensorflow as tf
from tensorflow.keras.models import load_model
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor

app = FastAPI()

# Wide open CORS needed for Render/Vercel connections natively
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class FrameRequest(BaseModel):
    image: str

# ML Models - Dynamically targeted using system-agnostic relative mapping
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "asl_landmarks_mlp.h5")
LABELS_PATH = os.path.join(BASE_DIR, "model", "labels.txt")

if os.path.exists(MODEL_PATH) and os.path.exists(LABELS_PATH):
    model = load_model(MODEL_PATH)
    with open(LABELS_PATH, "r") as f:
        labels = [ln.strip() for ln in f if ln.strip()]
else:
    model = None
    labels = []
    print(f"CRITICAL WARNING: Cloud Model artifacts missing from {BASE_DIR}")

mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False, 
    model_complexity=0,
    max_num_hands=1,
    min_detection_confidence=0.6,
    min_tracking_confidence=0.6
)

def to_features(hl, w, h):
    pts = np.array([[lm.x * w, lm.y * h] for lm in hl.landmark], dtype=np.float32)
    origin = pts[0].copy()
    pts_rel = pts - origin
    scale = np.max(np.linalg.norm(pts_rel, axis=1))
    if scale < 1e-6: return None
    pts_rel /= scale
    return pts_rel.flatten().reshape(1, -1)

def process_frame_data(image_data: str):
    if not model:
        return {"prediction": "Model Error", "bbox": None}
    
    try:
        if "," in image_data:
            header, encoded = image_data.split(",", 1)
        else:
            encoded = image_data
            
        jpg_original = base64.b64decode(encoded)
        jpg_as_np = np.frombuffer(jpg_original, dtype=np.uint8)
        img = cv2.imdecode(jpg_as_np, flags=1)
        
        if img is None:
            return {"prediction": "Invalid Frame", "bbox": None}

        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        res = hands.process(rgb)
        
        if res.multi_hand_landmarks:
            hl = res.multi_hand_landmarks[0]
            img_h, img_w = img.shape[:2]
            feat = to_features(hl, img_w, img_h)
            
            x_coords = [lm.x for lm in hl.landmark]
            y_coords = [lm.y for lm in hl.landmark]
            
            padding = 0.05
            x_min = max(0, min(x_coords) - padding)
            y_min = max(0, min(y_coords) - padding)
            x_max = min(1, max(x_coords) + padding)
            y_max = min(1, max(y_coords) + padding)
            
            bbox = {
                "x": x_min,
                "y": y_min,
                "width": x_max - x_min,
                "height": y_max - y_min
            }
            
            if feat is not None:
                pred = model.predict(feat, verbose=0)[0]
                ci = int(np.argmax(pred))
                label_conf = float(np.max(pred))
                
                if label_conf > 0.5:
                    return {"prediction": f"{labels[ci]}", "bbox": bbox}
                else:
                    return {"prediction": "Unknown", "bbox": bbox}
                    
        return {"prediction": "No Hand", "bbox": None}
        
    except Exception as e:
        print(f"Prediction Error: {e}")
        return {"prediction": "Error", "bbox": None}

@app.post("/predict")
async def predict_gesture(request: FrameRequest):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(executor, process_frame_data, request.image)

# Capped strictly to 1 thread to survive Render's 512MB RAM limitation limits.
executor = ThreadPoolExecutor(max_workers=1)

@app.websocket("/ws/predict")
async def websocket_predict(websocket: WebSocket):
    await websocket.accept()
    
    # Bounded queue to drop older frames and keep stream real-time
    queue = asyncio.Queue(maxsize=2)
    
    async def worker():
        try:
            loop = asyncio.get_running_loop()
            while True:
                data = await queue.get()
                
                try:
                    payload = json.loads(data)
                    image_data = payload.get("image", "")
                except json.JSONDecodeError:
                    image_data = data
                
                result = await loop.run_in_executor(executor, process_frame_data, image_data)
                
                await websocket.send_json(result)
                queue.task_done()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Worker Error: {e}")

    worker_task = asyncio.create_task(worker())
    
    try:
        while True:
            data = await websocket.receive_text()
            
            if queue.full():
                try:
                    queue.get_nowait()
                    queue.task_done()
                except asyncio.QueueEmpty:
                    pass
            
            await queue.put(data)
    except (WebSocketDisconnect, RuntimeError):
        pass
    except Exception as e:
        print(f"WebSocket Error: {e}")
    finally:
        worker_task.cancel()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)

