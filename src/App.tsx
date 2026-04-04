import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  MessageCircle, 
  User as UserIcon, 
  Search, 
  Settings, 
  LogOut, 
  Moon, 
  Sun, 
  ShieldAlert,
  ShieldCheck, 
  Zap,
  Menu,
  X,
  CheckCircle2,
  Crown,
  ChevronRight,
  Star,
  AlertCircle,
  Mail,
  Lock,
  LogIn,
  Camera,
  Plus,
  Trash2,
  Edit3,
  Flag,
  Bell,
  Eye,
  EyeOff,
  Image as ImageIcon,
  ChevronLeft,
  MapPin,
  Sparkles,
  MessageSquare,
  CreditCard,
  Layout,
  BarChart3,
  LifeBuoy,
  Filter,
  Send
} from 'lucide-react';
import { cn } from './lib/utils';
import { User as UserType } from './types';
import { PREDEFINED_INTERESTS } from './constants';
import { format, formatDistanceToNow } from 'date-fns';
import { GoogleGenAI } from "@google/genai";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

// Firebase Imports
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  addDoc,
  getDocFromServer,
  updateDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("[Firebase] Connection test successful.");
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-950 text-white text-center">
        <div className="max-w-md">
          <AlertCircle className="mx-auto mb-4 text-primary" size={48} />
          <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
          <p className="text-slate-400 mb-6">
            {(error?.message && typeof error.message === 'string' && error.message.includes('{')) 
              ? "A database error occurred. Please try again later." 
              : "An unexpected error occurred."}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

// --- Helpers ---
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return Math.round(d);
};

const generateBioWithAI = async (interests: string[], name: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Generate a short, engaging, and friendly dating profile bio for ${name}. 
    Interests: ${interests.join(', ')}. 
    Keep it under 200 characters. 
    Make it sound human and approachable.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    return response.text?.trim() || "";
  } catch (err) {
    console.error("AI Bio Generation Error", err);
    return "";
  }
};

const generateIcebreakerWithAI = async (otherUserName: string, otherUserInterests: string[], myName: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You are a helpful dating wingman. Generate a fun, unique, and non-cheesy icebreaker message for ${myName} to send to ${otherUserName}.
    ${otherUserName}'s interests: ${otherUserInterests.join(', ')}.
    Keep it short, friendly, and based on their interests. 
    Do not use generic lines like "Hey, how are you?". 
    Make it a question or a playful comment.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    
    return response.text?.trim() || "";
  } catch (err) {
    console.error("AI Icebreaker Generation Error", err);
    return "";
  }
};

const calculateCompleteness = (profile: UserType) => {
  let score = 0;
  if (profile.name) score += 10;
  if (profile.age) score += 10;
  if (profile.bio) score += 20;
  if (profile.location) score += 10;
  if (profile.interests && profile.interests.length > 0) score += 20;
  if (profile.images && profile.images.length > 0) score += 30;
  return score;
};

// --- Context ---

const AuthContext = createContext<{
  user: FirebaseUser | null;
  profile: UserType | null;
  loading: boolean;
  isSigningIn: boolean;
  signInError: string | null;
  signIn: () => Promise<void>;
  login: (email: string, pass: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  sendVerification: () => Promise<void>;
  clearError: () => void;
} | null>(null);

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    let statusUnsubscribe: any;
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setUser(u);
      
      if (u) {
        const userDoc = doc(db, 'users', u.uid);
        
        // Listen for profile changes
        statusUnsubscribe = onSnapshot(userDoc, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setProfile({ id: snap.id, ...data } as UserType);
            
            // Update online status if not already online
            if (!data.isOnline) {
              setDoc(userDoc, { 
                isOnline: true, 
                lastSeen: serverTimestamp() 
              }, { merge: true }).catch(err => {
                if (err.code !== 'permission-denied') {
                  console.error("Error updating online status", err);
                }
              });
            }
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (err) => {
          if (err.code !== 'permission-denied') {
            handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    const handleVisibilityChange = async () => {
      if (!auth.currentUser || !profile) return;
      const userDoc = doc(db, 'users', auth.currentUser.uid);

      if (document.visibilityState === 'hidden') {
        await setDoc(userDoc, { 
          isOnline: false, 
          lastSeen: serverTimestamp() 
        }, { merge: true }).catch(err => {
          if (err.code !== 'permission-denied') {
            console.error("Error updating offline status", err);
          }
        });
      } else if (document.visibilityState === 'visible') {
        await setDoc(userDoc, { 
          isOnline: true, 
          lastSeen: serverTimestamp() 
        }, { merge: true }).catch(err => {
          if (err.code !== 'permission-denied') {
            console.error("Error updating online status", err);
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribe();
      if (statusUnsubscribe) statusUnsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const signIn = async (retryCount = 0) => {
    if (isSigningIn && retryCount === 0) return;
    setIsSigningIn(true);
    setSignInError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/network-request-failed' && retryCount < 2) {
        console.log(`Retrying Google sign in... attempt ${retryCount + 1}`);
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return signIn(retryCount + 1);
      }

      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        console.error("Sign in error", error);
        if (error.code === 'auth/network-request-failed') {
          setSignInError("Network error: Please check your connection and try again.");
        } else {
          setSignInError(error.message || "An error occurred during sign in.");
        }
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const login = async (email: string, pass: string, rememberMe: boolean = true, retryCount = 0) => {
    setIsSigningIn(true);
    setSignInError(null);
    try {
      // Attempt to set persistence, but don't let it block the login if it fails
      try {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      } catch (pErr) {
        console.warn("Persistence could not be set:", pErr);
      }
      
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      // Automatic retry for network errors
      if (error.code === 'auth/network-request-failed' && retryCount < 2) {
        console.log(`Retrying login... attempt ${retryCount + 1}`);
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return login(email, pass, rememberMe, retryCount + 1);
      }

      if (error.code === 'auth/network-request-failed') {
        setSignInError("Network error: Please check your connection and try again.");
      } else {
        setSignInError(error.message);
      }
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  const register = async (email: string, pass: string, retryCount = 0) => {
    setIsSigningIn(true);
    setSignInError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await sendEmailVerification(userCredential.user);
    } catch (error: any) {
      if (error.code === 'auth/network-request-failed' && retryCount < 2) {
        console.log(`Retrying registration... attempt ${retryCount + 1}`);
        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
        return register(email, pass, retryCount + 1);
      }

      if (error.code === 'auth/network-request-failed') {
        setSignInError("Network error: Please check your connection and try again.");
      } else {
        setSignInError(error.message);
      }
      throw error;
    } finally {
      setIsSigningIn(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      setSignInError(error.message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (user && profile) {
        const userDoc = doc(db, 'users', user.uid);
        await updateDoc(userDoc, { 
          isOnline: false, 
          lastSeen: serverTimestamp() 
        }).catch(err => console.warn("Could not update online status on logout", err));
      }
      await signOut(auth);
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const sendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const clearError = () => setSignInError(null);

  return (
    <AuthContext.Provider value={{ 
      user, profile, loading, isSigningIn, signInError, 
      signIn, login, register, resetPassword, logout, sendVerification,
      clearError
    }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

// --- Admin Dashboard ---

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'notifications');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unread = notifications.filter(n => !n.read);
    try {
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold">Notifications</h2>
          <span className="text-sm text-slate-500">{notifications.filter(n => !n.read).length} unread</span>
        </div>
        {notifications.some(n => !n.read) && (
          <button 
            onClick={markAllAsRead}
            className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="space-y-4">
        {notifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-3xl border transition-all cursor-pointer",
              notification.read ? "bg-white border-slate-100" : "bg-primary/5 border-primary/20 shadow-sm"
            )}
            onClick={() => markAsRead(notification.id)}
          >
            <div className="flex gap-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                notification.type === 'like' ? "bg-pink-100 text-pink-600" : 
                notification.type === 'match' ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
              )}>
                {notification.type === 'like' ? <Heart size={24} /> : 
                 notification.type === 'match' ? <Zap size={24} /> : <MessageCircle size={24} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="font-bold text-slate-900 truncate">{notification.title}</h3>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {notification.createdAt?.toDate ? formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{notification.message}</p>
              </div>
              {!notification.read && (
                <div className="w-2 h-2 bg-primary rounded-full mt-2" />
              )}
            </div>
          </motion.div>
        ))}

        {notifications.length === 0 && (
          <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
            <Bell className="mx-auto text-slate-300 mb-4" size={48} />
            <h3 className="text-lg font-bold text-slate-700">No notifications yet</h3>
            <p className="text-slate-500">When people like or match with you, you'll see it here!</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Admin Components ---

const ConfirmModal = ({ 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  variant = "danger"
}: { 
  title: string; 
  message: string; 
  onConfirm: () => void; 
  onCancel: () => void; 
  confirmText?: string; 
  cancelText?: string;
  variant?: "danger" | "primary"
}) => (
  <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl"
    >
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-slate-500 mb-8 text-sm">{message}</p>
      <div className="flex gap-3">
        <button 
          onClick={onCancel}
          className="flex-1 py-3 rounded-2xl border border-slate-200 font-bold text-sm hover:bg-slate-50 transition-all"
        >
          {cancelText}
        </button>
        <button 
          onClick={onConfirm}
          className={cn(
            "flex-1 py-3 rounded-2xl text-white font-bold text-sm transition-all",
            variant === "danger" ? "bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200" : "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          )}
        >
          {confirmText}
        </button>
      </div>
    </motion.div>
  </div>
);

const UserEditModal = ({ 
  user, 
  onClose, 
  onSave 
}: { 
  user: UserType; 
  onClose: () => void; 
  onSave: (updatedData: Partial<UserType>) => Promise<void> 
}) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    age: user.age || 18,
    location: user.location || '',
    bio: user.bio || '',
    role: user.role || 'user',
    isPremium: user.isPremium || false,
    isVerified: user.isVerified || false,
    adminRights: user.adminRights || {
      canManageUsers: false,
      canDeleteUsers: false,
      canModerateProfiles: false,
      canMonitorInteractions: false,
      canHandleReports: false,
      canManageVerification: false,
      canControlPayments: false,
      canManageNotifications: false,
      canManageContent: false,
      canViewAnalytics: false,
      canControlLocationPreferences: false,
      canManageSecurity: false,
      canManageSupport: false,
      canEditSettings: false,
      canManageAdmins: false
    }
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">Edit User Profile</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Full Name</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Age</label>
              <input 
                type="number" 
                value={formData.age}
                onChange={e => setFormData(prev => ({ ...prev, age: parseInt(e.target.value) }))}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Role</label>
              <select 
                value={formData.role}
                onChange={e => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none bg-white"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {formData.role === 'admin' && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-3">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1 ml-1">Admin Permissions</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'canManageUsers', label: 'User Management' },
                  { key: 'canDeleteUsers', label: 'Delete Users' },
                  { key: 'canModerateProfiles', label: 'Profile Moderation' },
                  { key: 'canMonitorInteractions', label: 'Interaction Monitoring' },
                  { key: 'canHandleReports', label: 'Report Handling' },
                  { key: 'canManageVerification', label: 'Verification Mgmt' },
                  { key: 'canControlPayments', label: 'Payment Control' },
                  { key: 'canManageNotifications', label: 'Notification Mgmt' },
                  { key: 'canManageContent', label: 'Content Mgmt' },
                  { key: 'canViewAnalytics', label: 'View Analytics' },
                  { key: 'canControlLocationPreferences', label: 'Location Control' },
                  { key: 'canManageSecurity', label: 'Security Control' },
                  { key: 'canManageSupport', label: 'Support Mgmt' },
                  { key: 'canEditSettings', label: 'System Settings' },
                  { key: 'canManageAdmins', label: 'Manage Admins' },
                ].map((permission) => (
                  <label key={permission.key} className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={(formData.adminRights as any)[permission.key]}
                      onChange={e => setFormData(prev => ({ 
                        ...prev, 
                        adminRights: { ...prev.adminRights, [permission.key]: e.target.checked } 
                      }))}
                      className="w-4 h-4 rounded border-amber-200 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-[10px] font-bold text-amber-800">{permission.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Location</label>
            <input 
              type="text" 
              value={formData.location}
              onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Bio</label>
            <textarea 
              value={formData.bio}
              onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all min-h-[100px] resize-none"
            />
          </div>

          <div className="flex gap-4 pt-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={formData.isPremium}
                onChange={e => setFormData(prev => ({ ...prev, isPremium: e.target.checked }))}
                className="w-5 h-5 rounded-lg border-slate-200 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Premium Status</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={formData.isVerified}
                onChange={e => setFormData(prev => ({ ...prev, isVerified: e.target.checked }))}
                className="w-5 h-5 rounded-lg border-slate-200 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Verified Badge</span>
            </label>
          </div>

          <button 
            type="submit" 
            disabled={saving}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50 mt-4"
          >
            {saving ? "Saving Changes..." : "Save Profile"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const AdminDashboard = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<
    'users' | 'moderation' | 'interactions' | 'reports' | 'verification' | 
    'payments' | 'notifications' | 'content' | 'analytics' | 'location' | 
    'security' | 'support' | 'settings'
  >('users');
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [editingContent, setEditingContent] = useState<{ type: 'terms' | 'privacy', value: string } | null>(null);
  const [appSettings, setAppSettings] = useState<any>({
    maintenanceMode: false,
    registrationEnabled: true,
    premiumOnly: false,
    broadcastMessage: '',
    termsOfService: '',
    privacyPolicy: '',
    globalDistanceLimit: 100,
    ageRangeBuffer: 5,
    subscriptionPrice: 99
  });

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeUsers = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserType)));
      setLoading(false);
    });

    const qReports = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribeReports = onSnapshot(qReports, (snap) => {
      setReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAppSettings(prev => ({ ...prev, ...data }));
        setBroadcastMessage(data.broadcastMessage || '');
      }
    });

    const qTickets = query(collection(db, 'support_tickets'), orderBy('createdAt', 'desc'));
    const unsubscribeTickets = onSnapshot(qTickets, (snap) => {
      setSupportTickets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qMatches = query(collection(db, 'matches'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribeMatches = onSnapshot(qMatches, (snap) => {
      setMatches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qLogs = query(collection(db, 'security_logs'), orderBy('timestamp', 'desc'), limit(20));
    const unsubscribeLogs = onSnapshot(qLogs, (snap) => {
      setSecurityLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeUsers();
      unsubscribeReports();
      unsubscribeSettings();
      unsubscribeTickets();
      unsubscribeMatches();
      unsubscribeLogs();
    };
  }, []);

  const { profile: currentAdminProfile } = useAuth();

  const toggleBan = async (userId: string, currentStatus: boolean) => {
    const targetUser = users.find(u => u.id === userId);
    if (targetUser?.role === 'admin') {
      alert("Cannot ban another administrator.");
      return;
    }
    if (!currentAdminProfile?.adminRights?.canManageUsers) {
      alert("You do not have permission to manage users.");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), {
        isBanned: !currentStatus
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const toggleBlock = async (userId: string, currentStatus: boolean) => {
    const targetUser = users.find(u => u.id === userId);
    if (targetUser?.role === 'admin') {
      alert("Cannot block another administrator.");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), {
        isBlocked: !currentStatus
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const updateGlobalSettings = async (newSettings: any) => {
    try {
      await setDoc(doc(db, 'settings', 'global'), newSettings, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    }
  };

  const handleBroadcast = async () => {
    if (isBroadcasting) return;
    setIsBroadcasting(true);
    try {
      await updateGlobalSettings({ broadcastMessage });
      
      if (broadcastMessage.trim()) {
        // Create notifications for users only if there's a message
        const batch = writeBatch(db);
        users.slice(0, 50).forEach(u => {
          const notifRef = doc(collection(db, 'notifications'));
          batch.set(notifRef, {
            userId: u.id,
            type: 'system',
            fromUserId: 'admin',
            title: 'System Announcement',
            message: broadcastMessage,
            read: false,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
        alert("Broadcast message updated and notifications sent to users!");
      } else {
        alert("Broadcast message cleared!");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'broadcast');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), { status, updatedAt: serverTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `support_tickets/${ticketId}`);
    }
  };

  const deleteMatch = async (matchId: string) => {
    try {
      await deleteDoc(doc(db, 'matches', matchId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `matches/${matchId}`);
    }
  };

  const verifyUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        isVerified: true,
        verificationStatus: 'approved'
      });
      alert("User verified successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const rejectVerification = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        verificationStatus: 'rejected',
        verificationSelfie: null
      });
      alert("Verification request rejected.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const resolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  const deleteUser = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (targetUser?.role === 'admin') {
      alert("Cannot delete another administrator.");
      return;
    }
    if (!currentAdminProfile?.adminRights?.canDeleteUsers) {
      alert("You do not have permission to delete users.");
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', userId));
      setConfirmDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    }
  };

  const handleSaveUser = async (updatedData: Partial<UserType>) => {
    if (!editingUser) return;
    if (editingUser.role !== 'admin' && !currentAdminProfile?.adminRights?.canManageUsers) {
      alert("You do not have permission to manage users.");
      return;
    }
    if (editingUser.role === 'admin' && updatedData.adminRights && !currentAdminProfile?.adminRights?.canManageAdmins) {
      alert("You do not have permission to manage administrator rights.");
      return;
    }
    if (editingUser.role === 'admin' && updatedData.role !== 'admin' && !currentAdminProfile?.adminRights?.canManageAdmins) {
      alert("You do not have permission to demote administrators.");
      return;
    }
    if (updatedData.role === 'admin' && editingUser.role !== 'admin' && !currentAdminProfile?.adminRights?.canManageAdmins) {
      alert("You do not have permission to promote users to administrator.");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', editingUser.id), updatedData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${editingUser.id}`);
    }
  };

  const ContentEditModal = ({ type, initialValue, onClose, onSave }: any) => {
    const [value, setValue] = useState(initialValue);
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
        <div className="bg-white rounded-[32px] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-2xl font-bold capitalize">Edit {type === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all"><X size={24} /></button>
          </div>
          <div className="p-8 flex-1 overflow-y-auto">
            <textarea 
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full h-full min-h-[400px] p-6 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary outline-none transition-all font-mono text-sm"
              placeholder={`Enter ${type} content...`}
            />
          </div>
          <div className="p-8 border-t border-slate-100 flex justify-end gap-4">
            <button onClick={onClose} className="px-8 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all">Cancel</button>
            <button onClick={() => onSave(value)} className="px-8 py-3 rounded-2xl font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">Save Changes</button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="pt-32 text-center">Loading Admin Panel...</div>;

  return (
    <div className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold mb-1">Admin Control Panel</h2>
          <p className="text-slate-500">Manage users, monitor activity, and maintain community safety.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <UserIcon size={20} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase">Total Users</div>
              <div className="text-xl font-bold">{users.length}</div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-400/10 rounded-xl flex items-center justify-center text-amber-400">
              <Crown size={20} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase">Premium</div>
              <div className="text-xl font-bold">{users.filter(u => u.isPremium).length}</div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-green-400/10 rounded-xl flex items-center justify-center text-green-400">
              <Zap size={20} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase">Online</div>
              <div className="text-xl font-bold">{users.filter(u => u.isOnline).length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {[
          { id: 'users', label: 'User Management', permission: 'canManageUsers' },
          { id: 'moderation', label: 'Profile Moderation', permission: 'canModerateProfiles' },
          { id: 'interactions', label: 'Interactions', permission: 'canMonitorInteractions' },
          { id: 'reports', label: `Reports (${reports.filter(r => r.status === 'pending').length})`, permission: 'canHandleReports' },
          { id: 'verification', label: 'Verification', permission: 'canManageVerification' },
          { id: 'payments', label: 'Payments', permission: 'canControlPayments' },
          { id: 'notifications', label: 'Notifications', permission: 'canManageNotifications' },
          { id: 'content', label: 'Content', permission: 'canManageContent' },
          { id: 'analytics', label: 'Analytics', permission: 'canViewAnalytics' },
          { id: 'location', label: 'Location Control', permission: 'canControlLocationPreferences' },
          { id: 'security', label: 'Security', permission: 'canManageSecurity' },
          { id: 'support', label: 'Support', permission: 'canManageSupport' },
          { id: 'settings', label: 'App Settings', permission: 'canEditSettings' },
        ].map((tab) => (
          (currentAdminProfile?.adminRights as any)?.[tab.permission] && (
            <button 
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={cn(
                "px-4 py-2 rounded-full font-bold text-xs transition-all",
                activeSubTab === tab.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white text-slate-500 hover:bg-slate-50 border border-black/5"
              )}
            >
              {tab.label}
            </button>
          )
        ))}
        {currentAdminProfile?.adminRights?.canManageAdmins && (
          <button 
            onClick={() => setShowCreateAdmin(true)}
            className="ml-auto px-6 py-2 rounded-full font-bold text-sm bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-2"
          >
            <Plus size={16} />
            Add Admin
          </button>
        )}
      </div>

      {activeSubTab === 'users' && (
        <div className="bg-white rounded-[32px] border border-black/5 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">User</th>
                  <th className="p-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                  <th className="p-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Role</th>
                  <th className="p-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Joined</th>
                  <th className="p-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <img src={u.images?.[0] || `https://picsum.photos/seed/${u.id}/100/100`} className="w-10 h-10 rounded-full object-cover" alt="" />
                        <div>
                          <div className="font-bold text-sm">{u.name}, {u.age}</div>
                          <div className="text-xs text-slate-400">{u.location}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex flex-wrap gap-1">
                        {u.isBanned && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold uppercase">Banned</span>
                        )}
                        {u.isBlocked && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[9px] font-bold uppercase">Blocked</span>
                        )}
                        {!u.isBanned && !u.isBlocked && (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-600 text-[9px] font-bold uppercase">Active</span>
                        )}
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                        u.role === 'admin' ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600"
                      )}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="p-5 text-xs text-slate-500">
                      {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setEditingUser(u)}
                          className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
                          title="Edit User"
                        >
                          <Edit3 size={18} />
                        </button>
                        {u.role !== 'admin' && (
                          <>
                            <button 
                              onClick={() => toggleBlock(u.id, !!u.isBlocked)}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                u.isBlocked ? "bg-orange-50 text-orange-600 hover:bg-orange-100" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                              )}
                              title={u.isBlocked ? "Unblock User" : "Block User"}
                            >
                              <ShieldAlert size={18} />
                            </button>
                            <button 
                              onClick={() => toggleBan(u.id, !!u.isBanned)}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                u.isBanned ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                              )}
                              title={u.isBanned ? "Unban User" : "Ban User"}
                            >
                              <ShieldCheck size={18} />
                            </button>
                            <button 
                              onClick={() => setConfirmDelete(u.id)}
                              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"
                              title="Delete User"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'reports' && (
        <div className="bg-white rounded-[32px] border border-black/5 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Reported User</th>
                  <th className="p-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Reason</th>
                  <th className="p-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Details</th>
                  <th className="p-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                  <th className="p-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => {
                  const reportedUser = users.find(u => u.id === r.reportedId);
                  return (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <img src={reportedUser?.images?.[0] || `https://picsum.photos/seed/${r.reportedId}/100/100`} className="w-10 h-10 rounded-full object-cover" alt="" />
                          <div>
                            <div className="font-bold text-sm">{reportedUser?.name || 'Unknown User'}</div>
                            <div className="text-[10px] text-slate-400">ID: {r.reportedId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-[9px] font-bold uppercase">{r.reason}</span>
                      </td>
                      <td className="p-5 text-xs text-slate-500 max-w-xs truncate">
                        {r.message || 'No details provided'}
                      </td>
                      <td className="p-5">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                          r.status === 'pending' ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"
                        )}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-2">
                          {r.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => resolveReport(r.id, 'resolved')}
                                className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-all"
                                title="Resolve Report"
                              >
                                <CheckCircle2 size={18} />
                              </button>
                              <button 
                                onClick={() => resolveReport(r.id, 'dismissed')}
                                className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 transition-all"
                                title="Dismiss Report"
                              >
                                <X size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400 italic">No reports found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'moderation' && (
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm text-center">
          <ShieldCheck size={48} className="mx-auto mb-4 text-primary opacity-20" />
          <h3 className="text-xl font-bold mb-2">Profile Moderation</h3>
          <p className="text-slate-500 max-w-md mx-auto">Review user profiles, photos, and bios for community guidelines compliance.</p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {users.filter(u => !u.isVerified).slice(0, 6).map(u => (
              <div key={u.id} className="p-4 border rounded-2xl flex flex-col items-center">
                <img src={u.images?.[0]} className="w-20 h-20 rounded-full object-cover mb-3" alt="" />
                <div className="font-bold text-sm mb-1">{u.name}</div>
                <button 
                  onClick={() => setEditingUser(u)}
                  className="text-[10px] font-bold text-primary uppercase tracking-wider hover:underline"
                >
                  Review Profile
                </button>
              </div>
            ))}
            {users.filter(u => !u.isVerified).length === 0 && (
              <div className="col-span-3 py-10 text-slate-400 italic">No profiles pending moderation.</div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'interactions' && (
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <MessageSquare size={20} className="text-primary" />
              Match & Interaction Monitoring
            </h3>
            <div className="text-xs font-bold text-slate-400 uppercase">Recent Matches: {matches.length}</div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Users</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Date</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.map(m => {
                  const user1 = users.find(u => u.id === m.users[0]);
                  const user2 = users.find(u => u.id === m.users[1]);
                  return (
                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            <img src={user1?.images?.[0] || `https://picsum.photos/seed/${m.users[0]}/50/50`} className="w-8 h-8 rounded-full border-2 border-white object-cover" alt="" />
                            <img src={user2?.images?.[0] || `https://picsum.photos/seed/${m.users[1]}/50/50`} className="w-8 h-8 rounded-full border-2 border-white object-cover" alt="" />
                          </div>
                          <div className="text-xs font-bold truncate max-w-[150px]">
                            {user1?.name || 'User'} & {user2?.name || 'User'}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-xs text-slate-500">
                        {m.timestamp?.toDate ? m.timestamp.toDate().toLocaleString() : 'Recently'}
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => deleteMatch(m.id)}
                          className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"
                          title="Delete Match"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {matches.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-10 text-center text-slate-400 italic">No recent matches found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'verification' && (
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm text-center">
          <ShieldCheck size={48} className="mx-auto mb-4 text-primary opacity-20" />
          <h3 className="text-xl font-bold mb-2">Verification Management</h3>
          <p className="text-slate-500 max-w-md mx-auto">Review and approve user verification requests and ID documents.</p>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">User</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Request Date</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.verificationStatus === 'pending').map(u => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 flex items-center gap-3">
                      <img src={u.verificationSelfie} className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-sm" alt="Selfie" />
                      <div>
                        <span className="text-sm font-bold block">{u.name}</span>
                        <span className="text-[10px] text-slate-400">Verification Selfie</span>
                      </div>
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'Today'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setEditingUser(u)}
                          className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase hover:bg-slate-200"
                        >
                          View Profile
                        </button>
                        <button 
                          onClick={() => rejectVerification(u.id)}
                          className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold uppercase hover:bg-red-100"
                        >
                          Reject
                        </button>
                        <button 
                          onClick={() => verifyUser(u.id)}
                          className="px-3 py-1 bg-primary text-white rounded-lg text-[10px] font-bold uppercase hover:bg-primary/90"
                        >
                          Approve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.filter(u => u.verificationStatus === 'pending').length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-10 text-center text-slate-400 italic">No verification requests found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'payments' && (
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm text-center">
          <CreditCard size={48} className="mx-auto mb-4 text-primary opacity-20" />
          <h3 className="text-xl font-bold mb-2">Subscription & Payment Control</h3>
          <p className="text-slate-500 max-w-md mx-auto">Manage user subscriptions, process refunds, and monitor revenue.</p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="p-6 bg-green-50 rounded-2xl border border-green-100 text-left">
              <div className="text-xs font-bold text-green-600 uppercase mb-1">Total Revenue (MTD)</div>
              <div className="text-2xl font-bold text-green-800">R45,200</div>
            </div>
            <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 text-left">
              <div className="text-xs font-bold text-blue-600 uppercase mb-1">Active Subscriptions</div>
              <div className="text-2xl font-bold text-blue-800">{users.filter(u => u.isPremium).length}</div>
            </div>
          </div>
          <div className="max-w-md mx-auto p-6 bg-slate-50 rounded-2xl border border-slate-100 text-left">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Monthly Subscription Price (ZAR)</label>
            <div className="flex gap-3">
              <input 
                type="number"
                value={appSettings.subscriptionPrice}
                onChange={(e) => updateGlobalSettings({ subscriptionPrice: Number(e.target.value) })}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-white focus:border-primary outline-none text-sm font-bold"
              />
              <button className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-bold uppercase">Update Price</button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'notifications' && (
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm text-center">
          <Bell size={48} className="mx-auto mb-4 text-primary opacity-20" />
          <h3 className="text-xl font-bold mb-2">Notification Management</h3>
          <p className="text-slate-500 max-w-md mx-auto">Send system-wide push notifications and manage automated alerts.</p>
          <div className="mt-8 max-w-md mx-auto text-left">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Push Message</label>
            <textarea 
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary outline-none transition-all resize-none text-sm mb-4" 
              rows={3} 
              placeholder="Enter message to send to all users..." 
            />
            <div className="flex gap-2">
              <button 
                onClick={handleBroadcast}
                disabled={isBroadcasting}
                className="flex-1 btn-primary py-3 text-sm"
              >
                {isBroadcasting ? "Sending..." : "Update Broadcast"}
              </button>
              <button 
                onClick={() => {
                  setBroadcastMessage('');
                  updateGlobalSettings({ broadcastMessage: '' });
                  alert("Broadcast message cleared!");
                }}
                disabled={isBroadcasting}
                className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-sm font-bold hover:bg-slate-200 transition-all"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'content' && (
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm text-center">
          <Layout size={48} className="mx-auto mb-4 text-primary opacity-20" />
          <h3 className="text-xl font-bold mb-2">Content Management</h3>
          <p className="text-slate-500 max-w-md mx-auto">Manage static pages, blog posts, and application copy.</p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => setEditingContent({ type: 'terms', value: appSettings.termsOfService || '' })}
              className="p-4 border rounded-2xl text-left hover:bg-slate-50 transition-all"
            >
              <div className="font-bold text-sm">Terms of Service</div>
              <div className="text-xs text-slate-400">Manage the app's legal terms</div>
            </button>
            <button 
              onClick={() => setEditingContent({ type: 'privacy', value: appSettings.privacyPolicy || '' })}
              className="p-4 border rounded-2xl text-left hover:bg-slate-50 transition-all"
            >
              <div className="font-bold text-sm">Privacy Policy</div>
              <div className="text-xs text-slate-400">Manage the app's privacy policy</div>
            </button>
          </div>
        </div>
      )}

      {activeSubTab === 'analytics' && (
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <BarChart3 size={20} className="text-primary" />
            Analytics & Reports
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { name: 'Mon', active: 400, new: 24 },
                { name: 'Tue', active: 700, new: 32 },
                { name: 'Wed', active: 500, new: 28 },
                { name: 'Thu', active: 1200, new: 45 },
                { name: 'Fri', active: 900, new: 38 },
                { name: 'Sat', active: 1500, new: 62 },
                { name: 'Sun', active: 1000, new: 50 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="active" stroke="#8B0000" fill="#8B0000" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeSubTab === 'location' && (
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm text-center">
          <MapPin size={48} className="mx-auto mb-4 text-primary opacity-20" />
          <h3 className="text-xl font-bold mb-2">Location & Preference Control</h3>
          <p className="text-slate-500 max-w-md mx-auto">Manage global location settings, distance algorithms, and matching preferences.</p>
          <div className="mt-8 max-w-md mx-auto space-y-6 text-left">
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Global Distance Limit (km)</label>
              <input 
                type="number"
                value={appSettings.globalDistanceLimit}
                onChange={(e) => updateGlobalSettings({ globalDistanceLimit: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white focus:border-primary outline-none text-sm font-bold"
              />
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Age Range Buffer (years)</label>
              <input 
                type="number"
                value={appSettings.ageRangeBuffer}
                onChange={(e) => updateGlobalSettings({ ageRangeBuffer: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white focus:border-primary outline-none text-sm font-bold"
              />
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'security' && (
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Lock size={20} className="text-primary" />
              Security & Access Control
            </h3>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Activity Logs</div>
          </div>
          
          <div className="space-y-3">
            {securityLogs.map(log => (
              <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    log.type === 'login_fail' ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                  )}>
                    {log.type === 'login_fail' ? <ShieldAlert size={14} /> : <LogIn size={14} />}
                  </div>
                  <div>
                    <div className="text-sm font-bold">{log.message}</div>
                    <div className="text-[10px] text-slate-400">{log.ip} • {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Recently'}</div>
                  </div>
                </div>
                <button className="text-[10px] font-bold text-red-600 uppercase tracking-wider hover:underline">Block IP</button>
              </div>
            ))}
            {securityLogs.length === 0 && (
              <div className="p-10 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No security alerts or logs found.
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'support' && (
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <LifeBuoy size={20} className="text-primary" />
              Support Management
            </h3>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Open</div>
                <div className="text-lg font-bold">{supportTickets.filter(t => t.status === 'open').length}</div>
              </div>
              <div className="text-center border-l pl-4">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Resolved</div>
                <div className="text-lg font-bold">{supportTickets.filter(t => t.status === 'resolved').length}</div>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">User</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Subject</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</th>
                  <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {supportTickets.map(t => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-sm">{t.userName}</div>
                      <div className="text-[10px] text-slate-400">{t.userId}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium">{t.subject}</div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">{t.message}</div>
                    </td>
                    <td className="p-4">
                      <select 
                        value={t.status}
                        onChange={(e) => updateTicketStatus(t.id, e.target.value)}
                        className={cn(
                          "text-[10px] font-bold uppercase px-2 py-1 rounded-full outline-none border-none cursor-pointer",
                          t.status === 'open' ? "bg-red-100 text-red-600" : 
                          t.status === 'in-progress' ? "bg-amber-100 text-amber-600" : 
                          "bg-green-100 text-green-600"
                        )}
                      >
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                    <td className="p-4 text-right">
                      <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-all">
                        <MessageSquare size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {supportTickets.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-slate-400 italic">No support tickets found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Settings size={20} className="text-primary" />
              Global Application Settings
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Maintenance Mode</div>
                  <div className="text-sm text-slate-500 text-balance">Temporarily disable app access for all non-admin users.</div>
                </div>
                <button 
                  onClick={() => updateGlobalSettings({ maintenanceMode: !appSettings.maintenanceMode })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    appSettings.maintenanceMode ? "bg-primary" : "bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    appSettings.maintenanceMode ? "right-1" : "left-1"
                  )} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">New Registrations</div>
                  <div className="text-sm text-slate-500 text-balance">Allow or disallow new users to create accounts.</div>
                </div>
                <button 
                  onClick={() => updateGlobalSettings({ registrationEnabled: !appSettings.registrationEnabled })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    appSettings.registrationEnabled ? "bg-primary" : "bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    appSettings.registrationEnabled ? "right-1" : "left-1"
                  )} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Premium Only Mode</div>
                  <div className="text-sm text-slate-500 text-balance">Restrict app usage to premium members only.</div>
                </div>
                <button 
                  onClick={() => updateGlobalSettings({ premiumOnly: !appSettings.premiumOnly })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    appSettings.premiumOnly ? "bg-primary" : "bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                    appSettings.premiumOnly ? "right-1" : "left-1"
                  )} />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Bell size={20} className="text-primary" />
                Broadcast Message
              </h3>
              <p className="text-sm text-slate-500 mb-4">This message will be displayed to all users (e.g., during maintenance).</p>
              <textarea 
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Enter maintenance notice or announcement..."
                className="w-full px-4 py-3 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary outline-none transition-all resize-none text-sm mb-4"
                rows={3}
              />
              <button 
                onClick={handleBroadcast}
                disabled={isBroadcasting}
                className="w-full btn-primary py-3 text-sm"
              >
                {isBroadcasting ? "Updating..." : "Update Broadcast Message"}
              </button>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-black p-8 rounded-[32px] text-white">
              <h3 className="text-xl font-bold mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {users.slice(0, 5).map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                    <img src={u.images?.[0] || `https://picsum.photos/seed/${u.id}/50/50`} className="w-8 h-8 rounded-full" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{u.name} joined</div>
                      <div className="text-[10px] text-slate-400">{u.createdAt?.toDate ? formatDistanceToNow(u.createdAt.toDate()) : 'Recently'} ago</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
              <h3 className="text-xl font-bold mb-4">System Status</h3>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck className="text-primary" size={20} />
                  <span className="font-bold text-slate-900">All Systems Operational</span>
                </div>
                <div className="text-xs text-slate-400">
                  Database latency: 24ms. API status: Active.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Modals */}
      <AnimatePresence>
        {showCreateAdmin && (
          <CreateAdminModal 
            users={users.filter(u => u.role !== 'admin')}
            onClose={() => setShowCreateAdmin(false)}
            // Better to pass a direct promote function
            promoteUser={async (userId, rights) => {
              try {
                await updateDoc(doc(db, 'users', userId), {
                  role: 'admin',
                  adminRights: rights
                });
                setShowCreateAdmin(false);
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
              }
            }}
          />
        )}
        {editingUser && (
          <UserEditModal 
            user={editingUser} 
            onClose={() => setEditingUser(null)} 
            onSave={handleSaveUser} 
          />
        )}
        {confirmDelete && (
          <ConfirmModal 
            title="Delete User Account"
            message="Are you sure you want to permanently delete this user? This action cannot be undone and all their data will be lost."
            onConfirm={() => deleteUser(confirmDelete)}
            onCancel={() => setConfirmDelete(null)}
            confirmText="Delete Permanently"
          />
        )}
        {editingContent && (
          <ContentEditModal 
            type={editingContent.type}
            initialValue={editingContent.value}
            onClose={() => setEditingContent(null)}
            onSave={(newValue: string) => {
              updateGlobalSettings({ [editingContent.type === 'terms' ? 'termsOfService' : 'privacyPolicy']: newValue });
              setEditingContent(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const CreateAdminModal = ({ 
  users, 
  onClose, 
  promoteUser 
}: { 
  users: UserType[]; 
  onClose: () => void; 
  promoteUser: (userId: string, rights: any) => Promise<void>;
}) => {
  const [selectedUserId, setSelectedUserId] = useState('');
  const [rights, setRights] = useState({
    canManageUsers: false,
    canDeleteUsers: false,
    canModerateProfiles: false,
    canMonitorInteractions: false,
    canHandleReports: false,
    canManageVerification: false,
    canControlPayments: false,
    canManageNotifications: false,
    canManageContent: false,
    canViewAnalytics: false,
    canControlLocationPreferences: false,
    canManageSecurity: false,
    canManageSupport: false,
    canEditSettings: false,
    canManageAdmins: false
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setSubmitting(true);
    await promoteUser(selectedUserId, rights);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">Add New Administrator</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Select User to Promote</label>
            <select 
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary outline-none transition-all appearance-none bg-white text-sm"
              required
            >
              <option value="">Choose a user...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email || u.id.substring(0, 8)})</option>
              ))}
            </select>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-4">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-amber-600 ml-1">Assign Permissions</label>
            <div className="grid grid-cols-2 gap-4 max-h-48 overflow-y-auto pr-2">
              {[
                { key: 'canManageUsers', label: 'User Management' },
                { key: 'canDeleteUsers', label: 'Delete Users' },
                { key: 'canModerateProfiles', label: 'Profile Moderation' },
                { key: 'canMonitorInteractions', label: 'Interaction Monitoring' },
                { key: 'canHandleReports', label: 'Report Handling' },
                { key: 'canManageVerification', label: 'Verification Mgmt' },
                { key: 'canControlPayments', label: 'Payment Control' },
                { key: 'canManageNotifications', label: 'Notification Mgmt' },
                { key: 'canManageContent', label: 'Content Mgmt' },
                { key: 'canViewAnalytics', label: 'View Analytics' },
                { key: 'canControlLocationPreferences', label: 'Location Control' },
                { key: 'canManageSecurity', label: 'Security Control' },
                { key: 'canManageSupport', label: 'Support Mgmt' },
                { key: 'canEditSettings', label: 'System Settings' },
                { key: 'canManageAdmins', label: 'Manage Admins' },
              ].map((permission) => (
                <label key={permission.key} className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={(rights as any)[permission.key]}
                    onChange={e => setRights({ ...rights, [permission.key]: e.target.checked })}
                    className="w-5 h-5 rounded border-amber-200 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-amber-800">{permission.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={submitting || !selectedUserId}
            className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all disabled:opacity-50"
          >
            {submitting ? "Promoting..." : "Promote to Admin"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const ReportModal = ({ 
  reportedUser, 
  onClose 
}: { 
  reportedUser: UserType; 
  onClose: () => void; 
}) => {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const reasons = [
    "Inappropriate content",
    "Fake profile / Spam",
    "Harassment",
    "Underage",
    "Other"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reason) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        reportedId: reportedUser.id,
        reason,
        message,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setSubmitted(true);
      setTimeout(onClose, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'reports');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl"
      >
        {submitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Report Submitted</h3>
            <p className="text-slate-500 text-sm">Thank you for helping keep our community safe. Our team will review this report shortly.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Report {reportedUser.name}</h3>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Reason for reporting</label>
                <div className="grid grid-cols-1 gap-2">
                  {reasons.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={cn(
                        "w-full px-4 py-3 rounded-2xl border text-left text-sm font-medium transition-all",
                        reason === r ? "border-primary bg-primary/5 text-primary" : "border-slate-100 hover:border-slate-200 text-slate-600"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Additional Details (Optional)</label>
                <textarea 
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Tell us more about the issue..."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all min-h-[100px] resize-none text-sm"
                />
              </div>

              <button 
                type="submit" 
                disabled={submitting || !reason}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all disabled:opacity-50 mt-4"
              >
                {submitting ? "Submitting Report..." : "Submit Report"}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
};

// --- Components ---

const Navbar = ({ activeTab, setActiveTab, unreadCount }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, profile, signIn, logout } = useAuth();
  const isAdminUser = profile?.role === 'admin' || user?.email === 'siphes9812@gmail.com';

  const navItems = [
    { id: 'discover', label: 'Discover', icon: Search },
    { id: 'chat', label: 'Messages', icon: MessageCircle },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount > 0 ? unreadCount : null },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ];

  if (isAdminUser) {
    navItems.push({ id: 'admin', label: 'Admin', icon: ShieldCheck });
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-md border-b bg-white/60 border-black/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => {
            if (!user) {
              signIn();
              return;
            }
            if (isAdminUser) {
              setActiveTab('admin');
            } else {
              setActiveTab('discover');
            }
          }}>
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
              <Heart className="text-white fill-current" size={20} />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xl font-bold tracking-tight hidden sm:block">
                <span className="text-primary">uMzimkhulu</span>
                <span className="text-slate-900"> Love Link</span>
              </span>
              {isAdminUser && (
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter -mt-1 hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">
                  Click here if you want to get to admin dashboard
                </span>
              )}
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {user && navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-2 font-medium transition-all duration-300 relative py-1.5 text-sm",
                  activeTab === item.id 
                    ? "text-primary" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <item.icon size={16} />
                {item.label}
                {item.badge && (
                  <span className="absolute -top-1 -right-2 bg-primary text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                    {item.badge}
                  </span>
                )}
                {activeTab === item.id && (
                  <motion.div 
                    layoutId="navUnderline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
              {isOpen ? <X /> : <Menu />}
            </button>
            {user ? (
              <div className="flex items-center gap-3">
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                  className="w-10 h-10 rounded-full border-2 border-primary"
                  alt="User"
                />
                <button onClick={logout} className="hidden md:block text-slate-500 hover:text-primary transition-colors">
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button onClick={signIn} className="hidden md:block btn-primary py-2 px-6 text-sm">
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t overflow-hidden bg-white/90 border-black/5"
          >
      <div className="px-4 py-4 space-y-3">
        {user && navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              setIsOpen(false);
            }}
            className={cn(
              "flex items-center gap-3 w-full p-2.5 rounded-xl transition-all text-sm",
              activeTab === item.id 
                ? "bg-primary/10 text-primary" 
                : "text-slate-500 hover:bg-black/5"
            )}
          >
            <item.icon size={18} />
            <span className="font-semibold">{item.label}</span>
            {item.badge && (
              <span className="ml-auto bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}
        {!user ? (
          <button onClick={signIn} className="w-full btn-primary mt-2 py-2.5 text-sm">Sign In</button>
        ) : (
          <button onClick={logout} className="w-full py-2.5 rounded-xl border border-primary/20 text-primary font-bold text-sm">Logout</button>
        )}
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const TermsModal = ({ isOpen, onClose, title, content }: { isOpen: boolean, onClose: () => void, title: string, content: string }) => {
  if (!isOpen) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-[32px] overflow-hidden max-w-2xl w-full shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-8 overflow-y-auto text-sm text-slate-600 leading-relaxed space-y-4">
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </div>
        <div className="p-6 border-t border-slate-100 flex justify-end shrink-0">
          <button onClick={onClose} className="btn-primary px-8 py-2.5 text-sm">Close</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Hero = () => {
  const { signIn, login, register, resetPassword, isSigningIn, signInError, clearError } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState<'terms' | 'popi' | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const termsContent = `
    <h4 className="font-bold text-slate-900 mb-2">1. Acceptance of Terms</h4>
    <p>By accessing and using Love Link, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the service.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">2. Eligibility</h4>
    <p>You must be at least 18 years old to use Love Link. By creating an account, you represent and warrant that you are 18 or older.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">3. User Conduct</h4>
    <p>Users are expected to behave respectfully. Harassment, abuse, or any form of discrimination will result in immediate account termination.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">4. Safety</h4>
    <p>While we strive to provide a safe environment, we are not responsible for the actions of users. Always exercise caution when meeting someone in person.</p>
  `;

  const popiContent = `
    <h4 className="font-bold text-slate-900 mb-2">Protection of Personal Information (POPI) Act</h4>
    <p>Love Link is committed to protecting your privacy and ensuring that your personal information is collected and used properly, lawfully, and transparently in accordance with the POPI Act of South Africa.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">1. Information We Collect</h4>
    <p>We collect information such as your name, age, gender, location, and interests to provide you with the best matching experience.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">2. Purpose of Collection</h4>
    <p>Your information is used solely for the purpose of facilitating connections between users on the platform.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">3. Data Security</h4>
    <p>We implement robust security measures to protect your data from unauthorized access, loss, or destruction.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">4. Your Rights</h4>
    <p>You have the right to access, correct, or delete your personal information at any time through your profile settings.</p>
  `;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!agreedToTerms) {
      setLocalError("Please agree to the Terms and Conditions and POPI Act to continue.");
      return;
    }
    setSuccessMsg(null);
    try {
      if (mode === 'signin') {
        await login(email, password, rememberMe);
        if (auth.currentUser && !auth.currentUser.emailVerified) {
          setSuccessMsg("Welcome back! Please check your email to verify your account.");
        }
      } else if (mode === 'signup') {
        await register(email, password);
        setSuccessMsg("Account created! A verification email has been sent to your inbox.");
      } else {
        await resetPassword(email);
        setSuccessMsg("Password reset email sent! Check your inbox.");
      }
    } catch (err) {
      // Error is handled by AuthProvider and displayed via signInError
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    if (!agreedToTerms) {
      setLocalError("Please agree to the Terms and Conditions and POPI Act to continue.");
      return;
    }
    await signIn();
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      setSuccessMsg("Welcome! Please check your email to verify your account.");
    }
  };

  return (
    <section className="relative min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 py-8 overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-primary rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-accent rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="font-display text-4xl md:text-6xl font-bold mb-3 text-slate-900 leading-tight">
            Welcome to <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-accent">Love Link</span>
          </h1>
          <p className="text-base md:text-lg text-slate-500 mb-8">
            The premium dating experience in uMzimkhulu
          </p>

          <div className="bg-white rounded-[32px] p-8 shadow-2xl shadow-black/5 border border-slate-100 mb-6">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">
              {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
              <div className="text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-12 pr-4 py-3 rounded-xl outline-none border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary transition-all text-sm"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-12 pr-12 py-3 rounded-xl outline-none border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary transition-all text-sm"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'signin' && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="rememberMe" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="rememberMe" className="text-xs text-slate-500 cursor-pointer">Remember Me</label>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              <button 
                type="submit"
                disabled={isSigningIn}
                className="w-full btn-primary py-3.5 text-sm font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isSigningIn ? 'Processing...' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Link'}
              </button>

              <div className="flex items-start gap-3 mt-4">
                <input 
                  type="checkbox" 
                  id="terms" 
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="terms" className="text-[10px] text-slate-500 leading-relaxed text-left">
                  I agree to the <button type="button" onClick={() => setShowTerms('terms')} className="text-primary font-bold hover:underline">Terms & Conditions</button> and acknowledge the <button type="button" onClick={() => setShowTerms('popi')} className="text-primary font-bold hover:underline">POPI Act</button> regarding my personal data.
                </label>
              </div>
            </form>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-medium">Or continue with</span></div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all group text-sm disabled:opacity-50"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                <span className="font-bold text-slate-700">Google</span>
              </button>
              
              {signInError?.includes('popup-blocked') && (
                <p className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                  <strong>Popup Blocked:</strong> Please enable popups for this site in your browser settings to sign in with Google.
                </p>
              )}
            </div>

            {mode === 'signin' ? (
              <p className="mt-6 text-sm text-slate-500">
                Don't have an account? <button onClick={() => setMode('signup')} className="text-primary font-bold hover:underline">Sign Up</button>
              </p>
            ) : (
              <p className="mt-6 text-sm text-slate-500">
                Already have an account? <button onClick={() => setMode('signin')} className="text-primary font-bold hover:underline">Sign In</button>
              </p>
            )}

            {(signInError || localError) && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-xs flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span className="text-left font-semibold">{localError || (signInError?.includes('network-request-failed') ? 'Connection Error' : 'Error')}</span>
                </div>
                <p className="text-left opacity-90">{localError || signInError}</p>
                {signInError?.includes('network-request-failed') && (
                  <div className="flex gap-2 mt-1">
                    <button 
                      type="button"
                      onClick={() => { clearError(); handleSubmit(new Event('submit') as any); }}
                      className="px-2 py-1 bg-red-500 text-white rounded text-[10px] font-bold hover:bg-red-600 transition-colors"
                    >
                      Try Again
                    </button>
                    <button 
                      type="button"
                      onClick={() => window.location.reload()}
                      className="px-2 py-1 border border-red-500 text-red-500 rounded text-[10px] font-bold hover:bg-red-500/10 transition-colors"
                    >
                      Refresh Page
                    </button>
                  </div>
                )}
              </div>
            )}

            {successMsg && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/50 rounded-xl text-green-600 text-xs flex items-center gap-2">
                <CheckCircle2 size={14} className="shrink-0" />
                <span className="text-left">{successMsg}</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showTerms === 'terms' && (
          <TermsModal 
            isOpen={true} 
            onClose={() => setShowTerms(null)} 
            title="Terms & Conditions" 
            content={termsContent} 
          />
        )}
        {showTerms === 'popi' && (
          <TermsModal 
            isOpen={true} 
            onClose={() => setShowTerms(null)} 
            title="POPI Act Compliance" 
            content={popiContent} 
          />
        )}
      </AnimatePresence>
    </section>
  );
};

const ProfileCard = ({ user, currentUserProfile, onLike, onPass, onMessage, onReport, onBlock, onClick, compact = false }: { 
  user: UserType, 
  currentUserProfile?: UserType | null, 
  onLike: () => void | Promise<void>, 
  onPass: () => void, 
  onMessage: () => void, 
  onReport: () => void, 
  onBlock: () => void,
  onClick?: () => void, 
  key?: string,
  compact?: boolean
}) => {
  const distance = (currentUserProfile?.latitude && currentUserProfile?.longitude && user.latitude && user.longitude)
    ? calculateDistance(currentUserProfile.latitude, currentUserProfile.longitude, user.latitude, user.longitude)
    : null;

  return (
    <motion.div
      whileHover={{ y: -10 }}
      className={cn(
        "relative group rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 bg-white cursor-pointer",
        compact ? "rounded-2xl shadow-lg" : "rounded-3xl shadow-2xl"
      )}
      onClick={onClick}
    >
      <div className={cn("overflow-hidden relative", compact ? "aspect-square" : "aspect-[3/4]")}>
        <img 
          src={user.images?.[0] || `https://picsum.photos/seed/${user.id}/400/600`} 
          alt={user.name} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60" />
        
        {user.isPremium && (
          <div className={cn("absolute bg-accent/90 backdrop-blur-md text-white rounded-full shadow-lg animate-pulse", compact ? "top-2 left-2 p-1" : "top-4 left-4 p-2")}>
            <Crown size={compact ? 12 : 16} />
          </div>
        )}

        {distance !== null && (
          <div className={cn("absolute bg-black/40 backdrop-blur-md text-white rounded-full font-bold flex items-center gap-1", compact ? "top-2 right-2 px-2 py-0.5 text-[8px]" : "top-4 right-4 px-3 py-1 text-[10px]")}>
            <MapPin size={compact ? 8 : 10} />
            {distance} km
          </div>
        )}

        <div className={cn("absolute left-4 right-4 text-white", compact ? "bottom-3" : "bottom-6 left-6 right-6")}>
          <div className="flex items-center gap-2 mb-1">
            <h3 className={cn("font-bold truncate", compact ? "text-sm" : "text-xl")}>{user.name}, {user.age}</h3>
            {user.isVerified && <ShieldCheck className="text-accent" size={compact ? 14 : 18} />}
          </div>
          <p className={cn("text-slate-300 flex items-center gap-1 mb-2", compact ? "text-[10px]" : "text-xs mb-3")}>
            <Search size={compact ? 10 : 12} /> {user.location || 'Location not set'}
          </p>
          <div className="flex flex-wrap gap-1">
            {(user.interests || []).slice(0, compact ? 2 : 3).map(interest => (
              <span 
                key={interest} 
                className={cn(
                  "rounded-full bg-white/20 backdrop-blur-md font-medium",
                  compact ? "px-1.5 py-0.5 text-[8px]" : "px-2.5 py-0.5 text-[10px]"
                )}
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={cn("flex justify-between items-center bg-inherit", compact ? "p-2 gap-2" : "p-4")}>
        <button 
          onClick={(e) => { e.stopPropagation(); onPass(); }}
          className={cn("rounded-full flex items-center justify-center border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all active:scale-90", compact ? "w-8 h-8" : "w-10 h-10")}
        >
          <X size={compact ? 16 : 20} />
        </button>
        {!compact && (
          <div className="flex gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onReport(); }}
              className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all active:scale-90"
              title="Report User"
            >
              <Flag size={18} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onBlock(); }}
              className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-200 text-slate-400 hover:bg-slate-900 hover:text-white transition-all active:scale-90"
              title="Block User"
            >
              <ShieldAlert size={18} />
            </button>
          </div>
        )}
        <button 
          onClick={(e) => { e.stopPropagation(); onMessage(); }}
          className={cn("rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95", compact ? "w-8 h-8" : "w-10 h-10")}
        >
          <MessageCircle size={compact ? 16 : 20} />
        </button>
        {!compact && (
          <button 
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/30 hover:scale-110 transition-all active:scale-90"
          >
            <Heart size={20} className="fill-current" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

const ProfileDetailModal = ({ user, currentUserProfile, onClose, onLike, onPass, onMessage, onReport, onBlock }: { user: UserType, currentUserProfile?: UserType | null, onClose: () => void, onLike: () => void, onPass: () => void, onMessage: () => void, onReport: () => void, onBlock: () => void }) => {
  const [activeImage, setActiveImage] = useState(0);
  const distance = (currentUserProfile?.latitude && currentUserProfile?.longitude && user.latitude && user.longitude)
    ? calculateDistance(currentUserProfile.latitude, currentUserProfile.longitude, user.latitude, user.longitude)
    : null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-[40px] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
        onClick={e => e.stopPropagation()}
      >
        {/* Image Section */}
        <div className="md:w-1/2 relative bg-slate-100 aspect-[3/4] md:aspect-auto">
          <img 
            src={user.images?.[activeImage] || `https://picsum.photos/seed/${user.id}/600/800`} 
            className="w-full h-full object-cover"
            alt={user.name}
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {distance !== null && (
            <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5">
              <MapPin size={14} />
              {distance} km away
            </div>
          )}

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {user.images?.map((_, i) => (
              <button 
                key={i} 
                onClick={() => setActiveImage(i)}
                className={cn("w-2 h-2 rounded-full transition-all", activeImage === i ? "bg-white w-4" : "bg-white/40")}
              />
            ))}
          </div>

          <button 
            onClick={onClose}
            className="absolute top-4 left-4 p-2 bg-black/20 backdrop-blur-md text-white rounded-full hover:bg-black/40 transition-all"
          >
            <ChevronLeft size={24} />
          </button>
        </div>

        {/* Info Section */}
        <div className="md:w-1/2 p-8 flex flex-col h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold">{user.name}, {user.age}</h2>
              <p className="text-slate-500 flex items-center gap-1 text-sm">
                <Search size={14} /> {user.location}
              </p>
            </div>
            {user.isVerified && <ShieldCheck className="text-accent" size={24} />}
          </div>

          <div className="space-y-6 flex-1">
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">About Me</h4>
              <p className="text-slate-600 text-sm leading-relaxed">{user.bio || "No bio provided yet."}</p>
            </div>

            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Interests</h4>
              <div className="flex flex-wrap gap-2">
                {(user.interests || []).map(interest => (
                  <span key={interest} className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                    {interest}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Looking For</h4>
              <p className="text-slate-600 text-sm">{user.lookingFor || "Not specified"}</p>
            </div>
          </div>

          <div className="flex gap-4 mt-8 pt-6 border-t">
            <div className="flex gap-2 w-full">
              <button 
                onClick={onPass}
                className="flex-1 h-14 rounded-2xl flex items-center justify-center border-2 border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
                title="Pass"
              >
                <X size={24} />
              </button>
              <button 
                onClick={onReport}
                className="flex-1 h-14 rounded-2xl flex items-center justify-center border-2 border-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all"
                title="Report User"
              >
                <Flag size={24} />
              </button>
              <button 
                onClick={onBlock}
                className="flex-1 h-14 rounded-2xl flex items-center justify-center border-2 border-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white transition-all"
                title="Block User"
              >
                <ShieldAlert size={24} />
              </button>
            </div>
            <button 
              onClick={onMessage}
              className="flex-1 h-14 rounded-2xl flex items-center justify-center border-2 border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
            >
              <MessageCircle size={24} />
            </button>
            <button 
              onClick={onLike}
              className="flex-[2] h-14 rounded-2xl flex items-center justify-center bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20 hover:scale-105 transition-all"
            >
              <Heart size={24} className="fill-current mr-2" />
              <span className="font-bold">Like Profile</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Dashboard = ({ onSelectMatch, profile }: { onSelectMatch: (matchId: string) => void, profile: UserType | null }) => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'matches'),
      where('users', 'array-contains', user.uid),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, async (snap) => {
      const matchesData = (await Promise.all(snap.docs.map(async (matchDoc) => {
        const data = matchDoc.data();
        const otherUserId = data.users.find((id: string) => id !== user.uid);
        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        return {
          id: matchDoc.id,
          otherUser: { id: otherUserId, ...userDoc.data() } as UserType,
          ...data
        };
      }))).filter(m => {
        if (profile?.blockedUsers?.includes(m.otherUser.id)) return false;
        if (m.otherUser.blockedUsers?.includes(user.uid)) return false;
        return true;
      });
      setMatches(matchesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const deleteMatch = async (matchId: string) => {
    if (!window.confirm("Are you sure you want to delete this match? This will also delete your conversation.")) return;
    try {
      await deleteDoc(doc(db, 'matches', matchId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `matches/${matchId}`);
    }
  };

  const data = [
    { name: 'Mon', matches: 4, views: 24 },
    { name: 'Tue', matches: 7, views: 32 },
    { name: 'Wed', matches: 5, views: 28 },
    { name: 'Thu', matches: 12, views: 45 },
    { name: 'Fri', matches: 9, views: 38 },
    { name: 'Sat', matches: 15, views: 62 },
    { name: 'Sun', matches: 10, views: 50 },
  ];

  const stats = [
    { label: 'Total Matches', value: '128', icon: Heart, color: 'text-primary' },
    { label: 'Profile Views', value: '1,420', icon: Search, color: 'text-accent' },
    { label: 'Messages', value: '452', icon: MessageCircle, color: 'text-secondary' },
    { label: 'Premium Days', value: '24', icon: Crown, color: 'text-yellow-500' },
  ];

  return (
    <div className="pt-24 pb-12 px-4 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 rounded-3xl border bg-white border-black/5 shadow-sm"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-opacity-10", stat.color.replace('text', 'bg'))}>
              <stat.icon className={stat.color} size={24} />
            </div>
            <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
            <h4 className="text-3xl font-bold mt-1">{stat.value}</h4>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 p-8 rounded-3xl border bg-white border-black/5 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold">Activity Overview</h3>
            <select className="bg-transparent border rounded-lg px-3 py-1 text-sm outline-none border-black/10">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorMatches" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B0000" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8B0000" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: 'none', 
                    borderRadius: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                  }} 
                />
                <Area type="monotone" dataKey="matches" stroke="#8B0000" strokeWidth={3} fillOpacity={1} fill="url(#colorMatches)" />
                <Area type="monotone" dataKey="views" stroke="#C9A227" strokeWidth={3} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-8 rounded-3xl border bg-white border-black/5 shadow-sm">
          <h3 className="text-xl font-bold mb-6">Recent Matches</h3>
          
          <AnimatePresence mode="wait">
            {selectedMatch ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <button 
                  onClick={() => setSelectedMatch(null)}
                  className="flex items-center gap-2 text-xs font-bold text-primary hover:underline mb-4"
                >
                  <ChevronLeft size={14} />
                  Back to List
                </button>

                <div className="text-center">
                  <div className="relative inline-block mb-4">
                    <img 
                      src={selectedMatch.otherUser.images?.[0] || `https://picsum.photos/seed/${selectedMatch.otherUser.id}/200/200`} 
                      className="w-24 h-24 rounded-full object-cover border-4 border-primary/10 shadow-lg" 
                      alt={selectedMatch.otherUser.name}
                      referrerPolicy="no-referrer"
                    />
                    {selectedMatch.otherUser.isVerified && (
                      <div className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-md">
                        <ShieldCheck size={16} className="text-primary" />
                      </div>
                    )}
                  </div>
                  <h4 className="text-lg font-bold">{selectedMatch.otherUser.name}, {selectedMatch.otherUser.age}</h4>
                  <p className="text-xs text-slate-500 flex items-center justify-center gap-1 mt-1">
                    <MapPin size={12} /> {selectedMatch.otherUser.location}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Mutual Interests</h5>
                    <div className="flex flex-wrap gap-2">
                      {(selectedMatch.otherUser.interests || []).filter((interest: string) => (profile?.interests || []).includes(interest)).map((interest: string) => (
                        <span key={interest} className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold flex items-center gap-1">
                          <Sparkles size={10} />
                          {interest}
                        </span>
                      ))}
                      {(!selectedMatch.otherUser.interests || selectedMatch.otherUser.interests.filter((interest: string) => (profile?.interests || []).includes(interest)).length === 0) && (
                        <p className="text-[10px] text-slate-400 italic">No mutual interests found.</p>
                      )}
                    </div>
                  </div>

                  {selectedMatch.otherUser.bio && (
                    <div>
                      <h5 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">About</h5>
                      <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-3">
                        {selectedMatch.otherUser.bio}
                      </p>
                    </div>
                  )}

                  <div className="pt-4 flex gap-2">
                    <button 
                      onClick={() => onSelectMatch(selectedMatch.id)}
                      className="flex-1 btn-primary py-3 text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <MessageSquare size={14} />
                      Message
                    </button>
                    <button 
                      onClick={() => deleteMatch(selectedMatch.id)}
                      className="p-3 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 transition-colors"
                      title="Unmatch"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {loading ? (
                  <div className="text-center py-10 text-slate-400 text-sm">Loading matches...</div>
                ) : matches.length > 0 ? (
                  matches.map((match) => (
                    <div key={match.id} className="flex items-center justify-between group">
                      <button 
                        onClick={() => setSelectedMatch(match)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <img src={match.otherUser.images?.[0] || `https://picsum.photos/seed/${match.otherUser.id}/100/100`} className="w-12 h-12 rounded-full object-cover" alt="" referrerPolicy="no-referrer" />
                        <div>
                          <div className="font-bold text-sm">{match.otherUser.name}</div>
                          <div className="text-[10px] text-slate-400">Matched {match.timestamp?.toDate ? formatDistanceToNow(match.timestamp.toDate()) : 'Recently'} ago</div>
                        </div>
                      </button>
                      <button 
                        onClick={() => deleteMatch(match.id)}
                        className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete Match"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-400 text-sm italic">
                    No recent matches to show.
                  </div>
                )}
                
                <button 
                  onClick={() => onSelectMatch('')}
                  className="w-full mt-8 py-3 rounded-xl border border-primary/20 text-primary font-semibold hover:bg-primary/5 transition-all"
                >
                  View All Matches
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const Chat = ({ selectedMatchId, setSelectedMatchId, profile }: { selectedMatchId: string | null, setSelectedMatchId: (id: string | null) => void, profile: UserType | null }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [generatingIcebreaker, setGeneratingIcebreaker] = useState(false);
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedMatch = matches.find(m => m.id === selectedMatchId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (selectedMatchId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedMatchId]);

  useEffect(() => {
    if (!user || !selectedMatchId) return;

    // Mark message notifications for this match as read
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('matchId', '==', selectedMatchId),
      where('read', '==', false)
    );

    getDocs(q).then(snap => {
      snap.docs.forEach(d => {
        updateDoc(doc(db, 'notifications', d.id), { read: true });
      });
    });
  }, [user, selectedMatchId]);

  useEffect(() => {
    if (!user || !selectedMatchId) return;

    const matchDoc = doc(db, 'matches', selectedMatchId);
    const timeout = setTimeout(() => {
      updateDoc(matchDoc, {
        [`typing.${user.uid}`]: message.length > 0
      }).catch(() => {});
    }, 500);

    return () => clearTimeout(timeout);
  }, [message, user, selectedMatchId]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'matches'),
      where('users', 'array-contains', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const matchesData = (await Promise.all(snap.docs.map(async (matchDoc) => {
        const data = matchDoc.data();
        const otherUserId = data.users.find((id: string) => id !== user.uid);
        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        return {
          id: matchDoc.id,
          otherUser: { id: otherUserId, ...userDoc.data() } as UserType,
          ...data
        };
      }))).filter(m => {
        if (profile?.blockedUsers?.includes(m.otherUser.id)) return false;
        if (m.otherUser.blockedUsers?.includes(user.uid)) return false;
        return true;
      });
      setMatches(matchesData);
      if (matchesData.length > 0 && !selectedMatchId) {
        setSelectedMatchId(matchesData[0].id);
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!selectedMatchId || !user) return;

    const otherUserId = matches.find(m => m.id === selectedMatchId)?.otherUser.id;
    if (!otherUserId) return;

    const chatId = [user.uid, otherUserId].sort().join('_');
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [selectedMatchId, user, matches]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || !selectedMatch) return;

    const chatId = [user.uid, selectedMatch.otherUser.id].sort().join('_');
    const msgData = {
      senderId: user.uid,
      receiverId: selectedMatch.otherUser.id,
      text: message,
      timestamp: serverTimestamp()
    };

    try {
      const chatId = [user.uid, selectedMatch.otherUser.id].sort().join('_');
      await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);
      
      // Also create a notification for the message
      await addDoc(collection(db, 'notifications'), {
        userId: selectedMatch.otherUser.id,
        fromUserId: user.uid,
        type: 'message',
        title: 'New Message',
        message: `${profile?.name || 'Someone'} sent you a message: ${message.substring(0, 30)}${message.length > 30 ? '...' : ''}`,
        createdAt: serverTimestamp(),
        read: false,
        matchId: selectedMatch.id
      });

      setMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `chats/${chatId}/messages`);
    }
  };

  const handleIcebreaker = async () => {
    if (!selectedMatch || !profile) return;
    setGeneratingIcebreaker(true);
    const icebreaker = await generateIcebreakerWithAI(
      selectedMatch.otherUser.name, 
      selectedMatch.otherUser.interests || [], 
      profile.name
    );
    if (icebreaker) {
      setMessage(icebreaker);
    }
    setGeneratingIcebreaker(false);
  };

  const deleteMatch = async (matchId: string) => {
    if (!window.confirm("Are you sure you want to delete this match? This will also delete your conversation.")) return;
    try {
      await deleteDoc(doc(db, 'matches', matchId));
      if (selectedMatchId === matchId) {
        setSelectedMatchId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `matches/${matchId}`);
    }
  };

  const deleteMessage = async (msgId: string) => {
    if (!user || !selectedMatch) return;
    const chatId = [user.uid, selectedMatch.otherUser.id].sort().join('_');
    try {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', msgId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chats/${chatId}/messages/${msgId}`);
    }
  };

  return (
    <div className="pt-20 pb-6 px-4 max-w-6xl mx-auto h-[calc(100vh-20px)] flex gap-6">
      {/* Sidebar */}
      <div className={cn(
        "flex-col w-full md:w-72 rounded-3xl border overflow-hidden bg-white border-black/5 shadow-sm",
        selectedMatchId ? "hidden md:flex" : "flex"
      )}>
        <div className="p-5 border-b border-inherit">
          <h3 className="text-lg font-bold mb-3">Messages</h3>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/5">
            <Search size={14} className="text-slate-400" />
            <input type="text" placeholder="Search chats..." className="bg-transparent border-none outline-none text-xs w-full" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {matches.map((match) => (
            <div 
              key={match.id} 
              onClick={() => setSelectedMatchId(match.id)}
              className={cn(
                "w-full p-4 flex items-center gap-4 hover:bg-primary/5 transition-colors border-b border-inherit group cursor-pointer",
                selectedMatchId === match.id && "bg-primary/5 border-l-4 border-l-primary"
              )}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedMatchId(match.id);
                }
              }}
            >
              <img src={match.otherUser.images?.[0] || `https://picsum.photos/seed/${match.otherUser.id}/200/200`} alt={match.otherUser.name} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
              <div className="flex-1 text-left">
                <div className="flex justify-between items-center mb-1">
                  <h5 className="font-bold text-sm">{match.otherUser.name}</h5>
                </div>
                <p className="text-xs text-slate-500 truncate">Click to chat</p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMatch(match.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all"
                title="Delete Match"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {matches.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">
              No matches yet. Keep swiping!
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={cn(
        "flex-1 flex-col rounded-3xl border overflow-hidden bg-white border-black/5 shadow-sm",
        selectedMatchId ? "flex" : "hidden md:flex"
      )}>
        {selectedMatch ? (
          <>
            <div className="p-4 border-b border-inherit flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedMatchId(null)}
                  className="md:hidden p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors"
                >
                  <ChevronLeft size={24} />
                </button>
                <img src={selectedMatch.otherUser.images?.[0] || `https://picsum.photos/seed/${selectedMatch.otherUser.id}/200/200`} alt={selectedMatch.otherUser.name} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                <div>
                  <h5 className="font-bold text-sm">{selectedMatch.otherUser.name}</h5>
                  <div className="flex items-center gap-1.5">
                    <div className={cn("w-1.5 h-1.5 rounded-full", selectedMatch.otherUser.isOnline ? "bg-green-500" : "bg-slate-300")} />
                    <p className="text-[10px] text-slate-500 font-medium">
                      {selectedMatch.typing?.[selectedMatch.otherUser.id] 
                        ? "typing..." 
                        : selectedMatch.otherUser.isOnline 
                          ? "Online" 
                          : "Offline"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-black/5 rounded-lg transition-colors"><ShieldCheck size={20} className="text-slate-400" /></button>
                <button className="p-2 hover:bg-black/5 rounded-lg transition-colors"><Settings size={20} className="text-slate-400" /></button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={cn(
                  "flex flex-col max-w-[80%] group",
                  msg.senderId === user?.uid ? "ml-auto items-end" : "items-start"
                )}>
                  <div className="flex items-center gap-2">
                    {msg.senderId === user?.uid && (
                      <button 
                        onClick={() => deleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm shadow-sm",
                      msg.senderId === user?.uid 
                        ? "bg-gradient-to-r from-primary to-secondary text-white rounded-tr-none" 
                        : "bg-slate-100 text-slate-800 rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                  Say hi to {selectedMatch.otherUser.name}!
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t border-inherit flex gap-3 items-center">
              <button 
                type="button"
                onClick={handleIcebreaker}
                disabled={generatingIcebreaker}
                className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                title="AI Icebreaker"
              >
                <Sparkles size={20} className={generatingIcebreaker ? "animate-pulse" : ""} />
              </button>
              <input 
                ref={inputRef}
                type="text" 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..." 
                className="flex-1 px-6 py-3 rounded-full outline-none text-sm transition-all bg-slate-100 border-transparent focus:bg-white focus:border-primary/20"
              />
              <button type="submit" className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 transition-all">
                <Send size={20} className="fill-current" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <MessageCircle size={48} className="mb-4 opacity-20" />
            <h4 className="text-lg font-bold text-slate-600">No Chat Selected</h4>
            <p className="text-sm max-w-xs">Select a match from the sidebar to start a conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Pricing = () => {
  const plans = [
    { name: 'Basic', price: 'Free', features: ['5 Likes per day', 'Standard matching', 'Basic support'], icon: Heart, color: 'text-slate-400' },
    { name: 'Premium', price: 'R99/mo', features: ['Unlimited Likes', 'See who likes you', 'Profile boost', 'Premium badge'], icon: Crown, color: 'text-accent', popular: true },
    { name: 'Elite', price: 'R249/mo', features: ['Everything in Premium', 'Priority matching', 'Personal dating coach', 'Incognito mode'], icon: Star, color: 'text-secondary' },
  ];

  return (
    <section className="py-16 px-4 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="font-display text-3xl font-bold mb-3">Choose Your Plan</h2>
        <p className="text-slate-500 text-sm">Unlock premium features and find love faster</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -10 }}
            className={cn(
              "p-6 rounded-[32px] border relative overflow-hidden flex flex-col bg-white border-black/5 shadow-xl shadow-black/5",
              plan.popular && "border-accent/50 ring-2 ring-accent/20"
            )}
          >
            {plan.popular && (
              <div className="absolute top-0 right-0 bg-accent text-white px-5 py-1 rounded-bl-xl text-[10px] font-bold uppercase tracking-widest">
                Most Popular
              </div>
            )}
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-5 bg-opacity-10", plan.color.replace('text', 'bg'))}>
              <plan.icon className={plan.color} size={24} />
            </div>
            <h4 className="text-xl font-bold mb-1">{plan.name}</h4>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl font-bold">{plan.price}</span>
              {plan.price !== 'Free' && <span className="text-slate-500 text-xs">/month</span>}
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((f, j) => (
                <li key={j} className="flex items-center gap-2 text-xs text-slate-500">
                  <CheckCircle2 size={14} className="text-green-500" />
                  {f}
                </li>
              ))}
            </ul>
            <button className={cn(
              "w-full py-3 rounded-xl font-bold transition-all text-sm",
              plan.popular ? "btn-gold" : "bg-slate-100 hover:bg-slate-200"
            )}>
              Choose {plan.name}
            </button>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

const CameraModal = ({ isOpen, onClose, onCapture }: { isOpen: boolean, onClose: () => void, onCapture: (base64: string) => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Could not access camera. Please check your permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(base64);
        stopCamera();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-[40px] overflow-hidden max-w-xl w-full shadow-2xl"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold">Take a Selfie</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="relative aspect-video bg-black">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <ShieldAlert size={48} className="text-red-500 mb-4" />
              <p className="text-white font-bold">{error}</p>
              <button 
                onClick={startCamera}
                className="mt-4 px-6 py-2 bg-white text-black rounded-xl font-bold"
              >
                Retry
              </button>
            </div>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="p-8 flex justify-center">
          <button
            onClick={capture}
            disabled={!!error || !stream}
            className="w-20 h-20 rounded-full border-4 border-primary p-1 bg-white hover:scale-105 transition-transform active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            <div className="w-full h-full rounded-full bg-primary flex items-center justify-center">
              <Camera size={32} className="text-white" />
            </div>
          </button>
        </div>
        
        <p className="text-center text-[10px] text-slate-400 pb-8 px-8">
          Position your face clearly in the frame. This photo will only be used for identity verification.
        </p>
      </motion.div>
    </motion.div>
  );
};

const SignupModal = ({ isOpen, onClose }: any) => {
  const [step, setStep] = useState(1);
  const totalSteps = 7;
  const [formData, setFormData] = useState({ 
    name: '', 
    age: '', 
    gender: '', 
    lookingFor: '', 
    bio: '',
    height: '',
    education: '',
    smoking: 'never',
    drinking: 'never',
    relationshipGoal: 'dating',
    hobbies: [] as string[],
    images: [] as string[],
    latitude: null as number | null,
    longitude: null as number | null,
    preferredAgeMin: 18,
    preferredAgeMax: 100,
    preferredDistance: 50,
    preferredEducation: [] as string[]
  });
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleAiBio = async () => {
    if (formData.hobbies.length === 0) {
      alert("Please select some interests first to help the AI generate a better bio!");
      return;
    }
    setIsGeneratingBio(true);
    const bio = await generateBioWithAI(formData.hobbies, formData.name || "there");
    setFormData(prev => ({ ...prev, bio }));
    setIsGeneratingBio(false);
  };

  const compressImage = (base64Str: string, maxWidth = 600, maxHeight = 600, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(base64Str); // Fallback to original if error
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File is too large. Please choose an image under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        
        // Duplicate image prevention
        if (formData.images.includes(compressed)) {
          alert("This image has already been uploaded.");
          return;
        }

        setFormData(prev => ({
          ...prev,
          images: [...prev.images, compressed]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleComplete = async () => {
    if (!user) return;
    if (formData.images.length < 2) {
      alert("Please upload at least 2 profile images.");
      return;
    }
    setIsSubmitting(true);
    try {
      // Check total size of images to prevent Firestore limit error
      const totalSize = JSON.stringify(formData.images).length;
      if (totalSize > 800000) { // ~800KB limit for safety
        alert("Your profile images are too large. Please remove some or use smaller photos.");
        setIsSubmitting(false);
        return;
      }

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email || '',
        displayName: formData.name || user.displayName || 'User',
        name: formData.name || user.displayName || 'User',
        age: parseInt(formData.age) || 20,
        gender: formData.gender || 'other',
        lookingFor: formData.lookingFor || 'Both',
        location: 'uMzimkhulu Central',
        bio: formData.bio || 'New member!',
        height: parseInt(formData.height) || 170,
        education: formData.education || 'Not specified',
        smoking: formData.smoking,
        drinking: formData.drinking,
        relationshipGoal: formData.relationshipGoal,
        images: formData.images,
        interests: formData.hobbies,
        hobbies: formData.hobbies,
        latitude: formData.latitude,
        longitude: formData.longitude,
        preferredAgeMin: formData.preferredAgeMin,
        preferredAgeMax: formData.preferredAgeMax,
        preferredDistance: formData.preferredDistance,
        preferredEducation: formData.preferredEducation,
        role: user.email === 'siphes9812@gmail.com' ? 'admin' : 'user',
        adminRights: user.email === 'siphes9812@gmail.com' ? {
          canManageUsers: true,
          canDeleteUsers: true,
          canModerateProfiles: true,
          canMonitorInteractions: true,
          canHandleReports: true,
          canManageVerification: true,
          canControlPayments: true,
          canManageNotifications: true,
          canManageContent: true,
          canViewAnalytics: true,
          canControlLocationPreferences: true,
          canManageSecurity: true,
          canManageSupport: true,
          canEditSettings: true,
          canManageAdmins: true
        } : {
          canManageUsers: false,
          canModerateProfiles: false,
          canMonitorInteractions: false,
          canHandleReports: false,
          canManageVerification: false,
          canControlPayments: false,
          canManageNotifications: false,
          canManageContent: false,
          canViewAnalytics: false,
          canControlLocationPreferences: false,
          canManageSecurity: false,
          canManageSupport: false,
          canEditSettings: false,
          canManageAdmins: false
        },
        isBanned: false,
        isVerified: false,
        isPremium: false,
        isOnline: true,
        lastSeen: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });
      setIsSuccess(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isStepValid = () => {
    if (step === 1) return formData.name && formData.age;
    if (step === 2) return formData.gender && formData.lookingFor;
    if (step === 3) return formData.height && formData.education;
    if (step === 4) return formData.smoking && formData.drinking && formData.relationshipGoal;
    if (step === 5) return formData.bio && formData.hobbies.length >= 3;
    if (step === 6) return formData.images.length >= 2;
    if (step === 7) return formData.preferredAgeMin && formData.preferredAgeMax && formData.preferredDistance;
    return true;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="max-w-md w-full rounded-[40px] overflow-hidden relative bg-white shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-black/5 rounded-full transition-colors z-10">
          <X size={20} />
        </button>

        <div className="p-8">
          {isSuccess ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12 text-center"
            >
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Welcome Aboard!</h3>
              <p className="text-slate-500 text-sm mb-8">Your profile has been created successfully. We're setting everything up for you...</p>
              <button 
                onClick={onClose}
                className="btn-primary px-8 py-3 rounded-full font-bold shadow-lg shadow-primary/20"
              >
                Get Started
              </button>
            </motion.div>
          ) : (
            <>
              <div className="flex gap-2 mb-8">
                {[1, 2, 3, 4, 5, 6, 7].map(s => (
                  <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-all duration-500", s <= step ? "bg-primary" : "bg-slate-100")} />
                ))}
              </div>

              <AnimatePresence mode="wait">
                {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-2xl font-bold mb-2">Welcome to Love Link</h3>
                <p className="text-slate-500 text-sm mb-8">Let's start with the basics.</p>
                <div className="space-y-5">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Full Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Thando Dlamini"
                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl outline-none border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary transition-all text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Age</label>
                    <input 
                      type="number" 
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      placeholder="Must be 18+"
                      className="w-full px-4 py-3.5 rounded-2xl outline-none border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary transition-all text-sm"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-2xl font-bold mb-2">Your Identity</h3>
                <p className="text-slate-500 text-sm mb-8">Tell us about yourself and who you're seeking.</p>
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 block">I am a</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['male', 'female', 'other'].map(g => (
                        <button 
                          key={g}
                          onClick={() => setFormData({ ...formData, gender: g })}
                          className={cn(
                            "p-3.5 rounded-2xl border font-bold text-sm transition-all capitalize",
                            formData.gender === g ? "border-primary bg-primary/5 text-primary" : "border-slate-100 hover:border-primary"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 block">Looking for</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['Men', 'Women', 'Both'].map(l => (
                        <button 
                          key={l}
                          onClick={() => setFormData({ ...formData, lookingFor: l })}
                          className={cn(
                            "p-3.5 rounded-2xl border font-bold text-sm transition-all",
                            formData.lookingFor === l ? "border-primary bg-primary/5 text-primary" : "border-slate-100 hover:border-primary"
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-2xl font-bold mb-2">Physical & Education</h3>
                <p className="text-slate-500 text-sm mb-8">A bit more detail helps with matching.</p>
                <div className="space-y-5">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Height (cm)</label>
                    <input 
                      type="text" 
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                      placeholder="e.g. 175"
                      className="w-full px-4 py-3.5 rounded-2xl outline-none border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Education</label>
                    <select 
                      value={formData.education}
                      onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                      className="w-full px-4 py-3.5 rounded-2xl outline-none border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary transition-all text-sm appearance-none"
                    >
                      <option value="">Select Education</option>
                      <option value="High School">High School</option>
                      <option value="Diploma">Diploma</option>
                      <option value="Bachelors">Bachelors</option>
                      <option value="Masters">Masters</option>
                      <option value="PhD">PhD</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-2xl font-bold mb-2">Lifestyle</h3>
                <p className="text-slate-500 text-sm mb-8">Tell us a bit about your habits.</p>
                <div className="space-y-5">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Smoking</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['never', 'occasionally', 'socially', 'regularly'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setFormData({ ...formData, smoking: opt as any })}
                          className={cn(
                            "py-2 px-3 rounded-xl border text-[10px] font-bold transition-all capitalize",
                            formData.smoking === opt ? "border-primary bg-primary/5 text-primary" : "border-slate-100 hover:border-primary"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Drinking</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['never', 'occasionally', 'socially', 'regularly'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setFormData({ ...formData, drinking: opt as any })}
                          className={cn(
                            "py-2 px-3 rounded-xl border text-[10px] font-bold transition-all capitalize",
                            formData.drinking === opt ? "border-primary bg-primary/5 text-primary" : "border-slate-100 hover:border-primary"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Relationship Goal</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['dating', 'friendship', 'long-term', 'marriage'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setFormData({ ...formData, relationshipGoal: opt as any })}
                          className={cn(
                            "py-2 px-3 rounded-xl border text-[10px] font-bold transition-all capitalize",
                            formData.relationshipGoal === opt ? "border-primary bg-primary/5 text-primary" : "border-slate-100 hover:border-primary"
                          )}
                        >
                          {opt.replace('-', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-2xl font-bold mb-2">Bio & Interests</h3>
                <p className="text-slate-500 text-sm mb-6">Tell us about yourself and what you love.</p>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Bio</label>
                      <button 
                        onClick={handleAiBio}
                        disabled={isGeneratingBio}
                        className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 disabled:opacity-50"
                      >
                        <Sparkles size={12} />
                        {isGeneratingBio ? "Generating..." : "AI Bio Assistant"}
                      </button>
                    </div>
                    <textarea 
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      placeholder="Tell us something interesting..."
                      className="w-full px-4 py-3.5 rounded-2xl outline-none border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary transition-all text-sm h-24 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 block">Interests (Select at least 3)</label>
                    <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                      {PREDEFINED_INTERESTS.map(interest => {
                        const isSelected = formData.hobbies.includes(interest);
                        return (
                          <button
                            key={interest}
                            onClick={() => {
                              if (isSelected) {
                                setFormData({ ...formData, hobbies: formData.hobbies.filter(h => h !== interest) });
                              } else {
                                setFormData({ ...formData, hobbies: [...formData.hobbies, interest] });
                              }
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
                              isSelected 
                                ? "bg-primary border-primary text-white" 
                                : "bg-slate-50 border-slate-100 text-slate-600 hover:border-primary"
                            )}
                          >
                            {interest}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-2xl font-bold mb-2">Profile Gallery</h3>
                <p className="text-slate-500 text-sm mb-6">Upload at least 2 photos to complete your profile.</p>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {formData.images.map((img, idx) => (
                    <div key={idx} className="relative aspect-[3/4] rounded-2xl overflow-hidden group">
                      <img src={img} className="w-full h-full object-cover" alt={`Gallery ${idx}`} />
                      <button 
                        onClick={() => removeImage(idx)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {formData.images.length < 6 && (
                    <label className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-all">
                      <Plus size={24} className="text-slate-400" />
                      <span className="text-[10px] font-bold uppercase text-slate-400">Add Photo</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
                
                {formData.images.length < 2 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-600 text-[10px] font-medium">
                    <AlertCircle size={14} />
                    <span>Minimum 2 photos required to continue</span>
                  </div>
                )}
              </motion.div>
            )}

            {step === 7 && (
              <motion.div
                key="step7"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h3 className="text-2xl font-bold mb-2">Matching Preferences</h3>
                <p className="text-slate-500 text-sm mb-6">Who would you like to meet?</p>
                
                <div className="space-y-8">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Age Range</label>
                      <span className="text-xs font-bold text-primary">{formData.preferredAgeMin} - {formData.preferredAgeMax} years</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <span className="text-[9px] text-slate-400 block mb-1 uppercase font-bold">Min</span>
                        <input 
                          type="range" 
                          min="18" 
                          max="100" 
                          value={formData.preferredAgeMin}
                          onChange={(e) => setFormData({ ...formData, preferredAgeMin: parseInt(e.target.value) })}
                          className="w-full accent-primary h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      <div className="flex-1">
                        <span className="text-[9px] text-slate-400 block mb-1 uppercase font-bold">Max</span>
                        <input 
                          type="range" 
                          min="18" 
                          max="100" 
                          value={formData.preferredAgeMax}
                          onChange={(e) => setFormData({ ...formData, preferredAgeMax: parseInt(e.target.value) })}
                          className="w-full accent-primary h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Maximum Distance</label>
                      <span className="text-xs font-bold text-primary">{formData.preferredDistance} km</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="500" 
                      value={formData.preferredDistance}
                      onChange={(e) => setFormData({ ...formData, preferredDistance: parseInt(e.target.value) })}
                      className="w-full accent-primary h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between mt-2">
                      <span className="text-[9px] text-slate-400 font-bold">1km</span>
                      <span className="text-[9px] text-slate-400 font-bold">500km</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-4 mt-10">
            {step > 1 && (
              <button 
                onClick={() => setStep(step - 1)}
                className="flex-1 py-4 rounded-2xl font-bold border border-slate-100 hover:bg-slate-50 transition-all text-sm"
              >
                Back
              </button>
            )}
            <button 
              onClick={() => step < totalSteps ? setStep(step + 1) : handleComplete()}
              disabled={!isStepValid() || isSubmitting}
              className="flex-[2] btn-primary py-4 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {isSubmitting ? 'Saving...' : step === totalSteps ? 'Complete Profile' : 'Continue'}
            </button>
          </div>
        </>
      )}
    </div>
  </motion.div>
</motion.div>
);
};

// --- Profile View ---

const ProfileView = () => {
  const { profile, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [isUploadingSelfie, setIsUploadingSelfie] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showTerms, setShowTerms] = useState<'terms' | 'popi' | null>(null);

  const termsContent = `
    <h4 className="font-bold text-slate-900 mb-2">1. Acceptance of Terms</h4>
    <p>By accessing and using Love Link, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the service.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">2. Eligibility</h4>
    <p>You must be at least 18 years old to use Love Link. By creating an account, you represent and warrant that you are 18 or older.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">3. User Conduct</h4>
    <p>Users are expected to behave respectfully. Harassment, abuse, or any form of discrimination will result in immediate account termination.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">4. Safety</h4>
    <p>While we strive to provide a safe environment, we are not responsible for the actions of users. Always exercise caution when meeting someone in person.</p>
  `;

  const popiContent = `
    <h4 className="font-bold text-slate-900 mb-2">Protection of Personal Information (POPI) Act</h4>
    <p>Love Link is committed to protecting your privacy and ensuring that your personal information is collected and used properly, lawfully, and transparently in accordance with the POPI Act of South Africa.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">1. Information We Collect</h4>
    <p>We collect information such as your name, age, gender, location, and interests to provide you with the best matching experience.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">2. Purpose of Collection</h4>
    <p>Your information is used solely for the purpose of facilitating connections between users on the platform.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">3. Data Security</h4>
    <p>We implement robust security measures to protect your data from unauthorized access, loss, or destruction.</p>
    <h4 className="font-bold text-slate-900 mb-2 mt-4">4. Your Rights</h4>
    <p>You have the right to access, correct, or delete your personal information at any time through your profile settings.</p>
  `;

  const compressImage = (base64Str: string, maxWidth = 600, maxHeight = 600, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleSelfieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && profile) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File is too large. Please choose an image under 5MB.");
        return;
      }
      setIsUploadingSelfie(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressed = await compressImage(reader.result as string);
          await updateDoc(doc(db, 'users', profile.uid), {
            verificationSelfie: compressed,
            verificationStatus: 'pending'
          });
          alert("Selfie uploaded! Our team will review it shortly.");
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
        } finally {
          setIsUploadingSelfie(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (!profile) {
    return (
      <div className="pt-32 pb-12 px-4 max-w-4xl mx-auto text-center">
        <div className="bg-white rounded-[40px] p-12 shadow-xl border border-black/5">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserIcon className="text-primary" size={40} />
          </div>
          <h2 className="text-2xl font-bold mb-4">Complete Your Profile</h2>
          <p className="text-slate-500 mb-8 max-w-md mx-auto">
            You haven't finished setting up your profile yet. Add some photos and details to start meeting new people!
          </p>
          <button 
            onClick={() => setShowSignup(true)}
            className="btn-primary px-8 py-4 rounded-2xl font-bold shadow-lg shadow-primary/20"
          >
            Create Profile
          </button>
        </div>
        <AnimatePresence>
          {showSignup && (
            <SignupModal isOpen={showSignup} onClose={() => setShowSignup(false)} />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-12 px-4 max-w-4xl mx-auto">
      <div className="bg-white rounded-[40px] shadow-xl overflow-hidden border border-black/5">
        <div className="relative h-64 bg-gradient-to-r from-primary via-secondary to-accent">
          <div className="absolute -bottom-16 left-8">
            <img 
              src={profile.images?.[0] || `https://ui-avatars.com/api/?name=${profile.name}`} 
              className="w-32 h-32 rounded-3xl border-4 border-white object-cover shadow-xl"
              alt={profile.name}
            />
          </div>
          <button 
            onClick={() => setIsEditing(true)}
            className="absolute bottom-4 right-8 px-6 py-2.5 bg-white/20 backdrop-blur-md text-white rounded-xl font-bold hover:bg-white/30 transition-all flex items-center gap-2"
          >
            <Settings size={18} />
            Edit Profile
          </button>
        </div>

        <div className="pt-20 px-8 pb-8">
          <div className="mb-8 p-6 rounded-3xl bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-700">Profile Completeness</h4>
              <span className="text-sm font-bold text-primary">{calculateCompleteness(profile)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${calculateCompleteness(profile)}%` }}
                className="h-full bg-gradient-to-r from-primary to-secondary"
              />
            </div>
            {calculateCompleteness(profile) < 100 && (
              <p className="text-[10px] text-slate-500 mt-2 italic">
                Complete your profile to get more matches!
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold">{profile.name}, {profile.age}</h2>
              <p className="text-slate-500 flex items-center gap-1">
                <Search size={14} /> {profile.location}
              </p>
            </div>
            <div className="flex gap-2">
              {profile.role === 'admin' && (
                <div className="p-2 bg-slate-900 text-white rounded-xl" title="Administrator">
                  <ShieldCheck size={20} />
                </div>
              )}
              {profile.isVerified && (
                <div className="p-2 bg-accent/10 text-accent rounded-xl" title="Verified Account">
                  <ShieldCheck size={20} />
                </div>
              )}
              {profile.isPremium && (
                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl" title="Premium Member">
                  <Crown size={20} />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Bio</h4>
                <p className="text-slate-600 leading-relaxed">{profile.bio || "No bio yet. Add one to stand out!"}</p>
              </div>

              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Interests</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.interests?.map(interest => (
                    <span key={interest} className="px-4 py-1.5 rounded-xl bg-slate-50 text-slate-600 text-xs font-bold border border-slate-100">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Looking For</h4>
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 text-primary font-bold text-sm">
                  {profile.lookingFor || "Not specified"}
                </div>
              </div>

              {/* Identity Verification Section */}
              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck size={18} className="text-primary" />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Identity Verification</h4>
                </div>
                
                {profile.isVerified ? (
                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl border border-green-100">
                    <CheckCircle2 className="text-green-500" size={24} />
                    <div>
                      <p className="text-sm font-bold text-green-900">Verified Account</p>
                      <p className="text-[10px] text-green-600">Your identity has been confirmed.</p>
                    </div>
                  </div>
                ) : profile.verificationStatus === 'pending' ? (
                  <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <div className="animate-pulse w-6 h-6 bg-amber-200 rounded-full" />
                    <div>
                      <p className="text-sm font-bold text-amber-900">Verification Pending</p>
                      <p className="text-[10px] text-amber-600">Our team is reviewing your selfie.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Verify your identity to get a blue checkmark and increase your match rate by up to 3x!
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setShowCamera(true)}
                        disabled={isUploadingSelfie}
                        className="btn-primary py-3 text-[10px] flex items-center justify-center gap-2"
                      >
                        <Camera size={14} />
                        Take Selfie
                      </button>
                      <label className="block">
                        <div className={`bg-slate-100 text-slate-600 py-3 rounded-2xl text-[10px] font-bold uppercase flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 transition-all ${isUploadingSelfie ? 'opacity-50 pointer-events-none' : ''}`}>
                          {isUploadingSelfie ? (
                            <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <ImageIcon size={14} />
                          )}
                          {isUploadingSelfie ? 'Uploading...' : 'Upload File'}
                        </div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleSelfieUpload}
                          disabled={isUploadingSelfie}
                        />
                      </label>
                    </div>
                    {profile.verificationStatus === 'rejected' && (
                      <p className="text-[10px] text-red-500 font-bold">
                        Your previous request was rejected. Please upload a clearer selfie.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {showCamera && (
                  <CameraModal 
                    isOpen={showCamera} 
                    onClose={() => setShowCamera(false)} 
                    onCapture={async (base64) => {
                      if (profile) {
                        setIsUploadingSelfie(true);
                        try {
                          const compressed = await compressImage(base64);
                          await updateDoc(doc(db, 'users', profile.uid), {
                            verificationSelfie: compressed,
                            verificationStatus: 'pending'
                          });
                          alert("Selfie captured! Our team will review it shortly.");
                        } catch (err) {
                          handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
                        } finally {
                          setIsUploadingSelfie(false);
                        }
                      }
                    }}
                  />
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Details</h4>
                <div className="space-y-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Gender</span>
                    <span className="font-bold capitalize">{profile.gender}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Height</span>
                    <span className="font-bold">{profile.height || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Education</span>
                    <span className="font-bold">{profile.education || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Zodiac</span>
                    <span className="font-bold">{profile.zodiac || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-primary/5 border border-primary/10">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4">Preferences</h4>
                <div className="space-y-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Age Range</span>
                    <span className="font-bold">{profile.preferredAgeMin || 18} - {profile.preferredAgeMax || 100}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Max Distance</span>
                    <span className="font-bold">{profile.preferredDistance || 50} km</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Education</span>
                    <span className="font-bold">{(profile.preferredEducation || []).length > 0 ? profile.preferredEducation.join(', ') : 'Any'}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <Bell size={18} className="text-primary" />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Notification Settings</h4>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Push Notifications</p>
                      <p className="text-[10px] text-slate-500">Get alerts for matches and messages</p>
                    </div>
                    <button 
                      onClick={async () => {
                        if (!('Notification' in window)) {
                          alert("This browser does not support desktop notifications");
                          return;
                        }

                        if (Notification.permission === 'denied') {
                          alert("Notifications are blocked. Please enable them in your browser settings.");
                          return;
                        }

                        if (Notification.permission === 'default') {
                          const permission = await Notification.requestPermission();
                          if (permission !== 'granted') return;
                        }

                        // Toggle the preference in Firestore
                        try {
                          await updateDoc(doc(db, 'users', profile.uid), {
                            pushNotificationsEnabled: !profile.pushNotificationsEnabled
                          });
                        } catch (err) {
                          handleFirestoreError(err, OperationType.UPDATE, `users/${profile.uid}`);
                        }
                      }}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        profile.pushNotificationsEnabled ? "bg-primary" : "bg-slate-300"
                      )}
                    >
                      <motion.div 
                        animate={{ x: profile.pushNotificationsEnabled ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                  
                  {Notification.permission === 'denied' && (
                    <p className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100 flex items-center gap-2">
                      <AlertCircle size={12} />
                      Notifications are blocked by your browser.
                    </p>
                  )}
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Legal</h4>
                <div className="space-y-3">
                  <button 
                    onClick={() => setShowTerms('terms')}
                    className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-primary transition-colors group"
                  >
                    <span>Terms & Conditions</span>
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                    onClick={() => setShowTerms('popi')}
                    className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-primary transition-colors group"
                  >
                    <span>POPI Act Compliance</span>
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              <button 
                onClick={logout}
                className="w-full py-4 rounded-2xl border-2 border-red-50 text-red-500 font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
              >
                <LogOut size={20} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isEditing && (
          <ProfileEditModal profile={profile} onClose={() => setIsEditing(false)} />
        )}
        {showTerms === 'terms' && (
          <TermsModal 
            isOpen={true} 
            onClose={() => setShowTerms(null)} 
            title="Terms & Conditions" 
            content={termsContent} 
          />
        )}
        {showTerms === 'popi' && (
          <TermsModal 
            isOpen={true} 
            onClose={() => setShowTerms(null)} 
            title="POPI Act Compliance" 
            content={popiContent} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const ProfileEditModal = ({ profile, onClose }: { profile: UserType, onClose: () => void }) => {
  const [formData, setFormData] = useState({ ...profile });
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);

  const handleAiBio = async () => {
    if ((formData.interests || []).length === 0) {
      alert("Please select some interests first to help the AI generate a better bio!");
      return;
    }
    setIsGeneratingBio(true);
    const bio = await generateBioWithAI(formData.interests || [], formData.name || "there");
    setFormData(prev => ({ ...prev, bio }));
    setIsGeneratingBio(false);
  };

  const updateLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }));
          alert("Location updated successfully!");
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert("Could not get your location. Please check your browser permissions.");
        }
      );
    }
  };

  const compressImage = (base64Str: string, maxWidth = 600, maxHeight = 600, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File is too large. Please choose an image under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        
        // Duplicate image prevention
        if ((formData.images || []).includes(compressed)) {
          alert("This image has already been uploaded.");
          return;
        }

        setFormData(prev => ({
          ...prev,
          images: [...(prev.images || []), compressed]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Check total size of images to prevent Firestore limit error
      const totalSize = JSON.stringify(formData.images).length;
      if (totalSize > 800000) { // ~800KB limit for safety
        alert("Your profile data is too large. Please remove some images or use smaller photos.");
        setIsSaving(false);
        return;
      }

      await updateDoc(doc(db, 'users', profile.id), {
        ...formData,
        lastSeen: serverTimestamp()
      });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${profile.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="max-w-2xl w-full bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b flex items-center justify-between">
          <h3 className="text-2xl font-bold">Edit Profile</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Age</label>
              <input 
                type="number" 
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) })}
                className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Location</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary outline-none transition-all"
                />
                <button 
                  type="button"
                  onClick={updateLocation}
                  className="px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-all text-primary"
                  title="Update to current location"
                >
                  <MapPin size={18} />
                </button>
              </div>
              {formData.latitude && (
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  GPS: {formData.latitude.toFixed(4)}, {formData.longitude?.toFixed(4)}
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Looking For</label>
              <select 
                value={formData.lookingFor}
                onChange={(e) => setFormData({ ...formData, lookingFor: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary outline-none transition-all"
              >
                <option value="Men">Men</option>
                <option value="Women">Women</option>
                <option value="Both">Both</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Bio</label>
              <button 
                onClick={handleAiBio}
                disabled={isGeneratingBio}
                className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles size={12} />
                {isGeneratingBio ? "Generating..." : "AI Bio Assistant"}
              </button>
            </div>
            <textarea 
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary outline-none transition-all resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Interests</label>
            <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto p-2 border border-slate-100 rounded-2xl bg-slate-50 custom-scrollbar">
              {PREDEFINED_INTERESTS.map(interest => {
                const isSelected = (formData.interests || []).includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => {
                      const currentInterests = formData.interests || [];
                      if (isSelected) {
                        setFormData({ ...formData, interests: currentInterests.filter(h => h !== interest) });
                      } else {
                        setFormData({ ...formData, interests: [...currentInterests, interest] });
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
                      isSelected 
                        ? "bg-primary border-primary text-white" 
                        : "bg-white border-slate-100 text-slate-600 hover:border-primary"
                    )}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Profile Gallery</label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-4">
              {formData.images?.map((img, idx) => (
                <div key={idx} className="relative aspect-[3/4] rounded-xl overflow-hidden group">
                  <img src={img} className="w-full h-full object-cover" alt="" />
                  <button 
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {(formData.images?.length || 0) < 15 && (
                <label className="aspect-[3/4] rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-50 transition-all">
                  <Plus size={20} className="text-slate-400" />
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              )}
            </div>
            <p className="text-[10px] text-slate-400 italic">Compressed images help keep your profile loading fast.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Height</label>
              <input 
                type="text" 
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Education</label>
              <input 
                type="text" 
                value={formData.education}
                onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Zodiac</label>
              <input 
                type="text" 
                value={formData.zodiac}
                onChange={(e) => setFormData({ ...formData, zodiac: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:border-primary outline-none transition-all"
              />
            </div>
          </div>

          <div className="pt-6 border-t space-y-6">
            <h4 className="text-sm font-bold text-slate-900">Notification Settings</h4>
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-900">Push Notifications</p>
                <p className="text-[10px] text-slate-500">Enable browser alerts for new matches and messages</p>
              </div>
              <button 
                type="button"
                onClick={async () => {
                  if (!('Notification' in window)) {
                    alert("This browser does not support desktop notifications");
                    return;
                  }
                  if (Notification.permission === 'denied') {
                    alert("Notifications are blocked. Please enable them in your browser settings.");
                    return;
                  }
                  if (Notification.permission === 'default') {
                    const permission = await Notification.requestPermission();
                    if (permission !== 'granted') return;
                  }
                  setFormData({ ...formData, pushNotificationsEnabled: !formData.pushNotificationsEnabled });
                }}
                className={cn(
                  "w-12 h-6 rounded-full transition-all relative",
                  formData.pushNotificationsEnabled ? "bg-primary" : "bg-slate-300"
                )}
              >
                <motion.div 
                  animate={{ x: formData.pushNotificationsEnabled ? 24 : 4 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>
          </div>

          <div className="pt-6 border-t space-y-6">
            <h4 className="text-sm font-bold text-slate-900">Matching Preferences</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 block">Age Range ({formData.preferredAgeMin} - {formData.preferredAgeMax})</label>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <span className="text-[9px] text-slate-400 block mb-1">Min Age</span>
                    <input 
                      type="range" 
                      min="18" 
                      max="100" 
                      value={formData.preferredAgeMin}
                      onChange={(e) => setFormData({ ...formData, preferredAgeMin: parseInt(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[9px] text-slate-400 block mb-1">Max Age</span>
                    <input 
                      type="range" 
                      min="18" 
                      max="100" 
                      value={formData.preferredAgeMax}
                      onChange={(e) => setFormData({ ...formData, preferredAgeMax: parseInt(e.target.value) })}
                      className="w-full accent-primary"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 block">Max Distance ({formData.preferredDistance} km)</label>
                <input 
                  type="range" 
                  min="1" 
                  max="500" 
                  value={formData.preferredDistance}
                  onChange={(e) => setFormData({ ...formData, preferredDistance: parseInt(e.target.value) })}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 block">Preferred Education</label>
              <div className="flex flex-wrap gap-2">
                {["High School", "Bachelor's", "Master's", "PhD", "Other"].map(edu => {
                  const isSelected = (formData.preferredEducation || []).includes(edu);
                  return (
                    <button
                      key={edu}
                      type="button"
                      onClick={() => {
                        const currentEdu = formData.preferredEducation || [];
                        if (isSelected) {
                          setFormData({ ...formData, preferredEducation: currentEdu.filter(e => e !== edu) });
                        } else {
                          setFormData({ ...formData, preferredEducation: [...currentEdu, edu] });
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
                        isSelected 
                          ? "bg-primary border-primary text-white" 
                          : "bg-slate-50 border-slate-100 text-slate-600"
                      )}
                    >
                      {edu}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 border-t bg-slate-50 flex gap-4">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all">Cancel</button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex-[2] btn-primary py-4 font-bold shadow-lg shadow-primary/20"
          >
            {isSaving ? 'Saving Changes...' : 'Save Profile'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const FilterModal = ({ isOpen, onClose, filters, setFilters, interests }: { 
  isOpen: boolean, 
  onClose: () => void, 
  filters: any, 
  setFilters: (f: any) => void,
  interests: string[]
}) => {
  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b flex items-center justify-between">
          <h3 className="text-2xl font-bold">Filters</h3>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto no-scrollbar">
          {/* Age Range */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">Age Range</label>
            <div className="flex items-center gap-4">
              <input 
                type="number" 
                value={filters.ageRange[0]} 
                onChange={(e) => setFilters({...filters, ageRange: [parseInt(e.target.value), filters.ageRange[1]]})}
                className="w-full p-3 rounded-xl bg-slate-50 border-none text-sm font-bold focus:ring-2 ring-primary/20"
              />
              <span className="text-slate-400 font-bold">to</span>
              <input 
                type="number" 
                value={filters.ageRange[1]} 
                onChange={(e) => setFilters({...filters, ageRange: [filters.ageRange[0], parseInt(e.target.value)]})}
                className="w-full p-3 rounded-xl bg-slate-50 border-none text-sm font-bold focus:ring-2 ring-primary/20"
              />
            </div>
          </div>

          {/* Distance */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">Max Distance ({filters.maxDistance}km)</label>
            <input 
              type="range" 
              min="1" 
              max="500" 
              value={filters.maxDistance} 
              onChange={(e) => setFilters({...filters, maxDistance: parseInt(e.target.value)})}
              className="w-full accent-primary"
            />
          </div>

          {/* Interests */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">Interests</label>
            <div className="flex flex-wrap gap-2">
              {interests.map(interest => {
                const isSelected = filters.interests.includes(interest);
                return (
                  <button
                    key={interest}
                    onClick={() => {
                      if (isSelected) {
                        setFilters({...filters, interests: filters.interests.filter((i: string) => i !== interest)});
                      } else {
                        setFilters({...filters, interests: [...filters.interests, interest]});
                      }
                    }}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                      isSelected 
                        ? "bg-primary border-primary text-white" 
                        : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t flex flex-col gap-3">
          <button 
            onClick={onClose}
            className="w-full btn-primary py-4 font-bold shadow-lg shadow-primary/20"
          >
            Apply Filters
          </button>
          <button 
            onClick={() => {
              setFilters({
                ageRange: [18, 100],
                maxDistance: 100,
                interests: [],
                showTopPicks: false
              });
            }}
            className="w-full py-3 text-slate-500 font-bold hover:text-slate-700 transition-colors text-sm"
          >
            Clear All Filters
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  useEffect(() => {
    testConnection();
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const usePushNotifications = (user: FirebaseUser | null, profile: UserType | null) => {
  useEffect(() => {
    if (!user || !profile || !('Notification' in window)) return;
    if (!profile.pushNotificationsEnabled) return;

    if (Notification.permission === 'default') {
      // We don't request here automatically to avoid annoying the user
      // unless they explicitly enabled it in settings
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    let isInitialLoad = true;
    const unsubscribe = onSnapshot(q, (snap) => {
      if (isInitialLoad) {
        isInitialLoad = false;
        return;
      }

      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notification = change.doc.data();
          if (Notification.permission === 'granted') {
            new Notification(notification.title || 'New Notification', {
              body: notification.message,
              icon: '/favicon.ico',
            });
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user, profile]);
};

function AppContent() {
  const [activeTab, setActiveTab] = useState('home');
  const [showMatch, setShowMatch] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserType | null>(null);
  const [profiles, setProfiles] = useState<UserType[]>([]);
  const [myLikes, setMyLikes] = useState<string[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reportingUser, setReportingUser] = useState<UserType | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    ageRange: [18, 100],
    maxDistance: 100,
    interests: [] as string[],
    showTopPicks: false
  });
  const [appSettings, setAppSettings] = useState<any>({
    maintenanceMode: false,
    registrationEnabled: true,
    premiumOnly: false
  });
  const { user, profile, loading, isSigningIn, signInError, signIn, logout, sendVerification } = useAuth();
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const isAdminUser = profile?.role === 'admin' || user?.email === 'siphes9812@gmail.com';

  // Initialize push notifications
  usePushNotifications(user, profile);

  if (appSettings.maintenanceMode && !isAdminUser && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-6">
            <Settings size={40} className="animate-spin-slow" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Under Maintenance</h1>
          <p className="text-slate-600 mb-8">{appSettings.broadcastMessage || "We're currently performing some scheduled maintenance. We'll be back shortly!"}</p>
          <div className="p-4 bg-white rounded-2xl border border-black/5 shadow-sm text-xs text-slate-400">
            Estimated completion: Within 2 hours
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (user?.email === 'siphes9812@gmail.com' && profile) {
      const hasAllRights = profile.adminRights && 
                          profile.adminRights.canManageUsers && 
                          profile.adminRights.canDeleteUsers &&
                          profile.adminRights.canModerateProfiles &&
                          profile.adminRights.canMonitorInteractions &&
                          profile.adminRights.canHandleReports &&
                          profile.adminRights.canManageVerification &&
                          profile.adminRights.canControlPayments &&
                          profile.adminRights.canManageNotifications &&
                          profile.adminRights.canManageContent &&
                          profile.adminRights.canViewAnalytics &&
                          profile.adminRights.canControlLocationPreferences &&
                          profile.adminRights.canManageSecurity &&
                          profile.adminRights.canManageSupport &&
                          profile.adminRights.canEditSettings &&
                          profile.adminRights.canManageAdmins;

      if (profile.isBanned || profile.isBlocked || profile.role !== 'admin' || !hasAllRights) {
        const userDoc = doc(db, 'users', user.uid);
        updateDoc(userDoc, {
          isBanned: false,
          isBlocked: false,
          role: 'admin',
          adminRights: {
            canManageUsers: true,
            canDeleteUsers: true,
            canModerateProfiles: true,
            canMonitorInteractions: true,
            canHandleReports: true,
            canManageVerification: true,
            canControlPayments: true,
            canManageNotifications: true,
            canManageContent: true,
            canViewAnalytics: true,
            canControlLocationPreferences: true,
            canManageSecurity: true,
            canManageSupport: true,
            canEditSettings: true,
            canManageAdmins: true
          }
        }).catch(err => {
          console.error("Failed to auto-reinstate admin account", err);
        });
      }
    }
  }, [user, profile]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setAppSettings(snap.data());
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    console.log("[Discovery] My Profile:", profile);
  }, [profile]);

  useEffect(() => {
    console.log("[Discovery] Current profiles in state:", profiles.length);
  }, [profiles]);

  useEffect(() => {
    console.log("[Discovery] My Likes:", myLikes);
  }, [myLikes]);

  useEffect(() => {
    // If user is signed in and on home, redirect to discover
    if (user && activeTab === 'home') {
      setActiveTab('discover');
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (!user) {
      setMyLikes([]);
      return;
    }
    const q = query(collection(db, 'likes'), where('fromUserId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      setMyLikes(snap.docs.map(doc => doc.data().toUserId));
    }, (err) => {
      console.error("Error fetching likes:", err);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setProfiles([]);
      setDiscoveryLoading(false);
      return;
    }

    setDiscoveryLoading(true);
    console.log("[Discovery] Subscribing to users...");
    const q = query(collection(db, 'users'), limit(200));
    const unsubscribe = onSnapshot(q, (snap) => {
      console.log(`[Discovery] Fetched ${snap.docs.length} users from DB`);
      const fetched = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as UserType))
        .filter(p => {
          if (p.id === user?.uid) return false;
          if (p.isBanned || p.isBlocked) {
            console.log(`[Discovery] Filtered ${p.name} (Banned/Blocked)`);
            return false;
          }
          if (p.role === 'admin') return false;
          
          // Filter out already liked users
          if (myLikes.includes(p.id)) {
            console.log(`[Discovery] Filtered ${p.name} (Already Liked)`);
            return false;
          }

          if (!profile) return true;

          // Blocked users
          if (profile.blockedUsers?.includes(p.id)) return false;
          if (p.blockedUsers?.includes(user.uid)) return false;

          const myGender = profile.gender?.toLowerCase();
          const myLookingFor = profile.lookingFor?.toLowerCase(); // 'men', 'women', 'both'
          const theirGender = p.gender?.toLowerCase();
          const theirLookingFor = p.lookingFor?.toLowerCase();

          // Mutual Interest Check (Only if both profiles have gender/lookingFor set)
          if (myGender && myLookingFor && theirGender && theirLookingFor) {
            const iAmInterested = (myLookingFor === 'both') || 
                                  (myLookingFor === 'women' && theirGender === 'female') || 
                                  (myLookingFor === 'men' && theirGender === 'male');
            
            const theyAreInterested = (theirLookingFor === 'both') || 
                                      (theirLookingFor === 'women' && myGender === 'female') || 
                                      (theirLookingFor === 'men' && myGender === 'male');

            if (!iAmInterested || !theyAreInterested) {
              console.log(`[Discovery] Filtered ${p.name} (Mutual Interest: iAmInterested=${iAmInterested}, theyAreInterested=${theyAreInterested}, myGender=${myGender}, myLookingFor=${myLookingFor}, theirGender=${theirGender}, theirLookingFor=${theirLookingFor})`);
              return false;
            }
          }

          // Advanced Filtering
          
          // 1. Age Preference
          const minAge = filters.ageRange[0];
          const maxAge = filters.ageRange[1];
          if (p.age && (p.age < minAge || p.age > maxAge)) {
            console.log(`[Discovery] Filtered ${p.name} (Age: ${p.age} not in ${minAge}-${maxAge})`);
            return false;
          }

          // 2. Distance Preference
          const maxDist = filters.maxDistance;
          if (profile.latitude && profile.longitude && p.latitude && p.longitude) {
            const dist = calculateDistance(profile.latitude, profile.longitude, p.latitude, p.longitude);
            if (dist > maxDist) {
              console.log(`[Discovery] Filtered ${p.name} (Distance: ${dist.toFixed(1)}km > ${maxDist}km)`);
              return false;
            }
          }

          // 3. Interests Filter
          if (filters.interests.length > 0) {
            const hasCommonInterest = filters.interests.some(i => p.interests?.includes(i));
            if (!hasCommonInterest) {
              console.log(`[Discovery] Filtered ${p.name} (No common interests)`);
              return false;
            }
          }

          // 4. Education Preference
          if (profile.preferredEducation && profile.preferredEducation.length > 0) {
            if (p.education && !profile.preferredEducation.includes(p.education)) {
              console.log(`[Discovery] Filtered ${p.name} (Education mismatch)`);
              return false;
            }
          }

          return true;
        });
      
      console.log(`[Discovery] Final profiles count: ${fetched.length}`);
      if (fetched.length > 0) {
        setProfiles(fetched);
      } else {
        setProfiles([]);
      }
      setDiscoveryLoading(false);
    }, (err) => {
      console.error("[Discovery] Error fetching users:", err);
      if (err.code === 'permission-denied') {
        setProfiles([]);
      } else {
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
      setDiscoveryLoading(false);
    });

    return () => unsubscribe();
  }, [user, profile, filters, myLikes]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setUnreadCount(snap.size);
    }, (err) => {
      if (err.code !== 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, 'notifications');
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (user && !profile && !loading) {
      if (!appSettings.registrationEnabled && !profile) {
        // Registration is disabled
        alert("New registrations are currently disabled by the administrator. Please try again later.");
        logout();
        return;
      }
      setShowSignup(true);
    } else if (profile) {
      setShowSignup(false);
    }
  }, [user, profile, loading, appSettings.registrationEnabled]);

  // Global Guards
  if (user && !user.emailVerified && !isAdminUser) {
    return (
      <div className="fixed inset-0 z-[200] bg-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail size={40} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Verify Your Email</h1>
          <p className="text-slate-500 mb-8">
            We've sent a verification email to <strong>{user.email}</strong>. Please check your inbox and click the link to confirm your account.
          </p>
          
          {verificationSent && (
            <div className="mb-6 p-3 bg-green-50 text-green-600 rounded-xl text-xs font-bold border border-green-100 flex items-center gap-2 justify-center">
              <CheckCircle2 size={14} />
              Verification email resent!
            </div>
          )}

          {verificationError && (
            <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2 justify-center">
              <AlertCircle size={14} />
              {verificationError}
            </div>
          )}

          <div className="space-y-4">
            <button 
              onClick={() => window.location.reload()} 
              className="btn-primary w-full py-4"
            >
              I've Verified My Email
            </button>
            <button 
              onClick={async () => {
                setVerificationSent(false);
                setVerificationError(null);
                try {
                  await sendVerification();
                  setVerificationSent(true);
                } catch (err: any) {
                  setVerificationError(err.message);
                }
              }} 
              className="text-primary font-bold text-sm hover:underline"
            >
              Resend Verification Email
            </button>
            <button onClick={logout} className="block w-full text-slate-400 text-sm hover:text-slate-600">
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user && profile && (profile.isBanned || profile.isBlocked) && !isAdminUser) {
    return (
      <div className="fixed inset-0 z-[200] bg-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={40} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Account Restricted</h1>
          <p className="text-slate-500 mb-8">
            Your account has been {profile.isBanned ? 'permanently banned' : 'temporarily blocked'} for violating our community guidelines.
          </p>
          <button onClick={logout} className="btn-primary w-full py-4">Logout</button>
        </div>
      </div>
    );
  }

  if (appSettings.maintenanceMode && profile?.role !== 'admin') {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-900 flex items-center justify-center p-6 text-center text-white">
        <div className="max-w-md">
          <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Settings size={40} className="animate-spin-slow" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Under Maintenance</h1>
          <p className="text-slate-400 mb-8">
            {appSettings.broadcastMessage || "uMzimkhulu Love Link is currently undergoing scheduled maintenance. We'll be back online shortly!"}
          </p>
          {user && <button onClick={logout} className="px-8 py-3 rounded-full border border-white/20 hover:bg-white/5 transition-all">Logout</button>}
        </div>
      </div>
    );
  }

  if (appSettings.premiumOnly && user && profile && !profile.isPremium && profile.role !== 'admin') {
    return (
      <div className="fixed inset-0 z-[200] bg-gradient-to-br from-slate-900 to-black flex items-center justify-center p-6 text-center text-white">
        <div className="max-w-md">
          <div className="w-20 h-20 bg-amber-400/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <Crown size={40} />
          </div>
          <h1 className="text-3xl font-bold mb-4">Premium Access Only</h1>
          <p className="text-slate-400 mb-8">
            The community is currently in exclusive mode. Only premium members can access the app at this time.
          </p>
          <div className="flex flex-col gap-3">
            <button className="btn-primary w-full py-4 bg-amber-500 hover:bg-amber-600 border-none text-black">Upgrade to Premium</button>
            <button onClick={logout} className="text-slate-500 hover:text-white transition-colors text-sm">Logout</button>
          </div>
        </div>
      </div>
    );
  }

  const handleLike = async (targetUser: UserType) => {
    if (!user) {
      signIn();
      return;
    }

    // Remove from local list
    setProfiles(prev => prev.filter(p => p.id !== targetUser.id));

    try {
      // 1. Save the like in a 'likes' collection
      const likeId = `${user.uid}_${targetUser.id}`;
      await setDoc(doc(db, 'likes', likeId), {
        fromUserId: user.uid,
        toUserId: targetUser.id,
        timestamp: serverTimestamp()
      });

      // 2. Check if the other user has liked us
      const reverseLikeId = `${targetUser.id}_${user.uid}`;
      const reverseLikeDoc = await getDoc(doc(db, 'likes', reverseLikeId));

      if (reverseLikeDoc.exists()) {
        // It's a mutual match!
        setShowMatch(true);
        
        await addDoc(collection(db, 'matches'), {
          users: [user.uid, targetUser.id],
          timestamp: serverTimestamp(),
          typing: { [user.uid]: false, [targetUser.id]: false }
        });

        // Notify both users about the match
        await addDoc(collection(db, 'notifications'), {
          userId: targetUser.id,
          fromUserId: user.uid,
          type: 'match',
          title: "It's a Match!",
          message: `You and ${profile?.name || 'someone'} matched!`,
          createdAt: serverTimestamp(),
          read: false
        });
      } else {
        // Just a regular like notification
        await addDoc(collection(db, 'notifications'), {
          userId: targetUser.id,
          fromUserId: user.uid,
          type: 'like',
          title: 'New Like!',
          message: `${profile?.name || 'Someone'} liked your profile.`,
          createdAt: serverTimestamp(),
          read: false
        });
      }
    } catch (err) {
      console.error("Error handling like", err);
    }
  };

  const handlePass = (targetUser: UserType) => {
    setProfiles(prev => prev.filter(p => p.id !== targetUser.id));
  };

  const handleBlock = async (targetUser: UserType) => {
    if (!user || !profile) return;
    
    if (!window.confirm(`Are you sure you want to block ${targetUser.name}? This will prevent all future interactions.`)) {
      return;
    }

    try {
      const userDoc = doc(db, 'users', user.uid);
      const currentBlocked = profile.blockedUsers || [];
      if (!currentBlocked.includes(targetUser.id)) {
        await updateDoc(userDoc, {
          blockedUsers: [...currentBlocked, targetUser.id]
        });
      }
      
      // Also remove any existing matches
      const q = query(
        collection(db, 'matches'),
        where('users', 'array-contains', user.uid)
      );
      const snap = await getDocs(q);
      const matchToDelete = snap.docs.find(doc => doc.data().users.includes(targetUser.id));
      if (matchToDelete) {
        await deleteDoc(doc(db, 'matches', matchToDelete.id));
      }

      setProfiles(prev => prev.filter(p => p.id !== targetUser.id));
      setSelectedProfile(null);
      alert(`${targetUser.name} has been blocked.`);
    } catch (err) {
      console.error("Error blocking user", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleMessage = async (targetUser: UserType) => {
    if (!user) {
      signIn();
      return;
    }

    // Check if match exists
    const q = query(
      collection(db, 'matches'),
      where('users', 'array-contains', user.uid)
    );
    
    const snap = await getDocs(q);
    let existingMatch = snap.docs.find(doc => doc.data().users.includes(targetUser.id));

    if (existingMatch) {
      setSelectedMatchId(existingMatch.id);
      setActiveTab('chat');
    } else {
      alert("You can only message users you have a mutual match with!");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300">
      {appSettings.broadcastMessage && appSettings.broadcastMessage.trim() !== '' && !appSettings.maintenanceMode && (
        <div className="bg-primary text-white py-2 px-6 text-center text-[10px] font-bold flex items-center justify-center gap-2 relative z-[100] uppercase tracking-widest">
          <Bell size={12} />
          {appSettings.broadcastMessage}
        </div>
      )}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        unreadCount={unreadCount}
      />

      <main>
        <AnimatePresence mode="wait">
          {activeTab === 'home' && !user && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Hero onSignIn={signIn} isSigningIn={isSigningIn} signInError={signInError} />
            </motion.div>
          )}

          {activeTab === 'discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="pt-20 pb-10 px-4 max-w-7xl mx-auto"
            >
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Discover New People</h2>
                  <p className="text-slate-500 text-sm">Swipe right to like, left to pass</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowFilters(true)}
                    className="px-5 py-1.5 rounded-full border border-black/10 hover:bg-black/5 font-medium transition-all text-xs flex items-center gap-2"
                  >
                    <Filter size={14} />
                    Filters
                  </button>
                  <button className="btn-gold py-1.5 px-5 text-xs">
                    Boost Profile
                  </button>
                </div>
              </div>

              {/* Top Picks Section */}
              {profiles.length > 0 && (
                <div className="mb-12">
                  <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="text-amber-500" size={20} />
                    <h3 className="text-lg font-bold">Top Picks for You</h3>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                    {profiles.slice(0, 5).map(p => (
                      <div key={`top-${p.id}`} className="min-w-[160px] md:min-w-[200px]">
                        <ProfileCard 
                          user={p} 
                          currentUserProfile={profile}
                          onLike={() => handleLike(p)} 
                          onPass={() => handlePass(p)}
                          onMessage={() => handleMessage(p)}
                          onReport={() => setReportingUser(p)}
                          onBlock={() => handleBlock(p)}
                          onClick={() => setSelectedProfile(p)}
                          compact={true}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                {profiles.map(p => (
                  <ProfileCard 
                    key={p.id} 
                    user={p} 
                    currentUserProfile={profile}
                    onLike={() => handleLike(p)} 
                    onPass={() => handlePass(p)}
                    onMessage={() => handleMessage(p)}
                    onReport={() => setReportingUser(p)}
                    onBlock={() => handleBlock(p)}
                    onClick={() => setSelectedProfile(p)}
                  />
                ))}
                {discoveryLoading ? (
                  <div className="col-span-full py-20 text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-500">Finding matches for you...</p>
                  </div>
                ) : profiles.length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="text-slate-300" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700">No more profiles</h3>
                    <p className="text-slate-500 mb-6">Check back later for more people in your area!</p>
                    <button 
                      onClick={() => setFilters({
                        ageRange: [18, 100],
                        maxDistance: 500,
                        interests: [],
                        showTopPicks: false
                      })}
                      className="px-6 py-2 bg-primary text-white rounded-full font-bold hover:bg-primary-hover transition-colors"
                    >
                      Reset Filters
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Chat 
              selectedMatchId={selectedMatchId} 
              setSelectedMatchId={setSelectedMatchId} 
              profile={profile}
            />
            </motion.div>
          )}

          {activeTab === 'notifications' && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Notifications />
            </motion.div>
          )}

          {activeTab === 'dashboard' && isAdminUser && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Dashboard 
                profile={profile}
                onSelectMatch={(id) => {
                  if (id) setSelectedMatchId(id);
                  setActiveTab('chat');
                }} 
              />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ProfileView />
            </motion.div>
          )}

          {activeTab === 'admin' && isAdminUser && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <AdminDashboard />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Profile Detail Modal */}
      <AnimatePresence>
        {selectedProfile && (
          <ProfileDetailModal 
            user={selectedProfile} 
            currentUserProfile={profile}
            onClose={() => setSelectedProfile(null)} 
            onLike={() => { handleLike(selectedProfile); setSelectedProfile(null); }}
            onPass={() => { handlePass(selectedProfile); setSelectedProfile(null); }}
            onMessage={() => { handleMessage(selectedProfile); setSelectedProfile(null); }}
            onReport={() => { setReportingUser(selectedProfile); setSelectedProfile(null); }}
            onBlock={() => { handleBlock(selectedProfile); setSelectedProfile(null); }}
          />
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {reportingUser && (
          <ReportModal 
            reportedUser={reportingUser} 
            onClose={() => setReportingUser(null)} 
          />
        )}
      </AnimatePresence>

      {/* Filter Modal */}
      <AnimatePresence>
        {showFilters && (
          <FilterModal 
            isOpen={showFilters} 
            onClose={() => setShowFilters(false)} 
            filters={filters} 
            setFilters={setFilters} 
            interests={["Music", "Travel", "Food", "Art", "Sports", "Gaming", "Movies", "Reading", "Dancing", "Cooking", "Photography", "Fitness", "Nature", "Technology", "Fashion"]}
          />
        )}
      </AnimatePresence>

      {/* Match Popup */}
      <AnimatePresence>
        {showMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="bg-gradient-to-br from-primary via-wine to-black p-1 rounded-[40px] shadow-2xl max-w-md w-full text-center overflow-hidden"
            >
              <div className="bg-white rounded-[32px] p-8 relative">
                <div className="flex justify-center gap-3 mb-5">
                  <div className="relative">
                    <img src={user?.photoURL || "https://picsum.photos/seed/me/200/200"} className="w-16 h-16 rounded-full border-4 border-slate-100 object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="relative">
                    <img src={selectedProfile?.images?.[0] || "https://picsum.photos/seed/them/200/200"} className="w-16 h-16 rounded-full border-4 border-slate-100 object-cover" referrerPolicy="no-referrer" />
                  </div>
                </div>
                
                <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">It's a Match! 🎉</h2>
                <p className="text-slate-500 mb-5 text-xs">You and {selectedProfile?.name || 'someone'} have liked each other. Start the conversation now!</p>
                
                <div className="space-y-2">
                  <button 
                    onClick={() => { setActiveTab('chat'); setShowMatch(false); }}
                    className="w-full btn-primary py-2.5 text-sm"
                  >
                    Send a Message
                  </button>
                  <button 
                    onClick={() => setShowMatch(false)}
                    className="w-full py-2.5 text-slate-400 font-semibold hover:text-slate-600 transition-colors text-xs"
                  >
                    Keep Swiping
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Signup Modal */}
      <AnimatePresence>
        {showSignup && (
          <SignupModal 
            isOpen={showSignup} 
            onClose={() => { setShowSignup(false); setActiveTab('discover'); }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
