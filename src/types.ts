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

export const MOCK_PROFILES: User[] = [
  {
    id: '1',
    name: 'Thando',
    age: 24,
    gender: 'female',
    location: 'uMzimkhulu Central',
    bio: 'Lover of art, music and sunset walks. Looking for someone who values deep conversations.',
    images: ['https://picsum.photos/seed/thando/400/600', 'https://picsum.photos/seed/thando2/400/600'],
    interests: ['Music', 'Art', 'Travel'],
    isVerified: true,
    isPremium: true,
  },
  {
    id: '2',
    name: 'Sipho',
    age: 28,
    gender: 'male',
    location: 'Clydesdale',
    bio: 'Entrepreneur and fitness enthusiast. I believe in building strong foundations.',
    images: ['https://picsum.photos/seed/sipho/400/600', 'https://picsum.photos/seed/sipho2/400/600'],
    interests: ['Fitness', 'Business', 'Cooking'],
    isVerified: true,
    isPremium: false,
  },
  {
    id: '3',
    name: 'Zanele',
    age: 26,
    gender: 'female',
    location: 'Rietvlei',
    bio: 'Nature lover and bookworm. Let\'s explore the beauty of uMzimkhulu together.',
    images: ['https://picsum.photos/seed/zanele/400/600', 'https://picsum.photos/seed/zanele2/400/600'],
    interests: ['Reading', 'Hiking', 'Photography'],
    isVerified: false,
    isPremium: true,
  },
  {
    id: '4',
    name: 'Lungile',
    age: 30,
    gender: 'male',
    location: 'uMzimkhulu',
    bio: 'Professional chef. I can win your heart through your stomach!',
    images: ['https://picsum.photos/seed/lungile/400/600', 'https://picsum.photos/seed/lungile2/400/600'],
    interests: ['Cooking', 'Wine', 'Dancing'],
    isVerified: true,
    isPremium: false,
  }
];
