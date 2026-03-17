import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { Session, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { Calendar, Clock, BarChart3, ChevronRight, FileText, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface SessionListProps {
  user: UserProfile;
}

export default function SessionList({ user }: SessionListProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  useEffect(() => {
    const sessionsRef = collection(db, 'sessions');
    let q = query(sessionsRef, orderBy('startTime', 'desc'));
    
    if (user.role === 'teacher') {
      q = query(sessionsRef, where('teacherId', '==', user.uid), orderBy('startTime', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Session[];
      setSessions(sessionData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sessions');
    });

    return unsubscribe;
  }, [user]);

  if (loading) {
    return <div className="animate-pulse font-mono text-xs uppercase tracking-widest">Loading sessions...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-4">
        <h2 className="text-3xl font-black uppercase tracking-tighter italic mb-6">Session History</h2>
        {sessions.length === 0 ? (
          <p className="font-mono text-xs text-gray-500">No sessions recorded yet.</p>
        ) : (
          sessions.map(session => (
            <button
              key={session.id}
              onClick={() => setSelectedSession(session)}
              className={`w-full text-left p-4 border border-black transition-all ${
                selectedSession?.id === session.id 
                  ? 'bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]' 
                  : 'bg-white hover:bg-gray-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                  {session.startTime?.toDate().toLocaleDateString()}
                </span>
                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 ${
                  session.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {session.status}
                </span>
              </div>
              <h4 className="font-bold text-sm mb-1 truncate">
                {user.role === 'principal' ? session.teacherName : 'Class Session'}
              </h4>
              <div className="flex items-center gap-3 text-[10px] font-mono opacity-60">
                <span className="flex items-center gap-1"><Clock size={10} /> {session.startTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {session.metrics && <span className="flex items-center gap-1"><BarChart3 size={10} /> {session.metrics.clarityScore}% Clarity</span>}
              </div>
            </button>
          ))
        )}
      </div>

      <div className="lg:col-span-2">
        {selectedSession ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-4xl font-black tracking-tighter uppercase italic mb-2">Session Report</h3>
                <p className="font-mono text-xs text-gray-500 uppercase">
                  {selectedSession.teacherName} • {selectedSession.startTime?.toDate().toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <div className="p-3 border border-black text-center min-w-[80px]">
                  <p className="text-[8px] font-bold uppercase text-gray-400 mb-1">Clarity</p>
                  <p className="text-xl font-black">{selectedSession.metrics?.clarityScore || 0}%</p>
                </div>
                <div className="p-3 border border-black text-center min-w-[80px]">
                  <p className="text-[8px] font-bold uppercase text-gray-400 mb-1">Mistakes</p>
                  <p className="text-xl font-black text-red-600">{selectedSession.metrics?.mistakeCount || 0}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <section>
                <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                  <FileText size={12} /> AI Summary
                </h5>
                <div className="bg-gray-50 p-4 border-l-2 border-black font-mono text-xs leading-relaxed">
                  {selectedSession.summary || 'Summary being generated...'}
                </div>
              </section>
              
              <section>
                <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                  <AlertCircle size={12} /> Key Metrics
                </h5>
                <div className="space-y-4">
                  <MetricRow label="Student Engagement" value={selectedSession.metrics?.engagement || 0} />
                  <MetricRow label="Teaching Speed" value={selectedSession.metrics?.speed || 0} />
                  <MetricRow label="Concept Clarity" value={selectedSession.metrics?.clarityScore || 0} />
                </div>
              </section>
            </div>

            <section>
              <h5 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Full Transcript</h5>
              <div className="max-h-48 overflow-auto bg-gray-50 p-4 border border-black/10 text-xs font-mono text-gray-600 leading-relaxed italic">
                {selectedSession.transcript || 'No transcript available.'}
              </div>
            </section>
          </motion.div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-black/10 text-gray-300 p-12">
            <ChevronRight size={48} className="mb-4" />
            <p className="font-bold uppercase tracking-widest text-sm">Select a session to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string, value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 border border-black/10">
        <div className="h-full bg-black" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
