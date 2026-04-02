export interface AdminRights {
  canManageUsers: boolean;
  canDeleteUsers: boolean;
  canModerateProfiles: boolean;
  canMonitorInteractions: boolean;
  canHandleReports: boolean;
  canManageVerification: boolean;
  canControlPayments: boolean;
  canManageNotifications: boolean;
  canManageContent: boolean;
  canViewAnalytics: boolean;
  canControlLocationPreferences: boolean;
  canManageSecurity: boolean;
  canManageSupport: boolean;
  canEditSettings: boolean;
  canManageAdmins: boolean;
}

export interface User {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  location: string;
  education?: string;
  bio: string;
  images: string[];
  interests: string[];
  hobbies: string[]; // Added hobbies to match App.tsx usage
  lookingFor?: string;
  zodiac?: string; // Keeping it optional in case some data exists, but will remove from form
  height: number;
  smoking: 'never' | 'occasionally' | 'socially' | 'regularly';
  drinking: 'never' | 'occasionally' | 'socially' | 'regularly';
  relationshipGoal: 'dating' | 'friendship' | 'long-term' | 'marriage';
  role?: 'admin' | 'user';
  email?: string;
  adminRights?: AdminRights;
  isBanned?: boolean;
  isBlocked?: boolean;
  isVerified: boolean;
  isPremium: boolean;
  isOnline?: boolean;
  lastSeen?: any;
  latitude?: number;
  longitude?: number;
  preferredAgeMin?: number;
  preferredAgeMax?: number;
  preferredDistance?: number;
  preferredEducation?: string[];
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

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  message: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  createdAt: any;
  updatedAt: any;
}

export interface AppSettings {
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  premiumOnly: boolean;
  broadcastMessage: string;
  termsOfService: string;
  privacyPolicy: string;
  globalDistanceLimit: number;
  ageRangeBuffer: number;
  subscriptionPrice: number;
}

