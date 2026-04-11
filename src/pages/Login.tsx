import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Wallet, TrendingUp, PieChart, Shield, ArrowRight } from 'lucide-react';
import { Input, Button } from '../components/common';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/authStore';

export function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  
  const loginMutation = useMutation({
    mutationFn: (data: typeof formData) => authService.login(data.email, data.password),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate('/');
    },
    onError: (error: Error) => {
      setError(error.message || 'Login failed');
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate(formData);
  };

  const features = [
    { icon: TrendingUp, title: 'Track Spending', desc: 'Monitor your expenses across all accounts' },
    { icon: PieChart, title: 'Smart Categories', desc: 'Auto-categorize transactions with AI' },
    { icon: Shield, title: 'Tax Optimized', desc: 'Compare tax regimes and save money' },
  ];
  
  return (
    <div className="min-h-screen bg-gray-900 flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl" />
        </div>
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Finance Tracker</span>
          </div>
          <p className="text-white/80 text-lg max-w-md">
            Your personal financial command center. Track expenses, manage budgets, and optimize taxes all in one place.
          </p>
        </div>
        
        <div className="relative space-y-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="flex items-start gap-4 p-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20"
            >
              <div className="p-2 bg-white/20 rounded-lg">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">{feature.title}</h3>
                <p className="text-white/70 text-sm">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="relative text-white/60 text-sm">
          Self-hosted • Privacy-first • Open Source
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
              <h1 className="text-xl sm:text-2xl font-bold text-white">Welcome back</h1>
              <p className="text-sm sm:text-base text-gray-400 mt-2">Sign in to your account to continue</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              
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
                placeholder="Enter your password"
                required
              />
              
              <Button
                type="submit"
                className="w-full"
                isLoading={loginMutation.isPending}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In
              </Button>
            </form>
            
            <p className="text-center text-gray-400 mt-6">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
                Create one
              </Link>
            </p>
          </div>
          
          <p className="text-center text-gray-500 text-sm mt-6">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
