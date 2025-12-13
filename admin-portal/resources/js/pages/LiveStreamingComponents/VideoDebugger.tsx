import React, { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"

interface VideoDebuggerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  streamId: string
  title: string
}

const VideoDebugger: React.FC<VideoDebuggerProps> = ({ videoRef, streamId, title }) => {
  const [debugInfo, setDebugInfo] = useState<Record<string, string | number | boolean>>({})

  const updateDebugInfo = useCallback(() => {
    if (videoRef.current) {
      const video = videoRef.current
      setDebugInfo({
        streamId,
        srcObject: !!video.srcObject,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState,
        paused: video.paused,
        muted: video.muted,
        currentTime: video.currentTime,
        duration: video.duration,
        networkState: video.networkState,
        error: video.error?.message || 'None'
      })
    }
  }, [videoRef, streamId])

  useEffect(() => {
    const interval = setInterval(updateDebugInfo, 1000)
    return () => clearInterval(interval)
  }, [updateDebugInfo])

  const forcePlay = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(err => console.warn('Force play failed:', err))
    }
  }

  const reloadVideo = () => {
    if (videoRef.current) {
      videoRef.current.load()
      videoRef.current.play().catch(err => console.warn('Reload play failed:', err))
    }
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg m-2">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><strong>Stream ID:</strong> {debugInfo.streamId}</div>
        <div><strong>Has Stream:</strong> {debugInfo.srcObject ? '✅' : '❌'}</div>
        <div><strong>Dimensions:</strong> {debugInfo.videoWidth}x{debugInfo.videoHeight}</div>
        <div><strong>Ready State:</strong> {debugInfo.readyState}</div>
        <div><strong>Paused:</strong> {debugInfo.paused ? 'Yes' : 'No'}</div>
        <div><strong>Muted:</strong> {debugInfo.muted ? 'Yes' : 'No'}</div>
        <div><strong>Current Time:</strong> {typeof debugInfo.currentTime === 'number' ? debugInfo.currentTime.toFixed(2) : debugInfo.currentTime}s</div>
        <div><strong>Duration:</strong> {typeof debugInfo.duration === 'number' ? debugInfo.duration.toFixed(2) : debugInfo.duration}s</div>
        <div><strong>Network State:</strong> {debugInfo.networkState}</div>
        <div><strong>Error:</strong> {debugInfo.error}</div>
      </div>
      <div className="flex gap-2 mt-2">
        <Button size="sm" onClick={updateDebugInfo}>Refresh Info</Button>
        <Button size="sm" onClick={forcePlay}>Force Play</Button>
        <Button size="sm" onClick={reloadVideo}>Reload Video</Button>
      </div>
    </div>
  )
}

export default VideoDebugger
