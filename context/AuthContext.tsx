/* eslint-disable @typescript-eslint/no-wrapper-object-types */
// contexts/AuthContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';

const API_BASE_URL = 'https://sih-backend-eczh.onrender.com/api';
const WS_URL = 'wss://sih-backend-eczh.onrender.com';

interface User {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  wsConnection: WebSocket | null;
  isConnected: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string , profile: { boatLicenseId: string, experience: string, port: string }) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  forgotPassword: (email: string) => Promise<boolean>;
  verifyOtp: (email: string, otp: string) => Promise<boolean>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<boolean>;
  connectWebSocket: (userId: string | null) => void;
  disconnectWebSocket: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      const timestamp = await AsyncStorage.getItem('usertokenTimestamp');
      
      if (storedToken && storedUser && timestamp) {
        const storedTime = parseInt(timestamp, 10);
        const currentTime = Date.now();
        const TOKEN_EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000;
        
        if (currentTime - storedTime > TOKEN_EXPIRY_TIME) {
          console.log('Token expired, clearing storage');
          await clearAuthData();
          return;
        }
        
        const parsedUser: User = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        
        // Pass the ID directly from the parsed object
        connectWebSocket(parsedUser.id);
      }
    } catch (error) {
      console.error('Error checking login status:', error);
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthData = async () => {
    try {
      disconnectWebSocket();
      await AsyncStorage.multiRemove(['token', 'user', 'userId', 'usertokenTimestamp']);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  const connectWebSocket = (userId: string | null) => {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    if (!userId) {
      console.log('No user ID provided for WebSocket connection');
      return;
    }

    try {
      console.log('Connecting to WebSocket:', WS_URL);
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setWsConnection(ws);

        ws.send(JSON.stringify({
          type: 'connect',
          payload: {
            userId: userId,
            isAdmin: user?.isAdmin || false
          }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setWsConnection(null);
      };

      ws.onerror = (error) => {
        console.error('WebSocket connection error:', error.message);
        setIsConnected(false);
        setWsConnection(null);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  };

  const disconnectWebSocket = () => {
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
      setIsConnected(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        await AsyncStorage.setItem('userId', data.user.id);
        await AsyncStorage.setItem('usertokenTimestamp', Date.now().toString());
        
        setToken(data.token);
        setUser(data.user);
        
        // Pass the user ID directly from the API response
        connectWebSocket(data.user.id);
        
        return true;
      } else {
        Alert.alert('Login Failed', data.message || 'Invalid credentials');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
      return false;
    }
  };

  const register = async (name: string, email: string, password: string, profile: { boatLicenseId: string, experience: string, port: string }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, ...profile }),
      });

      const data = await response.json();

      if (data.success) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        await AsyncStorage.setItem('userId', data.user.id);
        await AsyncStorage.setItem('usertokenTimestamp', Date.now().toString());
        setToken(data.token);
        setUser(data.user);
        
        // Connect to WebSocket after successful registration
        connectWebSocket(data.user.id);
        
        Alert.alert('Success', data.message || 'Account created successfully!');
        return true;
      } else {
        Alert.alert('Registration Failed', data.message || 'Failed to create account');
        return false;
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
      return false;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        try {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        } catch (apiError) {
          console.warn('Could not call logout API, but continuing with local logout:', apiError);
        }
      }
      await clearAuthData();
    } catch (error) {
      console.error('Logout error:', error);
      await clearAuthData();
    }
  };

  const forgotPassword = async (email: string) => {
    // Implementation
    return false;
  };

  const verifyOtp = async (email: string, otp: string) => {
    // Implementation
    return false;
  };

  const resetPassword = async (email: string, otp: string, newPassword: string) => {
    // Implementation
    return false;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token,
      wsConnection,
      isConnected,
      login, 
      register, 
      logout, 
      isLoading,
      forgotPassword,
      verifyOtp,
      resetPassword,
      connectWebSocket,
      disconnectWebSocket
    }}>
      {children}
    </AuthContext.Provider>
  );
};