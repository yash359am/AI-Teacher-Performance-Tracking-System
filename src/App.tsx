import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, updateDoc, getDocFromServer } from 'firebase/firestore';
import { UserProfile } from './types';
import { handleFirestoreError, OperationType } from './utils/firestoreErrorHandler';
import { LogIn, LogOut, LayoutDashboard, Video, Users, Bell, Settings, ChevronRight, Play, Square, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CameraView from './components/CameraView';
import SessionList from './components/SessionList';
import PrincipalDashboard from './components/PrincipalDashboard';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>({
    uid: 'default-user',
    email: 'teacher@eduvision.ai',
    displayName: 'Default Teacher',
    role: 'teacher',
    createdAt: new Date(),
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'record' | 'sessions' | 'admin'>('dashboard');

  useEffect(() => {
    // Connection test
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  const handleLogout = () => {
    alert("Authentication is disabled. You cannot log out.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-black rounded-full mb-4"></div>
          <p className="font-mono text-sm uppercase tracking-widest">Initializing EduVision...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-black bg-white flex flex-col">
        <div className="p-6 border-bottom border-black">
          <h2 className="text-2xl font-black tracking-tighter uppercase italic">EduVision</h2>
          <div className="mt-1 px-2 py-0.5 bg-black text-white text-[10px] uppercase font-bold inline-block">
            {user.role}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavButton 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
          />
          {user.role === 'teacher' && (
            <NavButton 
              active={activeTab === 'record'} 
              onClick={() => setActiveTab('record')}
              icon={<Video size={18} />}
              label="Start Recording"
            />
          )}
          <NavButton 
            active={activeTab === 'sessions'} 
            onClick={() => setActiveTab('sessions')}
            icon={<Users size={18} />}
            label="Past Sessions"
          />
          {user.role === 'principal' && (
            <NavButton 
              active={activeTab === 'admin'} 
              onClick={() => setActiveTab('admin')}
              icon={<Settings size={18} />}
              label="Admin Panel"
            />
          )}
        </nav>

        <div className="p-4 border-t border-black">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs font-bold">
              {user.displayName?.[0] || user.email[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{user.displayName}</p>
              <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <div className="p-2 bg-gray-100 border border-black mb-4">
            <p className="text-[8px] font-bold uppercase tracking-widest text-gray-500 mb-1">Dev: Switch Role</p>
            <button 
              onClick={() => {
                const newRole = user.role === 'teacher' ? 'principal' : 'teacher';
                setUser({ ...user, role: newRole });
              }}
              className="w-full bg-white border border-black py-1 text-[8px] font-bold uppercase hover:bg-black hover:text-white transition-colors"
            >
              To {user.role === 'teacher' ? 'Principal' : 'Teacher'}
            </button>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-600 hover:bg-red-50 p-2 transition-colors"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <header className="mb-8">
                <h1 className="text-5xl font-black tracking-tighter uppercase italic mb-2">Welcome back</h1>
                <p className="font-mono text-sm text-gray-600">Overview of your teaching performance and recent activity.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard label="Avg. Clarity" value="84%" trend="+2.4%" />
                <StatCard label="Teaching Speed" value="Normal" trend="Optimal" />
                <StatCard label="Engagement" value="High" trend="+5.1%" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {user.role === 'principal' && (
                      <div className="bg-emerald-50 border border-emerald-600 p-6 shadow-[4px_4px_0px_0px_rgba(5,150,105,1)] lg:col-span-2">
                        <h3 className="font-bold uppercase tracking-widest text-xs mb-2 flex items-center gap-2 text-emerald-800">
                          <Video size={14} /> Principal Mode Active
                        </h3>
                        <p className="text-sm text-emerald-900 mb-4">
                          You are currently viewing the dashboard as a <strong>Principal</strong>. To start a live teaching session and use the AI analysis tools, please switch to the <strong>Teacher</strong> role using the button in the sidebar.
                        </p>
                        <button 
                          onClick={() => {
                            setUser({ ...user, role: 'teacher' });
                          }}
                          className="bg-emerald-600 text-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                        >
                          Switch to Teacher Role Now
                        </button>
                      </div>
                    )}
                
                <div className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h3 className="font-bold uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                    <Bell size={14} /> Recent Alerts
                  </h3>
                  <div className="space-y-4">
                    <AlertItem 
                      type="mistake" 
                      message="Incorrect formula used in Physics session" 
                      time="2h ago"
                    />
                    <AlertItem 
                      type="speed" 
                      message="Speaking speed was too fast in last 10 mins" 
                      time="4h ago"
                    />
                  </div>
                </div>
                
                <div className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <h3 className="font-bold uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                    <CheckCircle2 size={14} /> Quick Actions
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {user.role === 'teacher' && (
                      <button 
                        onClick={() => setActiveTab('record')}
                        className="flex flex-col items-center justify-center p-4 border border-black hover:bg-black hover:text-white transition-all group"
                      >
                        <Play size={24} className="mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">New Session</span>
                      </button>
                    )}
                    <button 
                      onClick={() => setActiveTab('sessions')}
                      className={`flex flex-col items-center justify-center p-4 border border-black hover:bg-black hover:text-white transition-all group ${user.role !== 'teacher' ? 'col-span-2' : ''}`}
                    >
                      <Users size={24} className="mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">History</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'record' && user.role === 'teacher' && (
            <motion.div 
              key="record"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="h-full"
            >
              <CameraView user={user} onComplete={() => setActiveTab('sessions')} />
            </motion.div>
          )}

          {activeTab === 'sessions' && (
            <motion.div 
              key="sessions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <SessionList user={user} />
            </motion.div>
          )}

          {activeTab === 'admin' && user.role === 'principal' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <PrincipalDashboard />
            </motion.div>
          )}

          {/* Fallback for invalid states */}
          {((activeTab === 'record' && user.role !== 'teacher') || (activeTab === 'admin' && user.role !== 'principal')) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-gray-400"
            >
              <AlertTriangle size={48} className="mb-4" />
              <p className="font-bold uppercase tracking-widest">Access Denied</p>
              <button 
                onClick={() => setActiveTab('dashboard')}
                className="mt-4 underline text-xs font-bold uppercase tracking-widest hover:text-black"
              >
                Return to Dashboard
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-tight transition-all ${
        active 
          ? 'bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]' 
          : 'hover:bg-gray-100 text-gray-600'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ label, value, trend }: { label: string, value: string, trend: string }) {
  return (
    <div className="bg-white border border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <h4 className="text-3xl font-black tracking-tighter">{value}</h4>
        <span className="text-[10px] font-bold text-emerald-600">{trend}</span>
      </div>
    </div>
  );
}

function AlertItem({ type, message, time }: { type: string, message: string, time: string }) {
  return (
    <div className="flex items-start gap-3 p-3 border-l-2 border-black bg-gray-50">
      <div className={`mt-0.5 ${type === 'mistake' ? 'text-red-600' : 'text-amber-600'}`}>
        <AlertTriangle size={16} />
      </div>
      <div className="flex-1">
        <p className="text-xs font-bold leading-tight">{message}</p>
        <p className="text-[10px] text-gray-400 mt-1 uppercase font-mono">{time}</p>
      </div>
    </div>
  );
}
