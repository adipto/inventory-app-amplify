// src/components/HomePage.jsx
import React, { useState } from "react";
import Sidebar from "./Sidebar";
import PageHeader from "./PageHeader";
import TransactionTable from "./TransactionTable";
// import TransactionActions from "./TransactionActions";

function HomePage() {
  const [transactionType, setTransactionType] = useState("all"); // "all", "retail", or "wholesale"

  const handleRetailClick = () => {
    setTransactionType("retail");
  };

  const handleWholesaleClick = () => {
    setTransactionType("wholesale");
  };

  // Handle showing all transactions
  const handleAllTransactionsClick = () => {
    setTransactionType("all");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <PageHeader
          title="Transaction History"
          onAllClick={handleAllTransactionsClick}
          onRetailClick={handleRetailClick}
          onWholesaleClick={handleWholesaleClick}
        />

        {/* Main Content */}
        <main className="p-6 max-w-7xl mx-auto">
          {/* Transaction Table */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800">
              {transactionType === "retail"
                ? "Retail Transactions"
                : transactionType === "wholesale"
                  ? "Wholesale Transactions"
                  : "All Transactions"}
            </h2>
            <TransactionTable initialTransactionType={transactionType} />
          </div>



          {/* Admin Actions */}
          {/* <TransactionActions /> */}
        </main>
      </div>
    </div>
  );
}

export default HomePage;