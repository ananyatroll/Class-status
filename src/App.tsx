/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  addDoc,
  updateDoc,
  handleFirestoreError,
  OperationType,
  getDoc,
  deleteDoc,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signInAnonymously
} from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  LogOut, 
  Plus, 
  Trash2, 
  Edit3, 
  Edit2,
  Bell,
  Calendar,
  Home,
  User as UserIcon,
  ChevronRight,
  Search,
  Filter,
  Mail,
  Lock,
  Hash,
  UserPlus,
  LogIn,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  History,
  Star,
  Stethoscope,
  FileText,
  Send,
  Check,
  X,
  Download,
  MessageSquare,
  LayoutGrid,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';

// --- Types ---

type ClassStatus = 'normal' | 'canceled' | 'delayed' | 'moved' | 'in-progress' | 'upcoming' | 'fulfilled';

interface ClassUpdate {
  id: string;
  name: string;
  instructor: string;
  status: ClassStatus;
  details: string;
  dayOfWeek: string;
  time: string;
  room?: string;
  duration?: string;
  attendanceCode?: string;
  updatedAt: any;
  updatedBy: string;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'student' | 'admin';
  phoneNumber?: string | null;
  studentId?: string;
}

interface Deadline {
  id: string;
  title: string;
  type: 'assignment' | 'test' | 'meeting' | 'quiz' | 'other';
  dueDate: string;
  course: string;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  createdAt: any;
}

interface SickLeave {
  id: string;
  studentId: string;
  studentName: string;
  reason: string;
  type: 'illness' | 'event';
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  adminComment?: string;
}

interface AttendanceRecord {
  id: string;
  uid: string;
  studentId: string;
  studentName: string;
  timestamp: string;
  classId: string;
  className: string;
}

const adminEmails = ['ananyabayable06@gmail.com', 'amira.ugr-1450-18@aau.edu.et', 'bereket.ugr-6706-18@aau.edu.et'];

// --- Components ---

const StatusBadge = ({ status, duration }: { status: ClassStatus, duration?: string }) => {
  const configs = {
    normal: { color: 'text-emerald-600 bg-emerald-50 border-emerald-100', label: 'NORMAL' },
    canceled: { color: 'text-red-600 bg-red-50 border-red-100', label: 'CANCELED' },
    delayed: { color: 'text-amber-600 bg-amber-50 border-amber-100', label: `DELAYED${duration ? ` (${duration})` : ''}` },
    moved: { color: 'text-blue-600 bg-blue-50 border-blue-100', label: 'MOVED' },
    'in-progress': { color: 'text-emerald-600 bg-emerald-50 border-emerald-100', label: 'IN PROGRESS' },
    upcoming: { color: 'text-blue-600 bg-blue-50 border-blue-100', label: 'UPCOMING' },
    fulfilled: { color: 'text-purple-600 bg-purple-50 border-purple-100', label: 'FULFILLED' },
  };

  const config = configs[status];

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${config.color}`}>
      {config.label}
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: 'low' | 'medium' | 'high' }) => {
  const configs = {
    low: { color: 'text-emerald-500', label: 'LOW' },
    medium: { color: 'text-amber-500', label: 'MEDIUM' },
    high: { color: 'text-red-500', label: 'HIGH' },
  };

  const config = configs[priority];

  return (
    <span className={`text-[10px] font-bold ${config.color}`}>
      {config.label}
    </span>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [classes, setClasses] = useState<ClassUpdate[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const lastClassesRef = useRef<Record<string, ClassStatus>>({});
  const notifiedClassesRef = useRef<Set<string>>(new Set());
  const [editingClass, setEditingClass] = useState<ClassUpdate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDay, setFilterDay] = useState('All');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  
  // Auth UI States
  const [authMode, setAuthMode] = useState<'selection' | 'email-login' | 'email-signup'>('selection');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Deadline Form State
  const [deadlineTitle, setDeadlineTitle] = useState('');
  const [deadlineType, setDeadlineType] = useState<'assignment' | 'test' | 'meeting' | 'quiz' | 'other'>('assignment');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineCourse, setDeadlineCourse] = useState('');
  const [deadlinePriority, setDeadlinePriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [deadlineNotes, setDeadlineNotes] = useState('');
  const [isAddingDeadline, setIsAddingDeadline] = useState(false);
  const [showPastDeadlines, setShowPastDeadlines] = useState(false);
  const [deadlineSearch, setDeadlineSearch] = useState('');
  const [deadlineSort, setDeadlineSort] = useState<'urgency' | 'date'>('urgency');
  const [importantDeadlineIds, setImportantDeadlineIds] = useState<Set<string>>(new Set());
  const [sickLeaves, setSickLeaves] = useState<SickLeave[]>([]);
  const [sickLeaveSearch, setSickLeaveSearch] = useState('');
  const [isSubmittingSickLeave, setIsSubmittingSickLeave] = useState(false);
  const [sickLeaveType, setSickLeaveType] = useState<'illness' | 'event'>('illness');
  const [sickLeaveReason, setSickLeaveReason] = useState('');
  const [sickLeaveStart, setSickLeaveStart] = useState('');
  const [sickLeaveEnd, setSickLeaveEnd] = useState('');

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isSigningAttendance, setIsSigningAttendance] = useState(false);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<string>('');
  const [attendancePassword, setAttendancePassword] = useState('');
  const [activeTab, setActiveTab] = useState<'status' | 'schedule' | 'deadlines' | 'profile' | 'sick-leave' | 'attendance'>('status');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // OTP States
  const [otpStep, setOtpStep] = useState<'email' | 'otp'>('email');
  const [generatedOtp, setGeneratedOtp] = useState<string>('');
  const [enteredOtp, setEnteredOtp] = useState<string>('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [pendingAuthAction, setPendingAuthAction] = useState<'login' | 'signup' | null>(null);

  const sendOtpEmail = async (targetEmail: string, otp: string) => {
    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, otp }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send email');
      
      if (data.demo) {
        alert(`[DEMO] OTP sent to ${targetEmail}: ${otp}`);
      } else {
        // No alert needed for real success, or a subtle toast
      }
    } catch (error: any) {
      console.error('Email send error:', error);
      setAuthError(`Failed to send email: ${error.message}`);
    }
  };

  const days = ['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Request Notification Permission
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  useEffect(() => {
    if (isAuthReady && user) {
      requestNotificationPermission();
    }
  }, [isAuthReady, user]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            // Ensure bootstrap admin always has admin role
            if (adminEmails.includes(currentUser.email || '') && data.role !== 'admin') {
              data.role = 'admin';
              await updateDoc(doc(db, 'users', currentUser.uid), { role: 'admin' });
            }
            setProfile(data);
            setIsAdmin(data.role === 'admin');
            if (data.studentId) setStudentId(data.studentId);
            if (data.displayName) setDisplayName(data.displayName);
          } else {
            const role = adminEmails.includes(currentUser.email || '') ? 'admin' : 'student';
            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: displayName || currentUser.displayName || (currentUser.phoneNumber ? `User ${currentUser.phoneNumber.slice(-4)}` : 'Student'),
              role: role as 'student' | 'admin',
              phoneNumber: currentUser.phoneNumber || null,
              studentId: studentId || ''
            };
            await setDoc(doc(db, 'users', currentUser.uid), newProfile);
            setProfile(newProfile);
            setIsAdmin(role === 'admin');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setProfile(null);
        setIsAdmin(false);
        setStudentId('');
        setDisplayName('');
      }
      setIsAuthReady(true);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Classes Listener with Notification Logic
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'classes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassUpdate));
      
      // Sort in memory to avoid index requirements
      const sortedClasses = [...newClasses].sort((a, b) => {
        const dayOrder: Record<string, number> = {
          'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7
        };
        const dayDiff = (dayOrder[a.dayOfWeek] || 0) - (dayOrder[b.dayOfWeek] || 0);
        if (dayDiff !== 0) return dayDiff;
        return a.time.localeCompare(b.time);
      });

      // Check for changes to trigger notifications
      sortedClasses.forEach(newClass => {
        const oldStatus = lastClassesRef.current[newClass.id];
        if (oldStatus !== undefined && oldStatus !== newClass.status && newClass.status !== 'normal') {
          triggerNotification(newClass);
        }
      });

      // Update ref and state
      const statusMap: Record<string, ClassStatus> = {};
      sortedClasses.forEach(c => statusMap[c.id] = c.status);
      lastClassesRef.current = statusMap;
      setClasses(sortedClasses);
    }, (error) => {
      console.error('Classes Listener error:', error);
      handleFirestoreError(error, OperationType.LIST, 'classes');
    });

    return unsubscribe;
  }, [isAuthReady, user]);

  // Upcoming Class Reminders
  useEffect(() => {
    if (!isAuthReady || !user || notificationPermission !== 'granted') return;

    const checkReminders = () => {
      const now = new Date();
      const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
      const currentTime = now.getHours() * 60 + now.getMinutes();

      // Reset notified classes if it's a new day
      const todayStr = now.toDateString();
      if ((window as any).lastReminderDate !== todayStr) {
        notifiedClassesRef.current.clear();
        (window as any).lastReminderDate = todayStr;
      }

      classes.forEach(c => {
        if (c.dayOfWeek === currentDay && !notifiedClassesRef.current.has(c.id) && c.status === 'normal') {
          try {
            // Parse c.time (e.g., "10:00 AM")
            const parts = c.time.split(' ');
            if (parts.length !== 2) return;
            
            const [timeStr, modifier] = parts;
            let [hours, minutes] = timeStr.split(':').map(Number);
            if (modifier === 'PM' && hours < 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;
            
            const classTime = hours * 60 + minutes;
            const diff = classTime - currentTime;

            // Notify if class starts in 15 minutes or less, but not if it already started
            if (diff > 0 && diff <= 15) {
              new Notification(`Upcoming Class: ${c.name}`, {
                body: `Your class with ${c.instructor} starts in ${diff} minutes at ${c.time} in ${c.room || 'TBA'}.`,
                icon: '/favicon.ico'
              });
              notifiedClassesRef.current.add(c.id);
            }
          } catch (e) {
            console.error("Error parsing class time for reminder:", e);
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 60000); // Check every minute
    checkReminders(); // Initial check

    return () => clearInterval(interval);
  }, [isAuthReady, user, classes, notificationPermission]);

  // Deadlines Listener
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'deadlines'), orderBy('dueDate'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const deadlineData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deadline));
      setDeadlines(deadlineData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'deadlines');
    });

    return unsubscribe;
  }, [isAuthReady, user]);

  // Important Deadlines Listener
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = collection(db, 'users', user.uid, 'important_deadlines');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set(snapshot.docs.map(doc => doc.id));
      setImportantDeadlineIds(ids);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/important_deadlines`);
    });

    return unsubscribe;
  }, [isAuthReady, user]);

  // Sick Leaves Listener
  useEffect(() => {
    if (!isAuthReady || !user) return;

    let q;
    const isHardcodedAdmin = adminEmails.includes(user.email || '');
    if (isAdmin && isHardcodedAdmin) {
      q = query(collection(db, 'sick_leaves'), orderBy('submittedAt', 'desc'));
    } else {
      q = query(collection(db, 'sick_leaves'), where('studentId', '==', user.uid), orderBy('submittedAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leaves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SickLeave));
      setSickLeaves(leaves);
    }, (error) => {
      // If it's a permission error, it might be because isAdmin hasn't propagated to rules yet
      // or missing index for student query. We log but don't throw to prevent crash.
      console.error('Sick Leaves Listener error:', error);
      if (error instanceof Error && !error.message.includes('permission-denied')) {
        handleFirestoreError(error, OperationType.LIST, 'sick_leaves');
      }
    });

    return unsubscribe;
  }, [isAuthReady, user, isAdmin]);

  // Attendance Listener
  useEffect(() => {
    if (!isAuthReady || !user) return;

    let q;
    const isHardcodedAdmin = adminEmails.includes(user.email || '');
    if (isAdmin && isHardcodedAdmin) {
      q = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'));
    } else {
      q = query(collection(db, 'attendance'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attendanceData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setAttendance(attendanceData);
    }, (error) => {
      console.error('Attendance Listener error:', error);
      if (error instanceof Error && !error.message.includes('permission-denied')) {
        handleFirestoreError(error, OperationType.LIST, 'attendance');
      }
    });

    return unsubscribe;
  }, [isAuthReady, user, isAdmin]);

  const handleUpdateProfile = async () => {
    if (!user || !profile) return;
    if (!studentId || studentId.trim().length < 5) {
      alert('Please enter a valid Student ID');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        studentId: studentId,
        displayName: displayName || profile.displayName
      });
      setProfile({ ...profile, studentId, displayName: displayName || profile.displayName });
      alert('Profile updated successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const triggerNotification = (classUpdate: ClassUpdate) => {
    if (notificationPermission === 'granted') {
      const title = `${classUpdate.name} ${classUpdate.status.charAt(0).toUpperCase() + classUpdate.status.slice(1)} Today`;
      const body = `${classUpdate.instructor}'s class at ${classUpdate.time} has been ${classUpdate.status}. ${classUpdate.details || ''}`;
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  };

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      requestNotificationPermission();
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        setAuthError('The login popup was closed before completion. Please try again.');
      } else {
        setAuthError(error.message);
      }
      console.error("Login failed:", error);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) {
      setAuthError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters');
      return;
    }
    if (!email.includes('@')) {
      setAuthError('Please enter a valid email address');
      return;
    }
    setAuthError(null);
    try {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);
      setPendingAuthAction('signup');
      setOtpStep('otp');
      
      // Send real email via backend
      await sendOtpEmail(email, otp);
      console.log(`[AUTH] OTP for ${email}: ${otp}`);
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError('Please enter email and password');
      return;
    }
    setAuthError(null);
    try {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);
      setPendingAuthAction('login');
      setOtpStep('otp');
      
      await sendOtpEmail(email, otp);
      console.log(`[AUTH] OTP for ${email}: ${otp}`);
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredOtp !== generatedOtp) {
      setAuthError('Invalid OTP. Please try again.');
      return;
    }

    setIsVerifyingOtp(true);
    setAuthError(null);
    try {
      if (pendingAuthAction === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
      } else if (pendingAuthAction === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      }
      requestNotificationPermission();
      setOtpStep('email');
      setGeneratedOtp('');
      setEnteredOtp('');
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSaveDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || profile.role !== 'admin') return;

    const deadlineData = {
      title: deadlineTitle,
      type: deadlineType,
      dueDate: deadlineDate,
      course: deadlineCourse,
      priority: deadlinePriority,
      notes: deadlineNotes,
      createdAt: new Date().toISOString()
    };

    try {
      const docRef = doc(collection(db, 'deadlines'));
      await setDoc(docRef, { ...deadlineData, id: docRef.id });
      setDeadlineTitle('');
      setDeadlineType('assignment');
      setDeadlineDate('');
      setDeadlineCourse('');
      setDeadlinePriority('medium');
      setDeadlineNotes('');
      setIsAddingDeadline(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'deadlines');
    }
  };

  const handleDeleteDeadline = async (id: string) => {
    if (!profile || profile.role !== 'admin') return;
    try {
      await deleteDoc(doc(db, 'deadlines', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'deadlines');
    }
  };

  const toggleImportant = async (deadlineId: string) => {
    if (!user) return;
    const isImportant = importantDeadlineIds.has(deadlineId);
    const docRef = doc(db, 'users', user.uid, 'important_deadlines', deadlineId);

    try {
      if (isImportant) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, {
          deadlineId,
          markedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/important_deadlines`);
    }
  };

  const handleSubmitSickLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const leaveData = {
      studentId: profile?.studentId || user.uid,
      studentName: profile?.displayName || user.displayName || 'Student',
      reason: sickLeaveReason,
      type: sickLeaveType,
      startDate: sickLeaveStart,
      endDate: sickLeaveEnd,
      status: 'pending',
      submittedAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'sick_leaves'), leaveData);
      setSickLeaveReason('');
      setSickLeaveStart('');
      setSickLeaveEnd('');
      setIsSubmittingSickLeave(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sick_leaves');
    }
  };

  const handleSignAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !selectedClassForAttendance) return;

    if (user.isAnonymous) {
      alert('Guest users cannot sign attendance. Please sign in with an account.');
      return;
    }

    const selectedClass = classes.find(c => c.id === selectedClassForAttendance);
    if (!selectedClass) return;

    if (selectedClass.attendanceCode && attendancePassword !== selectedClass.attendanceCode) {
      alert('Incorrect attendance password. Please check with your instructor.');
      return;
    }

    const attendanceRecord = {
      uid: user.uid,
      studentId: profile.studentId,
      studentName: profile.displayName,
      timestamp: new Date().toISOString(),
      classId: selectedClass.id,
      className: selectedClass.name
    };

    try {
      await addDoc(collection(db, 'attendance'), attendanceRecord);
      setIsSigningAttendance(false);
      setSelectedClassForAttendance('');
      setAttendancePassword('');
      alert('Attendance signed successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'attendance');
    }
  };

  const handleExportAttendance = () => {
    if (!isAdmin || attendance.length === 0) return;

    const headers = ['Full Name', 'Student ID', 'Class Name', 'Time of Signage'];
    const rows = attendance.map(record => [
      record.studentName,
      record.studentId,
      record.className,
      new Date(record.timestamp).toLocaleString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdateSickLeaveStatus = async (id: string, status: 'approved' | 'rejected', comment?: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'sick_leaves', id), {
        status,
        adminComment: comment || ''
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'sick_leaves');
    }
  };

  const getDaysLeft = (dueDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const upcomingDeadlines = useMemo(() => {
    let filtered = deadlines.filter(d => getDaysLeft(d.dueDate) >= 0);
    
    if (deadlineSearch) {
      const query = deadlineSearch.toLowerCase();
      filtered = filtered.filter(d => 
        d.title.toLowerCase().includes(query) || 
        d.course.toLowerCase().includes(query) ||
        d.type.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      // Prioritize important deadlines
      const aImportant = importantDeadlineIds.has(a.id);
      const bImportant = importantDeadlineIds.has(b.id);
      
      if (aImportant && !bImportant) return -1;
      if (!aImportant && bImportant) return 1;

      if (deadlineSort === 'urgency') {
        return getDaysLeft(a.dueDate) - getDaysLeft(b.dueDate);
      } else {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
    });
  }, [deadlines, deadlineSearch, deadlineSort, importantDeadlineIds]);

  const pastDeadlines = useMemo(() => 
    deadlines.filter(d => getDaysLeft(d.dueDate) < 0)
      .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()),
    [deadlines]
  );

  const setupRecaptcha = () => {
    // Recaptcha removed
  };

  const handleSaveClass = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile || profile.role !== 'admin') {
      console.error('Unauthorized: Only admins can save classes');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const classData = {
      name: formData.get('name') as string,
      instructor: formData.get('instructor') as string,
      status: formData.get('status') as ClassStatus,
      details: formData.get('details') as string,
      dayOfWeek: formData.get('dayOfWeek') as string,
      time: formData.get('time') as string,
      room: formData.get('room') as string,
      duration: formData.get('duration') as string,
      attendanceCode: formData.get('attendanceCode') as string,
      updatedAt: new Date().toISOString(),
      updatedBy: profile.uid,
    };

    console.log('Saving class data:', classData);

    try {
      const id = editingClass?.id || doc(collection(db, 'classes')).id;
      await setDoc(doc(db, 'classes', id), { ...classData, id });
      console.log('Class saved successfully with ID:', id);
      setShowAdminModal(false);
      setEditingClass(null);
    } catch (error) {
      console.error('Error saving class:', error);
      handleFirestoreError(error, OperationType.WRITE, 'classes');
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this class?')) return;
    try {
      await deleteDoc(doc(db, 'classes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'classes');
    }
  };

  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           c.instructor.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDay = filterDay === 'All' || c.dayOfWeek === filterDay;
      return matchesSearch && matchesDay;
    });
  }, [classes, searchQuery, filterDay]);

  const filteredSickLeaves = useMemo(() => {
    return sickLeaves.filter(leave => {
      const matchesSearch = leave.studentName.toLowerCase().includes(sickLeaveSearch.toLowerCase()) || 
                           new Date(leave.submittedAt).toLocaleDateString().includes(sickLeaveSearch);
      return matchesSearch;
    });
  }, [sickLeaves, sickLeaveSearch]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-stone-200 border-t-black rounded-full animate-spin"></div>
          <p className="text-stone-500 font-sans text-sm animate-pulse">Initializing Status Tracker...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 text-center"
        >
          <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg overflow-hidden border border-stone-100">
            <img 
              src="https://lavender-working-anteater-929.mypinata.cloud/ipfs/bafybeibzd7vkkrlwhccxevkc7lpyezsbjm256xnkelsrin3xzt6atssdxy" 
              alt="Class Status Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-4xl font-sans font-bold text-stone-900 mb-3 tracking-tight">Class Status</h1>
          <p className="text-stone-500 mb-10 leading-relaxed">
            Stay updated with real-time class cancellations, delays, and room changes.
          </p>

          <AnimatePresence mode="wait">
            {otpStep === 'otp' ? (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-left space-y-2">
                  <h2 className="text-xl font-bold text-stone-900">Verify Email</h2>
                  <p className="text-sm text-stone-500">Enter the 6-digit code sent to {email}</p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input 
                      type="text" 
                      required
                      maxLength={6}
                      value={enteredOtp}
                      onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all font-mono tracking-[0.5em] text-center text-lg"
                    />
                  </div>

                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs text-left">
                      <AlertCircle size={14} className="shrink-0" />
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isVerifyingOtp}
                    className="w-full py-4 bg-black text-white rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-stone-800 transition-all active:scale-[0.98] shadow-lg shadow-black/10 disabled:opacity-50"
                  >
                    {isVerifyingOtp ? 'Verifying...' : 'Verify & Continue'}
                  </button>

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        const otp = Math.floor(100000 + Math.random() * 900000).toString();
                        setGeneratedOtp(otp);
                        await sendOtpEmail(email, otp);
                        console.log(`[AUTH] Resent OTP for ${email}: ${otp}`);
                      }}
                      className="w-full text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Resend Code
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep('email');
                        setAuthError(null);
                      }}
                      className="w-full text-sm font-bold text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      Change Email
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : authMode === 'selection' && (
              <motion.div
                key="selection"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="space-y-4 mb-8 text-left">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Full Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                      <input 
                        type="text" 
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Student ID</label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                      <input 
                        type="text" 
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="e.g. UGR/1234/15"
                        className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all font-mono"
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 italic">Format: UGR/****/**</p>
                  </div>
                </div>

                <button
                  onClick={handleLogin}
                  className="w-full py-4 bg-black text-white rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-stone-800 transition-all active:scale-[0.98] shadow-lg shadow-black/10"
                >
                  <UserIcon size={20} />
                  Sign in with Google
                </button>

                {authError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs text-left">
                    <AlertCircle size={14} className="shrink-0" />
                    {authError}
                  </div>
                )}

                <div className="flex items-center gap-4 py-2">
                  <div className="h-px bg-stone-200 flex-1" />
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">or</span>
                  <div className="h-px bg-stone-200 flex-1" />
                </div>
                <button
                  onClick={() => setAuthMode('email-login')}
                  className="w-full py-4 bg-white text-stone-900 border border-stone-200 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-stone-50 transition-all active:scale-[0.98]"
                >
                  <Mail size={20} />
                  Continue with Email
                </button>

                <div className="flex items-center gap-4 py-2">
                  <div className="h-px bg-stone-100 flex-1" />
                  <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">or</span>
                  <div className="h-px bg-stone-100 flex-1" />
                </div>

                <button
                  onClick={handleGuestLogin}
                  className="w-full py-4 bg-stone-50 text-stone-600 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-stone-100 transition-all active:scale-[0.98]"
                >
                  <UserIcon size={20} />
                  Continue as Guest
                </button>
              </motion.div>
            )}

            {(authMode === 'email-login' || authMode === 'email-signup') && (
              <motion.div
                key="email-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-left"
              >
                <button 
                  onClick={() => { setAuthMode('selection'); setAuthError(null); }}
                  className="flex items-center gap-2 text-stone-400 hover:text-black mb-6 transition-colors text-sm font-medium"
                >
                  <ArrowLeft size={16} />
                  Back to options
                </button>

                <h2 className="text-2xl font-bold mb-6">
                  {authMode === 'email-login' ? 'Welcome Back' : 'Create Account'}
                </h2>

                <form onSubmit={authMode === 'email-login' ? handleEmailLogin : handleEmailSignup} className="space-y-4">
                  {authMode === 'email-signup' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Full Name</label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input 
                          type="text" 
                          required
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="John Doe"
                          className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all"
                        />
                      </div>
                    </div>
                  )}
                  {authMode === 'email-signup' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Student ID</label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input 
                          type="text" 
                          required
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          placeholder="e.g. UGR/1234/15"
                          className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all font-mono"
                        />
                      </div>
                      <p className="text-[10px] text-stone-400 italic">Format: UGR/****/**</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@university.edu"
                        className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                      <input 
                        type="password" 
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all"
                      />
                    </div>
                  </div>

                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs">
                      <AlertCircle size={14} />
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all shadow-lg shadow-black/10"
                  >
                    {authMode === 'email-login' ? 'Sign In' : 'Create Account'}
                  </button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-stone-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-stone-400 font-bold tracking-widest">Or</span>
                    </div>
                  </div>

                  <button
                    onClick={handleGuestLogin}
                    disabled={loading}
                    className="w-full py-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
                  >
                    <UserIcon size={20} />
                    Continue as Guest
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-stone-500">
                  {authMode === 'email-login' ? "Don't have an account? " : "Already have an account? "}
                  <button 
                    onClick={() => {
                      setAuthMode(authMode === 'email-login' ? 'email-signup' : 'email-login');
                      setAuthError(null);
                    }}
                    className="font-bold text-black hover:underline"
                  >
                    {authMode === 'email-login' ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-10 text-xs text-stone-400">
            Secure access for university students and faculty.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-white text-stone-900 font-sans selection:bg-blue-600 selection:text-white pb-24">
        {/* Missing Student ID Warning */}
        {profile && profile.role === 'student' && !profile.studentId && activeTab !== 'profile' && (
          <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                <AlertCircle size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-900">Student ID Required</p>
                <p className="text-xs text-amber-700">Please complete your profile to use all features.</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('profile')}
              className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-colors"
            >
              FIX NOW
            </button>
          </div>
        )}

        {/* Conditional Header */}
        {activeTab === 'status' && (
          <header className="px-6 pt-8 pb-6">
            <div className="flex justify-between items-center mb-1">
              <h1 className="text-3xl font-bold tracking-tight">Class Status</h1>
              <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center text-xs font-bold text-stone-500">
                {profile?.displayName?.split(' ').map(n => n[0]).join('') || 'JS'}
              </div>
            </div>
            <p className="text-stone-400 font-medium">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          </header>
        )}

        {activeTab === 'schedule' && (
          <header className="px-6 pt-8 pb-4">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold tracking-tight">Class Schedule</h1>
              <div className="flex gap-2">
                {isAdmin && (
                  <button 
                    onClick={() => { setEditingClass(null); setShowAdminModal(true); }}
                    className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200"
                  >
                    <Plus size={24} />
                  </button>
                )}
                <button className="p-2 text-blue-600">
                  <Bell size={24} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {Array.from({ length: 7 }, (_, i) => {
                const today = new Date();
                const day = today.getDay();
                const diff = today.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(new Date().setDate(diff));
                const d = new Date(monday);
                d.setDate(monday.getDate() + i);
                const isSelected = d.toDateString() === selectedDate.toDateString();
                const isToday = d.toDateString() === new Date().toDateString();
                
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(new Date(d))}
                    className={`flex flex-col items-center justify-center min-w-[64px] h-20 rounded-2xl transition-all ${
                      isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border border-stone-100 text-stone-400 font-bold'
                    }`}
                  >
                    <span className={`text-[10px] mb-1 ${isSelected ? 'text-blue-100' : 'text-stone-300'}`}>
                      {d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                    </span>
                    <span className="text-xl">{d.getDate()}</span>
                    {isToday && !isSelected && <div className="w-1 h-1 bg-blue-600 rounded-full mt-1" />}
                  </button>
                );
              })}
            </div>
          </header>
        )}

        {activeTab === 'deadlines' && (
          <header className="px-6 pt-8 pb-6">
            <div className="flex justify-between items-center mb-1">
              <h1 className="text-3xl font-bold tracking-tight">My Schedule</h1>
              {isAdmin && (
                <button 
                  onClick={() => setIsAddingDeadline(true)}
                  className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200"
                >
                  <Plus size={24} />
                </button>
              )}
            </div>
            <p className="text-stone-400 font-medium">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          </header>
        )}

        {activeTab === 'profile' && (
          <header className="px-6 pt-8 pb-6">
            <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          </header>
        )}

        {activeTab === 'sick-leave' && (
          <header className="px-6 pt-8 pb-6">
            <div className="flex justify-between items-center mb-1">
              <h1 className="text-3xl font-bold tracking-tight">Medical Leave</h1>
              {!isAdmin && !user?.isAnonymous && (
                <button 
                  onClick={() => setIsSubmittingSickLeave(true)}
                  className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200"
                >
                  <Plus size={24} />
                </button>
              )}
            </div>
            <p className="text-stone-400 font-medium">Submit & Track Requests</p>
          </header>
        )}

        <main className="px-6">
          <AnimatePresence mode="wait">
            {activeTab === 'status' && (
              <motion.div
                key="status"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <section>
                  {(() => {
                    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
                    const todayClasses = classes.filter(c => c.dayOfWeek === todayName);
                    
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowDayName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });
                    const tomorrowClasses = classes.filter(c => c.dayOfWeek === tomorrowDayName);
                    
                    return (
                      <div className="space-y-8">
                        <div>
                          <div className="flex justify-between items-center mb-6">
                            <h2 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Today's Schedule</h2>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                              {todayClasses.length} TOTAL
                            </span>
                          </div>
                          <div className="space-y-4">
                            {todayClasses.length > 0 ? (
                              todayClasses.map((c) => (
                                <div key={c.id} className="bg-white border border-stone-100 rounded-3xl p-6 flex items-center gap-6 shadow-sm">
                                  <div className="text-center min-w-[60px]">
                                    <p className="text-sm font-bold text-stone-400">{c.time.split(' ')[0]}</p>
                                    <p className="text-[10px] font-bold text-stone-300 uppercase">{c.time.split(' ')[1]}</p>
                                    {c.duration && (
                                      <p className="text-[9px] font-bold text-blue-500 mt-1">{c.duration}</p>
                                    )}
                                  </div>
                                  <div className="h-10 w-px bg-stone-100" />
                                  <div className="flex-1">
                                    <h4 className="font-bold text-stone-900 mb-0.5">{c.name}</h4>
                                    <p className="text-xs text-stone-400 font-medium">{c.room ? `${c.room} • ` : ''}{c.instructor}</p>
                                  </div>
                                  <StatusBadge status={c.status} duration={c.duration} />
                                </div>
                              ))
                            ) : (
                              <div className="py-12 text-center bg-stone-50 rounded-[32px] border border-dashed border-stone-200">
                                <p className="text-stone-400 text-sm font-medium">No classes scheduled for today.</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-6">
                            <h2 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Upcoming Tomorrow</h2>
                            <span className="text-[10px] font-bold text-stone-400 bg-stone-100 px-2 py-1 rounded-lg">
                              {tomorrowClasses.length} TOTAL
                            </span>
                          </div>
                          <div className="space-y-4">
                            {tomorrowClasses.length > 0 ? (
                              tomorrowClasses.map((c) => (
                                <div key={c.id} className="bg-white border border-stone-100 rounded-3xl p-6 flex items-center gap-6 shadow-sm opacity-70">
                                  <div className="text-center min-w-[60px]">
                                    <p className="text-sm font-bold text-stone-400">{c.time.split(' ')[0]}</p>
                                    <p className="text-[10px] font-bold text-stone-300 uppercase">{c.time.split(' ')[1]}</p>
                                  </div>
                                  <div className="h-10 w-px bg-stone-100" />
                                  <div className="flex-1">
                                    <h4 className="font-bold text-stone-900 mb-0.5">{c.name}</h4>
                                    <p className="text-xs text-stone-400 font-medium">{c.room ? `${c.room} • ` : ''}{c.instructor}</p>
                                  </div>
                                  <StatusBadge status={c.status} duration={c.duration} />
                                </div>
                              ))
                            ) : (
                              <div className="py-12 text-center bg-stone-50 rounded-[32px] border border-dashed border-stone-200">
                                <p className="text-stone-400 text-sm font-medium">No classes scheduled for tomorrow.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </section>
              </motion.div>
            )}

            {activeTab === 'schedule' && (
              <motion.div
                key="schedule"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <section>
                  {(() => {
                    const selectedDayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
                    const dayClasses = classes.filter(c => c.dayOfWeek === selectedDayName);
                    const isToday = selectedDate.toDateString() === new Date().toDateString();

                    return (
                      <>
                        <h2 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-6">
                          {isToday ? "Today's Sessions" : `${selectedDayName}'s Sessions`}
                        </h2>
                        <div className="relative pl-8 space-y-6">
                          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-stone-100" />
                          {dayClasses.length > 0 ? (
                            dayClasses.map((c, i) => (
                              <div key={c.id} className="relative">
                                <div className={`absolute -left-[29px] top-2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${isToday && i === 0 ? 'bg-blue-600' : 'bg-stone-200'}`} />
                                <div className="bg-white border border-stone-100 rounded-3xl p-6 shadow-sm">
                                  <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                      <h4 className="text-xl font-bold text-stone-900 mb-1">{c.name}</h4>
                                      <p className="text-sm text-stone-400 font-medium">{c.instructor}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                      <StatusBadge status={isToday && i === 0 ? 'in-progress' : (c.status === 'canceled' ? 'canceled' : 'upcoming')} />
                                      {isAdmin && (
                                        <div className="flex items-center gap-2">
                                          {(() => {
                                            // Check if it's class time to reveal code
                                            const now = new Date();
                                            const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
                                            if (c.dayOfWeek === currentDay) {
                                              try {
                                                const parts = c.time.split(' ');
                                                const [t, mod] = parts;
                                                let [h, m] = t.split(':').map(Number);
                                                if (mod === 'PM' && h < 12) h += 12;
                                                if (mod === 'AM' && h === 12) h = 0;
                                                const classStart = h * 60 + m;
                                                const current = now.getHours() * 60 + now.getMinutes();
                                                // Reveal code 15 mins before and up to 3 hours after start
                                                if (current >= classStart - 15 && current <= classStart + 180) {
                                                  return (
                                                    <div className="px-2 py-1 bg-purple-50 border border-purple-100 rounded-lg flex items-center gap-1.5">
                                                      <Lock size={10} className="text-purple-600" />
                                                      <span className="text-[10px] font-bold text-purple-700 font-mono">{c.attendanceCode}</span>
                                                    </div>
                                                  );
                                                }
                                              } catch (e) {}
                                            }
                                            return null;
                                          })()}
                                          <button 
                                            onClick={() => { setEditingClass(c); setShowAdminModal(true); }}
                                            className="p-2 text-stone-400 hover:text-blue-600 transition-colors"
                                          >
                                            <Edit2 size={16} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-4 sm:gap-6">
                                    <div className="flex items-center gap-2 text-stone-400">
                                      <Clock size={16} />
                                      <span className="text-xs font-bold">{c.time}</span>
                                    </div>
                                    {c.duration && (
                                      <div className="flex items-center gap-2 text-stone-400">
                                        <History size={16} />
                                        <span className="text-xs font-bold">{c.duration}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 text-stone-400">
                                      <MapPin size={16} />
                                      <span className="text-xs font-bold">{c.room || 'TBA'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-12 text-center bg-stone-50 rounded-[32px] border border-dashed border-stone-200">
                              <p className="text-stone-400 text-sm font-medium">No classes scheduled for this day.</p>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </section>
              </motion.div>
            )}

            {activeTab === 'deadlines' && (
              <motion.div
                key="deadlines"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                {[
                  { title: 'Upcoming Tests', type: 'test', color: 'bg-red-500' },
                  { title: 'Quizzes', type: 'quiz', color: 'bg-orange-500' },
                  { title: 'Assignments Due', type: 'assignment', color: 'bg-blue-500' },
                  { title: 'Meetings', type: 'meeting', color: 'bg-purple-500' },
                  { title: 'Other Reminders', type: 'other', color: 'bg-emerald-500' },
                ].map((section) => (
                  <section key={section.type}>
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-6 rounded-full ${section.color}`} />
                        <h2 className="text-xl font-bold">{section.title}</h2>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                        {deadlines.filter(d => d.type === section.type).length} {section.type === 'test' ? 'Pending' : 'Total'}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {deadlines.filter(d => d.type === section.type).map((d) => (
                        <div key={d.id} className="bg-white border border-stone-100 rounded-3xl p-6 flex items-center gap-4 shadow-sm">
                          <button className="w-6 h-6 rounded-full border-2 border-stone-200 flex items-center justify-center hover:border-blue-600 transition-colors">
                            {/* Checkmark placeholder */}
                          </button>
                          <div className="flex-1">
                            <h4 className="font-bold text-stone-900 mb-0.5">{d.title}</h4>
                            <p className="text-xs text-stone-400 font-medium">
                              {d.dueDate} • {d.course}
                            </p>
                          </div>
                          <PriorityBadge priority={d.priority} />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="bg-white border border-stone-100 rounded-3xl p-8 text-center shadow-sm">
                  <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center text-2xl font-bold text-stone-500 mx-auto mb-6">
                    {profile?.displayName?.split(' ').map(n => n[0]).join('') || 'JS'}
                  </div>
                  <h2 className="text-2xl font-bold mb-1">{profile?.displayName}</h2>
                  <p className="text-stone-400 font-medium mb-8">{profile?.email}</p>
                  
                  <div className="space-y-6 text-left">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-stone-50 p-4 rounded-2xl">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Role</p>
                        <p className="font-bold capitalize">{profile?.role}</p>
                      </div>
                      <div className="bg-stone-50 p-4 rounded-2xl">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Status</p>
                        <p className="font-bold text-emerald-600">Active</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Student ID</label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                        <input 
                          type="text" 
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          placeholder="UGR/****/**"
                          className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all font-mono"
                        />
                      </div>
                      <p className="text-[10px] text-stone-400 italic">Format: UGR/****/**</p>
                    </div>

                    <button
                      onClick={handleUpdateProfile}
                      className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-black/10"
                    >
                      Save Profile
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={20} />
                  Sign Out
                </button>
              </motion.div>
            )}

            {activeTab === 'attendance' && (
              <motion.div
                key="attendance"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-sm font-bold text-stone-400 uppercase tracking-widest">Attendance Records</h2>
                  {isAdmin && (
                    <button
                      onClick={handleExportAttendance}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                    >
                      <Download size={14} />
                      Export CSV
                    </button>
                  )}
                </div>

                {!isAdmin && (
                  <button
                    onClick={() => {
                      if (user?.isAnonymous) {
                        alert('Guest users cannot sign attendance. Please sign in with an account.');
                      } else {
                        setIsSigningAttendance(true);
                      }
                    }}
                    className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${
                      user?.isAnonymous 
                        ? 'bg-stone-100 text-stone-400 cursor-not-allowed' 
                        : 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700'
                    }`}
                  >
                    <Check size={20} />
                    Sign My Attendance
                  </button>
                )}

                <div className="space-y-4">
                  {attendance.length > 0 ? (
                    attendance.map((record) => (
                      <div key={record.id} className="bg-white border border-stone-100 rounded-3xl p-5 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-stone-900">{record.studentName}</h4>
                            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{record.studentId}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-blue-600">{record.className}</p>
                            <p className="text-[10px] text-stone-300">{new Date(record.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center bg-stone-50 rounded-[32px] border border-dashed border-stone-200">
                      <Check className="mx-auto text-stone-200 mb-4" size={48} />
                      <h3 className="text-lg font-medium text-stone-900">No attendance records</h3>
                      <p className="text-stone-500 text-sm">Records will appear here once students sign in.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'sick-leave' && (
              <motion.div
                key="sick-leave"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {user?.isAnonymous && (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                    <AlertCircle size={20} className="text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-700">
                      Guest users cannot submit sick leave requests. Please <button onClick={handleLogout} className="font-bold underline">sign in</button> to access this feature.
                    </p>
                  </div>
                )}

                {isAdmin && (
                  <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input 
                      type="text" 
                      value={sickLeaveSearch}
                      onChange={(e) => setSickLeaveSearch(e.target.value)}
                      placeholder="Search student name or date..."
                      className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  {filteredSickLeaves.length > 0 ? (
                    filteredSickLeaves.map((leave) => (
                      <div
                        key={leave.id}
                        className="bg-white border border-stone-100 rounded-3xl p-5 shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-bold text-stone-900">{isAdmin ? leave.studentName : 'Sick Leave Request'}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                                Submitted {new Date(leave.submittedAt).toLocaleDateString()}
                              </p>
                              <span className="w-1 h-1 bg-stone-300 rounded-full" />
                              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">
                                {leave.type || 'Illness'}
                              </p>
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            leave.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                            leave.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {leave.status}
                          </span>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-stone-50 rounded-2xl">
                              <p className="text-[10px] text-stone-400 uppercase font-bold mb-1">From</p>
                              <p className="text-sm font-bold">{leave.startDate}</p>
                            </div>
                            <div className="p-3 bg-stone-50 rounded-2xl">
                              <p className="text-[10px] text-stone-400 uppercase font-bold mb-1">To</p>
                              <p className="text-sm font-bold">{leave.endDate}</p>
                            </div>
                          </div>

                          <div className="p-4 bg-stone-50 rounded-2xl">
                            <p className="text-[10px] text-stone-400 uppercase font-bold mb-1">Reason</p>
                            <p className="text-sm text-stone-600 italic">"{leave.reason}"</p>
                          </div>

                          {leave.adminComment && (
                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                              <p className="text-[10px] text-blue-400 uppercase font-bold mb-1">Admin Comment</p>
                              <p className="text-sm text-blue-700">{leave.adminComment}</p>
                            </div>
                          )}

                          {isAdmin && leave.status === 'pending' && (
                            <div className="pt-4 flex gap-3">
                              <button
                                onClick={() => {
                                  const comment = window.prompt('Add a comment (optional):');
                                  handleUpdateSickLeaveStatus(leave.id, 'approved', comment || undefined);
                                }}
                                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                              >
                                <Check size={16} />
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  const comment = window.prompt('Add a reason for rejection:');
                                  if (comment) handleUpdateSickLeaveStatus(leave.id, 'rejected', comment);
                                }}
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                              >
                                <X size={16} />
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center bg-stone-50 rounded-[32px] border border-dashed border-stone-200">
                      <Stethoscope className="mx-auto text-stone-200 mb-4" size={48} />
                      <h3 className="text-lg font-medium text-stone-900">No requests found</h3>
                      <p className="text-stone-500 text-sm">
                        {isAdmin ? 'All caught up!' : 'Submit a request if you\'re unwell.'}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-stone-100 px-6 py-4 z-40">
          <div className="max-w-md mx-auto flex justify-between items-center">
            {[
              { id: 'status', label: 'STATUS', icon: Home },
              { id: 'schedule', label: 'SCHEDULE', icon: Calendar },
              { id: 'deadlines', label: 'ALERTS', icon: Bell },
              { id: 'attendance', label: 'ATTENDANCE', icon: Check },
              { id: 'sick-leave', label: 'MEDICAL', icon: Stethoscope },
              { id: 'profile', label: 'PROFILE', icon: UserIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex flex-col items-center gap-1 transition-all ${
                  activeTab === tab.id ? 'text-blue-600' : 'text-stone-300'
                }`}
              >
                <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                <span className="text-[10px] font-bold tracking-wider">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Deadline Modal */}
      <AnimatePresence>
        {isAddingDeadline && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">Add New Deadline</h2>
                <button onClick={() => setIsAddingDeadline(false)} className="p-2 hover:bg-stone-100 rounded-full">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSaveDeadline} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Task Title</label>
                  <input 
                    type="text" 
                    required
                    value={deadlineTitle}
                    onChange={(e) => setDeadlineTitle(e.target.value)}
                    placeholder="e.g. Final Project Submission"
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Type</label>
                    <select 
                      value={deadlineType}
                      onChange={(e) => setDeadlineType(e.target.value as any)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all appearance-none"
                    >
                      <option value="assignment">Assignment</option>
                      <option value="test">Test</option>
                      <option value="quiz">Quiz</option>
                      <option value="meeting">Meeting</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Due Date</label>
                    <input 
                      type="date" 
                      required
                      value={deadlineDate}
                      onChange={(e) => setDeadlineDate(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Course</label>
                    <input 
                      type="text" 
                      value={deadlineCourse}
                      onChange={(e) => setDeadlineCourse(e.target.value)}
                      placeholder="e.g. MATH 101"
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Priority</label>
                    <select 
                      value={deadlinePriority}
                      onChange={(e) => setDeadlinePriority(e.target.value as any)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all appearance-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Notes</label>
                  <textarea 
                    value={deadlineNotes}
                    onChange={(e) => setDeadlineNotes(e.target.value)}
                    placeholder="Additional details..."
                    rows={3}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-black/10"
                >
                  Save Deadline
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Modal */}
        <AnimatePresence>
          {showAdminModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAdminModal(false)}
                className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-stone-100 flex justify-between items-center">
                  <h2 className="text-xl font-bold tracking-tight">
                    {editingClass ? 'Edit Class Status' : 'Add New Class'}
                  </h2>
                  <button 
                    onClick={() => setShowAdminModal(false)}
                    className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
                  >
                    <Plus className="rotate-45 text-stone-400" size={20} />
                  </button>
                </div>

                <form onSubmit={handleSaveClass} className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Class Name</label>
                      <input 
                        name="name" 
                        required 
                        defaultValue={editingClass?.name}
                        placeholder="e.g. CS 101"
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-black transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Instructor</label>
                      <input 
                        name="instructor" 
                        defaultValue={editingClass?.instructor}
                        placeholder="e.g. Dr. Smith"
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-black transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Day of Week</label>
                      <select 
                        name="dayOfWeek" 
                        required 
                        defaultValue={editingClass?.dayOfWeek || 'Monday'}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-black transition-all appearance-none text-sm"
                      >
                        {days.filter(d => d !== 'All').map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Time</label>
                      <input 
                        name="time" 
                        required 
                        defaultValue={editingClass?.time}
                        placeholder="e.g. 10:00 AM"
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-black transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Room</label>
                      <input 
                        name="room" 
                        defaultValue={editingClass?.room}
                        placeholder="e.g. 402B"
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-black transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Duration</label>
                      <input 
                        name="duration" 
                        defaultValue={editingClass?.duration}
                        placeholder="e.g. 1h 30m"
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-black transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Status</label>
                      <select 
                        name="status" 
                        required 
                        defaultValue={editingClass?.status || 'normal'}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-black transition-all appearance-none text-sm"
                      >
                        <option value="normal">Normal</option>
                        <option value="canceled">Canceled</option>
                        <option value="delayed">Delayed</option>
                        <option value="moved">Moved</option>
                        <option value="fulfilled">Fulfilled</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Attendance Code (4 digits)</label>
                      <input 
                        name="attendanceCode" 
                        required 
                        maxLength={4}
                        pattern="\d{4}"
                        defaultValue={editingClass?.attendanceCode}
                        placeholder="e.g. 1234"
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-black transition-all text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Details</label>
                    <textarea 
                      name="details" 
                      defaultValue={editingClass?.details}
                      placeholder="Additional info..."
                      rows={2}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-black transition-all resize-none text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-stone-800 transition-all shadow-lg shadow-black/10 active:scale-[0.98]"
                  >
                    {editingClass ? 'Update Status' : 'Create Entry'}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Sick Leave Submission Modal */}
        <AnimatePresence>
          {isSubmittingSickLeave && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold">Submit Sick Leave</h2>
                  <button onClick={() => setIsSubmittingSickLeave(false)} className="p-2 hover:bg-stone-100 rounded-full">
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleSubmitSickLeave} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Type of Request</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setSickLeaveType('illness')}
                        className={`py-3 rounded-xl font-bold text-sm transition-all ${
                          sickLeaveType === 'illness' ? 'bg-blue-600 text-white' : 'bg-stone-50 text-stone-400 border border-stone-200'
                        }`}
                      >
                        Illness
                      </button>
                      <button
                        type="button"
                        onClick={() => setSickLeaveType('event')}
                        className={`py-3 rounded-xl font-bold text-sm transition-all ${
                          sickLeaveType === 'event' ? 'bg-blue-600 text-white' : 'bg-stone-50 text-stone-400 border border-stone-200'
                        }`}
                      >
                        Life Event
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Reason / Details</label>
                    <textarea 
                      required
                      value={sickLeaveReason}
                      onChange={(e) => setSickLeaveReason(e.target.value)}
                      placeholder={sickLeaveType === 'illness' ? "Briefly explain your medical reason..." : "Explain the life event..."}
                      rows={3}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Start Date</label>
                      <input 
                        type="date" 
                        required
                        value={sickLeaveStart}
                        onChange={(e) => setSickLeaveStart(e.target.value)}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">End Date</label>
                      <input 
                        type="date" 
                        required
                        value={sickLeaveEnd}
                        onChange={(e) => setSickLeaveEnd(e.target.value)}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-black/10 flex items-center justify-center gap-2"
                  >
                    <Send size={18} />
                    Submit Request
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-stone-200 mt-12">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 opacity-40">
              <Calendar size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">Class Status Tracker © 2026</span>
            </div>
            <div className="flex gap-8">
              <a href="#" className="text-xs font-bold text-stone-400 uppercase tracking-widest hover:text-black transition-colors">Support</a>
              <a href="#" className="text-xs font-bold text-stone-400 uppercase tracking-widest hover:text-black transition-colors">Privacy</a>
              <a href="#" className="text-xs font-bold text-stone-400 uppercase tracking-widest hover:text-black transition-colors">Terms</a>
            </div>
          </div>
        </footer>
        {/* Attendance Sign-In Modal */}
        <AnimatePresence>
          {isSigningAttendance && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold">Sign Attendance</h2>
                  <button onClick={() => setIsSigningAttendance(false)} className="p-2 hover:bg-stone-100 rounded-full">
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleSignAttendance} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Select Class</label>
                    <select 
                      required
                      value={selectedClassForAttendance}
                      onChange={(e) => setSelectedClassForAttendance(e.target.value)}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all appearance-none"
                    >
                      <option value="">Choose a class...</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.time})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Attendance Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                      <input 
                        type="text" 
                        required
                        maxLength={4}
                        value={attendancePassword}
                        onChange={(e) => setAttendancePassword(e.target.value.replace(/\D/g, ''))}
                        placeholder="Enter 4-digit code"
                        className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:outline-none focus:border-black transition-all font-mono tracking-[0.5em]"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-[10px] text-blue-400 uppercase font-bold mb-1">Your Details</p>
                    <p className="text-sm font-bold text-blue-900">{profile?.displayName}</p>
                    <p className="text-xs text-blue-700">{profile?.studentId}</p>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-black/10 flex items-center justify-center gap-2"
                  >
                    <Check size={18} />
                    Confirm Attendance
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
