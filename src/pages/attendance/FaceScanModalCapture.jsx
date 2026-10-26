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
async function ensureTfBackendReady(api) {
  if (!api || !api.tf) return false;
  if (tfBackendReadyPromise) return tfBackendReadyPromise;
  tfBackendReadyPromise = (async () => {
    const tf = api.tf;
    for (const backend of ['webgl', 'wasm', 'cpu']) {
      try {
        await tf.setBackend(backend);
        await tf.ready();
        if (tf.getBackend() === backend) return true;
      } catch (e) {
        console.warn(`TensorFlow backend '${backend}' failed to initialize:`, e);
      }
    }
    return false;
  })();
  return tfBackendReadyPromise;
}

async function ensureFaceModelsLoaded(api) {
  if (!api || !api.nets) return;
  await ensureTfBackendReady(api);
  const loadNets = async (url) => {
    if (!api.nets.tinyFaceDetector.isLoaded) {
      await api.nets.tinyFaceDetector.loadFromUri(url);
    }
    if (api.nets.faceLandmark68TinyNet && !api.nets.faceLandmark68TinyNet.isLoaded) {
      await api.nets.faceLandmark68TinyNet.loadFromUri(url);
    }
    if (api.nets.faceRecognitionNet && !api.nets.faceRecognitionNet.isLoaded) {
      await api.nets.faceRecognitionNet.loadFromUri(url);
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
}

// Loaded separately (and allowed to silently fail) from the core detection/landmark/
// recognition models above - this is only a data-integrity nicety for registration,
// never something that should block the core face-scan flow if it can't load.
async function ensureAgeGenderModelLoaded(api) {
  if (!api || !api.nets || !api.nets.ageGenderNet) return false;
  await ensureTfBackendReady(api);
  if (api.nets.ageGenderNet.isLoaded) return true;
  try {
    await api.nets.ageGenderNet.loadFromUri(LOCAL_MODEL_URL);
    return true;
  } catch (eLocal) {
    try {
      await api.nets.ageGenderNet.loadFromUri(CDN_MODEL_URL);
      return true;
    } catch (eCdn) {
      console.warn("Age/gender model loading warning:", eCdn);
      return false;
    }
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
  const genderMismatchStreakRef = useRef(0);
  const genderCheckTickRef = useRef(0);
  const ageGenderReadyRef = useRef(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const autoCapturedRef = useRef(false);
  const handleCaptureRef = useRef(null);
  const scanProgressRef = useRef(0);
  const scanIntervalRef = useRef(null);

  const prevFaceRef = useRef(null);
  const regStageRef = useRef(1);
  const [regStep, setRegStep] = useState(1);

  // Stop camera tracks cleanly
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
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

      try {
        let api = window.faceapi;
        if (!api) {
          try { api = await loadFaceApi(); } catch (error) { console.warn("Face scanner library unavailable:", error); }
        }
        await ensureFaceModelsLoaded(api);

        genderMismatchStreakRef.current = 0;
        genderCheckTickRef.current = 0;
        ageGenderReadyRef.current = false;
        if (mode === 'register' && expectedGender) {
          ensureAgeGenderModelLoaded(api).then((ready) => { ageGenderReadyRef.current = ready; });
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });

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

  const handleCapture = async () => {
    if (!videoRef.current || faceStatus.isMismatch || faceStatus.isCovered) return;

    const video = videoRef.current;
    let descriptorArray = null;

    const api = window.faceapi;
    if (api) {
      try {
        await ensureFaceModelsLoaded(api);

        let detection = null;
        if (api.detectSingleFace) {
          detection = await api.detectSingleFace(
            video,
            new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.2 })
          ).withFaceLandmarks(true).withFaceDescriptor();
        }

        if (!detection && api.detectAllFaces) {
          const raw = await api.detectAllFaces(
            video,
            new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.2 })
          ).withFaceLandmarks(true).withFaceDescriptors();
          if (raw && raw.length > 0) detection = raw[0];
        }

        if (detection && detection.descriptor) {
          descriptorArray = Array.from(detection.descriptor);
        }
      } catch (e) {
        console.warn("Capture face descriptor extraction warning:", e);
      }
    }

    const offCanvas = document.createElement('canvas');
    offCanvas.width = video.videoWidth || 640;
    offCanvas.height = video.videoHeight || 480;
    const ctx = offCanvas.getContext('2d');

    // Mirror correction
    ctx.translate(offCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);

    offCanvas.toBlob((blob) => {
      const dataUrl = offCanvas.toDataURL('image/jpeg', 0.95);
      if (!resetOnCapture) {
        setCapturedImage(dataUrl);
      } else {
        setCapturedImage(null);
      }
      if (onFaceCaptured) onFaceCaptured(blob || dataUrl, descriptorArray);
      stopCamera();
      setIsOpen(false);
    }, 'image/jpeg', 0.95);
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

    const api = window.faceapi;
    const displaySize = { width: video.clientWidth || 480, height: video.clientHeight || 360 };
    if (api && api.matchDimensions) {
      api.matchDimensions(canvas, displaySize);
    } else {
      canvas.width = displaySize.width;
      canvas.height = displaySize.height;
    }

    const interval = setInterval(async () => {
      if (!video || video.paused || video.ended || !isOpen) return;

      let detections = [];
      let singleFaceDetection = null;

      // 1. Try detectSingleFace with fast 224 input size
      if (api && api.detectSingleFace && api.nets?.faceRecognitionNet?.isLoaded) {
        try {
          singleFaceDetection = await api.detectSingleFace(
            video,
            new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.2 })
          ).withFaceLandmarks(true).withFaceDescriptor();

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

        // Check for face obstruction / mask / hand covering lower face safely
        let isCoveredFace = false;
        if (det.landmarks && det.landmarks.positions && det.landmarks.positions.length >= 68) {
          const mouth = typeof det.landmarks.getMouth === 'function' ? det.landmarks.getMouth() : null;
          const nose = typeof det.landmarks.getNose === 'function' ? det.landmarks.getNose() : null;
          if (!mouth || mouth.length < 6 || !nose || nose.length < 3) {
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
            const faceW = box.width || 100;
            const faceH = box.height || 100;

            if (mouthW < faceW * 0.10 || mouthH < faceH * 0.015) {
              isCoveredFace = true;
            }
          }
        }

        // GENDER SANITY CHECK (registration only, only when the employee record
        // has a gender on file). Throttled to every 2nd tick (~150ms, not every
        // 75ms tick) and only while the face is centered, to keep this cheap.
        // A mismatch is only acted on after 2 consecutive high-confidence (>=80%)
        // mismatched reads (~300ms), so one bad-angle frame can't lock
        // registration, but it still surfaces as soon as the face is read -
        // not only once the scan ring is already well past halfway.
        let isGenderMismatch = false;
        if (mode === 'register' && expectedGender && ageGenderReadyRef.current && isCentered && !isCoveredFace) {
          genderCheckTickRef.current += 1;
          if (genderCheckTickRef.current % 2 === 0) {
            try {
              const genderResult = await api.detectSingleFace(
                video,
                new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.2 })
              ).withAgeAndGender();
              if (genderResult && genderResult.genderProbability >= 0.8) {
                const detectedGender = genderResult.gender === 'male' ? 'MALE' : 'FEMALE';
                genderMismatchStreakRef.current = detectedGender !== expectedGender ? genderMismatchStreakRef.current + 1 : 0;
              }
            } catch (e) {}
          }
          isGenderMismatch = genderMismatchStreakRef.current >= 2;
        } else if (mode !== 'register' || !isCentered) {
          genderMismatchStreakRef.current = 0;
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
        let isFaceMatched = true;
        let isDuplicateFace = false;
        let calculatedDistance = null;
        let hasNoProfilePhoto = false;

        // REAL-TIME DUPLICATE FACE CHECK FOR REGISTRATION
        if (mode === 'register' && liveDescriptor && allRegisteredDescriptors && allRegisteredDescriptors.length > 0) {
          const liveFloatArray = new Float32Array(liveDescriptor);
          for (const emp of allRegisteredDescriptors) {
            const empDesc = parseDescriptor(emp.descriptor || emp.face_encoding || emp.face_descriptor);
            if (empDesc) {
              const targetArr = new Float32Array(empDesc);
              const d = api.euclideanDistance 
                ? api.euclideanDistance(liveFloatArray, targetArr) 
                : Math.sqrt(liveDescriptor.reduce((sum, val, idx) => sum + Math.pow(val - empDesc[idx], 2), 0));

              if (d < 0.52) {
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
            text: '⚠️ Lower face covered! Remove mask, cloth, or hand.'
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
        } else if (isGenderMismatch) {
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
            text: expectedGender === 'FEMALE'
              ? '⚠️ Face does not match the recorded gender (Female) on this profile.'
              : '⚠️ Face does not match the recorded gender (Male) on this profile.'
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
        } else if (mode === 'register') {
          // SINGLE SCAN (Straight head looking forward inside circle) - paced so
          // the ring visibly fills over ~2s instead of completing almost as
          // soon as the camera opens.
          if (isStraightHead && isCentered) {
            scanProgressRef.current = Math.min(100, scanProgressRef.current + 4.0);
            const p = Math.floor(scanProgressRef.current);
            setScanProgress(p);

            if (p >= 100) {
              setScanProgress(100);
              setFaceStatus({
                valid: true,
                count: 1,
                isMismatch: false,
                isCovered: false,
                text: '✓ Face Biometric Scan Complete (100%) — Registering...'
              });

              if (autoCapture && !autoCapturedRef.current) {
                autoCapturedRef.current = true;
                setTimeout(() => {
                  if (handleCaptureRef.current) handleCaptureRef.current();
                }, 120);
              }
            } else {
              setFaceStatus({
                valid: false,
                count: 1,
                isMismatch: false,
                isCovered: false,
                text: `🔍 Scanning face biometrics... ${p}%`
              });
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
                text: `⏸️ Scan Paused (${currentP}%): Align head straight inside circle`
              });
            } else {
              setFaceStatus({
                valid: false,
                count: 1,
                isMismatch: false,
                isCovered: false,
                text: 'Align head straight inside the circle to start scan'
              });
            }
          }
        } else if (isCentered) {
          // Punch Mode (Fast & Smooth Punch Scan)
          scanProgressRef.current = Math.min(100, scanProgressRef.current + 12.5);
          const currentProgress = Math.floor(scanProgressRef.current);
          setScanProgress(currentProgress);

          const statusText = currentProgress < 100
            ? `Preparing photo... ${currentProgress}%`
            : 'Photo captured. Verifying attendance...';

          setFaceStatus({
            valid: currentProgress >= 100,
            count: 1,
            isMismatch: false,
            isCovered: false,
            text: statusText
          });

          if (currentProgress >= 100 && autoCapture && !autoCapturedRef.current) {
            autoCapturedRef.current = true;
            setTimeout(() => {
              if (handleCaptureRef.current) handleCaptureRef.current();
            }, 120);
          }
        } else {
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
        }
      } else {
        autoCapturedRef.current = false;
        scanProgressRef.current = 0;
        setScanProgress(0);
        setFaceStatus({ valid: false, count: 0, isMismatch: false, isCovered: false, text: 'Align face inside the center circle' });
      }
    }, 75);

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
              {faceStatus.count === 1 && !faceStatus.isMismatch && !faceStatus.isCovered && scanProgress < 100 && (
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
