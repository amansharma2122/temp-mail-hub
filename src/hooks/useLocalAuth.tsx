import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { storage, STORAGE_KEYS, generateId } from '@/lib/storage';
import { toast } from 'sonner';

export interface User {
  id: string;
  email: string;
  password: string; // In real app, this would be hashed
  displayName: string;
  role: 'admin' | 'moderator' | 'user';
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithFacebook: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedUser = storage.get<User | null>(STORAGE_KEYS.USER, null);
    if (savedUser) {
      setUser(savedUser);
    }
    setIsLoading(false);
  }, []);

  const isAdmin = user?.role === 'admin';

  const signUp = async (email: string, password: string, name?: string): Promise<{ error: Error | null }> => {
    try {
      const users = storage.get<User[]>(STORAGE_KEYS.USERS_DB, []);
      
      // Check if user exists
      if (users.find(u => u.email === email)) {
        return { error: new Error('Email already registered') };
      }

      const newUser: User = {
        id: generateId(),
        email,
        password, // In production, hash this!
        displayName: name || email.split('@')[0],
        role: users.length === 0 ? 'admin' : 'user', // First user is admin
        createdAt: new Date().toISOString(),
      };

      users.push(newUser);
      storage.set(STORAGE_KEYS.USERS_DB, users);
      
      // Auto login
      const { password: _, ...userWithoutPassword } = newUser;
      storage.set(STORAGE_KEYS.USER, newUser);
      setUser(newUser);

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const users = storage.get<User[]>(STORAGE_KEYS.USERS_DB, []);
      const foundUser = users.find(u => u.email === email && u.password === password);

      if (!foundUser) {
        return { error: new Error('Invalid email or password') };
      }

      storage.set(STORAGE_KEYS.USER, foundUser);
      setUser(foundUser);

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async (): Promise<{ error: Error | null }> => {
    // Simulated Google sign-in for demo
    toast.info('Google sign-in is simulated in this demo. Creating a test account...');
    
    const email = `google_user_${generateId()}@gmail.com`;
    return signUp(email, 'google_oauth', 'Google User');
  };

  const signInWithFacebook = async (): Promise<{ error: Error | null }> => {
    // Simulated Facebook sign-in for demo
    toast.info('Facebook sign-in is simulated in this demo. Creating a test account...');
    
    const email = `fb_user_${generateId()}@facebook.com`;
    return signUp(email, 'facebook_oauth', 'Facebook User');
  };

  const signOut = async () => {
    storage.remove(STORAGE_KEYS.USER);
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    if (!user) return;
    
    const updatedUser = { ...user, ...updates };
    storage.set(STORAGE_KEYS.USER, updatedUser);
    setUser(updatedUser);

    // Update in users database
    const users = storage.get<User[]>(STORAGE_KEYS.USERS_DB, []);
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      users[index] = updatedUser;
      storage.set(STORAGE_KEYS.USERS_DB, users);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithFacebook,
        signOut,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
