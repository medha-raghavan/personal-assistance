import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((state) => state.login);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await authService.login(email, password);
      await login(response.user, response.accessToken, response.refreshToken);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-sky-500">
      <StatusBar barStyle="light-content" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center px-6 py-12">
            {/* Logo and Header */}
            <View className="items-center mb-10">
              <View className="w-24 h-24 bg-white/20 rounded-3xl items-center justify-center mb-6">
                <Ionicons name="wallet" size={48} color="white" />
              </View>
              <Text className="text-3xl font-bold text-white mb-2">
                Finance Tracker
              </Text>
              <Text className="text-sky-100 text-base">
                Track your money, grow your wealth
              </Text>
            </View>

            {/* Login Card */}
            <View className="bg-white rounded-3xl p-6 shadow-xl">
              <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
                Welcome Back
              </Text>
              <Text className="text-gray-500 text-center mb-6">
                Sign in to continue
              </Text>

              {error ? (
                <View className="bg-red-50 border border-red-200 p-4 rounded-xl mb-4 flex-row items-center">
                  <Ionicons name="alert-circle" size={20} color="#ef4444" />
                  <Text className="text-red-600 ml-2 flex-1">{error}</Text>
                </View>
              ) : null}

              <View className="space-y-4">
                {/* Email Input */}
                <View>
                  <Text className="text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </Text>
                  <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4">
                    <Ionicons name="mail-outline" size={20} color="#9ca3af" />
                    <TextInput
                      className="flex-1 py-4 px-3 text-gray-900"
                      placeholder="you@example.com"
                      placeholderTextColor="#9ca3af"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View className="mt-4">
                  <Text className="text-sm font-semibold text-gray-700 mb-2">
                    Password
                  </Text>
                  <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4">
                    <Ionicons name="lock-closed-outline" size={20} color="#9ca3af" />
                    <TextInput
                      className="flex-1 py-4 px-3 text-gray-900"
                      placeholder="Enter your password"
                      placeholderTextColor="#9ca3af"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="password"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons 
                        name={showPassword ? "eye-off-outline" : "eye-outline"} 
                        size={20} 
                        color="#9ca3af" 
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Login Button */}
                <TouchableOpacity
                  className={`py-4 rounded-xl items-center mt-6 ${
                    isLoading ? 'bg-sky-400' : 'bg-sky-500'
                  }`}
                  onPress={handleLogin}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <View className="flex-row items-center">
                      <Ionicons name="log-in-outline" size={20} color="white" />
                      <Text className="text-white font-bold text-lg ml-2">
                        Sign In
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Divider */}
              <View className="flex-row items-center my-6">
                <View className="flex-1 h-px bg-gray-200" />
                <Text className="text-gray-400 px-4 text-sm">or</Text>
                <View className="flex-1 h-px bg-gray-200" />
              </View>

              {/* Register Link */}
              <View className="flex-row justify-center">
                <Text className="text-gray-600">Don't have an account? </Text>
                <Link href="/(auth)/register" asChild>
                  <TouchableOpacity>
                    <Text className="text-sky-600 font-bold">Sign Up</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>

            {/* Footer */}
            <View className="items-center mt-8">
              <Text className="text-sky-100 text-sm">
                Self-hosted • Secure • Private
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
