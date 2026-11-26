import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, AlertCircle, X, RefreshCw, UserCheck } from 'lucide-react';
import { loadFaceApi } from './faceApiLoader';

const LOCAL_MODEL_URL = '/models/';
const CDN_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

// Must match the <circle r="..."> below exactly, or the ring's fill amount
// drifts from the scanProgress percentage it's meant to represent.
const RING_RADIUS = 100;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// TensorFlow.js needs a working compute backend before any model can run.
// Some machines/browsers don't support WebGL, and the WASM backend's binary
// can fail to load on a dev server that doesn't serve .wasm with the right
// MIME type (it silently gets an HTML 404 page instead, which then fails to
// parse as WebAssembly) - without this, every detection call throws "load
// model before inference" and the scan circle never progresses past 0%.
// 'cpu' is pure JS, so it always works as a last resort (just slower).
let tfBackendReadyPromise = null;
export async function ensureTfBackendReady(api) {
  if (!api || !api.tf) return false;
  if (tfBackendReadyPromise) return tfBackendReadyPromise;
  tfBackendReadyPromise = (async () => {
    const tf = api.tf;
    let hasWebGL = false;
    try {
      const testCanvas = document.createElement('canvas');
      hasWebGL = !!(testCanvas.getContext('webgl2') || testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl'));
    } catch (e) {
      hasWebGL = false;
    }

    const candidates = hasWebGL ? ['webgl', 'cpu'] : ['cpu'];
    for (const backend of candidates) {
      try {
        await tf.setBackend(backend);
        await tf.ready();
        if (tf.getBackend() === backend) return true;
      } catch (e) {
        console.warn(`TensorFlow backend '${backend}' unavailable, falling back...`);
      }
    }
    return false;
  })();
  return tfBackendReadyPromise;
}

let faceModelsPromise = null;
let coreModelsPromise = null;

export async function ensureFaceModelsLoaded(api, includeRecognition = true) {
  if (!api || !api.nets) return;
  if (!includeRecognition && coreModelsPromise) return coreModelsPromise;
  if (includeRecognition && faceModelsPromise) return faceModelsPromise;

  const loadTask = (async () => {
    await ensureTfBackendReady(api);
    const loadNets = async (url) => {
      const promises = [];
      if (!api.nets.tinyFaceDetector.isLoaded) {
        promises.push(api.nets.tinyFaceDetector.loadFromUri(url));
      }
      if (api.nets.faceLandmark68TinyNet && !api.nets.faceLandmark68TinyNet.isLoaded) {
        promises.push(api.nets.faceLandmark68TinyNet.loadFromUri(url));
      }
      if (includeRecognition && api.nets.faceRecognitionNet && !api.nets.faceRecognitionNet.isLoaded) {
        promises.push(api.nets.faceRecognitionNet.loadFromUri(url));
      }
      if (promises.length > 0) {
        await Promise.all(promises);
      }
    };

    try {
      await loadNets(LOCAL_MODEL_URL);
    } catch (eLocal) {
      try {
        await loadNets(CDN_MODEL_URL);
      } catch (eCdn) {
        console.warn("Face model loading warning:", eCdn);
      }
    }
  })();

  if (includeRecognition) {
    faceModelsPromise = loadTask;
  } else {
    coreModelsPromise = loadTask;
  }
  return loadTask;
}

export async function preloadFaceBiometrics() {
  try {
    const api = window.faceapi || await loadFaceApi();
    if (api) {
      await ensureFaceModelsLoaded(api);
    }
  } catch (err) {
    console.warn("Background biometric preload notice:", err);
  }
}


export default function FaceScanModalCapture({ 
  onFaceCaptured,
  title = "Biometric Face Scan",
  description = "Center face scan required to activate attendance profile.",
  buttonText = "Open Face Scanner",
  resetOnCapture = false,
  autoCapture = false,
  isDarkMode = false,
  currentUserDescriptor = null,
  currentUserName = "Employee",
  allRegisteredDescriptors = [],
  mode = "punch",
  disabled = false,
  disabledMessage = "Complete the previous step first.",
  expectedGender = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const autoCapturedRef = useRef(false);
  const handleCaptureRef = useRef(null);
  const scanProgressRef = useRef(0);
  const scanIntervalRef = useRef(null);
  const blinkTimerRef = useRef(null);
  const latestDescriptorRef = useRef(null);

  const prevFaceRef = useRef(null);
  const regStageRef = useRef(1);
  const [regStep, setRegStep] = useState(1);

  // Eye-blink liveness state (blocks printed / mobile screen photos)
  const earSamplesRef = useRef([]);
  const earBaselineRef = useRef(null);
  const closedEarRef = useRef(null);
  const eyeLumaSamplesRef = useRef([]);
  const eyeLumaBaselineRef = useRef(null);
  const eyeRegionRef = useRef(null);
  const eyeBasePixelsRef = useRef(null);
  const prevCheekPixelsRef = useRef(null);
  const prevFaceBoxRef = useRef(null);
  const eyesClosedAtRef = useRef(null);
  const blinkStateRef = useRef('waiting_open'); // 'waiting_open' | 'eyes_closed' | 'blinked'
  const blinkFrameBlobRef = useRef(null);
  const livenessPromptAtRef = useRef(null);
  const [blinkVerified, setBlinkVerified] = useState(false);

  const resetLivenessState = () => {
    earSamplesRef.current = [];
    earBaselineRef.current = null;
    closedEarRef.current = null;
    eyeLumaSamplesRef.current = [];
    eyeLumaBaselineRef.current = null;
    eyeRegionRef.current = null;
    eyeBasePixelsRef.current = null;
    prevCheekPixelsRef.current = null;
    prevFaceBoxRef.current = null;
    eyesClosedAtRef.current = null;
    blinkStateRef.current = 'waiting_open';
    blinkFrameBlobRef.current = null;
    livenessPromptAtRef.current = null;
    setBlinkVerified(false);
  };

  // Synchronous JPEG Blob capture so liveness frame is never null when handleCapture runs
  const captureVideoBlobSync = (video, quality = 0.82) => {
    try {
      const w = video?.videoWidth || 640;
      const h = video?.videoHeight || 480;
      if (!w || !h) return null;
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = w;
      snapCanvas.height = h;
      const sCtx = snapCanvas.getContext('2d');
      sCtx.translate(w, 0);
      sCtx.scale(-1, 1);
      sCtx.drawImage(video, 0, 0, w, h);
      const dataUrl = snapCanvas.toDataURL('image/jpeg', quality);
      const parts = dataUrl.split(';base64,');
      const raw = window.atob(parts[1]);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i);
      }
      return new Blob([bytes], { type: 'image/jpeg' });
    } catch (e) {
      return null;
    }
  };

  // Stop camera tracks cleanly
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (blinkTimerRef.current) {
      clearInterval(blinkTimerRef.current);
      blinkTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Start camera when modal opens
  useEffect(() => {
    let active = true;

    async function startScanner() {
      if (!isOpen) {
        stopCamera();
        prevFaceRef.current = null;
        regStageRef.current = 1;
        setRegStep(1);
        resetLivenessState();
        return;
      }

      setLoading(true);
      setErrorMessage('');
      autoCapturedRef.current = false;
      scanProgressRef.current = 0;
      prevFaceRef.current = null;
      regStageRef.current = 1;
      setRegStep(1);
      setScanProgress(0);
      resetLivenessState();

      try {
        const modelsPromise = (async () => {
          let api = window.faceapi;
          if (!api) {
            try { api = await loadFaceApi(); } catch (error) { console.warn("Face scanner library unavailable:", error); }
          }
          await ensureFaceModelsLoaded(api, mode === 'register');
        })();

        const cameraPromise = navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });

        const [, stream] = await Promise.all([modelsPromise, cameraPromise]);

        if (active) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setErrorMessage('Camera access was denied or face model failed to load.');
        setLoading(false);
      }
    }

    startScanner();

    return () => {
      active = false;
      stopCamera();
    };
  }, [isOpen]);

  const [faceStatus, setFaceStatus] = useState({ valid: false, count: 0, isMismatch: false, isCovered: false, text: 'Align face inside the center circle' });

  const handleCapture = () => {
    if (!videoRef.current || faceStatus.isMismatch || faceStatus.isCovered) return;

    // Immediately stop scanning loop to free WebGL and CPU
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    const video = videoRef.current;
    // Fast path: use already-computed descriptor from the active scan loop (avoids 3-second freeze)
    const descriptorArray = latestDescriptorRef.current;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = video.videoWidth || 640;
    offCanvas.height = video.videoHeight || 480;
    const ctx = offCanvas.getContext('2d');

    // Mirror correction
    ctx.translate(offCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);

    const livenessBlob = blinkFrameBlobRef.current || captureVideoBlobSync(video, 0.80);
    // Stop camera and close scan modal IMMEDIATELY so the green circle completes and modal disappears without lag
    stopCamera();
    setIsOpen(false);

    offCanvas.toBlob((blob) => {
      const dataUrl = offCanvas.toDataURL('image/jpeg', 0.85);
      if (!resetOnCapture) {
        setCapturedImage(dataUrl);
      } else {
        setCapturedImage(null);
      }
      if (onFaceCaptured) onFaceCaptured(blob || dataUrl, descriptorArray, livenessBlob);
    }, 'image/jpeg', 0.85);
  };

  handleCaptureRef.current = handleCapture;

  const handleVideoPlay = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // The video element's native "play" event can fire more than once per
    // camera session (buffering/resume, re-renders re-attaching the handler,
    // etc). Without clearing the previous interval first, each firing started
    // a second, third, ... concurrent interval, all incrementing the same
    // scanProgressRef at once - so progress rocketed to 100% almost instantly
    // regardless of the per-tick increment, no matter how small it was set.
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (blinkTimerRef.current) {
      clearInterval(blinkTimerRef.current);
      blinkTimerRef.current = null;
    }

    const api = window.faceapi;
    const displaySize = { width: video.clientWidth || 480, height: video.clientHeight || 360 };
    if (api && api.matchDimensions) {
      api.matchDimensions(canvas, displaySize);
    } else {
      canvas.width = displaySize.width;
      canvas.height = displaySize.height;
    }

    // High-speed 22 FPS pure-canvas eye-blink sampler (works even on CPU-only devices without WebGL)
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 24;
    sampleCanvas.height = 10;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    blinkTimerRef.current = setInterval(() => {
      const region = eyeRegionRef.current;
      if (!region || !video || video.paused || video.ended || !isOpen || blinkStateRef.current === 'blinked') return;
      try {
        // 1. Sample cheek/bridge stability patch
        sampleCtx.drawImage(video, region.cheekX, region.cheekY, region.cheekW, region.cheekH, 0, 0, 24, 10);
        const cData = sampleCtx.getImageData(0, 0, 24, 10).data;
        const cheekLuma = new Float32Array(240);
        for (let i = 0, j = 0; i < cData.length; i += 4, j++) {
          cheekLuma[j] = 0.299 * cData[i] + 0.587 * cData[i + 1] + 0.114 * cData[i + 2];
        }
        let cheekDiff = 0;
        if (prevCheekPixelsRef.current) {
          for (let j = 0; j < 240; j++) cheekDiff += Math.abs(cheekLuma[j] - prevCheekPixelsRef.current[j]);
          cheekDiff /= 240;
        }
        prevCheekPixelsRef.current = cheekLuma;

        // 2. Sample eye bounding box
        sampleCtx.drawImage(video, region.minX, region.minY, region.w, region.h, 0, 0, 24, 10);
        const eData = sampleCtx.getImageData(0, 0, 24, 10).data;
        const eyeLuma = new Float32Array(240);
        let sum = 0;
        for (let i = 0, j = 0; i < eData.length; i += 4, j++) {
          const v = 0.299 * eData[i] + 0.587 * eData[i + 1] + 0.114 * eData[i + 2];
          eyeLuma[j] = v;
          sum += v;
        }
        const mean = sum / 240;
        let variance = 0;
        for (let j = 0; j < 240; j++) {
          const d = eyeLuma[j] - mean;
          variance += d * d;
        }
        const eyeContrast = Math.sqrt(variance / 240);

        // If whole photo/head is moving rapidly, reset open baseline so shaking a photo never passes
        if (cheekDiff > 6.5) {
          eyeBasePixelsRef.current = null;
          eyeLumaSamplesRef.current = [];
          return;
        }

        if (blinkStateRef.current === 'waiting_open') {
          if (!eyeBasePixelsRef.current) {
            eyeBasePixelsRef.current = eyeLuma;
            return;
          }
          if (eyeLumaSamplesRef.current.length < 6) {
            eyeLumaSamplesRef.current.push(eyeContrast);
            eyeLumaBaselineRef.current =
              eyeLumaSamplesRef.current.reduce((s, v) => s + v, 0) / eyeLumaSamplesRef.current.length;
          }
          let eyeDelta = 0;
          for (let j = 0; j < 240; j++) eyeDelta += Math.abs(eyeLuma[j] - eyeBasePixelsRef.current[j]);
          eyeDelta /= 240;

          const cBase = eyeLumaBaselineRef.current;
          const lumaBlink = eyeDelta > 5.2 && eyeDelta > cheekDiff * 1.7;
          const contrastBlink = cBase && eyeLumaSamplesRef.current.length >= 4 && eyeContrast < cBase * 0.87;
          if (lumaBlink || contrastBlink) {
            blinkStateRef.current = 'eyes_closed';
            eyesClosedAtRef.current = Date.now();
            const syncBlob = captureVideoBlobSync(video, 0.82);
            if (syncBlob) blinkFrameBlobRef.current = syncBlob;
          }
        } else if (blinkStateRef.current === 'eyes_closed') {
          let eyeDelta = 0;
          if (eyeBasePixelsRef.current) {
            for (let j = 0; j < 240; j++) eyeDelta += Math.abs(eyeLuma[j] - eyeBasePixelsRef.current[j]);
            eyeDelta /= 240;
          }
          const cBase = eyeLumaBaselineRef.current;
          const reopened =
            (eyeBasePixelsRef.current && eyeDelta < 4.5) ||
            (cBase && eyeContrast >= cBase * 0.93) ||
            (eyesClosedAtRef.current && Date.now() - eyesClosedAtRef.current > 180);
          if (reopened) {
            blinkStateRef.current = 'blinked';
            setBlinkVerified(true);
          }
        }
      } catch (e) {}
    }, 45);

    let isDetecting = false;
    const interval = setInterval(async () => {
      if (!video || video.paused || video.ended || !isOpen || isDetecting) return;
      isDetecting = true;
      try {

      let detections = [];
      let singleFaceDetection = null;

      // 1. Fast path: run lightweight detector + 68 landmarks while waiting for blink
      // Only run heavy faceRecognitionNet descriptor in register mode AFTER blink is verified (or once for duplicate check)
      const needsDescriptor = mode === 'register' && blinkStateRef.current === 'blinked' && api?.nets?.faceRecognitionNet?.isLoaded;
      if (api && api.detectSingleFace && api.nets?.tinyFaceDetector?.isLoaded) {
        try {
          const detectorOpts = new api.TinyFaceDetectorOptions({
            inputSize: needsDescriptor ? 224 : 160,
            scoreThreshold: 0.2,
          });
          const task = api.detectSingleFace(video, detectorOpts).withFaceLandmarks(true);
          singleFaceDetection = needsDescriptor ? await task.withFaceDescriptor() : await task;

          if (singleFaceDetection) {
            const resized = api.resizeResults ? api.resizeResults(singleFaceDetection, displaySize) : singleFaceDetection;
            detections = [resized];
          }
        } catch (e) {}
      }

      // 2. Fallback to detectAllFaces
      if (detections.length === 0 && api && api.detectAllFaces) {
        try {
          const rawDetections = await api.detectAllFaces(
            video,
            new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.2 })
          );
          detections = api.resizeResults ? api.resizeResults(rawDetections, displaySize) : rawDetections;
        } catch (e) {}
      }

      // 3. Fallback to native FaceDetector if available
      if (detections.length === 0 && 'FaceDetector' in window) {
        try {
          const nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
          const faces = await nativeDetector.detect(video);
          detections = faces.map(f => ({ box: f.boundingBox }));
        } catch (e) {}
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Keep canvas clean

      const detectedCount = detections.length;

      if (detectedCount > 1) {
        autoCapturedRef.current = false;
        scanProgressRef.current = 0;
        setScanProgress(0);
        setFaceStatus({ valid: false, count: detectedCount, isMismatch: true, isCovered: false, text: '⚠️ Multiple faces detected! Only 1 person allowed.' });
      } else if (detectedCount === 1) {
        const det = detections[0];
        const box = det.box || det.detection?.box || det;
        const faceCenterX = box.x + box.width / 2;
        const faceCenterY = box.y + box.height / 2;
        const viewCenterX = displaySize.width / 2;
        const viewCenterY = displaySize.height / 2;

        const deltaX = Math.abs(faceCenterX - viewCenterX);
        const deltaY = Math.abs(faceCenterY - viewCenterY);
        const isCentered = deltaX <= 120 && deltaY <= 120;
        const faceW = box.width || 100;
        const faceH = box.height || 100;
        const isTooFar = faceW < 90 || faceH < 90;

        // Check for face obstruction / mask / sunglasses / hand covering face
        let isCoveredFace = false;
        if (det.landmarks && det.landmarks.positions && det.landmarks.positions.length >= 68) {
          const mouth = typeof det.landmarks.getMouth === 'function' ? det.landmarks.getMouth() : null;
          const nose = typeof det.landmarks.getNose === 'function' ? det.landmarks.getNose() : null;
          const leftEye = typeof det.landmarks.getLeftEye === 'function' ? det.landmarks.getLeftEye() : null;
          const rightEye = typeof det.landmarks.getRightEye === 'function' ? det.landmarks.getRightEye() : null;
          if (!mouth || mouth.length < 6 || !nose || nose.length < 3 || !leftEye || leftEye.length < 4 || !rightEye || rightEye.length < 4) {
            isCoveredFace = true;
          } else {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            mouth.forEach(pt => {
              if (pt.x < minX) minX = pt.x;
              if (pt.x > maxX) maxX = pt.x;
              if (pt.y < minY) minY = pt.y;
              if (pt.y > maxY) maxY = pt.y;
            });
            const mouthW = maxX - minX;
            const mouthH = maxY - minY;

            if (mouthW < faceW * 0.10 || mouthH < faceH * 0.015) {
              isCoveredFace = true;
            }
          }
        }

        const parseDescriptor = (raw) => {
          if (!raw) return null;
          if (typeof raw === 'object' && !Array.isArray(raw)) {
            if (raw.descriptor) raw = raw.descriptor;
            else if (raw.face_descriptor) raw = raw.face_descriptor;
            else if (raw.face_encoding) raw = raw.face_encoding;
          }
          if (Array.isArray(raw) && raw.length === 128) return raw.map(Number);
          if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length === 128) return parsed.map(Number);
            } catch (e) {}
          }
          if (typeof raw === 'object') {
            const vals = Object.values(raw);
            if (vals.length === 128) return vals.map(Number);
          }
          return null;
        };

        let parsedUserDescriptor = parseDescriptor(currentUserDescriptor);
        if (!parsedUserDescriptor && allRegisteredDescriptors && allRegisteredDescriptors.length > 0) {
          const empMatch = allRegisteredDescriptors.find(e => 
            (currentUserName && e.full_name && String(e.full_name).toLowerCase() === String(currentUserName).toLowerCase()) ||
            (e.emp_id && String(e.emp_id).toLowerCase() === String(currentUserName).toLowerCase())
          );
          if (empMatch) {
            parsedUserDescriptor = parseDescriptor(empMatch.descriptor || empMatch.face_encoding || empMatch.face_descriptor);
          }
        }

        let liveDescriptor = det.descriptor ? Array.from(det.descriptor) : null;
        if (liveDescriptor) {
          latestDescriptorRef.current = liveDescriptor;
        }
        let isFaceMatched = true;
        let isDuplicateFace = false;
        let calculatedDistance = null;
        let hasNoProfilePhoto = false;

        // REAL-TIME DUPLICATE FACE CHECK FOR REGISTRATION
        if (mode === 'register' && liveDescriptor && allRegisteredDescriptors && allRegisteredDescriptors.length > 0) {
          const liveFloatArray = new Float32Array(liveDescriptor);
          for (const emp of allRegisteredDescriptors) {
            // Exclude self if employee code or name matches
            if (currentUserName && (
              (emp.full_name && String(emp.full_name).toLowerCase() === String(currentUserName).toLowerCase()) ||
              (emp.emp_id && String(emp.emp_id).toLowerCase() === String(currentUserName).toLowerCase())
            )) {
              continue;
            }
            const empDesc = parseDescriptor(emp.descriptor || emp.face_encoding || emp.face_descriptor);
            if (empDesc) {
              const targetArr = new Float32Array(empDesc);
              const d = api.euclideanDistance 
                ? api.euclideanDistance(liveFloatArray, targetArr) 
                : Math.sqrt(liveDescriptor.reduce((sum, val, idx) => sum + Math.pow(val - empDesc[idx], 2), 0));

              if (d < 0.30) {
                isDuplicateFace = true;
                break;
              }
            }
          }
        }

        // PUNCH MODE: the browser's live descriptor comes from face-api.js (a
        // TensorFlow.js model), while the stored, authoritative template is a
        // server-side dlib/face_recognition encoding - a different embedding
        // space entirely, so comparing the two distances client-side is not
        // meaningful (and the server deliberately never publishes the real
        // template to the browser - see RegisteredDescriptorsView). Capture
        // quality is checked here; identity is verified on the server.
        if (mode === 'punch') {
          isFaceMatched = true;
          hasNoProfilePhoto = false;
        }

        // 3D Head Turning & Orientation Detection (Straight -> Left -> Right)
        let isStraightHead = false;
        let isTurnedHead = false;
        let yawRatio = 0;

        if (det.landmarks && typeof det.landmarks.getLeftEye === 'function') {
          try {
            const leftEye = det.landmarks.getLeftEye();
            const rightEye = det.landmarks.getRightEye();
            const nose = det.landmarks.getNose();
            if (leftEye && rightEye && nose && nose.length >= 4) {
              const noseTip = nose[3];
              const leftX = leftEye.reduce((s, p) => s + p.x, 0) / leftEye.length;
              const rightX = rightEye.reduce((s, p) => s + p.x, 0) / rightEye.length;
              const distL = Math.abs(noseTip.x - leftX);
              const distR = Math.abs(rightX - noseTip.x);
              yawRatio = Math.abs(distR - distL) / (distL + distR + 0.0001);

              if (yawRatio <= 0.25) {
                isStraightHead = true;
              } else if (yawRatio >= 0.12) {
                isTurnedHead = true;
              }
            }
          } catch (e) {
            isStraightHead = true;
          }
        } else {
          isStraightHead = true;
        }

        if (isCoveredFace) {
          autoCapturedRef.current = false;
          scanProgressRef.current = 0;
          regStageRef.current = 1;
          setRegStep(1);
          setScanProgress(0);
          setFaceStatus({
            valid: false,
            count: 1,
            isMismatch: true,
            isCovered: true,
            text: '⚠️ Face covered! Ensure eyes, nose, and mouth are clearly visible.'
          });
        } else if (isDuplicateFace) {
          autoCapturedRef.current = false;
          scanProgressRef.current = 0;
          regStageRef.current = 1;
          setRegStep(1);
          setScanProgress(0);
          setFaceStatus({
            valid: false,
            count: 1,
            isMismatch: true,
            isCovered: false,
            text: 'This face is already registered in the system.'
          });

        } else if (hasNoProfilePhoto) {
          autoCapturedRef.current = false;
          scanProgressRef.current = 0;
          regStageRef.current = 1;
          setRegStep(1);
          setScanProgress(0);
          setFaceStatus({
            valid: false,
            count: 1,
            isMismatch: true,
            isCovered: false,
            text: '⚠️ Profile face not registered! Please register face photo.'
          });
        } else if (!isFaceMatched) {
          autoCapturedRef.current = false;
          scanProgressRef.current = 0;
          regStageRef.current = 1;
          setRegStep(1);
          setScanProgress(0);
          setFaceStatus({
            valid: false,
            count: 1,
            isMismatch: true,
            isCovered: false,
            text: '⚠️ Face Mismatch! (Not Matched)'
          });
        } else {
          // Shared Eye-Blink Liveness Helper (EAR + eye-region luma pulse, blocks printed & mobile screen photos)
          const updateBlinkLiveness = () => {
            if (blinkStateRef.current === 'blinked') return true;
            if (!livenessPromptAtRef.current) {
              livenessPromptAtRef.current = Date.now();
            }

            // Check head steadiness so shaking a photo doesn't trigger eye-region change
            let headMove = 0;
            if (prevFaceBoxRef.current) {
              headMove =
                Math.abs(box.x - prevFaceBoxRef.current.x) +
                Math.abs(box.y - prevFaceBoxRef.current.y) +
                Math.abs(box.width - prevFaceBoxRef.current.width);
            }
            prevFaceBoxRef.current = { x: box.x, y: box.y, width: box.width };

            const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
            const calcEAR = (eye) => {
              if (!eye || eye.length < 6) return null;
              const v1 = dist(eye[1], eye[5]);
              const v2 = dist(eye[2], eye[4]);
              const h = dist(eye[0], eye[3]);
              return h > 1e-4 ? (v1 + v2) / (2.0 * h) : null;
            };
            const leftEye = det.landmarks && typeof det.landmarks.getLeftEye === 'function' ? det.landmarks.getLeftEye() : null;
            const rightEye = det.landmarks && typeof det.landmarks.getRightEye === 'function' ? det.landmarks.getRightEye() : null;
            const leftEar = calcEAR(leftEye);
            const rightEar = calcEAR(rightEye);
            if (leftEar === null || rightEar === null) return false;

            // Update latest eye & cheek coordinates in video pixel space for the 22 FPS pure-canvas sampler
            try {
              const allEyePts = [...leftEye, ...rightEye];
              const scaleX = (video.videoWidth || 640) / displaySize.width;
              const scaleY = (video.videoHeight || 480) / displaySize.height;
              const minX = Math.max(0, Math.min(...allEyePts.map(p => p.x)) * scaleX - 4);
              const maxX = Math.min(video.videoWidth || 640, Math.max(...allEyePts.map(p => p.x)) * scaleX + 4);
              const minY = Math.max(0, Math.min(...allEyePts.map(p => p.y)) * scaleY - 4);
              const maxY = Math.min(video.videoHeight || 480, Math.max(...allEyePts.map(p => p.y)) * scaleY + 4);
              const w = maxX - minX;
              const h = maxY - minY;
              if (w > 12 && h > 4) {
                eyeRegionRef.current = {
                  minX,
                  minY,
                  w,
                  h,
                  cheekX: minX + w * 0.2,
                  cheekY: Math.min((video.videoHeight || 480) - h - 2, maxY + h * 0.8),
                  cheekW: w * 0.6,
                  cheekH: h,
                };
              }
            } catch (e) {}

            const avgEar = (leftEar + rightEar) / 2.0;

            // Sample grayscale contrast inside eye bounding box (catches blinks even when tiny landmarks smooth over)
            let eyeContrast = null;
            try {
              const allEyePts = [...leftEye, ...rightEye];
              const scaleX = (video.videoWidth || 640) / displaySize.width;
              const scaleY = (video.videoHeight || 480) / displaySize.height;
              const minX = Math.max(0, Math.min(...allEyePts.map(p => p.x)) * scaleX - 4);
              const maxX = Math.min(video.videoWidth || 640, Math.max(...allEyePts.map(p => p.x)) * scaleX + 4);
              const minY = Math.max(0, Math.min(...allEyePts.map(p => p.y)) * scaleY - 4);
              const maxY = Math.min(video.videoHeight || 480, Math.max(...allEyePts.map(p => p.y)) * scaleY + 4);
              const w = maxX - minX;
              const h = maxY - minY;
              if (w > 12 && h > 4) {
                const eyeCanvas = document.createElement('canvas');
                eyeCanvas.width = 24;
                eyeCanvas.height = 10;
                const eCtx = eyeCanvas.getContext('2d');
                eCtx.drawImage(video, minX, minY, w, h, 0, 0, 24, 10);
                const px = eCtx.getImageData(0, 0, 24, 10).data;
                let sum = 0;
                const vals = [];
                for (let i = 0; i < px.length; i += 4) {
                  const luma = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
                  vals.push(luma);
                  sum += luma;
                }
                const mean = sum / vals.length;
                let variance = 0;
                for (let i = 0; i < vals.length; i++) {
                  const d = vals[i] - mean;
                  variance += d * d;
                }
                eyeContrast = Math.sqrt(variance / vals.length);
              }
            } catch (e) {}

            if (blinkStateRef.current === 'waiting_open') {
              if (headMove < 10 && earSamplesRef.current.length < 6 && avgEar > 0.14) {
                earSamplesRef.current.push(avgEar);
                const mean = earSamplesRef.current.reduce((s, v) => s + v, 0) / earSamplesRef.current.length;
                earBaselineRef.current = Math.max(0.18, mean);
              }
              if (headMove < 10 && eyeContrast !== null && eyeLumaSamplesRef.current.length < 6) {
                eyeLumaSamplesRef.current.push(eyeContrast);
                const cMean = eyeLumaSamplesRef.current.reduce((s, v) => s + v, 0) / eyeLumaSamplesRef.current.length;
                eyeLumaBaselineRef.current = cMean;
              }

              const baseline = earBaselineRef.current || 0.26;
              const earDropped = earSamplesRef.current.length >= 3 && avgEar < baseline * 0.87;
              const cBase = eyeLumaBaselineRef.current;
              // When eyelid closes over dark iris/pupil, contrast inside eye box drops cleanly
              const contrastDropped = headMove < 8 && cBase && eyeContrast !== null && eyeLumaSamplesRef.current.length >= 4 && eyeContrast < cBase * 0.88;

              if (earDropped || contrastDropped) {
                blinkStateRef.current = 'eyes_closed';
                closedEarRef.current = avgEar;
                eyesClosedAtRef.current = Date.now();
                // Capture the blink-moment frame synchronously for backend 2-frame liveness verification
                const syncBlob = captureVideoBlobSync(video, 0.82);
                if (syncBlob) blinkFrameBlobRef.current = syncBlob;
              }
            } else if (blinkStateRef.current === 'eyes_closed') {
              const baseline = earBaselineRef.current || 0.26;
              const closedEar = closedEarRef.current || baseline * 0.82;
              const earReopened = avgEar >= Math.max(closedEar * 1.06, baseline * 0.91);
              const cBase = eyeLumaBaselineRef.current;
              const contrastReopened = cBase && eyeContrast !== null && eyeContrast >= cBase * 0.93;
              const heldClosedLongEnough = eyesClosedAtRef.current && (Date.now() - eyesClosedAtRef.current) > 220 && avgEar >= closedEar;

              if (earReopened || contrastReopened || heldClosedLongEnough) {
                blinkStateRef.current = 'blinked';
                setBlinkVerified(true);
                return true;
              }
            }
            return false;
          };

          if (mode === 'register') {
            if (isTooFar) {
              setFaceStatus({
                valid: false,
                count: 1,
                isMismatch: false,
                isCovered: false,
                text: '🔍 Move closer to the camera'
              });
            } else if (isStraightHead && isCentered) {
              const blinked = updateBlinkLiveness();
              if (!blinked) {
                scanProgressRef.current = Math.min(45, scanProgressRef.current + 6.0);
                const p = Math.floor(scanProgressRef.current);
                setScanProgress(p);
                const elapsed = livenessPromptAtRef.current ? (Date.now() - livenessPromptAtRef.current) : 0;
                setFaceStatus({
                  valid: false,
                  count: 1,
                  isMismatch: false,
                  isCovered: false,
                  text: elapsed > 6000
                    ? '👀 Blink your eyes clearly (remove dark glasses if needed)'
                    : '👀 Blink your eyes once to verify live face'
                });
              } else {
                scanProgressRef.current = Math.min(100, Math.max(45, scanProgressRef.current) + 12.0);
                const p = Math.floor(scanProgressRef.current);
                setScanProgress(p);

                if (p >= 100) {
                  setScanProgress(100);
                  setFaceStatus({
                    valid: true,
                    count: 1,
                    isMismatch: false,
                    isCovered: false,
                    text: '✓ Live Biometric Scan Complete (100%) — Registering...'
                  });

                  if (autoCapture && !autoCapturedRef.current) {
                    autoCapturedRef.current = true;
                    if (scanIntervalRef.current) {
                      clearInterval(scanIntervalRef.current);
                      scanIntervalRef.current = null;
                    }
                    if (handleCaptureRef.current) handleCaptureRef.current();
                  }
                } else {
                  setFaceStatus({
                    valid: false,
                    count: 1,
                    isMismatch: false,
                    isCovered: false,
                    text: `✓ Blink verified! Scanning... ${p}%`
                  });
                }
              }
            } else {
              // PAUSE SCAN on movement or deviation (Keep current progress, do not reset)
              const currentP = Math.floor(scanProgressRef.current);
              if (currentP > 0) {
                setFaceStatus({
                  valid: false,
                  count: 1,
                  isMismatch: false,
                  isCovered: false,
                  text: `⏸️ Scan Paused (${currentP}%): Look straight towards camera`
                });
              } else {
                setFaceStatus({
                  valid: false,
                  count: 1,
                  isMismatch: false,
                  isCovered: false,
                  text: 'Align head straight inside circle to start scan'
                });
              }
            }
          } else {
            // Punch Mode (Strict Frontal Gaze, Proximity & Eye-Blink Liveness)
            if (!isCentered) {
              autoCapturedRef.current = false;
              scanProgressRef.current = 0;
              setScanProgress(0);
              setFaceStatus({
                valid: false,
                count: 1,
                isMismatch: false,
                isCovered: false,
                text: 'Position face inside the center circle'
              });
            } else if (isTooFar) {
              autoCapturedRef.current = false;
              scanProgressRef.current = 0;
              setScanProgress(0);
              setFaceStatus({
                valid: false,
                count: 1,
                isMismatch: false,
                isCovered: false,
                text: '🔍 Move closer to the camera'
              });
            } else if (!isStraightHead) {
              autoCapturedRef.current = false;
              scanProgressRef.current = 0;
              setScanProgress(0);
              setFaceStatus({
                valid: false,
                count: 1,
                isMismatch: false,
                isCovered: false,
                text: 'Look straight towards the camera to verify'
              });
            } else {
              const blinked = updateBlinkLiveness();
              if (!blinked) {
                scanProgressRef.current = Math.min(45, scanProgressRef.current + 8.0);
                const currentProgress = Math.floor(scanProgressRef.current);
                setScanProgress(currentProgress);
                const elapsed = livenessPromptAtRef.current ? (Date.now() - livenessPromptAtRef.current) : 0;
                setFaceStatus({
                  valid: false,
                  count: 1,
                  isMismatch: false,
                  isCovered: false,
                  text: elapsed > 6000
                    ? '👀 Blink your eyes clearly (remove dark glasses if needed)'
                    : '👀 Blink your eyes once to verify live face'
                });
              } else {
                scanProgressRef.current = Math.min(100, Math.max(45, scanProgressRef.current) + 14.0);
                const currentProgress = Math.floor(scanProgressRef.current);
                setScanProgress(currentProgress);

                const statusText = currentProgress < 100
                  ? `✓ Blink verified! Completing... ${currentProgress}%`
                  : '✓ Live face verified. Submitting attendance...';

                setFaceStatus({
                  valid: currentProgress >= 100,
                  count: 1,
                  isMismatch: false,
                  isCovered: false,
                  text: statusText
                });

                if (currentProgress >= 100 && autoCapture && !autoCapturedRef.current) {
                  autoCapturedRef.current = true;
                  if (scanIntervalRef.current) {
                    clearInterval(scanIntervalRef.current);
                    scanIntervalRef.current = null;
                  }
                  if (handleCaptureRef.current) handleCaptureRef.current();
                }
              }
            }
          }
        }
      } else {
        autoCapturedRef.current = false;
        scanProgressRef.current = 0;
        setScanProgress(0);
        resetLivenessState();
        setFaceStatus({ valid: false, count: 0, isMismatch: false, isCovered: false, text: 'Align face inside the center circle' });
      }
      } finally {
        isDetecting = false;
      }
    }, 55);

    scanIntervalRef.current = interval;
  };

  const closeModal = () => {
    stopCamera();
    setIsOpen(false);
  };


  return (
    <div className="w-full">
      {/* 1. Normal View (Trigger Card) */}
      {!capturedImage || resetOnCapture ? (
        <div className={`border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 transition-colors ${
          isDarkMode 
            ? 'border-neutral-800 bg-[#18181b]' 
            : 'border-neutral-200/80 bg-neutral-50/50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold transition-colors ${
              isDarkMode 
                ? 'bg-neutral-800 border border-neutral-700 text-neutral-200' 
                : 'bg-white border border-neutral-200 text-neutral-700 shadow-sm'
            }`}>
              <Camera size={22} className="stroke-[1.75]" />
            </div>
            <div>
              <h4 className={`text-sm font-semibold transition-colors ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>{title}</h4>
              <p className={`text-xs transition-colors ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {disabled ? disabledMessage : description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { if (!disabled) setIsOpen(true); }}
            disabled={disabled}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all ${
              disabled
                ? 'bg-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600 cursor-not-allowed'
                : 'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 cursor-pointer'
            }`}
          >
            {buttonText}
          </button>
        </div>
      ) : (
        <div className={`border rounded-2xl p-4 flex items-center justify-between transition-colors ${
          isDarkMode 
            ? 'border-emerald-900/60 bg-emerald-950/30' 
            : 'border-emerald-200 bg-emerald-50/60'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold transition-colors ${
              isDarkMode 
                ? 'bg-emerald-950/80 border border-emerald-800/60 text-emerald-400' 
                : 'bg-emerald-100 text-emerald-600'
            }`}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                isDarkMode ? 'text-emerald-400' : 'text-emerald-800'
              }`}>
                Face Verified & Locked
              </div>
              <p className={`text-[11px] transition-colors ${isDarkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Biometrics scanned successfully. Ready for registration.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setCapturedImage(null);
              setIsOpen(true);
            }}
            className={`px-3 py-1.5 border rounded-lg text-xs font-medium transition ${
              isDarkMode 
                ? 'border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300' 
                : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            Retake
          </button>
        </div>
      )}

      {/* 2. Modal with Backdrop Blur */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl p-5 relative shadow-2xl flex flex-col items-center">
            
            {/* Modal Header */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2 text-white font-medium text-sm">
                <UserCheck className="text-neutral-300" size={18} />
                <span>Align Face to Capture</span>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Camera Viewport with Round Mask */}
            <div className="relative w-full aspect-square max-h-[340px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-2 z-30 bg-slate-950">
                  <RefreshCw className="animate-spin text-neutral-300" size={28} />
                  <span className="text-xs">Accessing webcam & face scanner...</span>
                </div>
              )}

              {errorMessage ? (
                <div className="p-4 text-center text-red-400 text-xs z-30">
                  {errorMessage}
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    onPlay={handleVideoPlay}
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100"
                  />

                  {/* Pitch Black / Dark Mask Overlay outside the center circle (Only round shape camera visible) */}
                  <div 
                    className="absolute inset-0 pointer-events-none z-10"
                    style={{
                      background: 'radial-gradient(circle 105px at 50% 50%, transparent 104px, rgba(15, 23, 42, 0.96) 105px)'
                    }}
                  />

                  {/* Circular Biometric Scanning Ring (0% -> 100% smooth clockwise fill) */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="relative w-[210px] h-[210px] flex items-center justify-center">
                      <svg 
                        viewBox="0 0 210 210"
                        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                      >
                        <g transform="rotate(-90 105 105)">
                          {/* Background Track Guide Ring */}
                          <circle
                            cx="105"
                            cy="105"
                            r={RING_RADIUS}
                            fill="none"
                            stroke={
                              faceStatus.isMismatch || faceStatus.isCovered || faceStatus.count > 1
                                ? 'rgba(239, 68, 68, 0.35)'
                                : scanProgress > 0
                                ? 'rgba(51, 65, 85, 0.7)'
                                : 'rgba(100, 116, 139, 0.45)'
                            }
                            strokeWidth="4"
                            strokeDasharray={scanProgress > 0 ? "none" : "6 6"}
                          />

                          {/* Dynamic Active Progress Ring (fills up proportionally from top 12 o'clock clockwise) */}
                          {scanProgress > 0 && (
                            <circle
                              cx="105"
                              cy="105"
                              r={RING_RADIUS}
                              fill="none"
                              stroke={
                                faceStatus.isMismatch || faceStatus.isCovered || faceStatus.count > 1
                                  ? '#ef4444'
                                  : '#10b981'
                              }
                              strokeWidth="5"
                              strokeLinecap="round"
                              strokeDasharray={`${RING_CIRCUMFERENCE}`}
                              strokeDashoffset={`${RING_CIRCUMFERENCE * (1 - scanProgress / 100)}`}
                              style={{
                                strokeDasharray: `${RING_CIRCUMFERENCE}`,
                                strokeDashoffset: `${RING_CIRCUMFERENCE * (1 - scanProgress / 100)}`,
                                transition: 'stroke-dashoffset 90ms ease-out, stroke 0.2s ease',
                              }}
                            />
                          )}

                          {/* Instant Active Green Guide Ring: Shows immediately when ready so user never waits */}
                          {scanProgress === 0 && !faceStatus.isMismatch && !faceStatus.isCovered && !loading && (
                            <circle
                              cx="105"
                              cy="105"
                              r={RING_RADIUS}
                              fill="none"
                              stroke="rgba(16, 185, 129, 0.6)"
                              strokeWidth="3.5"
                              strokeDasharray="6 6"
                              className="animate-pulse"
                            />
                          )}
                        </g>
                      </svg>

                      {/* Glowing Green Halo on 100% Verification */}
                      {scanProgress >= 100 && !faceStatus.isMismatch && !faceStatus.isCovered && (
                        <div className="absolute inset-0 rounded-full border-4 border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.85)] animate-pulse" />
                      )}
                    </div>
                  </div>

                  {/* Single Registration Scan Badge */}
                  {mode === 'register' && (
                    <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 px-3 py-1 rounded-full shadow-lg text-[11px] font-bold text-neutral-200">
                      <span>👤 Straight Face Alignment Scan</span>
                    </div>
                  )}

                  {/* Status Tag */}
                  <div className={`absolute z-20 ${mode === 'register' ? 'bottom-3 left-3' : 'top-3 left-3'}`}>
                    {scanProgress >= 100 ? (
                      <span className="flex items-center gap-1 bg-emerald-950/90 border border-emerald-500 text-emerald-300 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                        <CheckCircle2 size={12} /> {faceStatus.text}
                      </span>
                    ) : (faceStatus.count > 1 || faceStatus.isMismatch || faceStatus.isCovered) ? (
                      <span className="flex items-center gap-1 bg-red-950/90 border border-red-500 text-red-300 px-2.5 py-1 rounded-full text-[11px] font-semibold">
                        <AlertCircle className="text-red-400" size={12} /> {faceStatus.text}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-slate-900/90 border border-slate-600 text-slate-300 px-2.5 py-1 rounded-full text-[11px]">
                        <AlertCircle className="text-amber-400" size={12} /> {faceStatus.text}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Bottom Action */}
            {autoCapture ? (
              <>
                <div className={`mt-4 w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition ${
                scanProgress >= 100
                  ? 'bg-emerald-600 text-white shadow-lg animate-pulse'
                  : (faceStatus.isMismatch || faceStatus.isCovered)
                  ? 'bg-red-950 border border-red-700 text-red-300'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {scanProgress > 0 && scanProgress < 100 && <RefreshCw className="animate-spin text-emerald-400" size={16} />}
                {scanProgress >= 100 && <CheckCircle2 className="text-white" size={16} />}
                {(faceStatus.isMismatch || faceStatus.isCovered) && <AlertCircle className="text-red-400" size={16} />}
                <span>
                  {scanProgress >= 100 
                    ? (mode === 'register' ? '✓ Biometrics Verified (100%) — Capturing Photo...' : `✓ Face Verified — Auto Punching...`) 
                    : (faceStatus.isMismatch || faceStatus.isCovered)
                    ? faceStatus.text
                    : faceStatus.count > 1 
                    ? 'Multiple faces found - 1 face only' 
                    : scanProgress > 0 
                    ? `🔍 Scanning biometrics... ${scanProgress}%` 
                    : 'Position face inside center circle'}
                </span>
              </div>
              {blinkVerified && faceStatus.count === 1 && !faceStatus.isMismatch && !faceStatus.isCovered && scanProgress < 100 && (
                <button
                  type="button"
                  onClick={handleCapture}
                  className="mt-2.5 w-full py-2 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Camera size={14} className="text-emerald-400" /> Click to Capture Photo Directly
                </button>
              )}
            </>
            ) : (
              <button
                type="button"
                onClick={handleCapture}
                disabled={scanProgress < 100 || faceStatus.isMismatch || faceStatus.isCovered}
                className={`mt-4 w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition ${
                  scanProgress >= 100
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg cursor-pointer active:scale-95'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                <Camera size={16} />
                {scanProgress >= 100 
                  ? 'Capture & Confirm' 
                  : (faceStatus.isMismatch || faceStatus.isCovered)
                  ? faceStatus.text 
                  : faceStatus.count > 1 
                  ? 'Multiple faces found - 1 face only' 
                  : 'Align face inside center circle'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
