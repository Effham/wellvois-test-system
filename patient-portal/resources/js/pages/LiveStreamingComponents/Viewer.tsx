import React, { useRef, useEffect } from "react";

const Viewer = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  let pc: RTCPeerConnection;

  useEffect(() => {
    const startPlaying = async () => {
      pc = new RTCPeerConnection();

      // When remote stream is available, show it
      pc.ontrack = (event) => {
        if (videoRef.current) videoRef.current.srcObject = event.streams[0];
      };

      const ws = new WebSocket("wss://YOUR_ANT_MEDIA_SERVER:5443/WebRTCAppEE/websocket?streamId=stream1");

      ws.onopen = async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        ws.send(JSON.stringify({
          command: "play",
          streamId: "stream1",
          sdp: offer.sdp,
          type: "offer"
        }));
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "answer") {
          await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
        }
      };
    };

    startPlaying();
  }, []);

  return (
    <div>
      <h2>Live Viewer</h2>
      <video ref={videoRef} autoPlay playsInline controls />
    </div>
  );
};

export default Viewer;
