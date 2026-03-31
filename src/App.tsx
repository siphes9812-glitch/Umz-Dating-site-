import React, { useState, useEffect, createContext, useContext } from 'react';
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
  ShieldCheck, 
  Zap,
  Menu,
  X,
  CheckCircle2,
  Crown,
  ChevronRight,
  Star,
  AlertCircle
} from 'lucide-react';
import { cn } from './lib/utils';
import { User as UserType, MOCK_PROFILES } from './types';
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
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  addDoc,
  getDocFromServer
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
            {error?.message?.includes('{') 
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

// --- Context ---

const AuthContext = createContext<{
  user: FirebaseUser | null;
  profile: UserType | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
} | null>(null);

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userDoc = doc(db, 'users', u.uid);
        onSnapshot(userDoc, (snap) => {
          if (snap.exists()) {
            setProfile({ id: snap.id, ...snap.data() } as UserType);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (err) => handleFirestoreError(err, OperationType.GET, `users/${u.uid}`));
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Test connection
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

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        console.error("Sign in error", error);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

// --- Components ---

const Navbar = ({ activeTab, setActiveTab }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, profile, signIn, logout } = useAuth();

  const navItems = [
    { id: 'discover', label: 'Discover', icon: Search },
    { id: 'chat', label: 'Messages', icon: MessageCircle },
    { id: 'dashboard', label: 'Dashboard', icon: Zap },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-md border-b bg-white/60 border-black/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('discover')}>
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <Heart className="text-white fill-current" size={20} />
            </div>
            <span className="font-display text-xl font-bold tracking-tight hidden sm:block">
              <span className="text-primary">uMzimkhulu</span>
              <span className="text-slate-900"> Love Link</span>
            </span>
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

const Hero = ({ onSignIn }: { onSignIn: () => void }) => {
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

          <div className="bg-white rounded-[24px] p-6 shadow-2xl shadow-black/5 border border-slate-100 mb-6">
            <div className="space-y-6 mb-8">
              {[
                { icon: ShieldCheck, title: 'Verified & Secure Community', color: 'bg-blue-50 text-blue-500' },
                { icon: Star, title: 'Premium Matching Algorithm', color: 'bg-yellow-50 text-yellow-500' },
                { icon: Heart, title: 'Real Connections in uMzimkhulu', color: 'bg-red-50 text-red-500' },
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-4 text-left"
                >
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", item.color)}>
                    <item.icon size={20} />
                  </div>
                  <span className="text-base font-semibold text-slate-700">
                    {item.title}
                  </span>
                </motion.div>
              ))}
            </div>

            <button 
              onClick={onSignIn}
              className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all group text-sm"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              <span className="font-bold text-slate-700">Continue with Google</span>
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const ProfileCard = ({ user, onLike, onPass }: { user: UserType, onLike: () => void | Promise<void>, onPass: () => void, key?: string }) => {
  return (
    <motion.div
      whileHover={{ y: -10 }}
      className="relative group rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 bg-white"
    >
      <div className="aspect-[3/4] overflow-hidden relative">
        <img 
          src={user.image} 
          alt={user.name} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60" />
        
        {user.isPremium && (
          <div className="absolute top-4 left-4 bg-accent/90 backdrop-blur-md text-white p-2 rounded-full shadow-lg animate-pulse">
            <Crown size={16} />
          </div>
        )}

        <div className="absolute bottom-6 left-6 right-6 text-white">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold">{user.name}, {user.age}</h3>
            {user.isVerified && <ShieldCheck className="text-accent" size={18} />}
          </div>
          <p className="text-xs text-slate-300 flex items-center gap-1 mb-3">
            <Search size={12} /> {user.location}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {user.interests.map(interest => (
              <span key={interest} className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-medium">
                {interest}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 flex justify-between items-center bg-inherit">
        <button 
          onClick={onPass}
          className="w-14 h-14 rounded-full flex items-center justify-center border-2 border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all active:scale-90"
        >
          <X size={28} />
        </button>
        <button 
          onClick={onLike}
          className="w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/30 hover:scale-110 transition-all active:scale-90"
        >
          <Heart size={28} className="fill-current" />
        </button>
      </div>
    </motion.div>
  );
};

const Dashboard = () => {
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
          <div className="space-y-6">
            {MOCK_PROFILES.slice(0, 3).map((profile, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="relative">
                  <img 
                    src={profile.image} 
                    alt={profile.name} 
                    className="w-12 h-12 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-inherit rounded-full" />
                </div>
                <div className="flex-1">
                  <h5 className="font-bold text-sm">{profile.name}</h5>
                  <p className="text-xs text-slate-500">Matched 2 hours ago</p>
                </div>
                <button className="p-2 text-primary hover:bg-primary/5 rounded-lg transition-colors">
                  <MessageCircle size={18} />
                </button>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 py-3 rounded-xl border border-primary/20 text-primary font-semibold hover:bg-primary/5 transition-all">
            View All Matches
          </button>
        </div>
      </div>
    </div>
  );
};

const Chat = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'matches'),
      where('users', 'array-contains', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const matchesData = await Promise.all(snap.docs.map(async (matchDoc) => {
        const data = matchDoc.data();
        const otherUserId = data.users.find((id: string) => id !== user.uid);
        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        return {
          id: matchDoc.id,
          otherUser: { id: otherUserId, ...userDoc.data() },
          ...data
        };
      }));
      setMatches(matchesData);
      if (matchesData.length > 0 && !selectedMatch) {
        setSelectedMatch(matchesData[0]);
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!selectedMatch || !user) return;

    const chatId = [user.uid, selectedMatch.otherUser.id].sort().join('_');
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [selectedMatch, user]);

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
      await addDoc(collection(db, 'chats', chatId, 'messages'), msgData);
      setMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `chats/${chatId}/messages`);
    }
  };

  return (
    <div className="pt-20 pb-6 px-4 max-w-6xl mx-auto h-[calc(100vh-20px)] flex gap-6">
      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-72 rounded-3xl border overflow-hidden bg-white border-black/5 shadow-sm">
        <div className="p-5 border-b border-inherit">
          <h3 className="text-lg font-bold mb-3">Messages</h3>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/5">
            <Search size={14} className="text-slate-400" />
            <input type="text" placeholder="Search chats..." className="bg-transparent border-none outline-none text-xs w-full" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {matches.map((match) => (
            <button 
              key={match.id} 
              onClick={() => setSelectedMatch(match)}
              className={cn(
                "w-full p-4 flex items-center gap-4 hover:bg-primary/5 transition-colors border-b border-inherit",
                selectedMatch?.id === match.id && "bg-primary/5 border-l-4 border-l-primary"
              )}
            >
              <img src={match.otherUser.image} alt={match.otherUser.name} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />
              <div className="flex-1 text-left">
                <div className="flex justify-between items-center mb-1">
                  <h5 className="font-bold text-sm">{match.otherUser.name}</h5>
                </div>
                <p className="text-xs text-slate-500 truncate">Click to chat</p>
              </div>
            </button>
          ))}
          {matches.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">
              No matches yet. Keep swiping!
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col rounded-3xl border overflow-hidden bg-white border-black/5 shadow-sm">
        {selectedMatch ? (
          <>
            <div className="p-4 border-b border-inherit flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={selectedMatch.otherUser.image} alt={selectedMatch.otherUser.name} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                <div>
                  <h5 className="font-bold text-sm">{selectedMatch.otherUser.name}</h5>
                  <p className="text-[10px] text-green-500 font-medium">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-black/5 rounded-lg transition-colors"><ShieldCheck size={20} className="text-slate-400" /></button>
                <button className="p-2 hover:bg-black/5 rounded-lg transition-colors"><Settings size={20} className="text-slate-400" /></button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={cn(
                  "flex flex-col max-w-[80%]",
                  msg.senderId === user?.uid ? "ml-auto items-end" : "items-start"
                )}>
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-sm shadow-sm",
                    msg.senderId === user?.uid 
                      ? "bg-gradient-to-r from-primary to-secondary text-white rounded-tr-none" 
                      : "bg-slate-100 text-slate-800 rounded-tl-none"
                  )}>
                    {msg.text}
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

            <form onSubmit={sendMessage} className="p-4 border-t border-inherit flex gap-3">
              <input 
                type="text" 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..." 
                className="flex-1 px-6 py-3 rounded-full outline-none text-sm transition-all bg-slate-100 border-transparent focus:bg-white focus:border-primary/20"
              />
              <button type="submit" className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 transition-all">
                <Zap size={20} className="fill-current" />
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

const SignupModal = ({ isOpen, onClose }: any) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ 
    name: '', 
    age: '', 
    gender: '', 
    lookingFor: '', 
    bio: '',
    height: '',
    education: '',
    zodiac: '',
    hobbies: [] as string[]
  });
  const { user } = useAuth();

  const handleComplete = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: formData.name || user.displayName || 'User',
        age: parseInt(formData.age) || 20,
        gender: formData.gender || 'Not specified',
        lookingFor: formData.lookingFor || 'Everyone',
        location: 'uMzimkhulu Central',
        bio: formData.bio || 'New member!',
        height: formData.height || 'Not specified',
        education: formData.education || 'Not specified',
        zodiac: formData.zodiac || 'Not specified',
        image: user.photoURL || `https://picsum.photos/seed/${user.uid}/400/600`,
        interests: formData.hobbies.length > 0 ? formData.hobbies : ['Music', 'Travel'],
        isVerified: false,
        isPremium: false,
        createdAt: serverTimestamp()
      }, { merge: true });
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  if (!isOpen) return null;

  const totalSteps = 5;

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
        className="max-w-md w-full rounded-[40px] overflow-hidden relative bg-white"
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-black/5 rounded-full transition-colors">
          <X size={20} />
        </button>

        <div className="p-8">
          <div className="flex gap-2 mb-6">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className={cn("h-1 flex-1 rounded-full transition-all", s <= step ? "bg-primary" : "bg-slate-200")} />
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
                <h3 className="text-xl font-bold mb-1">Welcome to Love Link</h3>
                <p className="text-slate-500 text-sm mb-6">Let's start with the basics.</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Full Name</label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Thando Dlamini"
                      className="w-full px-4 py-3 rounded-xl outline-none border border-transparent bg-slate-50 focus:bg-white focus:border-primary transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Age</label>
                    <input 
                      type="number" 
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      placeholder="Must be 18+"
                      className="w-full px-4 py-3 rounded-xl outline-none border border-transparent bg-slate-50 focus:bg-white focus:border-primary transition-all text-sm"
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
                <h3 className="text-xl font-bold mb-1">Your Identity</h3>
                <p className="text-slate-500 text-sm mb-6">Tell us about yourself and who you're seeking.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">I am a</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['Male', 'Female'].map(g => (
                        <button 
                          key={g}
                          onClick={() => setFormData({ ...formData, gender: g })}
                          className={cn(
                            "p-3 rounded-xl border font-bold text-sm transition-all",
                            formData.gender === g ? "border-primary bg-primary/5 text-primary" : "border-slate-200 hover:border-primary"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Looking for</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Men', 'Women', 'Both'].map(l => (
                        <button 
                          key={l}
                          onClick={() => setFormData({ ...formData, lookingFor: l })}
                          className={cn(
                            "py-2 rounded-lg border font-semibold text-xs transition-all",
                            formData.lookingFor === l ? "border-primary bg-primary/5 text-primary" : "border-slate-200 hover:border-primary"
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
                <h3 className="text-xl font-bold mb-1">Physical & Education</h3>
                <p className="text-slate-500 text-sm mb-6">A bit more detail helps with matching.</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Height (cm)</label>
                    <input 
                      type="text" 
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                      placeholder="e.g. 175"
                      className="w-full px-4 py-3 rounded-xl outline-none border border-transparent bg-slate-50 focus:bg-white focus:border-primary transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Education</label>
                    <select 
                      value={formData.education}
                      onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl outline-none border border-transparent bg-slate-50 focus:bg-white focus:border-primary transition-all text-sm"
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
                <h3 className="text-xl font-bold mb-1">Personality</h3>
                <p className="text-slate-500 text-sm mb-6">What makes you, you?</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Zodiac Sign</label>
                    <select 
                      value={formData.zodiac}
                      onChange={(e) => setFormData({ ...formData, zodiac: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl outline-none border border-transparent bg-slate-50 focus:bg-white focus:border-primary transition-all text-sm"
                    >
                      <option value="">Select Sign</option>
                      {['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'].map(z => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Bio</label>
                    <textarea 
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      placeholder="Tell us something interesting..."
                      className="w-full px-4 py-3 rounded-xl outline-none border border-transparent bg-slate-50 focus:bg-white focus:border-primary transition-all text-sm h-24 resize-none"
                    />
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
                <h3 className="text-xl font-bold mb-1">Final Touch</h3>
                <p className="text-slate-500 text-sm mb-6">Add a photo to get 3x more matches.</p>
                <div className="w-full aspect-square rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-black/5 transition-all mb-6">
                  {user?.photoURL ? (
                    <img src={user.photoURL} className="w-full h-full object-cover rounded-2xl" alt="Preview" />
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <UserIcon size={24} />
                      </div>
                      <span className="text-xs font-medium text-slate-500">Upload Profile Photo</span>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button 
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition-all text-sm"
              >
                Back
              </button>
            )}
            <button 
              onClick={() => step < totalSteps ? setStep(step + 1) : handleComplete()}
              className="flex-[2] btn-primary py-3 text-sm"
            >
              {step === totalSteps ? 'Complete Profile' : 'Continue'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState('home');
  const [showMatch, setShowMatch] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [profiles, setProfiles] = useState<UserType[]>(MOCK_PROFILES);
  const { user, profile, loading, signIn } = useAuth();

  useEffect(() => {
    // If user is signed in and on home, redirect to discover
    if (user && activeTab === 'home') {
      setActiveTab('discover');
    }
  }, [user, activeTab]);

  useEffect(() => {
    const q = query(collection(db, 'users'), limit(20));
    const unsubscribe = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserType));
      if (fetched.length > 0) {
        setProfiles(fetched);
      }
    }, (err) => {
      // Gracefully handle permission errors for background listeners
      if (err.code === 'permission-denied') {
        console.warn("Permission denied for listing users. Using mock data.");
        setProfiles(MOCK_PROFILES);
      } else {
        handleFirestoreError(err, OperationType.LIST, 'users');
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && !profile && !loading) {
      setShowSignup(true);
    }
  }, [user, profile, loading]);

  const handleLike = async (targetUser: UserType) => {
    if (!user) {
      signIn();
      return;
    }
    // Randomly show match popup for demo
    if (Math.random() > 0.5) {
      setShowMatch(true);
      setTimeout(() => setShowMatch(false), 3000);
      
      // Save match to Firestore
      try {
        await addDoc(collection(db, 'matches'), {
          users: [user.uid, targetUser.id],
          timestamp: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'matches');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
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
              <Hero onSignIn={signIn} />
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
                  <button className="px-5 py-1.5 rounded-full border border-black/10 hover:bg-black/5 font-medium transition-all text-xs">
                    Filters
                  </button>
                  <button className="btn-gold py-1.5 px-5 text-xs">
                    Boost Profile
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {profiles.map(profile => (
                  <ProfileCard 
                    key={profile.id} 
                    user={profile} 
                    onLike={() => handleLike(profile)} 
                    onPass={() => {}} 
                  />
                ))}
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
              <Chat />
            </motion.div>
          )}

          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Dashboard />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

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
                    <img src={MOCK_PROFILES[0].image} className="w-16 h-16 rounded-full border-4 border-slate-100 object-cover" referrerPolicy="no-referrer" />
                  </div>
                </div>
                
                <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">It's a Match! 🎉</h2>
                <p className="text-slate-500 mb-5 text-xs">You and Thando have liked each other. Start the conversation now!</p>
                
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
