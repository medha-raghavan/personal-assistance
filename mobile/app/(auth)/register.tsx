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

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore((state) => state.login);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await authService.register(email, password, name);
      await login(response.user, response.accessToken, response.refreshToken);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-emerald-500">
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
            <View className="items-center mb-8">
              <View className="w-20 h-20 bg-white/20 rounded-3xl items-center justify-center mb-4">
                <Ionicons name="person-add" size={40} color="white" />
              </View>
              <Text className="text-2xl font-bold text-white mb-1">
                Get Started
              </Text>
              <Text className="text-emerald-100 text-base">
                Create your account
              </Text>
            </View>

            {/* Register Card */}
            <View className="bg-white rounded-3xl p-6 shadow-xl">
              <Text className="text-xl font-bold text-gray-900 text-center mb-6">
                Create Account
              </Text>

              {error ? (
                <View className="bg-red-50 border border-red-200 p-4 rounded-xl mb-4 flex-row items-center">
                  <Ionicons name="alert-circle" size={20} color="#ef4444" />
                  <Text className="text-red-600 ml-2 flex-1">{error}</Text>
                </View>
              ) : null}

              <View className="space-y-4">
                {/* Name Input */}
                <View>
                  <Text className="text-sm font-semibold text-gray-700 mb-2">
                    Full Name
                  </Text>
                  <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4">
                    <Ionicons name="person-outline" size={20} color="#9ca3af" />
                    <TextInput
                      className="flex-1 py-4 px-3 text-gray-900"
                      placeholder="John Doe"
                      placeholderTextColor="#9ca3af"
                      value={name}
                      onChangeText={setName}
                      autoComplete="name"
                    />
                  </View>
                </View>

                {/* Email Input */}
                <View className="mt-4">
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
                      placeholder="Min. 6 characters"
                      placeholderTextColor="#9ca3af"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="password-new"
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

                {/* Register Button */}
                <TouchableOpacity
                  className={`py-4 rounded-xl items-center mt-6 ${
                    isLoading ? 'bg-emerald-400' : 'bg-emerald-500'
                  }`}
                  onPress={handleRegister}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <View className="flex-row items-center">
                      <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                      <Text className="text-white font-bold text-lg ml-2">
                        Create Account
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

              {/* Login Link */}
              <View className="flex-row justify-center">
                <Text className="text-gray-600">Already have an account? </Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity>
                    <Text className="text-emerald-600 font-bold">Sign In</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>

            {/* Footer */}
            <View className="items-center mt-6">
              <Text className="text-emerald-100 text-sm">
                Self-hosted • Secure • Private
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
