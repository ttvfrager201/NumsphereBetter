import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, Settings, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../supabase/auth";

export default function LandingPage() {
  const { user, signOut } = useAuth();

  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Apple-style navigation */}
      <header className="fixed top-0 z-50 w-full bg-[rgba(255,255,255,0.8)] backdrop-blur-md border-b border-[#f5f5f7]/30">
        <div className="max-w-[980px] mx-auto flex h-12 items-center justify-between px-4">
          <div className="flex items-center">
            <Link to="/" className="font-medium text-xl">
              NumSphere
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/dashboard">
                  <Button
                    variant="ghost"
                    className="text-sm font-light hover:text-gray-500"
                  >
                    Dashboard
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Avatar className="h-8 w-8 hover:cursor-pointer">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`}
                        alt={user.email || ""}
                      />
                      <AvatarFallback>
                        {user.email?.[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="rounded-xl border-none shadow-lg"
                  >
                    <DropdownMenuLabel className="text-xs text-gray-500">
                      {user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => signOut()}
                    >
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <>
                <Link to="/login">
                  <Button
                    variant="ghost"
                    className="text-sm font-light hover:text-gray-500"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button className="rounded-full bg-black text-white hover:bg-gray-800 text-sm px-4">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="pt-12">
        {/* Hero section */}
        <section className="py-24 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/50" />
          <div className="relative max-w-4xl mx-auto px-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl mb-8 shadow-2xl">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent">
              Business VoIP
              <br />
              <span className="text-5xl md:text-6xl">Made Simple</span>
            </h1>
            <p className="text-xl md:text-2xl font-medium text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Get your virtual phone number and start making professional calls
              in minutes.
              <span className="text-blue-600 font-semibold">
                No setup fees, no contracts.
              </span>
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6 mb-12">
              <Link to="/signup">
                <Button className="h-14 px-8 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 text-lg font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105">
                  Start Free Trial
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link
                to="/"
                className="flex items-center text-lg font-semibold text-gray-700 hover:text-blue-600 transition-colors group"
              >
                View Plans
                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center items-center space-x-8 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>99.9% Uptime</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4 text-yellow-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>5-Star Rated</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg
                  className="w-4 h-4 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span>Enterprise Security</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features section */}
        <section className="py-24 bg-gradient-to-br from-gray-50 to-blue-50/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent">
                Professional VoIP Features
              </h2>
              <p className="text-xl md:text-2xl font-medium text-gray-600 mb-8 max-w-3xl mx-auto">
                Everything your business needs for seamless communication
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-8">
                <Link
                  to="/"
                  className="flex items-center text-lg font-semibold text-blue-600 hover:text-blue-700 transition-colors group"
                >
                  View all features
                  <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/"
                  className="flex items-center text-lg font-semibold text-purple-600 hover:text-purple-700 transition-colors group"
                >
                  Compare plans
                  <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="group bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
                <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <svg
                    className="h-8 w-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </div>
                <h4 className="text-2xl font-bold mb-4 text-gray-900">
                  Virtual Phone Numbers
                </h4>
                <p className="text-gray-600 leading-relaxed">
                  Get instant access to professional phone numbers with
                  automatic provisioning and management. Choose from local,
                  toll-free, or international numbers.
                </p>
                <div className="mt-6 flex items-center text-blue-600 font-semibold group-hover:text-blue-700 transition-colors">
                  <span>Learn more</span>
                  <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div className="group bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
                <div className="h-16 w-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <svg
                    className="h-8 w-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h4 className="text-2xl font-bold mb-4 text-gray-900">
                  Usage Analytics
                </h4>
                <p className="text-gray-600 leading-relaxed">
                  Track your call minutes, monitor usage patterns, and optimize
                  your communication costs with detailed analytics and
                  reporting.
                </p>
                <div className="mt-6 flex items-center text-purple-600 font-semibold group-hover:text-purple-700 transition-colors">
                  <span>Learn more</span>
                  <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div className="group bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
                <div className="h-16 w-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <svg
                    className="h-8 w-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 100-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
                    />
                  </svg>
                </div>
                <h4 className="text-2xl font-bold mb-4 text-gray-900">
                  Custom Call Flows
                </h4>
                <p className="text-gray-600 leading-relaxed">
                  Design personalized call routing with our intuitive
                  drag-and-drop flow editor. Create complex workflows without
                  any coding.
                </p>
                <div className="mt-6 flex items-center text-green-600 font-semibold group-hover:text-green-700 transition-colors">
                  <span>Learn more</span>
                  <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* My Plans section */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent">
                Choose Your Plan
              </h2>
              <p className="text-xl md:text-2xl font-medium text-gray-600 mb-8 max-w-3xl mx-auto">
                Select the perfect VoIP solution for your business needs
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Starter Plan */}
              <div className="group bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 border-gray-100 hover:border-blue-200">
                <div className="text-center">
                  <div className="h-16 w-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                    <svg
                      className="h-8 w-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">
                    Starter
                  </h3>
                  <div className="text-4xl font-bold text-green-600 mb-1">
                    $9
                  </div>
                  <div className="text-gray-500 mb-6">per month</div>
                  <ul className="text-left space-y-3 mb-8">
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      1 Virtual Phone Number
                    </li>
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      500 Minutes/Month
                    </li>
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Basic Call Flows
                    </li>
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Email Support
                    </li>
                  </ul>
                  <Link to="/signup">
                    <Button className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold">
                      Get Started
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Business Plan */}
              <div className="group bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 border-blue-200 relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
                <div className="text-center">
                  <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                    <svg
                      className="h-8 w-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">
                    Business
                  </h3>
                  <div className="text-4xl font-bold text-blue-600 mb-1">
                    $29
                  </div>
                  <div className="text-gray-500 mb-6">per month</div>
                  <ul className="text-left space-y-3 mb-8">
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      5 Virtual Phone Numbers
                    </li>
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      2,000 Minutes/Month
                    </li>
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Advanced Call Flows
                    </li>
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Priority Support
                    </li>
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Analytics Dashboard
                    </li>
                  </ul>
                  <Link to="/signup">
                    <Button className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                      Get Started
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Enterprise Plan */}
              <div className="group bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-2 border-gray-100 hover:border-purple-200">
                <div className="text-center">
                  <div className="h-16 w-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                    <svg
                      className="h-8 w-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-gray-900">
                    Enterprise
                  </h3>
                  <div className="text-4xl font-bold text-purple-600 mb-1">
                    $99
                  </div>
                  <div className="text-gray-500 mb-6">per month</div>
                  <ul className="text-left space-y-3 mb-8">
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Unlimited Phone Numbers
                    </li>
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Unlimited Minutes
                    </li>
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Custom Call Flows
                    </li>
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      24/7 Phone Support
                    </li>
                    <li className="flex items-center text-gray-600">
                      <svg
                        className="h-5 w-5 text-green-500 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Advanced Analytics
                    </li>
                  </ul>
                  <Link to="/signup">
                    <Button className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold">
                      Contact Sales
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials section */}
        <section className="py-24 bg-gradient-to-br from-gray-50 to-blue-50/30">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent">
                What Our Customers Say
              </h2>
              <p className="text-xl md:text-2xl font-medium text-gray-600 mb-8 max-w-3xl mx-auto">
                Join thousands of businesses that trust NumSphere for their
                communication needs
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className="w-5 h-5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  &quot;NumSphere transformed our customer service. The call
                  flow designer is incredibly intuitive, and we've reduced wait
                  times by 60%. Our customers love the professional
                  experience.&quot;
                </p>
                <div className="flex items-center">
                  <img
                    className="w-12 h-12 rounded-full mr-4"
                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
                    alt="Sarah Johnson"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">
                      Sarah Johnson
                    </div>
                    <div className="text-gray-500 text-sm">
                      CEO, TechStart Inc.
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className="w-5 h-5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  &quot;The setup was incredibly easy. Within 10 minutes, we had
                  our virtual number running with custom call flows. The
                  analytics help us optimize our sales process daily.&quot;
                </p>
                <div className="flex items-center">
                  <img
                    className="w-12 h-12 rounded-full mr-4"
                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=Michael"
                    alt="Michael Chen"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">
                      Michael Chen
                    </div>
                    <div className="text-gray-500 text-sm">
                      Sales Director, GrowthCorp
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100">
                <div className="flex items-center mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className="w-5 h-5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  &quot;NumSphere's reliability is outstanding. 99.9% uptime
                  means our business never stops. The cost savings compared to
                  traditional phone systems are remarkable.&quot;
                </p>
                <div className="flex items-center">
                  <img
                    className="w-12 h-12 rounded-full mr-4"
                    src="https://api.dicebear.com/7.x/avataaars/svg?seed=Emily"
                    alt="Emily Rodriguez"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">
                      Emily Rodriguez
                    </div>
                    <div className="text-gray-500 text-sm">
                      Operations Manager, ServicePro
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#f5f5f7] py-12 text-xs text-gray-500">
        <div className="max-w-[980px] mx-auto px-4">
          <div className="border-b border-gray-300 pb-8 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-medium text-sm text-gray-900 mb-4">
                NumSphere
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="hover:underline">
                    Features
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Call Flows
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Support
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-900 mb-4">
                Resources
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="hover:underline">
                    Getting Started
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    User Guide
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Call Flow Tutorial
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Help Center
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-900 mb-4">
                Business
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="hover:underline">
                    Enterprise
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Partners
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Resellers
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Contact Sales
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-sm text-gray-900 mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/" className="hover:underline">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:underline">
                    Licenses
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="py-4">
            <p>Copyright © 2025 NumSphere. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
