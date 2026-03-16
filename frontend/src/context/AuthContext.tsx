import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.REACT_APP_BACKEND_URL || 'https://diobestia.onrender.com';

interface User {
  id: string;
  email: string;
  nome: string;
  cognome: string;
  telefono?: string;
  soprannome?: string;
  role: string;
  push_token?: string;
  profile_image?: string;
  must_reset_password?: boolean;
  archived?: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  nome: string;
  cognome: string;
  telefono?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  mustResetPassword: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isIstruttore: boolean;
  refreshUser: () => Promise<void>;
  clearMustResetPassword: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustResetPassword, setMustResetPassword] = useState(false);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setMustResetPassword(parsedUser.must_reset_password || false);
        
        try {
          const resp = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          if (resp.ok) {
            const data = await resp.json();
            setUser(data);
            setMustResetPassword(data.must_reset_password || false);
          } else {
            await AsyncStorage.multiRemove(['token', 'user']);
            setToken(null);
            setUser(null);
            setMustResetPassword(false);
          }
        } catch (error) {
          await AsyncStorage.multiRemove(['token', 'user']);
          setToken(null);
          setUser(null);
          setMustResetPassword(false);
        }
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const resp = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.detail || 'Errore durante il login');
    }
    const { token: newToken, user: userData } = data;
    await AsyncStorage.setItem('token', newToken);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    setMustResetPassword(userData.must_reset_password || false);
  };

  const register = async (regData: RegisterData) => {
    const resp = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regData),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.detail || 'Errore durante la registrazione');
    }
    const { token: newToken, user: userData } = data;
    await AsyncStorage.setItem('token', newToken);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    setMustResetPassword(false);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    setToken(null);
    setUser(null);
    setMustResetPassword(false);
  };

  const refreshUser = async () => {
    try {
      if (token) {
        const resp = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.ok) {
          const userData = await resp.json();
          setUser(userData);
          setMustResetPassword(userData.must_reset_password || false);
          await AsyncStorage.setItem('user', JSON.stringify(userData));
        }
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const clearMustResetPassword = () => {
    setMustResetPassword(false);
    if (user) {
      const updatedUser = { ...user, must_reset_password: false };
      setUser(updatedUser);
      AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const isAdmin = user?.role === 'admin';
  const isIstruttore = user?.role === 'istruttore';

  return (
    <AuthContext.Provider value={{ user, token, loading, mustResetPassword, login, register, logout, isAdmin, isIstruttore, refreshUser, clearMustResetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};
