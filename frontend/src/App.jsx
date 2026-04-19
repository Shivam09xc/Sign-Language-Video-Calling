import { useEffect, useRef, useState } from 'react'
import io from 'socket.io-client'
import './App.css'

function App() {
  const localVideoRef = useRef(null)
  const canvasRef = useRef(null)
  
  // Connections
  const mlWsRef = useRef(null)
  const socketRef = useRef(null)

  const localStreamRef = useRef(null)
  const activeRoomRef = useRef(null)

  // Data Refs instead of State to prevent re-renders
  const predictionRef = useRef("Waiting for gesture...")
  
  // Mesh Network Tracking
  const peerConnectionsRef = useRef({})
  const remoteVideoRefs = useRef({})
  const remoteTextDOMRefs = useRef({})
  const remoteOverlayDOMRefs = useRef({})
  const remoteTextTimerRefs = useRef({})
  const remotePredictionRefs = useRef({})
  
  const [remotePeers, setRemotePeers] = useState([]) // Array of socket IDs
  
  const localTextTimerRef = useRef(null)
  
  // DOM element refs for imperative updates
  const bboxDOMRef = useRef(null)
  const localOverlayDOMRef = useRef(null)
  const localTextDOMRef = useRef(null)

  const [mlStatus, setMlStatus] = useState("Connecting...")
  const [isMlConnected, setIsMlConnected] = useState(false)
  
  const [callStatus, setCallStatus] = useState("Waiting for Room...") 
  const [localStream, setLocalStream] = useState(null)
  
  // Dynamic Rooms
  const [roomIdInput, setRoomIdInput] = useState("")
  const [activeRoom, setActiveRoom] = useState(null)
  const [serverError, setServerError] = useState("")

  const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

  useEffect(() => {
    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
              width: { ideal: 640 }, 
              height: { ideal: 480 },
              frameRate: { ideal: 24, max: 30 }
          },
          audio: true 
        })
        setLocalStream(stream)
        localStreamRef.current = stream

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
          localVideoRef.current.muted = true
          localVideoRef.current.volume = 0
        }
      } catch (err) {
        console.error("Error accessing webcam:", err)
        predictionRef.current = "Error accessing media devices."
      }
    }
    
    startWebcam()

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const addRemotePeer = (sid) => {
      setRemotePeers(prev => {
          if (!prev.includes(sid)) return [...prev, sid]
          return prev
      })
  }
  
  const removeRemotePeer = (sid) => {
      setRemotePeers(prev => prev.filter(p => p !== sid))
      if (peerConnectionsRef.current[sid]) {
          peerConnectionsRef.current[sid].close()
          delete peerConnectionsRef.current[sid]
      }
      delete remoteVideoRefs.current[sid]
      delete remoteTextDOMRefs.current[sid]
      delete remoteOverlayDOMRefs.current[sid]
      delete remotePredictionRefs.current[sid]
      if (remoteTextTimerRefs.current[sid]) clearTimeout(remoteTextTimerRefs.current[sid])
      delete remoteTextTimerRefs.current[sid]
  }

  const createPeerConnection = (room, targetSid) => {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    peerConnectionsRef.current[targetSid] = pc

    pc.onicecandidate = (event) => {
      if (event.candidate) {
         socketRef.current.emit('ice_candidate', { candidate: event.candidate, targetSid })
      }
    }

    pc.ontrack = (event) => {
      const vidRef = remoteVideoRefs.current[targetSid]
      if (vidRef && event.streams[0]) {
        vidRef.srcObject = event.streams[0]
      }
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        const sender = pc.addTrack(track, localStreamRef.current)
        
        if (track.kind === 'video') {
            const parameters = sender.getParameters()
            if (!parameters.encodings) parameters.encodings = [{}]
            parameters.encodings[0].maxBitrate = 500000 
            parameters.degradationPreference = 'maintain-framerate'
            sender.setParameters(parameters).catch(e => console.warn(e))
        }
      })
    }
    return pc
  }

  const initiateCallTo = async (targetSid, room) => {
    const pc = createPeerConnection(room, targetSid)
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socketRef.current.emit('offer', { offer, targetSid, room })
    } catch(e) {
      console.error(`Failed calling ${targetSid}`, e)
    }
  }

  useEffect(() => {
    socketRef.current = io('http://localhost:3001')
    const socket = socketRef.current

    socket.on('room_created', ({ room }) => {
       setActiveRoom(room)
       activeRoomRef.current = room
       setCallStatus("Room Generated")
       setServerError("")
    })

    socket.on('room_joined', ({ room, otherUsers }) => {
       setActiveRoom(room)
       activeRoomRef.current = room
       setCallStatus("Connected to Room")
       setServerError("")
       
       // Explicit mesh routing: initiate calls to existing inhabitants
       otherUsers.forEach(sid => {
           addRemotePeer(sid)
           initiateCallTo(sid, room)
       })
    })

    socket.on('room_error', ({ message }) => {
       setServerError(message)
       setCallStatus("Idle")
    })

    socket.on('peer_joined', ({ sid }) => {
       setCallStatus("Peer Joined")
       addRemotePeer(sid)
       // Let the new peer initiate the offer to us to prevent race conditions
    })

    socket.on('offer', async ({ offer, senderSid }) => {
      try {
        const room = activeRoomRef.current
        const pc = createPeerConnection(room, senderSid)
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        socket.emit('answer', { answer, targetSid: senderSid, room })
      } catch(e) {}
    })

    socket.on('answer', async ({ answer, senderSid }) => {
      try {
        const pc = peerConnectionsRef.current[senderSid]
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer))
      } catch(e) {}
    })

    socket.on('ice_candidate', async ({ candidate, senderSid }) => {
      try {
        const pc = peerConnectionsRef.current[senderSid]
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch(e) {}
    })

    socket.on('gesture_prediction', (data) => {
      if (data && data.prediction && data.senderSid) {
          const sid = data.senderSid
          if (!remotePredictionRefs.current[sid]) remotePredictionRefs.current[sid] = "Waiting for remote gesture..."
          
          const newPrediction = data.prediction
          if (newPrediction !== remotePredictionRefs.current[sid]) {
              remotePredictionRefs.current[sid] = newPrediction
              if (remoteTextTimerRefs.current[sid]) clearTimeout(remoteTextTimerRefs.current[sid])
              
              remoteTextTimerRefs.current[sid] = setTimeout(() => {
                  requestAnimationFrame(() => {
                     const domRef = remoteTextDOMRefs.current[sid]
                     const overlayRef = remoteOverlayDOMRefs.current[sid]
                     if (domRef) {
                         const isDefault = newPrediction === "Waiting for remote gesture..." || newPrediction === "No Hand" || newPrediction === "Unknown"
                         domRef.innerHTML = isDefault
                            ? `<span class="loading-pulse">${newPrediction}</span>`
                            : `<span class="live-prediction">Remote Gesture: <strong>${newPrediction}</strong></span>`
                            
                         domRef.classList.remove('animated-text')
                         void domRef.offsetWidth
                         domRef.classList.add('animated-text')
                            
                         if (overlayRef) {
                             if (!isDefault) overlayRef.classList.add('active')
                             else overlayRef.classList.remove('active')
                         }
                     }
                  })
              }, 150)
          }
      }
    })

    socket.on('peer_left', ({ sid }) => {
       removeRemotePeer(sid)
    })

    return () => {
      socket.disconnect()
    }
  }, []) 

  const joinRoomBtn = () => {
     if (roomIdInput.trim() === '') return
     setCallStatus("Joining Room...")
     socketRef.current.emit('join_room', { room: roomIdInput })
  }

  const createRoomBtn = () => {
     setCallStatus("Creating Room...")
     socketRef.current.emit('create_room')
  }

  const disconnectCallLocally = () => {
    Object.keys(peerConnectionsRef.current).forEach(sid => {
       peerConnectionsRef.current[sid].close()
    })
    peerConnectionsRef.current = {}
    setRemotePeers([])
    setCallStatus("Idle")
    setActiveRoom(null)
    activeRoomRef.current = null
    socketRef.current.disconnect()
    socketRef.current.connect()
  }

  useEffect(() => {
    const connectMLWebSocket = () => {
      const ws = new WebSocket('ws://localhost:8000/ws/predict')
      mlWsRef.current = ws

      ws.onopen = () => {
        setMlStatus("ML Engine Ready")
        setIsMlConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const newPrediction = data.prediction
          const newBbox = data.bbox || null
          
          requestAnimationFrame(() => {
              if (bboxDOMRef.current) {
                  if (newBbox) {
                      bboxDOMRef.current.style.display = 'block'
                      bboxDOMRef.current.style.left = `${(1 - (newBbox.x + newBbox.width)) * 100}%`
                      bboxDOMRef.current.style.top = `${newBbox.y * 100}%`
                      bboxDOMRef.current.style.width = `${newBbox.width * 100}%`
                      bboxDOMRef.current.style.height = `${newBbox.height * 100}%`
                  } else {
                      bboxDOMRef.current.style.display = 'none'
                  }
              }
          })
          
          if (newPrediction !== predictionRef.current) {
              predictionRef.current = newPrediction
              if (localTextTimerRef.current) clearTimeout(localTextTimerRef.current)
              
              localTextTimerRef.current = setTimeout(() => {
                  requestAnimationFrame(() => {
                      if (localTextDOMRef.current) {
                          const isDefault = newPrediction === "Waiting for gesture..." || newPrediction === "No Hand" || newPrediction === "Unknown"
                          localTextDOMRef.current.innerHTML = isDefault
                             ? `<span class="loading-pulse">${newPrediction}</span>`
                             : `<span class="live-prediction">Gesture: <strong>${newPrediction}</strong></span>`
                             
                          localTextDOMRef.current.classList.remove('animated-text')
                          void localTextDOMRef.current.offsetWidth
                          localTextDOMRef.current.classList.add('animated-text')
                          
                          if (localOverlayDOMRef.current) {
                              if (!isDefault) localOverlayDOMRef.current.classList.add('active')
                              else localOverlayDOMRef.current.classList.remove('active')
                          }
                      }
                  })
              }, 150)
          }
          
          const currentRoom = activeRoomRef.current
          if (socketRef.current && currentRoom) {
              socketRef.current.emit('gesture_prediction', { prediction: newPrediction, room: currentRoom })
          }
        } catch (e) { }
      }

      ws.onerror = () => {
        setIsMlConnected(false)
        setMlStatus("ML Offline")
      }

      ws.onclose = () => {
        setIsMlConnected(false)
        setTimeout(connectMLWebSocket, 3000)
      }
    }

    connectMLWebSocket()

    const captureAndSend = () => {
      if (!localVideoRef.current || !canvasRef.current) return
      if (localVideoRef.current.readyState !== 4) return
      if (!mlWsRef.current || mlWsRef.current.readyState !== WebSocket.OPEN) return
      
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      canvas.width = localVideoRef.current.videoWidth || 640
      canvas.height = localVideoRef.current.videoHeight || 480
      context.drawImage(localVideoRef.current, 0, 0, canvas.width, canvas.height)
      
      const imageData = canvas.toDataURL('image/jpeg', 0.6) 
      mlWsRef.current.send(JSON.stringify({ image: imageData }))
    }

    let isCapturing = true;
    const captureLoop = () => {
       if (!isCapturing) return
       captureAndSend()
       setTimeout(() => {
           requestAnimationFrame(captureLoop)
       }, 200)
    }
    requestAnimationFrame(captureLoop)
    
    return () => {
      isCapturing = false
      if (mlWsRef.current) mlWsRef.current.close()
    }
  }, [])

  return (
    <div className="app-container">
      <div className="header-layer">
        <h1 className="title">Dual Stream ASL Chat</h1>
        <div className="badge-row">
            <div className="status-badge" title={callStatus}>
                <div className={`status-dot ${activeRoom ? 'connected' : ''}`}></div>
                <span className="status-text">{callStatus === 'Idle' ? 'Ready to Call' : callStatus}</span>
            </div>
            {activeRoom && (
              <div className="status-badge">
                 <span className="status-text">Room <strong>{activeRoom}</strong> ({remotePeers.length + 1}/4)</span>
              </div>
            )}
            <div className="status-badge" title={mlStatus}>
              {isMlConnected ? (
                <>
                  <div className="status-dot connected"></div>
                  <span className="status-text">ML Active <span className="highlight-text">200ms</span></span>
                </>
              ) : (
                <>
                  <div className="spinner"></div>
                  Connecting ML...
                </>
              )}
            </div>
        </div>
        {serverError && <div style={{ color: '#ff4757', fontWeight: 'bold' }}>{serverError}</div>}
      </div>
      
      <div className={`video-grid count-${remotePeers.length + 1}`}>
        <div className="camera-container">
          <video ref={localVideoRef} autoPlay playsInline muted />
          <div className="container-label local-label">You</div>
          
          <div ref={bboxDOMRef} className="hand-bounding-box" style={{ display: 'none' }} />
          
          <div ref={localOverlayDOMRef} className="subtitle-overlay">
            <div ref={localTextDOMRef} className="animated-text">
               <span className="loading-pulse">Waiting for gesture...</span>
            </div>
          </div>
        </div>

        {remotePeers.map(sid => (
           <div key={sid} className="camera-container remote-container">
               <video ref={el => remoteVideoRefs.current[sid] = el} autoPlay playsInline />
               <div ref={el => remoteOverlayDOMRefs.current[sid] = el} className="subtitle-overlay">
                 <div ref={el => remoteTextDOMRefs.current[sid] = el} className="animated-text">
                    <span className="loading-pulse">Waiting for remote gesture...</span>
                 </div>
               </div>
               <div className="container-label remote-label">Peer {sid.substring(0,4)}</div>
           </div>
        ))}
        
        {remotePeers.length === 0 && activeRoom && (
           <div className="camera-container remote-container">
              <div className="placeholder-remote">
                 <div className="spinner large"></div>
                 <span className="placeholder-text">Waiting in Room: <strong>{activeRoom}</strong></span>
              </div>
           </div>
        )}
      </div>

      <div className="action-tray">
         {!activeRoom ? (
             <div className="room-input-group">
                <button className="join-btn" style={{ background: '#2ed573' }} onClick={createRoomBtn}>
                   ✨ Create New Room
                </button>
                <span style={{color: '#fff', fontWeight: 'bold'}}>OR</span>
                <input 
                  type="text" 
                  className="room-input" 
                  placeholder="Enter 6-char Co..." 
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                />
                <button className="join-btn" onClick={joinRoomBtn} disabled={!roomIdInput.trim()}>
                  🚪 Join
                </button>
             </div>
         ) : (
             <>
               <button className="hangup-btn" onClick={disconnectCallLocally}>
                 ❌ End Call & Leave
               </button>
             </>
         )}
      </div>
      
      <canvas ref={canvasRef} className="hidden-canvas" />
    </div>
  )
}

export default App
