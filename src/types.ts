export interface User {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  location: string;
  bio: string;
  images: string[];
  interests: string[];
  lookingFor?: string;
  role?: 'admin' | 'user';
  isBanned?: boolean;
  isBlocked?: boolean;
  isVerified: boolean;
  isPremium: boolean;
  isOnline?: boolean;
  lastSeen?: any;
  latitude?: number;
  longitude?: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'match' | 'message' | 'like';
  fromUserId: string;
  text: string;
  read: boolean;
  timestamp: any;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: any;
}

