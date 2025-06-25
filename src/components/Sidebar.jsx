// src/components/Sidebar.jsx
import React, { useState, useEffect } from "react";
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Menu,
  Package,
  Users,
  ChevronLeft,
  ChevronRight,
  BarChart,
  Settings,
  HelpCircle
} from "lucide-react";

function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  // Auto-collapse sidebar on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
    };

    handleResize(); // Check on initial load
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Navigation items with icons
  const navItems = [
    { path: "/", name: "Dashboard", icon: <Home size={20} /> },
    { path: "/stock", name: "Stock Management", icon: <Package size={20} /> },
    { path: "/customers", name: "Customers", icon: <Users size={20} /> },
    { path: "/reports", name: "Reports", icon: <BarChart size={20} /> },
    // Add more navigation items as needed
  ];

  // Support/help links
  const bottomNavItems = [
    { path: "/settings", name: "Settings", icon: <Settings size={20} /> },
    { path: "/help", name: "Help & Support", icon: <HelpCircle size={20} /> },
  ];

  return (
    <div
      className={`
        bg-gray-900 text-white flex flex-col justify-between h-screen transition-all duration-300
        ${isCollapsed ? "w-16" : "w-64"} 
        sticky top-0 left-0
      `}
    >
      {/* Logo & Collapse Button */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!isCollapsed && (
          <div className="font-bold text-xl">InvManager</div>
        )}
        <button
          onClick={toggleSidebar}
          className={`
            p-2 rounded-lg hover:bg-gray-700 transition-colors
            ${isCollapsed ? "mx-auto" : ""}
          `}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`
                    flex items-center p-3 rounded-lg transition-colors
                    ${isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"}
                    ${isCollapsed ? "justify-center" : ""}
                  `}
                  title={isCollapsed ? item.name : ""}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!isCollapsed && (
                    <span className="ml-3">{item.name}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Links (Settings, Help, etc) */}
      <div className="border-t border-gray-700 py-4">
        <ul className="space-y-1 px-2">
          {bottomNavItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`
                  flex items-center p-3 rounded-lg transition-colors
                  text-gray-400 hover:bg-gray-800 hover:text-white
                  ${isCollapsed ? "justify-center" : ""}
                `}
                title={isCollapsed ? item.name : ""}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!isCollapsed && (
                  <span className="ml-3">{item.name}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Sidebar;