import React from "react";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import CapitalManagementTable from "../components/CapitalManagementTable";

function CapitalManagement() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <PageHeader title="Capital Management" />
        <main className="p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Capital Management</h1>
            <p className="text-gray-600">Track your business capital, stock value, and financial performance</p>
          </div>
          
          <CapitalManagementTable />
        </main>
      </div>
    </div>
  );
}

export default CapitalManagement;