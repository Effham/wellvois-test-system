import React, { useEffect, useRef, useState, useCallback } from "react"
import { WebRTCAdaptor } from '@antmedia/webrtc_adaptor'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Play, Square, Search, Mic, MicOff, Video, VideoOff, Users } from "lucide-react"
import VideoDebugger from "./VideoDebugger"

interface StreamJoinerProps {
  antMediaUrl: string
}

interface StreamInfo {
  id: string
  name: string
  status: string
}

interface Participant {
  id: string
  name: string
  isVideoEnabled: boolean
  isAudioEnabled: boolean
}

const StreamJoiner: React.FC<StreamJoinerProps> = ({ antMediaUrl }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const adaptorRef = useRef<WebRTCAdaptor | null>(null)
  const isInitializedRef = useRef<boolean>(false)
  const antMediaUrlRef = useRef<string>(antMediaUrl)
  const roomIdRef = useRef<string>("")
  const streamIdRef = useRef<string>("")
  const localStreamRef = useRef<MediaStream | null>(null)

  // Stable map of remoteId -> MediaStream we assemble from tracks
  const streamsByIdRef = useRef<Map<string, MediaStream>>(new Map())

  const [roomId, setRoomId] = useState<string>("")
  const [isConnected, setIsConnected] = useState(false)
  const [isInConference, setIsInConference] = useState(false)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [error, setError] = useState<string>("")
  const [participants, setParticipants] = useState<Participant[]>([])
  const [availableRooms, setAvailableRooms] = useState<StreamInfo[]>([])
  const [isLoadingRooms, setIsLoadingRooms] = useState(false)

  // keep refs fresh
  antMediaUrlRef.current = antMediaUrl
  roomIdRef.current = roomId

  // create my participant stream id once
  useEffect(() => {
    if (!streamIdRef.current) {
      streamIdRef.current = `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }, [])

  // Get local media
  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      })
      localStreamRef.current = stream

      if (localVideoRef.current) {
        const el = localVideoRef.current
        el.srcObject = stream
        el.load()
        el.play().catch(() => {})
      }
      return stream
    } catch (err) {
      console.error('Error accessing media devices:', err)
      setError("Failed to access camera and microphone. Please check permissions.")
      return null
    }
  }, [])

  // stable cb refs for webrtc adaptor
  const handleWebRTCErrorRef = useRef<(err: string, obj: unknown) => void>(() => {})
  const handleWebRTCCallbackRef = useRef<(info: string, obj: unknown) => void>(() => {})

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
        // benign
        break
      default:
        setError(`Streaming error: ${err}`)
        break
    }
  }, [])

  const handleWebRTCCallback = useCallback((info: string, obj: any) => {
    console.log('WebRTC Callback:', info, obj)

    switch (info) {
      case "initialized": {
        setIsConnected(true)
        setError("")
        break
      }

      case "joinedTheRoom": {
        console.log("Joined conference room successfully")
        setIsInConference(true)
        setError("")

        // Publish self
        adaptorRef.current?.publish(streamIdRef.current)

        // Play the WHOLE ROOM exactly once so we receive tracks for
        // everyone already present AND for future joiners
        adaptorRef.current?.play(roomIdRef.current, "", roomIdRef.current, [])

        // Render tiles for existing participants (no per-stream play)
        if (obj && Array.isArray(obj.streams)) {
          const existing = obj.streams as string[]
          setParticipants(prev => {
            const toAdd = existing
              .filter(s => s !== streamIdRef.current && !prev.some(p => p.id === s))
              .map(s => ({
                id: s,
                name: `Participant ${s.slice(-4)}`,
                isVideoEnabled: true,
                isAudioEnabled: true
              }))
            return [...prev, ...toAdd]
          })
        }
        break
      }

      case "newStreamAvailable": {
        // Someone new joined; create a tile only (tracks will arrive via newTrackAvailable)
        const sid = obj?.streamId as string | undefined
        if (sid && sid !== streamIdRef.current) {
          setParticipants(prev => (prev.some(p => p.id === sid)
            ? prev
            : [...prev, {
                id: sid,
                name: `Participant ${sid.slice(-4)}`,
                isVideoEnabled: true,
                isAudioEnabled: true
              }]))
        }
        break
      }

      case "newTrackAvailable": {
        const streamId: string = obj?.streamId
        const track: MediaStreamTrack = obj?.track

        if (!streamId || streamId === streamIdRef.current || !track) break

        // Ensure participant tile exists
        setParticipants(prev => {
          if (prev.some(p => p.id === streamId)) return prev
          return [...prev, {
            id: streamId,
            name: `Participant ${streamId.slice(-4)}`,
            isVideoEnabled: track.kind === "video" ? true : false,
            isAudioEnabled: track.kind === "audio" ? true : true
          }]
        })

        // Ensure persistent MediaStream per remote
        let ms = streamsByIdRef.current.get(streamId)
        if (!ms) {
          ms = new MediaStream()
          streamsByIdRef.current.set(streamId, ms)
        }
        // avoid dupes
        if (!ms.getTracks().some(t => t.id === track.id)) {
          ms.addTrack(track)
        }

        // Attach to the remote video once it exists (React tile might render next tick)
        const attachWhenReady = (tries = 0) => {
          const video = document.getElementById(`remote_${streamId}`) as HTMLVideoElement | null
          if (video) {
            if (video.srcObject !== ms) video.srcObject = ms
            video.play().catch(() => {})
          } else if (tries < 20) {
            setTimeout(() => attachWhenReady(tries + 1), 100)
          }
        }
        attachWhenReady()

        // cleanup when this track ends
        track.onended = () => {
          const keep = streamsByIdRef.current.get(streamId)
          if (!keep) return
          keep.getTracks().forEach(t => {
            if (t.id === track.id) keep.removeTrack(t)
          })
        }
        break
      }

      case "streamLeaved": {
        const sid = obj?.streamId as string | undefined
        if (sid) {
          setParticipants(prev => prev.filter(p => p.id !== sid))
          const ms = streamsByIdRef.current.get(sid)
          if (ms) {
            ms.getTracks().forEach(t => t.stop())
            streamsByIdRef.current.delete(sid)
          }
        }
        break
      }

      case "publish_started":
      case "play_started":
      case "play_finished":
      case "available_devices":
      case "pong":
      case "streamJoined":
      case "data_received":
      case "bitrateMeasurement":
      default:
        // no-op / logs
        break
    }
  }, [])

  handleWebRTCErrorRef.current = handleWebRTCError
  handleWebRTCCallbackRef.current = handleWebRTCCallback

  const joinConference = useCallback(async () => {
    if (!roomId.trim()) {
      setError("Please enter a room ID")
      return
    }

    if (!adaptorRef.current) {
      setError("WebRTC not initialized. Please wait for connection.")
      return
    }

    const stream = await getLocalStream()
    if (!stream) {
      setError("Failed to access camera and microphone")
      return
    }

    adaptorRef.current.joinRoom(roomId.trim(), streamIdRef.current)
  }, [roomId, getLocalStream])

  const leaveConference = useCallback(() => {
    const adaptor = adaptorRef.current
    if (adaptor && roomIdRef.current && streamIdRef.current) {
      try {
        const adaptorWithWS = adaptor as WebRTCAdaptor & { websocket?: WebSocket }
        if (adaptorWithWS.websocket && adaptorWithWS.websocket.readyState === WebSocket.OPEN) {
          adaptor.leaveFromRoom(roomIdRef.current)
        }
        adaptor.stop(streamIdRef.current)
      } catch (e) {
        console.warn('Error leaving conference:', e)
      }
    }

    setIsInConference(false)
    setParticipants([])
    streamsByIdRef.current.forEach(ms => ms.getTracks().forEach(t => t.stop()))
    streamsByIdRef.current.clear()

    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
  }, [])

  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return
    const tracks = localStreamRef.current.getAudioTracks()
    tracks.forEach(t => t.enabled = isAudioMuted)
    setIsAudioMuted(v => !v)
  }, [isAudioMuted])

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return
    const tracks = localStreamRef.current.getVideoTracks()
    tracks.forEach(t => t.enabled = isVideoMuted)
    setIsVideoMuted(v => !v)
  }, [isVideoMuted])

  const fetchAvailableRooms = useCallback(async () => {
    setIsLoadingRooms(true)
    setError("")
    try {
      const httpUrl = antMediaUrl.replace('ws://', 'http://').replace('wss://', 'https://')
      const apiUrl = `${httpUrl}/rest/v2/rooms/list/0/50`
      const res = await fetch(apiUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' }})
      if (res.ok) {
        const data = await res.json()
        const rooms = (data?.content ?? []).map((room: { roomId: string; name?: string; status: string }) => ({
          id: room.roomId,
          name: room.name || room.roomId,
          status: room.status
        }))
        setAvailableRooms(rooms)
      } else {
        setAvailableRooms([])
      }
    } catch {
      setAvailableRooms([])
    } finally {
      setIsLoadingRooms(false)
    }
  }, [antMediaUrl])

  // When participants list changes, (re)attach MediaStreams to their <video>s (covers tiles rendered after tracks)
  useEffect(() => {
    participants.forEach(p => {
      const video = document.getElementById(`remote_${p.id}`) as HTMLVideoElement | null
      const ms = streamsByIdRef.current.get(p.id)
      if (video && ms && video.srcObject !== ms) {
        video.srcObject = ms
        video.play().catch(() => {})
      }
    })
  }, [participants])

  // Initialize WebRTC adaptor once
  useEffect(() => {
    let mounted = true
    const init = async () => {
      if (!mounted || isInitializedRef.current) return
      try {
        isInitializedRef.current = true
        const adaptor = new WebRTCAdaptor({
          websocket_url: antMediaUrlRef.current,
          mediaConstraints: { video: { width: 640, height: 480 }, audio: true },
          peerconnection_config: {
            iceServers: [
              { urls: "stun:stun1.l.google.com:19302" },
              { urls: "stun:stun2.l.google.com:19302" }
            ]
          },
          localVideoId: "localVideo",
          debug: true,
          callback: (info: string, obj: unknown) => handleWebRTCCallbackRef.current?.(info, obj),
          callbackError: (err: string, obj: unknown) => handleWebRTCErrorRef.current?.(err, obj)
        })
        adaptorRef.current = adaptor
      } catch (e) {
        console.error('Error initializing WebRTC:', e)
        setError("Failed to initialize WebRTC. Please check your connection.")
        isInitializedRef.current = false
      }
    }
    init()

    return () => {
      mounted = false
      const adaptor = adaptorRef.current
      if (adaptor) {
        try {
          const a = adaptor as WebRTCAdaptor & { websocket?: WebSocket }
          if (roomIdRef.current && streamIdRef.current && a.websocket && a.websocket.readyState === WebSocket.OPEN) {
            adaptor.leaveFromRoom(roomIdRef.current)
          }
          if (streamIdRef.current) adaptor.stop(streamIdRef.current)
        } catch (e) {
          console.warn('Error during cleanup:', e)
        }
      }
      // stop local + remote tracks
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop())
      streamsByIdRef.current.forEach(ms => ms.getTracks().forEach(t => t.stop()))
      streamsByIdRef.current.clear()

      adaptorRef.current = null
      isInitializedRef.current = false
      setIsConnected(false)
      setIsInConference(false)
      setParticipants([])
      streamIdRef.current = ""
    }
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800">
        <div>
          <h2 className="text-xl font-semibold">Video Conference</h2>
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
              onClick={async () => {
                setError("")
                await joinConference()
              }}
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
          <Button
            variant="outline"
            onClick={fetchAvailableRooms}
            disabled={isLoadingRooms}
            className="mb-1"
          >
            <Search size={16} className="mr-2" />
            {isLoadingRooms ? 'Loading...' : 'Find Rooms'}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-600 text-white p-4 m-4 rounded-lg">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Available Rooms */}
      {availableRooms.length > 0 && (
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <h3 className="text-lg font-semibold mb-3">Available Conference Rooms</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableRooms.map((room) => (
              <div
                key={room.id}
                className="bg-gray-700 p-3 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
                onClick={() => setRoomId(room.id)}
              >
                <div className="font-medium text-sm">{room.name}</div>
                <div className="text-xs text-gray-400 mt-1">ID: {room.id}</div>
                <div className="text-xs mt-1">
                  <span className={`px-2 py-1 rounded ${
                    room.status === 'active' ? 'bg-green-600 text-green-100' : 'bg-gray-600 text-gray-300'
                  }`}>
                    {room.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Video Area */}
      <div className="flex-1 p-4">
        <div className="relative bg-gray-800 rounded-lg overflow-hidden h-full">
          {/* Hidden input video for adaptor */}
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
              {/* Local preview */}
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
                    if (el && localVideoRef.current?.srcObject && el.srcObject !== localVideoRef.current.srcObject) {
                      el.srcObject = localVideoRef.current.srcObject
                      el.play().catch(() => {})
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

              {/* Remote tiles */}
              {participants.map((participant) => (
                <div key={participant.id} className="relative bg-gray-700 rounded-lg overflow-hidden">
                  <video
                    id={`remote_${participant.id}`}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ backgroundColor: '#374151' }}
                  />
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

      {/* Video Debugger */}
      <VideoDebugger
        videoRef={localVideoRef}
        streamId={streamIdRef.current}
        title="Participant Video Debug"
      />

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

export default StreamJoiner
