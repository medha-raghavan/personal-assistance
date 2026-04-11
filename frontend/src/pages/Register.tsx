import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Wallet, TrendingUp, PieChart, Shield, ArrowRight, Check } from 'lucide-react';
import { Input, Button } from '../components/common';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/authStore';

export function Register() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  
  const registerMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      authService.register(data.name, data.email, data.password),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate('/');
    },
    onError: (error: Error) => {
      setError(error.message || 'Registration failed');
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    registerMutation.mutate(formData);
  };

  const benefits = [
    'Track unlimited accounts and transactions',
    'Import bank statements automatically',
    'Smart expense categorization',
    'Tax regime comparison and optimization',
    'Trip expense splitting with friends',
    'Self-hosted for complete privacy',
  ];
  
  return (
    <div className="min-h-screen bg-gray-900 flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-600 via-primary-700 to-blue-800 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-40 right-20 w-80 h-80 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-40 left-10 w-72 h-72 bg-blue-300 rounded-full blur-3xl" />
        </div>
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Finance Tracker</span>
          </div>
          <h2 className="text-3xl font-bold text-white mt-8 mb-4">
            Start your journey to financial freedom
          </h2>
          <p className="text-white/80 text-lg">
            Join thousands of users who have taken control of their finances.
          </p>
        </div>
        
        <div className="relative space-y-4">
          <h3 className="text-white font-semibold text-lg mb-4">What you'll get:</h3>
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="p-1 bg-green-500/20 rounded-full">
                <Check className="w-4 h-4 text-green-400" />
              </div>
              <span className="text-white/90">{benefit}</span>
            </div>
          ))}
        </div>
        
        <div className="relative text-white/60 text-sm">
          100% Free • No credit card required • Self-hosted
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-6 sm:mb-8 justify-center">
            <div className="p-2 sm:p-3 bg-primary-600 rounded-xl">
              <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <span className="text-xl sm:text-2xl font-bold text-white">Finance Tracker</span>
          </div>
          
          <div className="bg-gray-800 rounded-2xl p-5 sm:p-8 shadow-xl border border-gray-700">
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-2xl font-bold text-white">Create your account</h1>
              <p className="text-sm sm:text-base text-gray-400 mt-2">Get started in less than a minute</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              
              <Input
                label="Full Name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
              />
              
              <Input
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com"
                required
              />
              
              <Input
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Create a strong password"
                required
              />
              
              <Input
                label="Confirm Password"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Confirm your password"
                required
              />
              
              <Button
                type="submit"
                className="w-full"
                isLoading={registerMutation.isPending}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Create Account
              </Button>
            </form>
            
            <p className="text-center text-gray-400 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">
                Sign in
              </Link>
            </p>
          </div>
          
          <p className="text-center text-gray-500 text-sm mt-6">
            By creating an account, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
