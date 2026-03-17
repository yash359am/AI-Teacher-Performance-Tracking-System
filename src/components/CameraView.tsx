import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { UserProfile, Alert } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { Camera, Mic, Square, AlertCircle, CheckCircle, Loader2, Volume2, FastForward, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyzeTeachingChunk, generateSessionSummary } from '../services/gemini';

interface CameraViewProps {
  user: UserProfile;
  onComplete: () => void;
}

export default function CameraView({ user, onComplete }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [detections, setDetections] = useState<cocoSsd.DetectedObject[]>([]);
  const [metrics, setMetrics] = useState({
    clarity: 80,
    speed: 50,
    engagement: 70,
    mistakes: 0
  });
  const [currentSubject, setCurrentSubject] = useState<string | null>(null);

  // Speech Recognition Setup
  const recognitionRef = useRef<any>(null);
  const isRecognitionActiveRef = useRef(false);

  // Load TensorFlow Model
  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        console.log("TensorFlow Model Loaded");
      } catch (err) {
        console.error("Error loading TF model:", err);
      }
    };
    loadModel();
  }, []);

  // Real-time Object Detection
  useEffect(() => {
    let requestRef: number;
    const detect = async () => {
      if (isRecording && model && videoRef.current && videoRef.current.readyState === 4) {
        const predictions = await model.detect(videoRef.current);
        setDetections(predictions);
      }
      requestRef = requestAnimationFrame(detect);
    };
    
    if (isRecording && model) {
      requestRef = requestAnimationFrame(detect);
    }
    
    return () => cancelAnimationFrame(requestRef);
  }, [isRecording, model]);

  const startRecording = async () => {
    console.log("Starting recording...");
    setCameraError(null);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Your browser does not support camera access. Please use a modern browser like Chrome.");
      return;
    }

    let stream: MediaStream | null = null;
    
    // Try with ideal constraints first
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: true 
      });
    } catch (err: any) {
      console.warn("Failed with ideal constraints, trying fallback...", err);
      
      // Fallback 1: Simple video + audio
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err2) {
        console.warn("Failed with simple constraints, trying video only...", err2);
        
        // Fallback 2: Video only (maybe microphone is busy or missing)
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (err3: any) {
          console.error("All camera access attempts failed:", err3);
          
          if (err3.name === 'NotReadableError' || err3.message.includes('Could not start video source')) {
            setCameraError("Camera is already in use by another application or tab. Please close other apps using the camera and try again.");
          } else if (err3.name === 'NotAllowedError') {
            setCameraError("Camera or Microphone permission denied. Please click the lock icon in your browser address bar and allow access.");
          } else if (err3.name === 'NotFoundError') {
            setCameraError("No camera found on this device.");
          } else {
            setCameraError(`Error accessing media devices: ${err3.message}`);
          }
          return;
        }
      }
    }

    if (!stream) return;

    try {
      console.log("Camera stream obtained:", stream.id);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.error("Video play failed:", e));
        };
      }

      // Create session in Firestore
      let sessionRef;
      try {
        sessionRef = await addDoc(collection(db, 'sessions'), {
          teacherId: user.uid,
          teacherName: user.displayName || user.email,
          startTime: serverTimestamp(),
          status: 'recording',
          metrics: {
            clarityScore: 0,
            speed: 0,
            engagement: 0,
            mistakeCount: 0
          }
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'sessions');
        return;
      }
      setSessionId(sessionRef.id);
      setIsRecording(true);
      isRecordingRef.current = true;

      // Start Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          isRecognitionActiveRef.current = true;
        };

        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript) {
            setTranscript(prev => (prev + ' ' + finalTranscript).trim());
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          if (event.error === 'not-allowed') {
            setCameraError("Microphone access denied. Please enable microphone permissions in your browser settings to use live transcription.");
          }
          isRecognitionActiveRef.current = false;
        };

        recognitionRef.current.onend = () => {
          isRecognitionActiveRef.current = false;
          // Restart if still recording (handles some browser timeouts)
          if (isRecordingRef.current && recognitionRef.current) {
            try {
              if (!isRecognitionActiveRef.current) {
                recognitionRef.current.start();
              }
            } catch (e) {
              console.error("Failed to restart recognition:", e);
            }
          }
        };

        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Initial recognition start failed:", e);
        }
      } else {
        console.warn("Speech Recognition API not supported in this browser.");
        setCameraError("Your browser does not support speech recognition. Please use Chrome or Edge.");
      }
    } catch (err) {
      console.error("Error accessing media devices:", err);
      setCameraError(err instanceof Error ? err.message : "Could not access camera. Please ensure you have granted permissions.");
    }
  };

  const stopRecording = async () => {
    if (!sessionId) return;

    setIsRecording(false);
    isRecordingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Error stopping recognition:", e);
      }
    }
    
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());

    // Generate final summary
    const summary = await generateSessionSummary(transcript);

    // Update session
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'completed',
        endTime: serverTimestamp(),
        transcript,
        summary,
        metrics: {
          clarityScore: metrics.clarity,
          speed: metrics.speed,
          engagement: metrics.engagement,
          mistakeCount: metrics.mistakes
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sessions/${sessionId}`);
    }

    onComplete();
  };

  const captureAndAnalyze = useCallback(async () => {
    if (!isRecording || !videoRef.current || !canvasRef.current || !sessionId) return;

    setIsAnalyzing(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);

    const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
    
    // Get classroom context from detections
    const classroomContext = detections.map(d => `${d.class} (${Math.round(d.score * 100)}%)`).join(', ');
    
    // Get last few sentences for context
    const recentTranscript = transcript.split('.').slice(-3).join('.');

    try {
      const result = await analyzeTeachingChunk(base64Image, recentTranscript, classroomContext);
      
      if (result.subject) {
        setCurrentSubject(result.subject);
      }

      // Update metrics
      setMetrics(prev => ({
        clarity: (prev.clarity + result.clarityScore) / 2,
        speed: (prev.speed + result.speedScore) / 2,
        engagement: (prev.engagement + result.engagementScore) / 2,
        mistakes: prev.mistakes + (result.mistakeDetected ? 1 : 0)
      }));

      // Create alert if mistake detected or scores are low
      const isLowScore = result.clarityScore < 60 || result.speedScore < 60 || result.engagementScore < 60;
      
      if (result.mistakeDetected || result.pedagogicalFeedback || isLowScore) {
        let message = result.mistakeDescription || 'Pedagogical Insight';
        let feedback = result.pedagogicalFeedback;

        if (isLowScore && !feedback) {
          const lowMetrics = [];
          if (result.clarityScore < 60) lowMetrics.push('Clarity');
          if (result.speedScore < 60) lowMetrics.push('Speed');
          if (result.engagementScore < 60) lowMetrics.push('Engagement');
          feedback = `Your ${lowMetrics.join(', ')} score is below 60%. Try to adjust your teaching style to improve these areas.`;
        }

        const alertData = {
          sessionId,
          teacherId: user.uid,
          timestamp: serverTimestamp(),
          type: result.mistakeDetected ? 'mistake' : 'insight' as any,
          message,
          suggestion: result.suggestion,
          pedagogicalFeedback: feedback
        };
        try {
          const alertRef = await addDoc(collection(db, 'sessions', sessionId, 'alerts'), alertData);
          setAlerts(prev => [{ id: alertRef.id, ...alertData, timestamp: new Date() } as any, ...prev]);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `sessions/${sessionId}/alerts`);
        }
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      if (err.message?.includes("RESOURCE_EXHAUSTED") || err.message?.includes("429")) {
        const quotaAlert: Alert = {
          id: 'quota-error',
          sessionId,
          teacherId: user.uid,
          timestamp: new Date(),
          type: 'clarity', // Using clarity as a generic type for system alerts
          message: "AI Quota Exceeded. Real-time analysis is temporarily paused.",
          suggestion: "Please wait a minute or upgrade your Gemini API plan for higher limits."
        };
        setAlerts(prev => [quotaAlert, ...prev.filter(a => a.id !== 'quota-error')]);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [isRecording, sessionId, transcript, user.uid, detections]);

  // Periodic analysis every 15 seconds
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(captureAndAnalyze, 15000);
    }
    return () => clearInterval(interval);
  }, [isRecording, captureAndAnalyze]);

  return (
    <div className="h-full flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter italic">Live Session</h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="font-mono text-xs text-gray-500 uppercase">
              {isRecording ? 'Recording in progress...' : 'Ready to start recording'}
            </p>
            {isRecording && currentSubject && (
              <span className="bg-black text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                Topic: {currentSubject}
              </span>
            )}
          </div>
        </div>
        
        {!isRecording ? (
          <button 
            onClick={startRecording}
            className="flex items-center gap-2 bg-black text-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]"
          >
            <Camera size={18} />
            Start Session
          </button>
        ) : (
          <button 
            onClick={stopRecording}
            className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]"
          >
            <Square size={18} />
            Stop Session
          </button>
        )}
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Video Feed */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="relative aspect-video bg-black border border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline
              className="w-full h-full object-cover bg-gray-900"
            />
            
            {/* TensorFlow Detection Overlay */}
            {isRecording && detections.map((det, i) => (
              <div 
                key={i}
                className="absolute border-2 border-emerald-400 bg-emerald-400/5 pointer-events-none transition-all duration-300"
                style={{
                  left: `${(det.bbox[0] / (videoRef.current?.videoWidth || 1)) * 100}%`,
                  top: `${(det.bbox[1] / (videoRef.current?.videoHeight || 1)) * 100}%`,
                  width: `${(det.bbox[2] / (videoRef.current?.videoWidth || 1)) * 100}%`,
                  height: `${(det.bbox[3] / (videoRef.current?.videoHeight || 1)) * 100}%`,
                }}
              >
                <span className="absolute -top-6 left-0 bg-emerald-400 text-black text-[9px] font-black px-2 py-0.5 uppercase tracking-tighter shadow-sm">
                  {det.class} {Math.round(det.score * 100)}%
                </span>
              </div>
            ))}

            <canvas ref={canvasRef} className="hidden" />
            
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full" />
                Live
              </div>
            )}

            {isRecording && (
              <div className="absolute top-4 left-24 flex items-center gap-2 bg-emerald-600 text-white px-2 py-1 text-[8px] font-bold uppercase tracking-widest">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                TF.js: {model ? 'Active' : 'Loading...'}
              </div>
            )}

            {isAnalyzing && (
              <div className="absolute top-4 right-4 bg-black/80 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">
                <Loader2 size={12} className="animate-spin" />
                AI Analyzing...
              </div>
            )}

            {isRecording && (
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button 
                  onClick={captureAndAnalyze}
                  disabled={isAnalyzing}
                  className="bg-black text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm hover:bg-gray-800 disabled:opacity-50"
                >
                  {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                  Analyze Now
                </button>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle size={48} className="text-red-500 mb-4" />
                <h4 className="text-white font-bold uppercase tracking-widest mb-2">Camera Error</h4>
                <p className="text-gray-400 text-xs font-mono mb-6 max-w-xs">{cameraError}</p>
                <button 
                  onClick={startRecording}
                  className="bg-white text-black px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          <div className="bg-white border border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex-1 min-h-0 overflow-auto">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic size={12} className={isRecording ? 'text-red-600 animate-pulse' : ''} /> 
                Live Transcript
              </div>
              {isRecording && (
                <span className="text-[8px] text-emerald-600 flex items-center gap-1">
                  <div className="w-1 h-1 bg-emerald-600 rounded-full animate-ping" />
                  Listening
                </span>
              )}
            </h3>
            <p className="text-sm font-mono leading-relaxed text-gray-700 italic">
              {transcript || 'Awaiting speech...'}
            </p>
          </div>
        </div>

        {/* Sidebar Analysis */}
        <div className="flex flex-col gap-6 overflow-auto pr-2">
          {/* Subject Analysis */}
          <div className="bg-black text-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-2">
              <Loader2 size={12} className={isAnalyzing ? 'animate-spin' : ''} />
              Subject Analysis
            </h3>
            <p className="text-lg font-black uppercase italic tracking-tighter">
              {currentSubject || 'Detecting Topic...'}
            </p>
            {isRecording && !currentSubject && (
              <p className="text-[8px] font-mono text-gray-500 mt-1 uppercase">
                Analyzing speech to identify subject...
              </p>
            )}
          </div>

          {/* Real-time Metrics */}
          <div className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Real-time Metrics</h3>
            <div className="space-y-4">
              <MetricBar label="Clarity" value={metrics.clarity} icon={<Volume2 size={14} />} />
              <MetricBar label="Speed" value={metrics.speed} icon={<FastForward size={14} />} />
              <MetricBar label="Engagement" value={metrics.engagement} icon={<UserCheck size={14} />} />
            </div>
          </div>

          {/* Pedagogical Insight */}
          <div className="bg-emerald-50 border border-emerald-600 p-4 shadow-[4px_4px_0px_0px_rgba(5,150,105,1)]">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 mb-2 flex items-center gap-2">
              <Loader2 size={12} className={isAnalyzing ? 'animate-spin' : ''} />
              AI Pedagogical Insight
            </h3>
            <p className="text-xs font-bold text-emerald-900 italic">
              {alerts[0]?.pedagogicalFeedback || 'Analyzing teaching style...'}
            </p>
          </div>

          {/* Real-time Alerts */}
          <div className="flex-1 bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col min-h-0">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center justify-between">
              <span>Live Alerts</span>
              <span className="bg-black text-white px-1.5 py-0.5 rounded text-[8px]">{alerts.length}</span>
            </h3>
            
            <div className="flex-1 overflow-auto space-y-3">
              <AnimatePresence initial={false}>
                {alerts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                    <CheckCircle size={32} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">All clear</p>
                  </div>
                ) : (
                  alerts.map((alert, idx) => (
                    <motion.div
                      key={alert.id || idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 border-l-4 ${
                        alert.type === 'mistake' ? 'border-red-600 bg-red-50' : 
                        alert.type === 'insight' ? 'border-emerald-600 bg-emerald-50' : 
                        'border-amber-500 bg-amber-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle size={14} className={
                          alert.type === 'mistake' ? 'text-red-600' : 
                          alert.type === 'insight' ? 'text-emerald-600' : 
                          'text-amber-600'
                        } />
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          {alert.type} detected
                        </span>
                      </div>
                      <p className="text-xs font-bold mb-2">{alert.message}</p>
                      {alert.pedagogicalFeedback && (
                        <p className="text-[10px] text-gray-600 italic mb-2">{alert.pedagogicalFeedback}</p>
                      )}
                      {alert.suggestion && (
                        <div className="bg-white/50 p-2 text-[10px] font-mono border border-black/10">
                          <span className="font-bold">SUGGESTION:</span> {alert.suggestion}
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricBar({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight">
          {icon} {label}
        </div>
        <span className="text-[10px] font-mono font-bold">{Math.round(value)}%</span>
      </div>
      <div className="h-2 bg-gray-100 border border-black overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className={`h-full ${value > 70 ? 'bg-emerald-500' : value > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
        />
      </div>
    </div>
  );
}
