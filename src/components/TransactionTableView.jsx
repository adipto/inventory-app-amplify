// src/components/TransactionTableView.jsx
import { format } from "date-fns";
import {
  ChevronDown,
  Clipboard,
  Edit,
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
  onModifyTransaction,
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
    return parseFloat(amount).toFixed(2);
  };

  // Calculate pagination stats
  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const totalTransactions = displayTransactions.length;
  const totalProfit = displayTransactions
    .reduce((sum, tx) => sum + parseFloat(tx.NetProfit || 0), 0)
    .toFixed(2);

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
    <div className="hidden md:block overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Date
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Time
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Customer Name
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Mobile Number
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Product
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Variation
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Quantity
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Selling Price
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              COGS
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Net Profit
            </th>
            {isAdmin && (
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {displayTransactions.map((transaction) => {
            const customer = customerDetails[transaction.CustomerID] || {};
            return (
              <tr key={transaction.TransactionID} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(transaction.Date)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {transaction.Time || "-"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {customer.Name || "Unknown"}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {customer.PhoneNumber || "-"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      transaction.type === "retail"
                        ? "bg-green-100 text-green-800"
                        : "bg-indigo-100 text-indigo-800"
                    }`}
                  >
                    {transaction.type === "retail" ? "Retail" : "Wholesale"}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {transaction.ProductName}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {transaction.ProductVariation}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {transaction.quantity}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatCurrency(transaction.sellingPrice)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatCurrency(transaction.cogs)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatCurrency(transaction.NetProfit)}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onModifyTransaction(transaction)}
                        className="text-yellow-500 hover:text-yellow-700 hover:bg-yellow-50 p-1 rounded"
                        title="Edit Transaction"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => onDeleteTransaction(transaction)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                        title="Delete Transaction"
                      >
                        <Trash2 size={16} />
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

              {/* Financial Information */}
              <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">Selling Price:</span>
                  <span className="text-sm font-semibold text-blue-900">
                    ${formatCurrency(transaction.sellingPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-700">COGS:</span>
                  <span className="text-sm text-gray-900">
                    ${formatCurrency(transaction.cogs)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-2">
                  <span className="text-sm font-semibold text-gray-700">Net Profit:</span>
                  <span className="text-sm font-bold text-green-600">
                    ${formatCurrency(transaction.NetProfit)}
                  </span>
                </div>
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="flex justify-end space-x-3 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => onModifyTransaction(transaction)}
                    className="flex items-center px-3 py-2 text-sm text-yellow-700 bg-yellow-50 rounded-md hover:bg-yellow-100 transition-colors"
                  >
                    <Edit size={14} className="mr-1" />
                    Edit
                  </button>
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
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              transactionType === "all"
                ? "bg-blue-100 text-blue-800"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            All Transactions
          </button>
          <button
            onClick={() => onTransactionTypeChange("retail")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              transactionType === "retail"
                ? "bg-blue-100 text-blue-800"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Retail
          </button>
          <button
            onClick={() => onTransactionTypeChange("wholesale")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              transactionType === "wholesale"
                ? "bg-blue-100 text-blue-800"
                : "text-gray-600 hover:bg-gray-100"
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
              placeholder="Search transactions..."
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
                <span className="font-medium text-green-600">
                  ${totalProfit}
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