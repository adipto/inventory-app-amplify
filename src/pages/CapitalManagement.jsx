import React from "react";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";

function CapitalManagement() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <PageHeader title="Capital Management" />
        <main className="p-6 max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-800 mb-4">Capital Management</h1>
          <p className="text-gray-600 mb-8">This is the Capital Management page. Add your content here.</p>
          {/* Add your capital management content/components here */}
        </main>
      </div>
    </div>
  );
}

export default CapitalManagement;