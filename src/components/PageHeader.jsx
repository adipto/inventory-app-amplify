// src/components/PageHeader.jsx
import React, { useEffect, useState } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { signInWithRedirect, signOut, fetchAuthSession } from "aws-amplify/auth";
import { ShoppingBag, Package, LogOut, User, List } from "lucide-react";

function PageHeader({ title, onAllClick, onRetailClick, onWholesaleClick, activeFilter, onFilterChange }) {
    const { user } = useAuthenticator((context) => [context.user]);
    const [userEmail, setUserEmail] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch user's email from the ID token
    useEffect(() => {
        const loadUserEmail = async () => {
            if (!user) {
                setUserEmail(null);
                return;
            }

            try {
                const session = await fetchAuthSession();
                const email = session.tokens?.idToken?.payload?.email;
                setUserEmail(email || null);
            } catch (err) {
                console.error("Failed to fetch session:", err);
                setUserEmail(null);
            }
        };

        loadUserEmail();
    }, [user]);

    // Handle login with Hosted UI
    const handleLogin = async () => {
        setIsLoading(true);
        try {
            await signInWithRedirect({ provider: "Cognito" });
        } catch (err) {
            console.error("Sign-in error:", err);
            setIsLoading(false);
        }
    };

    // Handle logout and clear state
    const handleLogout = async () => {
        setIsLoading(true);
        try {
            await signOut({ global: true });
            setUserEmail(null);
        } catch (err) {
            console.error("Sign-out error:", err);
            setIsLoading(false);
        }
    };

    const getButtonClass = (isActive) =>
        `px-4 py-2 text-sm font-medium rounded-md transition ${isActive
            ? "bg-white text-blue-600 shadow-sm"
            : "text-gray-700 hover:bg-white hover:shadow-sm"
        }`;

    // Enhanced filter handlers that support both legacy and new callback patterns
    const handleAllClick = () => {
        if (onFilterChange) {
            onFilterChange("all");
        } else if (onAllClick) {
            onAllClick();
        }
    };

    const handleRetailClick = () => {
        if (onFilterChange) {
            onFilterChange("retail");
        } else if (onRetailClick) {
            onRetailClick();
        }
    };

    const handleWholesaleClick = () => {
        if (onFilterChange) {
            onFilterChange("wholesale");
        } else if (onWholesaleClick) {
            onWholesaleClick();
        }
    };

    // Determine if this page needs filter tabs
    const needsFilters = onAllClick || onRetailClick || onWholesaleClick || onFilterChange || activeFilter;

    // Determine active state based on activeFilter prop or title matching
    const isAllActive = activeFilter ? activeFilter === "all" : title === "All Transactions" || title === "All Stock";
    const isRetailActive = activeFilter ? activeFilter === "retail" : title === "Retail Transactions" || title === "Retail Stock";
    const isWholesaleActive = activeFilter ? activeFilter === "wholesale" : title === "Wholesale Transactions" || title === "Wholesale Stock";

    return (
        <header className="bg-white border-b px-6 py-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800">{title}</h1>

                <div className="flex items-center space-x-6">
                    {/* Tabs - Only show if page needs filters */}
                    {needsFilters && (
                        <div className="hidden md:flex bg-gray-100 p-1 rounded-lg">
                            <button
                                onClick={handleAllClick}
                                className={getButtonClass(isAllActive)}
                            >
                                <List size={16} className="inline mr-1" />
                                All
                            </button>
                            <button
                                onClick={handleRetailClick}
                                className={getButtonClass(isRetailActive)}
                            >
                                <ShoppingBag size={16} className="inline mr-1" />
                                Retail
                            </button>
                            <button
                                onClick={handleWholesaleClick}
                                className={getButtonClass(isWholesaleActive)}
                            >
                                <Package size={16} className="inline mr-1" />
                                Wholesale
                            </button>
                        </div>
                    )}

                    {/* Auth Section */}
                    {user ? (
                        <div className="flex items-center space-x-3">
                            {/* User Avatar and Info */}
                            <div className="hidden md:flex items-center space-x-3 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 rounded-xl border border-blue-200 shadow-sm">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                                    <User size={16} className="text-white" />
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-semibold text-gray-800 truncate max-w-32">
                                        {userEmail || user.username || "User"}
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                        <span className="text-xs font-medium text-green-600">Active</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Logout Button */}
                            <button
                                onClick={handleLogout}
                                disabled={isLoading}
                                className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl border border-gray-200 hover:border-red-200 transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md"
                                title="Sign out"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleLogin}
                            disabled={isLoading}
                            className="flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 shadow-md hover:shadow-lg transform hover:scale-105"
                        >
                            <User size={16} className="mr-2" />
                            {isLoading ? "Signing In..." : "Sign In"}
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

export default PageHeader;
