// src/components/PageHeader.jsx
import React, { useEffect, useState } from "react";
import { useAuthenticator } from "@aws-amplify/ui-react";
import { signInWithRedirect, signOut, fetchAuthSession } from "aws-amplify/auth";
import { ShoppingBag, Package, LogOut, User, List } from "lucide-react";

function PageHeader({ title, onAllClick, onRetailClick, onWholesaleClick }) {
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

    return (
        <header className="bg-white border-b px-6 py-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800">{title}</h1>

                <div className="flex items-center space-x-6">
                    {/* Tabs */}
                    <div className="hidden md:flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={onAllClick}
                            className={getButtonClass(title === "All Transactions")}
                        >
                            <List size={16} className="inline mr-1" />
                            All
                        </button>
                        <button
                            onClick={onRetailClick}
                            className={getButtonClass(title === "Retail Transactions")}
                        >
                            <ShoppingBag size={16} className="inline mr-1" />
                            Retail
                        </button>
                        <button
                            onClick={onWholesaleClick}
                            className={getButtonClass(title === "Wholesale Transactions")}
                        >
                            <Package size={16} className="inline mr-1" />
                            Wholesale
                        </button>
                    </div>

                    {/* Auth Section */}
                    {user ? (
                        <div className="flex items-center space-x-2">
                            <div className="hidden md:block text-right">
                                <div className="text-sm font-medium text-gray-900">
                                    {userEmail || user.username || "User"}
                                </div>
                                <div className="text-xs text-gray-500">Authenticated</div>
                            </div>
                            <button
                                onClick={handleLogout}
                                disabled={isLoading}
                                className="ml-2 p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-full disabled:opacity-50"
                                title="Sign out"
                            >
                                <LogOut size={18} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleLogin}
                            disabled={isLoading}
                            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            <User size={16} className="mr-1" />
                            {isLoading ? "Signing In..." : "Sign In"}
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

export default PageHeader;
