import React, { useEffect, useRef, useState, useCallback } from "react"
import { WebRTCAdaptor } from '@antmedia/webrtc_adaptor'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Play, Square, Search, Mic, MicOff, Video, VideoOff, Users } from "lucide-react"

interface VideoConferenceJoinerProps {
  antMediaUrl: string
}

interface Participant {
  streamId: string
  name: string
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  isMine: boolean
}

const VideoConferenceJoiner: React.FC<VideoConferenceJoinerProps> = ({ antMediaUrl }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const adaptorRef = useRef<WebRTCAdaptor | null>(null)
  const isInitializedRef = useRef<boolean>(false)
  const localStreamRef = useRef<MediaStream | null>(null)
  
  const [roomId, setRoomId] = useState<string>("")
  const [isConnected, setIsConnected] = useState(false)
  const [isInConference, setIsInConference] = useState(false)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [error, setError] = useState<string>("")
  const [participants, setParticipants] = useState<Participant[]>([])

  // Generate unique stream ID for participant
  const streamId = useRef<string>(`participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

  // Get local media stream
  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      })
      
      localStreamRef.current = stream
      
      // Set the stream to the local video element
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

  // WebRTC Error Handler
  const handleWebRTCError = useCallback((err: string, obj: unknown) => {
    console.error('WebRTC Error:', err, obj)
    
    switch (err) {
      case "notSetLocalDescription":
        setError("Failed to set local description. Please check your connection.")
        break
      case "websocketConnectionFailed":
        setError("Failed to connect to streaming server. Please check your internet connection.")
        break
      case "noStreamNameSpecified":
        setError("No stream name specified. Please enter a stream ID.")
        break
      case "play_finished":
        setError("Stream ended or is no longer available.")
        break
      case "already_playing":
        console.warn("Stream is already playing, ignoring error")
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
        console.log("VideoConferenceJoiner: WebRTC Adaptor initialized")
        setIsConnected(true)
        setError("")
        break

      case "joinedTheRoom":
        console.log("VideoConferenceJoiner: Joined conference room successfully")
        setIsInConference(true)
        setError("")
        
        // Start publishing our stream
        if (adaptorRef.current && streamId.current) {
          adaptorRef.current.publish(streamId.current)
        }
        
        // Handle existing participants
        if (obj && typeof obj === 'object' && 'streams' in obj && Array.isArray(obj.streams)) {
          const existingStreams = obj.streams as string[]
          console.log("VideoConferenceJoiner: Existing streams found:", existingStreams)
          
          const newParticipants: Participant[] = []
          existingStreams.forEach(existingStreamId => {
            if (existingStreamId !== streamId.current) {
              console.log("VideoConferenceJoiner: Adding existing participant:", existingStreamId)
              adaptorRef.current?.play(existingStreamId)
              newParticipants.push({
                streamId: existingStreamId,
                name: `Participant ${existingStreamId.slice(-4)}`,
                isVideoEnabled: true,
                isAudioEnabled: true,
                isMine: false
              })
            }
          })
          
          if (newParticipants.length > 0) {
            setParticipants(prev => {
              // Remove any existing participants with the same IDs to avoid duplicates
              const filtered = prev.filter(p => !newParticipants.some(np => np.streamId === p.streamId))
              return [...filtered, ...newParticipants]
            })
          }
        }
        break

      case "newStreamAvailable":
        console.log("VideoConferenceJoiner: New participant joined:", obj)
        if (obj && typeof obj === 'object' && 'streamId' in obj && typeof obj.streamId === 'string') {
          const newStreamId = obj.streamId as string
          if (newStreamId !== streamId.current) {
            console.log("VideoConferenceJoiner: Playing new stream:", newStreamId)
            adaptorRef.current?.play(newStreamId)
            
            setParticipants(prev => {
              const exists = prev.some(p => p.streamId === newStreamId)
              if (exists) {
                console.log("VideoConferenceJoiner: Participant already exists, skipping:", newStreamId)
                return prev
              }
              
              console.log("VideoConferenceJoiner: Adding new participant:", newStreamId)
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
        console.log("VideoConferenceJoiner: Participant left:", obj)
        if (obj && typeof obj === 'object' && 'streamId' in obj) {
          const leftStreamId = obj.streamId as string
          setParticipants(prev => prev.filter(p => p.streamId !== leftStreamId))
        }
        break

      case "publish_started":
        console.log("VideoConferenceJoiner: Publishing started successfully")
        break

      case "play_started":
        console.log("VideoConferenceJoiner: Playback started for participant:", obj)
        break

      case "pong":
        console.log("VideoConferenceJoiner: Pong received - connection alive")
        break

      default:
        console.log("VideoConferenceJoiner: Unhandled callback:", info, obj)
        break
    }
  }, [])

  // Join conference
  const joinConference = useCallback(async () => {
    if (!roomId.trim()) {
      setError("Please enter a room ID")
      return
    }

    if (!adaptorRef.current) {
      setError("WebRTC not initialized. Please wait for connection.")
      return
    }

    setError("")
    console.log("VideoConferenceJoiner: Joining conference room:", roomId.trim())
    
    // Get local stream first
    const stream = await getLocalStream()
    if (!stream) {
      setError("Failed to access camera and microphone")
      return
    }
    
    // Join the room
    adaptorRef.current.joinRoom(roomId.trim(), streamId.current)
  }, [roomId, getLocalStream])

  // Leave conference
  const leaveConference = useCallback(() => {
    if (adaptorRef.current && roomId && streamId.current) {
      console.log("VideoConferenceJoiner: Leaving conference room:", roomId)
      
      try {
        adaptorRef.current.leaveFromRoom(roomId)
        adaptorRef.current.stop(streamId.current)
      } catch (error) {
        console.warn('Error leaving conference:', error)
      }
      
      setIsInConference(false)
      setParticipants([])
      
      // Clear local video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
      }
      
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
        localStreamRef.current = null
      }
    }
  }, [roomId])

  // Toggle audio mute
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks()
      audioTracks.forEach(track => {
        track.enabled = isAudioMuted
      })
      setIsAudioMuted(!isAudioMuted)
    }
  }, [isAudioMuted])

  // Toggle video mute
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks()
      videoTracks.forEach(track => {
        track.enabled = isVideoMuted
      })
      setIsVideoMuted(!isVideoMuted)
    }
  }, [isVideoMuted])

  // Initialize WebRTC
  useEffect(() => {
    let isMounted = true
    
    const init = async () => {
      if (isMounted && !isInitializedRef.current) {
        try {
          console.log('VideoConferenceJoiner: Initializing WebRTC...')
          isInitializedRef.current = true

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

          console.log('VideoConferenceJoiner: Creating WebRTCAdaptor')

          const adaptor = new WebRTCAdaptor({
            websocket_url: antMediaUrl,
            mediaConstraints: { 
              video: { width: 640, height: 480 }, 
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
          
        } catch (err) {
          console.error('Error initializing WebRTC:', err)
          setError("Failed to initialize WebRTC. Please check your connection.")
          isInitializedRef.current = false
        }
      }
    }
    
    init()
    
    return () => {
      isMounted = false
      
      // Cleanup
      if (adaptorRef.current) {
        if (roomId && streamId.current) {
          try {
            adaptorRef.current.leaveFromRoom(roomId)
            adaptorRef.current.stop(streamId.current)
          } catch (error) {
            console.warn('Error during cleanup:', error)
          }
        }
      }
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
      
      adaptorRef.current = null
      isInitializedRef.current = false
      setIsConnected(false)
      setIsInConference(false)
      setParticipants([])
    }
  }, [antMediaUrl, handleWebRTCCallback, handleWebRTCError])

  // Ensure local video stream is set up
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
      localVideoRef.current.play().catch(err => console.warn('Failed to play local video:', err))
    }
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800">
        <div>
          <h2 className="text-xl font-semibold">Video Conferencesss</h2>
          <p className="text-sm text-gray-400">
            {isInConference ? `In Room: ${roomId} • ${participants.length + 1} participants` : "Enter room ID to join conference"}
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-2">
          {!isInConference ? (
            <Button
              variant="default"
              size="sm"
              onClick={joinConference}
              className="rounded-full w-10 h-10"
              disabled={!isConnected || !roomId.trim()}
            >
              <Play size={16} />
            </Button>
          ) : (
            <>
              <Button
                variant={isAudioMuted ? "destructive" : "secondary"}
                size="sm"
                onClick={toggleAudio}
                className="rounded-full w-10 h-10"
              >
                {isAudioMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </Button>
              
              <Button
                variant={isVideoMuted ? "destructive" : "secondary"}
                size="sm"
                onClick={toggleVideo}
                className="rounded-full w-10 h-10"
              >
                {isVideoMuted ? <VideoOff size={16} /> : <Video size={16} />}
              </Button>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={leaveConference}
                className="rounded-full w-10 h-10"
              >
                <Square size={16} />
              </Button>
            </>
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
              placeholder="Enter room ID to join conference"
              className="mt-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              disabled={isInConference}
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
          {/* Local Video Element for WebRTC Adaptor - positioned off-screen when in conference */}
          <video
            id="localVideo"
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            controls={false}
            preload="metadata"
            className="w-full h-full object-cover"
            style={{ 
              backgroundColor: '#000',
              minHeight: '200px',
              minWidth: '200px',
              border: '2px solid #00ff00',
              borderRadius: '8px',
              position: isInConference ? 'absolute' : 'relative',
              top: isInConference ? '-9999px' : 'auto',
              left: isInConference ? '-9999px' : 'auto',
              zIndex: isInConference ? -1 : 1
            }}
          />
          
          {isInConference ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full p-4">
              {/* Local Video Container */}
              <div className="relative bg-gray-700 rounded-lg overflow-hidden">
                <video
                  id="localVideoDisplay"
                  autoPlay
                  playsInline
                  muted
                  controls={false}
                  preload="metadata"
                  className="w-full h-full object-cover"
                  style={{ 
                    backgroundColor: '#000',
                    minHeight: '200px',
                    minWidth: '200px',
                    border: '2px solid #00ff00',
                    borderRadius: '8px'
                  }}
                  ref={(el) => {
                    if (el && localVideoRef.current && localVideoRef.current.srcObject) {
                      el.srcObject = localVideoRef.current.srcObject
                    }
                  }}
                />
                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-xs">
                  <div className="flex items-center gap-1">
                    <span>You</span>
                    {isAudioMuted && <MicOff className="w-3 h-3" />}
                    {isVideoMuted && <VideoOff className="w-3 h-3" />}
                  </div>
                </div>
              </div>
              
              {/* Remote Participants */}
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
                <Users />
              </div>
              <p className="text-gray-400 text-lg mb-2">
                {roomId ? 'Click play to join conference' : 'Enter a room ID to join conference'}
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
          
          {/* Status Overlay */}
          {isInConference && (
            <div className="absolute top-4 right-4 bg-black bg-opacity-50 px-3 py-2 rounded text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>IN CONFERENCE</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Connection Info */}
      <div className="bg-gray-800 p-4 m-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Conference Information</h3>
        <div className="space-y-2">
          <div>
            <span className="text-gray-400">Status:</span>
            <span className={`ml-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">WebSocket URL:</span>
            <span className="ml-2 font-mono text-sm break-all">{antMediaUrl}</span>
          </div>
          {roomId && (
            <div>
              <span className="text-gray-400">Current Room:</span>
              <span className="ml-2 font-mono text-sm">{roomId}</span>
            </div>
          )}
          {isInConference && (
            <div>
              <span className="text-gray-400">Participants:</span>
              <span className="ml-2 text-sm">{participants.length + 1}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VideoConferenceJoiner
