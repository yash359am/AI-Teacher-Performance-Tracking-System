import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, orderBy, limit, where } from 'firebase/firestore';
import { Session, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { Users, TrendingUp, AlertTriangle, Award, Search } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PrincipalDashboard() {
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch teachers
        const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const teachersSnap = await getDocs(teachersQuery);
        setTeachers(teachersSnap.docs.map(doc => doc.data() as UserProfile));

        // Fetch recent sessions
        const sessionsQuery = query(collection(db, 'sessions'), orderBy('startTime', 'desc'), limit(10));
        const sessionsSnap = await getDocs(sessionsQuery);
        setRecentSessions(sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session)));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'dashboard_data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="animate-pulse font-mono text-xs uppercase tracking-widest">Loading admin data...</div>;

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase italic mb-2">School Overview</h1>
          <p className="font-mono text-sm text-gray-600">Principal's monitoring and performance analysis dashboard.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-black text-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Total Teachers</p>
            <p className="text-2xl font-black">{teachers.length}</p>
          </div>
          <div className="bg-white border border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Avg. Quality</p>
            <p className="text-2xl font-black">82%</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Teacher Performance List */}
        <div className="lg:col-span-2 bg-white border border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold uppercase tracking-widest text-xs flex items-center gap-2">
              <TrendingUp size={14} /> Teacher Performance
            </h3>
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="SEARCH TEACHER..." 
                className="pl-8 pr-4 py-1.5 border border-black text-[10px] font-mono focus:outline-none focus:bg-gray-50"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black">
                  <th className="py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Teacher</th>
                  <th className="py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Avg. Clarity</th>
                  <th className="py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Sessions</th>
                  <th className="py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(teacher => (
                  <tr key={teacher.uid} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {teacher.displayName?.[0]}
                        </div>
                        <div>
                          <p className="text-xs font-bold">{teacher.displayName}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{teacher.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 font-mono text-xs font-bold">84%</td>
                    <td className="py-4 font-mono text-xs">12</td>
                    <td className="py-4">
                      <span className="text-[8px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Critical Alerts Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="font-bold uppercase tracking-widest text-xs mb-4 flex items-center gap-2 text-red-600">
              <AlertTriangle size={14} /> Critical Alerts
            </h3>
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border-l-2 border-red-600">
                <p className="text-xs font-bold mb-1">Conceptual Error: Physics</p>
                <p className="text-[10px] text-gray-500 font-mono mb-2">Teacher: Sarah Jenkins</p>
                <button className="text-[8px] font-bold uppercase tracking-widest underline">Review Session</button>
              </div>
              <div className="p-3 bg-amber-50 border-l-2 border-amber-500">
                <p className="text-xs font-bold mb-1">Low Engagement Detected</p>
                <p className="text-[10px] text-gray-500 font-mono mb-2">Teacher: Robert Chen</p>
                <button className="text-[8px] font-bold uppercase tracking-widest underline">Review Session</button>
              </div>
            </div>
          </div>

          <div className="bg-black text-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.3)]">
            <h3 className="font-bold uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
              <Award size={14} /> Top Performer
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center text-xl font-black">
                M
              </div>
              <div>
                <p className="text-sm font-bold">Maria Garcia</p>
                <p className="text-[10px] opacity-60 font-mono">Mathematics Department</p>
                <div className="mt-1 flex items-center gap-1">
                  <TrendingUp size={10} className="text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-400">96% Quality Score</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
