export interface User {
  id: string;
  name: string;
  age: number;
  location: string;
  bio: string;
  image: string;
  interests: string[];
  isVerified: boolean;
  isPremium: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
}

export const MOCK_PROFILES: User[] = [
  {
    id: '1',
    name: 'Thando',
    age: 24,
    location: 'uMzimkhulu Central',
    bio: 'Lover of art, music and sunset walks. Looking for someone who values deep conversations.',
    image: 'https://picsum.photos/seed/thando/400/600',
    interests: ['Music', 'Art', 'Travel'],
    isVerified: true,
    isPremium: true,
  },
  {
    id: '2',
    name: 'Sipho',
    age: 28,
    location: 'Clydesdale',
    bio: 'Entrepreneur and fitness enthusiast. I believe in building strong foundations.',
    image: 'https://picsum.photos/seed/sipho/400/600',
    interests: ['Fitness', 'Business', 'Cooking'],
    isVerified: true,
    isPremium: false,
  },
  {
    id: '3',
    name: 'Zanele',
    age: 26,
    location: 'Rietvlei',
    bio: 'Nature lover and bookworm. Let\'s explore the beauty of uMzimkhulu together.',
    image: 'https://picsum.photos/seed/zanele/400/600',
    interests: ['Reading', 'Hiking', 'Photography'],
    isVerified: false,
    isPremium: true,
  },
  {
    id: '4',
    name: 'Lungile',
    age: 30,
    location: 'uMzimkhulu',
    bio: 'Professional chef. I can win your heart through your stomach!',
    image: 'https://picsum.photos/seed/lungile/400/600',
    interests: ['Cooking', 'Wine', 'Dancing'],
    isVerified: true,
    isPremium: false,
  }
];
