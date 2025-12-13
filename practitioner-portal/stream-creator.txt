import React, { useEffect, useRef, useState, useCallback } from "react"
import { WebRTCAdaptor } from "@antmedia/webrtc_adaptor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mic, MicOff, Video, VideoOff, Play, Square, Settings } from "lucide-react"
import VideoDebugger from "./VideoDebugger"

interface StreamCreatorProps {
  antMediaUrl: string
}

interface Participant {
  id: string
  name: string
  isVideoEnabled: boolean
  isAudioEnabled: boolean
}

const StreamCreator: React.FC<StreamCreatorProps> = ({ antMediaUrl }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const adaptorRef = useRef<WebRTCAdaptor | null>(null)
  const isInitializedRef = useRef<boolean>(false)
  const antMediaUrlRef = useRef<string>(antMediaUrl)
  const roomIdRef = useRef<string>("")
  const streamIdRef = useRef<string>("")
  const localStreamRef = useRef<MediaStream | null>(null)

  // remoteId -> assembled MediaStream (audio+video tracks)
  const streamsByIdRef = useRef<Map<string, MediaStream>>(new Map())

  const [isHosting, setIsHosting] = useState(false)
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [roomId, setRoomId] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [participants, setParticipants] = useState<Participant[]>([])

  // keep refs in sync
  antMediaUrlRef.current = antMediaUrl
  roomIdRef.current = roomId

  // create unique stream id once
  useEffect(() => {
    if (!streamIdRef.current) {
      streamIdRef.current = `host_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }, [])

  // ===== Local media =====
  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      })
      localStreamRef.current = stream

      // feed the adaptor's input element
      if (localVideoRef.current) {
        const el = localVideoRef.current
        el.srcObject = stream
        el.load()
        el.play().catch(() => {})
      }
      return stream
    } catch (err) {
      console.error("Media error:", err)
      setError("Failed to access camera/microphone. Check permissions.")
      return null
    }
  }, [])

  // ===== Stable callback refs for the adaptor =====
  const handleWebRTCErrorRef = useRef<(err: string, obj: unknown) => void>(() => {})
  const handleWebRTCCallbackRef = useRef<(info: string, obj: unknown) => void>(() => {})

  const handleWebRTCError = useCallback((err: string) => {
    console.error("WebRTC Error:", err)
    switch (err) {
      case "websocketConnectionFailed":
        setError("Failed to connect to streaming server.")
        break
      case "notSetLocalDescription":
        setError("Failed to start WebRTC (local description).")
        break
      case "noStreamNameSpecified":
        setError("No stream name specified.")
        break
      default:
        setError(`Streaming error: ${err}`)
    }
  }, [])

  const handleWebRTCCallback = useCallback((info: string, obj: any) => {
    switch (info) {
      case "initialized": {
        setIsConnected(true)
        setError("")
        break
      }

      case "joinedTheRoom": {
        setIsHosting(true)
        setError("")

        // Publish self
        adaptorRef.current?.publish(streamIdRef.current)

        // Play the entire room once to receive tracks for everyone (present + future)
        adaptorRef.current?.play(roomIdRef.current, "", roomIdRef.current, [])

        // Render tiles for already-present participants (tracks will come via newTrackAvailable)
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
        // Someone new joined; create a tile only (no per-stream play)
        const sid = obj?.streamId as string | undefined
        if (sid && sid !== streamIdRef.current) {
          setParticipants(prev =>
            prev.some(p => p.id === sid)
              ? prev
              : [...prev, { id: sid, name: `Participant ${sid.slice(-4)}`, isVideoEnabled: true, isAudioEnabled: true }]
          )
        }
        break
      }

      case "newTrackAvailable": {
        const streamId: string = obj?.streamId
        const track: MediaStreamTrack = obj?.track
        if (!streamId || streamId === streamIdRef.current || !track) break

        // Ensure tile exists
        setParticipants(prev => {
          if (prev.some(p => p.id === streamId)) return prev
          return [...prev, {
            id: streamId,
            name: `Participant ${streamId.slice(-4)}`,
            isVideoEnabled: track.kind === "video",
            isAudioEnabled: track.kind === "audio"
          }]
        })

        // Ensure persistent MediaStream for this remote
        let ms = streamsByIdRef.current.get(streamId)
        if (!ms) {
          ms = new MediaStream()
          streamsByIdRef.current.set(streamId, ms)
        }
        if (!ms.getTracks().some(t => t.id === track.id)) {
          ms.addTrack(track)
        }

        // Attach to the tile video once it exists
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

        // Clean up when this track ends
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

      default:
        // noop
        break
    }
  }, [])

  handleWebRTCErrorRef.current = handleWebRTCError
  handleWebRTCCallbackRef.current = handleWebRTCCallback

  // ===== Host controls =====
  const startConference = useCallback(async () => {
    if (!roomId.trim()) {
      // generate a room if empty (host convenience)
      const rid = `room_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      setRoomId(rid)
      roomIdRef.current = rid
    }

    if (!adaptorRef.current) {
      setError("WebRTC not initialized yet.")
      return
    }

    const stream = await getLocalStream()
    if (!stream) {
      setError("Local media not available.")
      return
    }

    adaptorRef.current.joinRoom(roomIdRef.current, streamIdRef.current)
  }, [getLocalStream, roomId])

  const stopConference = useCallback(() => {
    const adaptor = adaptorRef.current
    try {
      if (adaptor && roomIdRef.current && streamIdRef.current) {
        const a = adaptor as WebRTCAdaptor & { websocket?: WebSocket }
        if (a.websocket && a.websocket.readyState === WebSocket.OPEN) {
          adaptor.leaveFromRoom(roomIdRef.current)
        }
        adaptor.stop(streamIdRef.current)
      }
    } catch (e) {
      console.warn("Stop error:", e)
    }

    setIsHosting(false)
    setParticipants([])
    // stop remote & local tracks
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
    tracks.forEach(t => (t.enabled = isAudioMuted))
    setIsAudioMuted(v => !v)
  }, [isAudioMuted])

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return
    const tracks = localStreamRef.current.getVideoTracks()
    tracks.forEach(t => (t.enabled = isVideoMuted))
    setIsVideoMuted(v => !v)
  }, [isVideoMuted])

  // Re-attach remote MediaStreams when participant tiles render (covers already-present participants)
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

  // Initialize adaptor once
  useEffect(() => {
    let mounted = true
    const init = () => {
      if (!mounted || isInitializedRef.current) return
      try {
        isInitializedRef.current = true
        const adaptor = new WebRTCAdaptor({
          websocket_url: antMediaUrlRef.current,
          mediaConstraints: { video: { width: 1280, height: 720 }, audio: true },
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
        console.error("Init error:", e)
        setError("Failed to initialize WebRTC.")
        isInitializedRef.current = false
      }
    }
    init()

    return () => {
      mounted = false
      const adaptor = adaptorRef.current
      try {
        if (adaptor) {
          const a = adaptor as WebRTCAdaptor & { websocket?: WebSocket }
          if (roomIdRef.current && streamIdRef.current && a.websocket && a.websocket.readyState === WebSocket.OPEN) {
            adaptor.leaveFromRoom(roomIdRef.current)
          }
          if (streamIdRef.current) adaptor.stop(streamIdRef.current)
        }
      } catch (e) {
        console.warn("Cleanup error:", e)
      }
      // stop all tracks
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop())
      streamsByIdRef.current.forEach(ms => ms.getTracks().forEach(t => t.stop()))
      streamsByIdRef.current.clear()

      adaptorRef.current = null
      isInitializedRef.current = false
      setIsHosting(false)
      setIsConnected(false)
      setParticipants([])
      streamIdRef.current = ""
    }
  }, [])

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
              disabled={!isConnected}
              title="Start hosting"
            >
              <Play size={16} />
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={stopConference}
              className="rounded-full w-10 h-10 ml-2"
              title="Stop hosting"
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
              placeholder="Enter or generate a room ID"
              className="mt-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              disabled={isHosting}
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-600 text-white p-4 m-4 rounded-lg">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
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
              backgroundColor: "#000",
              minHeight: "200px",
              minWidth: "200px",
              border: "2px solid #00ff00",
              borderRadius: "8px",
              position: isHosting ? "absolute" : "relative",
              top: isHosting ? "-9999px" : "auto",
              left: isHosting ? "-9999px" : "auto",
              zIndex: isHosting ? -1 : 1
            }}
          />

          {isHosting ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full p-4">
              {/* Host preview */}
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
                    backgroundColor: "#000",
                    minHeight: "200px",
                    minWidth: "200px",
                    border: "2px solid #00ff00",
                    borderRadius: "8px"
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

              {/* Remote participants */}
              {participants.map((participant) => (
                <div key={participant.id} className="relative bg-gray-700 rounded-lg overflow-hidden">
                  <video
                    id={`remote_${participant.id}`}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ backgroundColor: "#374151" }}
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
                <Settings />
              </div>
              <p className="text-gray-400 text-lg mb-2">
                {roomId ? "Click play to start hosting conference" : "Enter a room ID to host conference"}
              </p>
              <p className="text-gray-500 text-sm">
                {isConnected ? "Connected to server" : "Connecting to server..."}
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
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
              <span>{isConnected ? "Connected" : "Connecting..."}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Video Debugger */}
      <VideoDebugger videoRef={localVideoRef} streamId={streamIdRef.current} title="Host Video Debug" />

      {/* Info */}
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
              <span className={`ml-2 ${isHosting ? "text-green-400" : "text-yellow-400"}`}>
                {isHosting ? "Hosting" : "Ready"}
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
          </div>
        </div>
      )}
    </div>
  )
}

export default StreamCreator
