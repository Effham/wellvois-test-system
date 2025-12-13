import React, { useEffect, useRef, useState, useCallback } from "react"
import { WebRTCAdaptor } from '@antmedia/webrtc_adaptor'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mic, MicOff, Video, VideoOff, Play, Square, Users, Settings } from "lucide-react"

interface VideoConferenceCreatorProps {
  antMediaUrl: string
}

interface Participant {
  streamId: string
  name: string
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  isMine: boolean
}

const VideoConferenceCreator: React.FC<VideoConferenceCreatorProps> = ({ antMediaUrl }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const adaptorRef = useRef<WebRTCAdaptor | null>(null)
  const isInitializedRef = useRef<boolean>(false)
  
  const [roomId, setRoomId] = useState<string>("")
  const [isHosting, setIsHosting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [error, setError] = useState<string>("")
  const [participants, setParticipants] = useState<Participant[]>([])
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)

  // Generate unique stream ID for host
  const streamId = useRef<string>(`host_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

  // WebRTC Error Handler
  const handleWebRTCError = useCallback((err: string, obj: unknown) => {
    console.error('WebRTC Error:', err, obj)
    
    switch (err) {
      case "notSetLocalDescription":
        setError("Failed to set local description. Please check your camera and microphone permissions.")
        break
      case "websocketConnectionFailed":
        setError("Failed to connect to streaming server. Please check your internet connection.")
        break
      case "noStreamNameSpecified":
        setError("No stream name specified. Please try again.")
        break
      default:
        setError(`Streaming error: ${err}`)
        break
    }
  }, [])

  // WebRTC Callback Handler
  const handleWebRTCCallback = useCallback((info: string, obj: unknown) => {
    console.log('WebRTC Callback:', info, obj)

    switch (info) {
      case "initialized":
        console.log("VideoConferenceCreator: WebRTC Adaptor initialized")
        setIsConnected(true)
        setError("")
        break

      case "joinedTheRoom":
        console.log("VideoConferenceCreator: Joined room as host")
        setIsHosting(true)
        setError("")
        
        // Start publishing our stream
        setTimeout(() => {
          if (adaptorRef.current && streamId.current) {
            console.log("VideoConferenceCreator: Publishing stream:", streamId.current)
            adaptorRef.current.publish(streamId.current)
          }
        }, 1000)
        
        // Handle existing participants
        if (obj && typeof obj === 'object' && 'streams' in obj && Array.isArray(obj.streams)) {
          const existingStreams = obj.streams as string[]
          existingStreams.forEach(existingStreamId => {
            if (existingStreamId !== streamId.current) {
              adaptorRef.current?.play(existingStreamId)
              setParticipants(prev => [...prev, {
                streamId: existingStreamId,
                name: `Participant ${existingStreamId.slice(-4)}`,
                isVideoEnabled: true,
                isAudioEnabled: true,
                isMine: false
              }])
            }
          })
        }
        break

      case "newStreamAvailable":
        console.log("VideoConferenceCreator: New participant joined:", obj)
        if (obj && typeof obj === 'object' && 'streamId' in obj && typeof obj.streamId === 'string') {
          const newStreamId = obj.streamId as string
          if (newStreamId !== streamId.current) {
            console.log("VideoConferenceCreator: Playing new stream:", newStreamId)
            adaptorRef.current?.play(newStreamId)
            
            setParticipants(prev => {
              const exists = prev.some(p => p.streamId === newStreamId)
              if (exists) {
                console.log("VideoConferenceCreator: Participant already exists, skipping:", newStreamId)
                return prev
              }
              
              console.log("VideoConferenceCreator: Adding new participant:", newStreamId)
              return [...prev, {
                streamId: newStreamId,
                name: `Participant ${newStreamId.slice(-4)}`,
                isVideoEnabled: true,
                isAudioEnabled: true,
                isMine: false
              }]
            })
          }
        }
        break

      case "streamLeaved":
        console.log("VideoConferenceCreator: Participant left:", obj)
        if (obj && typeof obj === 'object' && 'streamId' in obj) {
          const leftStreamId = obj.streamId as string
          setParticipants(prev => prev.filter(p => p.streamId !== leftStreamId))
        }
        break

      case "publish_started":
        console.log("VideoConferenceCreator: Publishing started successfully")
        break

      case "play_started":
        console.log("VideoConferenceCreator: Playback started for participant:", obj)
        break

      case "pong":
        console.log("VideoConferenceCreator: Pong received - connection alive")
        break

      default:
        console.log("VideoConferenceCreator: Unhandled callback:", info, obj)
        break
    }
  }, [])

  // Get local media stream
  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      })
      
      console.log('VideoConferenceCreator: Got local stream:', stream)
      setLocalStream(stream)
      
      // Set the stream to the video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
        localVideoRef.current.play().catch(err => console.warn('Autoplay failed:', err))
      }
      
      return stream
    } catch (err) {
      console.error('Error accessing media devices:', err)
      setError("Failed to access camera and microphone. Please check permissions.")
      return null
    }
  }, [])

  // Start hosting conference
  const startConference = useCallback(async () => {
    if (!roomId.trim()) {
      setError("Please enter a room ID")
      return
    }

    if (!adaptorRef.current) {
      setError("WebRTC not initialized. Please wait for connection.")
      return
    }

    setError("")
    console.log("VideoConferenceCreator: Starting conference room:", roomId.trim())
    
    // Get local stream first
    const stream = await getLocalStream()
    if (!stream) {
      setError("Failed to access camera and microphone")
      return
    }
    
    // Join the room as host
    adaptorRef.current.joinRoom(roomId.trim(), streamId.current)
  }, [roomId, getLocalStream])

  // Stop hosting conference
  const stopConference = useCallback(() => {
    if (adaptorRef.current && roomId && streamId.current) {
      console.log("VideoConferenceCreator: Stopping conference room:", roomId)
      
      try {
        adaptorRef.current.leaveFromRoom(roomId)
        adaptorRef.current.stop(streamId.current)
      } catch (error) {
        console.warn('Error stopping conference:', error)
      }
      
      setIsHosting(false)
      setParticipants([])
      
      // Stop local stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
        setLocalStream(null)
      }
    }
  }, [roomId, localStream])

  // Toggle audio mute
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks()
      audioTracks.forEach(track => {
        track.enabled = isAudioMuted
      })
      setIsAudioMuted(!isAudioMuted)
    }
  }, [localStream, isAudioMuted])

  // Toggle video mute
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks()
      videoTracks.forEach(track => {
        track.enabled = isVideoMuted
      })
      setIsVideoMuted(!isVideoMuted)
    }
  }, [localStream, isVideoMuted])

  // Initialize WebRTC
  useEffect(() => {
    let isMounted = true
    
    const init = async () => {
      if (isMounted && !isInitializedRef.current) {
        try {
          console.log('VideoConferenceCreator: Initializing WebRTC...')
          isInitializedRef.current = true

          // Generate room ID if not provided
          if (!roomId) {
            const myRoomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            setRoomId(myRoomId)
          }

          // Wait for video element to be available
          let videoElement = localVideoRef.current
          let attempts = 0
          while (!videoElement && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 100))
            videoElement = localVideoRef.current
            attempts++
          }

          if (!videoElement) {
            console.error('Video element not available after waiting')
            setError("Video element not available. Please refresh the page.")
            isInitializedRef.current = false
            return
          }

          console.log('VideoConferenceCreator: Creating WebRTCAdaptor')

          const adaptor = new WebRTCAdaptor({
            websocket_url: antMediaUrl,
            mediaConstraints: { 
              video: { width: 1280, height: 720 }, 
              audio: true 
            },
            peerconnection_config: { 
              iceServers: [
                { urls: "stun:stun1.l.google.com:19302" },
                { urls: "stun:stun2.l.google.com:19302" }
              ] 
            },
            localVideoId: "localVideo",
            debug: true,
            callback: handleWebRTCCallback,
            callbackError: handleWebRTCError,
          })
          
          adaptorRef.current = adaptor
          
          // Get local stream after adaptor is created
          await getLocalStream()
          
        } catch (err) {
          console.error('Error initializing WebRTC:', err)
          setError("Failed to initialize WebRTC. Please check your connection.")
          isInitializedRef.current = false
        }
      }
    }
    
    // Use setTimeout to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      init()
    }, 100)
    
    return () => {
      clearTimeout(timeoutId)
      isMounted = false
      
      // Cleanup
      if (adaptorRef.current && roomId && streamId.current) {
        try {
          adaptorRef.current.leaveFromRoom(roomId)
          adaptorRef.current.stop(streamId.current)
        } catch (error) {
          console.warn('Error during cleanup:', error)
        }
      }
      
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
      }
      
      adaptorRef.current = null
      isInitializedRef.current = false
      setIsHosting(false)
      setIsConnected(false)
      setParticipants([])
      setLocalStream(null)
    }
  }, [antMediaUrl, handleWebRTCCallback, handleWebRTCError, getLocalStream])

  // Ensure video element gets the stream when localStream changes
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream
      localVideoRef.current.play().catch(err => {
        console.warn('Autoplay failed:', err)
      })
    }
  }, [localStream])

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800">
        <div>
          <h2 className="text-xl font-semibold">Conference Host</h2>
          <p className="text-sm text-gray-400">
            {isHosting ? `Hosting Room: ${roomId} • ${participants.length + 1} participants` : "Ready to host conference"}
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant={isAudioMuted ? "destructive" : "secondary"}
            size="sm"
            onClick={toggleAudio}
            className="rounded-full w-10 h-10"
            disabled={!isConnected || !isHosting}
          >
            {isAudioMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </Button>
          
          <Button
            variant={isVideoMuted ? "destructive" : "secondary"}
            size="sm"
            onClick={toggleVideo}
            className="rounded-full w-10 h-10"
            disabled={!isConnected || !isHosting}
          >
            {isVideoMuted ? <VideoOff size={16} /> : <Video size={16} />}
          </Button>
          
          {!isHosting ? (
            <Button
              variant="default"
              size="sm"
              onClick={startConference}
              className="rounded-full w-10 h-10 ml-2"
              disabled={!isConnected || !roomId.trim()}
            >
              <Play size={16} />
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={stopConference}
              className="rounded-full w-10 h-10 ml-2"
            >
              <Square size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Room ID Input */}
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Label htmlFor="roomId" className="text-sm font-medium text-gray-300">
              Room ID
            </Label>
            <Input
              id="roomId"
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room ID to host conference"
              className="mt-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              disabled={isHosting}
            />
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-600 text-white p-4 m-4 rounded-lg">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Video Area */}
      <div className="flex-1 p-4">
        <div className="relative bg-gray-800 rounded-lg overflow-hidden h-full">
          {/* Local Video Element for WebRTC Adaptor */}
          <video
            id="localVideo"
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            controls={false}
            preload="metadata"
            className={`w-full h-full object-cover ${isConnected && localStream ? 'block' : 'hidden'}`}
            style={{ 
              backgroundColor: '#000',
              minHeight: '200px',
              minWidth: '200px',
              border: '2px solid #00ff00',
              borderRadius: '8px'
            }}
          />
          
          {isConnected && localStream ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full p-4">
              {/* Host Video Container */}
              <div className="relative bg-gray-700 rounded-lg overflow-hidden">
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-xs">
                  <div className="flex items-center gap-1">
                    <span>Host (You)</span>
                    {isAudioMuted && <MicOff className="w-3 h-3" />}
                    {isVideoMuted && <VideoOff className="w-3 h-3" />}
                    <div className="flex items-center gap-1 ml-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-xs">HOST</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Participants */}
              {participants.map((participant) => (
                <div key={participant.streamId} className="relative bg-gray-700 rounded-lg overflow-hidden">
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-xs">
                    <div className="flex items-center gap-1">
                      <span>{participant.name}</span>
                      {!participant.isAudioEnabled && <MicOff className="w-3 h-3" />}
                      {!participant.isVideoEnabled && <VideoOff className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full flex-col">
              <div className="text-6xl text-gray-600 mb-4">
                <Settings />
              </div>
              <p className="text-gray-400 text-lg mb-2">
                {roomId ? 'Click play to start hosting conference' : 'Enter a room ID to host conference'}
              </p>
              <p className="text-gray-500 text-sm">
                {isConnected ? 'Connected to server' : 'Connecting to server...'}
              </p>
              {roomId && (
                <p className="text-gray-500 text-xs mt-2">
                  Room ID: {roomId}
                </p>
              )}
            </div>
          )}
          
          {/* Connection Status */}
          <div className="absolute top-4 right-4 bg-black bg-opacity-50 px-3 py-2 rounded text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conference Info */}
      {roomId && (
        <div className="bg-gray-800 p-4 m-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Conference Information</h3>
          <div className="space-y-2">
            <div>
              <span className="text-gray-400">Room ID:</span>
              <span className="ml-2 font-mono text-sm">{roomId}</span>
            </div>
            <div>
              <span className="text-gray-400">Status:</span>
              <span className={`ml-2 ${isHosting ? 'text-green-400' : 'text-yellow-400'}`}>
                {isHosting ? 'Hosting' : 'Ready'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Participants:</span>
              <span className="ml-2 text-sm">{participants.length + 1}</span>
            </div>
            <div>
              <span className="text-gray-400">WebSocket URL:</span>
              <span className="ml-2 font-mono text-sm break-all">{antMediaUrl}</span>
            </div>
            <div>
              <span className="text-gray-400">Local Stream:</span>
              <span className={`ml-2 ${localStream ? 'text-green-400' : 'text-red-400'}`}>
                {localStream ? 'Available' : 'Not Available'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoConferenceCreator
