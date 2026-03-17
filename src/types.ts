export type UserRole = 'teacher' | 'principal';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt: any;
}

export interface SessionMetrics {
  clarityScore: number;
  speed: number;
  engagement: number;
  mistakeCount: number;
}

export interface Session {
  id: string;
  teacherId: string;
  teacherName: string;
  startTime: any;
  endTime?: any;
  status: 'recording' | 'completed';
  metrics?: SessionMetrics;
  transcript?: string;
  summary?: string;
}

export interface Alert {
  id: string;
  sessionId: string;
  teacherId: string;
  timestamp: any;
  type: 'mistake' | 'speed' | 'clarity' | 'engagement' | 'insight';
  message: string;
  suggestion?: string;
  pedagogicalFeedback?: string;
}
