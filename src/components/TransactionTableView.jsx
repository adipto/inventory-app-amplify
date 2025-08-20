// src/components/TransactionTableView.jsx
import { format } from "date-fns";
import {
  ChevronDown,
  Clipboard,
  PlusCircle,
  Search,
  Trash2,
} from "lucide-react";
import React from "react";

function TransactionTableView({
  displayTransactions,
  customerDetails,
  transactionType,
  searchTerm,
  setSearchTerm,
  currentPage,
  setCurrentPage,
  totalPages,
  transactionsPerPage,
  isLoading,
  isAdmin,
  onTransactionTypeChange,
  onRefresh,
  onNewTransaction,
  onDeleteTransaction,
}) {
  // Format date helper
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy");
    } catch (e) {
      return dateString;
    }
  };

  // Format currency helper
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return "-";
    return `BDT ${parseFloat(amount).toFixed(2)}`;
  };

  // Calculate total product cost
  const calculateTotalProductCost = (transaction) => {
    const quantity = transaction.quantity;
    const cogs = transaction.cogs;
    const productType = transaction.type;
    const productName = transaction.ProductName;
    
    if (productType === "retail") {
      // For retail: quantity * COGS for all product types
      return quantity * cogs;
    } else {
      // For wholesale
      if (productName === "Court Fee") {
        // Court Fee: quantity * COGS * 40 * 500
        return quantity * cogs * 40 * 500;
      } else {
        // Cartridge, Folio, Non-judicial stamp: quantity * COGS * 500
        return quantity * cogs * 500;
      }
    }
  };

  // Calculate total amount charged
  const calculateTotalAmountCharged = (transaction) => {
    const quantity = transaction.quantity;
    const sellingPrice = transaction.sellingPrice;
    return quantity * sellingPrice;
  };

  // Calculate net profit dynamically
  const calculateNetProfit = (transaction) => {
    const quantity = transaction.quantity;
    const sellingPrice = transaction.sellingPrice;
    const cogs = transaction.cogs;
    const productType = transaction.type;
    const productName = transaction.ProductName;
    
    if (productType === "retail") {
      // For retail: Net Profit = (Quantity × Selling Price) - (Quantity × COGS)
      return (quantity * sellingPrice) - (quantity * cogs);
    } else {
      // For wholesale
      if (productName === "Court Fee") {
        // Court Fee: Net Profit = (Quantity × Selling Price) - (Quantity × COGS × 40 × 500)
        return (quantity * sellingPrice) - (quantity * cogs * 40 * 500);
      } else {
        // Other products: Net Profit = (Quantity × Selling Price) - (Quantity × COGS × 500)
        return (quantity * sellingPrice) - (quantity * cogs * 500);
      }
    }
  };

  // Calculate pagination stats
  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const totalTransactions = displayTransactions.length;
  const totalProfit = displayTransactions
    .reduce((sum, tx) => sum + calculateNetProfit(tx), 0)
    .toFixed(2);

  // Export transactions to CSV
  const handleExportData = () => {
    const headers = [
      "Date/Time",
      "Customer",
      "Type",
      "Product",
      "Variation",
      "Quantity",
      "COGS (Per Piece)",
      "Selling Price",
      "Total Product Cost",
      "Total Amount Charged",
      "Net Profit",
      "Notes"
    ];

    const csvData = [
      headers.join(","),
      ...displayTransactions.map(transaction => {
        return [
          transaction.Date + " " + (transaction.Time || ""),
          customerDetails[transaction.CustomerID]?.Name || transaction.CustomerID,
          transaction.type || transactionType,
          transaction.ProductName || "",
          transaction.ProductVariation || "",
          transaction.quantity || "",
          transaction.cogs || "",
          transaction.sellingPrice || "",
          calculateTotalProductCost(transaction),
          calculateTotalAmountCharged(transaction),
          calculateNetProfit(transaction),
          transaction.Notes || ""
        ].map(field => `"${field}"`).join(",");
      })
    ].join("\n");

    const blob = new Blob([csvData], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${transactionType}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Render empty state
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center text-center p-12">
      <div className="mb-4 p-4 bg-gray-100 rounded-full">
        <Clipboard className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="mt-2 text-sm font-medium text-gray-900">
        No transactions found
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        {searchTerm
          ? "Try adjusting your search terms or filters."
          : "Get started by creating a new transaction."}
      </p>
      <div className="mt-6">
        <button
          type="button"
          onClick={onNewTransaction}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <PlusCircle className="-ml-1 mr-2 h-5 w-5" />
          New Transaction
        </button>
      </div>
    </div>
  );

  // Render loading state
  const renderLoading = () => (
    <div className="flex justify-center items-center p-12">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        <span className="mt-2 text-gray-500">Loading transactions...</span>
      </div>
    </div>
  );

  // Render desktop table
  const renderDesktopTable = () => (
    <div className="hidden md:block">
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-20">
                  <div className="flex items-center gap-1">
                    <span>Date/Time</span>
                    <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-32">
                  <div className="flex items-center gap-1">
                    <span>Customer</span>
                    <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-16">
                  <div className="flex items-center gap-1">
                    <span>Type</span>
                    <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-40">
                  <div className="flex items-center gap-1">
                    <span>Product</span>
                    <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-20">
                  <div className="flex items-center gap-1">
                    <span>Qty</span>
                    <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-24">
                  <div className="flex items-center gap-1">
                    <span>COGS</span>
                    <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-32">
                  <div className="flex items-center gap-1">
                    <span>Notes</span>
                    <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-24">
                  <div className="flex items-center gap-1">
                    <span>Price</span>
                    <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-28">
                  <span>Total</span>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-28">
                  <span>Cost</span>
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-24">
                  <span>Profit</span>
                </th>
                {isAdmin && (
                  <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-20">
                    <span>Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white">
              {displayTransactions.map((transaction) => {
                const customer = customerDetails[transaction.CustomerID] || {};
                return (
                  <tr key={transaction.TransactionID} className="hover:bg-gray-50 border-b border-gray-100">
                    <td className="px-3 py-3 text-sm text-gray-600">
                      <div className="flex flex-col">
                        <span className="font-medium">{formatDate(transaction.Date)}</span>
                        <span className="text-xs text-gray-400">{transaction.Time || "-"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-28">
                          {customer.Name || "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-28">
                          {customer.PhoneNumber || "-"}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          transaction.type === "retail"
                            ? "bg-green-100 text-green-800"
                            : "bg-indigo-100 text-indigo-800"
                        }`}
                      >
                        {transaction.type === "retail" ? "R" : "W"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      <div className="flex flex-col">
                        <span className="font-medium truncate max-w-36">{transaction.ProductName}</span>
                        <span className="text-xs text-gray-400 truncate max-w-36">{transaction.ProductVariation}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-center">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                        {transaction.quantity}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-right">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        {formatCurrency(transaction.cogs)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      <div className="max-w-32 truncate" title={transaction.Notes || "-"}>
                        {transaction.Notes || "-"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-right">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {formatCurrency(transaction.sellingPrice)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-right">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {formatCurrency(calculateTotalAmountCharged(transaction))}
                      </span>
                    </td>
                                         <td className="px-3 py-3 text-sm text-right">
                       <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                         {formatCurrency(calculateTotalProductCost(transaction))}
                       </span>
                     </td>
                    <td className="px-3 py-3 text-sm font-semibold text-right">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        calculateNetProfit(transaction) >= 0 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {formatCurrency(calculateNetProfit(transaction))}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-3 text-sm text-gray-500">
                        <div className="flex space-x-1">
                          <button
                            onClick={() => onDeleteTransaction(transaction)}
                            className="text-red-500 hover:text-red-700 hover:bg-yellow-50 p-1 rounded transition-colors"
                            title="Delete Transaction"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Custom Scrollbar Indicator */}
        <div className="h-2 bg-gray-100 border-t border-gray-200">
          <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full mx-1 my-0.5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"></div>
        </div>
      </div>
    </div>
  );

  // Render mobile cards
  const renderMobileCards = () => (
    <div className="md:hidden">
      <div className="space-y-4 p-4">
        {displayTransactions.map((transaction) => {
          const customer = customerDetails[transaction.CustomerID] || {};
          return (
            <div
              key={transaction.TransactionID}
              className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-3"
            >
              {/* Header Row */}
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {customer.Name || "Unknown"}
                    </h3>
                    <span
                      className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.type === "retail"
                          ? "bg-green-100 text-green-800"
                          : "bg-indigo-100 text-indigo-800"
                      }`}
                    >
                      {transaction.type === "retail" ? "Retail" : "Wholesale"}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    📞 {customer.PhoneNumber || "No phone"}
                  </div>
                </div>
              </div>

              {/* Date and Time */}
              <div className="flex justify-between text-sm text-gray-500">
                <span>📅 {formatDate(transaction.Date)}</span>
                <span>🕒 {transaction.Time || "No time"}</span>
              </div>

              {/* Product Information */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">Product:</span>
                  <span className="text-sm text-gray-900 text-right flex-1 ml-2">
                    {transaction.ProductName}
                  </span>
                </div>
                {transaction.ProductVariation && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700">Variation:</span>
                    <span className="text-sm text-gray-900 text-right flex-1 ml-2">
                      {transaction.ProductVariation}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">Quantity:</span>
                  <span className="text-sm text-gray-900">
                    {transaction.quantity} {transaction.type === "retail" ? "pcs" : "packets"}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {transaction.Notes && transaction.Notes !== "-" && (
                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="flex items-start">
                    <span className="text-sm font-medium text-gray-700 mr-2">📝 Notes:</span>
                    <span className="text-sm text-gray-900 flex-1">
                      {transaction.Notes}
                    </span>
                  </div>
                </div>
              )}

              {/* Financial Information */}
                <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700">Selling Price:</span>
                    <span className="text-sm font-semibold bg-green-100 text-green-800 px-2 py-1 rounded">
                      {formatCurrency(transaction.sellingPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700">Total Amount Charged:</span>
                    <span className="text-sm font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {formatCurrency(calculateTotalAmountCharged(transaction))}
                    </span>
                  </div>
                                   <div className="flex justify-between">
                     <span className="text-sm font-medium text-gray-700">Total Product Cost:</span>
                     <span className="text-sm font-semibold bg-red-100 text-red-800 px-2 py-1 rounded">
                       {formatCurrency(calculateTotalProductCost(transaction))}
                     </span>
                   </div>
                                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700">COGS(Per Piece):</span>
                    <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded">
                      {formatCurrency(transaction.cogs)}
                    </span>
                  </div>
                 <div className="flex justify-between border-t border-blue-200 pt-2">
                   <span className="text-sm font-semibold text-gray-700">Net Profit:</span>
                                      <span className={`text-sm font-bold px-2 py-1 rounded ${
                        calculateNetProfit(transaction) >= 0 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                      {formatCurrency(calculateNetProfit(transaction))}
                    </span>
                 </div>
               </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="flex justify-end space-x-3 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => onDeleteTransaction(transaction)}
                    className="flex items-center px-3 py-2 text-sm text-red-700 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={14} className="mr-1" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Transaction Filters and Controls */}
      <div className="p-4 border-b flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTransactionTypeChange("all")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              transactionType === "all"
                ? "bg-blue-600 text-white shadow-md font-semibold"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => onTransactionTypeChange("retail")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              transactionType === "retail"
                ? "bg-blue-600 text-white shadow-md font-semibold"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
            }`}
          >
            Retail
          </button>
          <button
            onClick={() => onTransactionTypeChange("wholesale")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              transactionType === "wholesale"
                ? "bg-blue-600 text-white shadow-md font-semibold"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
            }`}
          >
            Wholesale
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by customer name or phone..."
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={onRefresh}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md"
            title="Refresh data"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
          </button>

                     <button
             onClick={handleExportData}
             className="px-3 py-2 rounded border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 text-sm font-medium transition-colors"
             title="Export transactions"
           >
             <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
             </svg>
             Export
           </button>

          <button
            onClick={onNewTransaction}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            <PlusCircle size={16} className="mr-1" />
            <span>New</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        renderLoading()
      ) : transactionType === "all" && (
        <div className="mb-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
          <strong>Note:</strong> This view shows a mix of the current page of both Retail and Wholesale transactions. Use the Retail or Wholesale tabs for paginated views of each type.
        </div>
      )}

      {isLoading ? (
        renderLoading()
      ) : displayTransactions.length > 0 ? (
        <>
          {/* Desktop Table View */}
          {renderDesktopTable()}

          {/* Mobile Card View */}
          {renderMobileCards()}

          {/* Pagination Section */}
          <div className="bg-gray-50 px-4 py-3 flex flex-col sm:flex-row items-center justify-between border-t border-gray-200">
            {/* Statistics */}
            <div className="mb-4 sm:mb-0">
              <p className="text-sm text-gray-700 text-center sm:text-left">
                Showing{" "}
                <span className="font-medium">
                  {indexOfFirstTransaction + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {Math.min(indexOfLastTransaction, totalTransactions)}
                </span>{" "}
                of <span className="font-medium">{totalTransactions}</span>{" "}
                transactions
              </p>
                             <p className="text-sm text-gray-700 mt-1 text-center sm:text-left">
                 Total Profit:{" "}
                 <span className="font-medium bg-green-100 text-green-800 px-2 py-1 rounded">
                   BDT {totalProfit}
                 </span>
               </p>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <span className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        renderEmptyState()
      )}
    </div>
  );
}

export default TransactionTableView;