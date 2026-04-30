// src/components/QrScannerModal.jsx — Camera-based QR code reader
//
// Opens the rear camera, scans frames with jsQR, and extracts the ?gs= param
// from the scanned URL. Calls onScanned(gsParam) on success — never navigates.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import jsQR   from 'jsqr';
import { Modal } from './shared/Modal';

export function QrScannerModal({ isOpen, onClose, onScanned }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const doneRef   = useRef(false); // prevents multiple onScanned calls per open

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  // ── Stop camera & RAF whenever the modal closes ──────────────────────────
  const stopCamera = useCallback(() => {
    if (rafRef.current)    { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setReady(false);
  }, []);

  // ── Start camera when modal opens ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) { stopCamera(); return; }
    doneRef.current = false;
    setError(null);
    setReady(false);

    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => { if (!cancelled) setReady(true); });
        }
      })
      .catch(() => {
        if (!cancelled) setError('Camera access denied. Enable camera permissions and try again.');
      });

    return () => { cancelled = true; stopCamera(); };
  }, [isOpen, stopCamera]);

  // ── Scan loop — runs while camera is ready ───────────────────────────────
  useEffect(() => {
    if (!ready) return;

    const scan = () => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || doneRef.current) return;

      if (video.readyState >= 2 && video.videoWidth > 0) {
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0);
        const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });

        if (code?.data) {
          // Try to parse as a full URL and extract ?gs=
          let gsParam = null;
          try {
            const url = new URL(code.data);
            gsParam = url.searchParams.get('gs');
          } catch {
            // If not a valid URL, treat the raw value as the gs param directly
            gsParam = code.data.startsWith('gs=') ? code.data.slice(3) : code.data;
          }

          if (gsParam) {
            doneRef.current = true;
            stopCamera();
            onScanned(gsParam);
            return; // do not request next frame
          }
        }
      }

      rafRef.current = requestAnimationFrame(scan);
    };

    rafRef.current = requestAnimationFrame(scan);
    return () => { if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [ready, onScanned, stopCamera]);

  const handleClose = useCallback(() => { stopCamera(); onClose(); }, [stopCamera, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Scan Lobby QR Code">
      <div className="flex flex-col items-center gap-4">
        {error ? (
          <div className="w-full rounded-2xl bg-red-950/30 border border-red-800/40 p-4 text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : (
          <>
            {/* Camera viewport */}
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-zinc-900">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Scanning frame overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-3/4 rounded-2xl"
                  style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)', borderRadius: '1rem' }}
                />
                <div className="absolute w-3/4 h-3/4 border-2 border-white/50 rounded-2xl" />
                {/* Corner accents */}
                {[
                  'top-[12.5%] left-[12.5%] border-t-2 border-l-2 rounded-tl-2xl',
                  'top-[12.5%] right-[12.5%] border-t-2 border-r-2 rounded-tr-2xl',
                  'bottom-[12.5%] left-[12.5%] border-b-2 border-l-2 rounded-bl-2xl',
                  'bottom-[12.5%] right-[12.5%] border-b-2 border-r-2 rounded-br-2xl',
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-6 h-6 border-white ${cls}`} />
                ))}
              </div>
              {/* Loading indicator before stream is ready */}
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
                  <p className="text-zinc-400 text-sm">Starting camera…</p>
                </div>
              )}
            </div>

            {/* Off-screen canvas used for frame processing — not display:none (breaks WebKit pixel reads) */}
            <canvas ref={canvasRef} style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: 1, height: 1 }} />

            <p className="text-xs text-zinc-500 text-center">
              Point your camera at the QR code shown on the pregame screen
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
