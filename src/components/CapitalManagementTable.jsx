// src/components/CapitalManagementTable.jsx
import React, { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { 
  getCapitalManagementData, 
  refreshCapitalManagement,
  updateAfterTransaction,
  updateAfterStockAddition,
  updateCapitalManagementData
} from "../utils/capitalManagementService";
import { 
  RefreshCw, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Banknote,
  Minus,
  X
} from "lucide-react";

function CapitalManagementTable() {
  const [capitalData, setCapitalData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Fixed initial capital value
  const INITIAL_CAPITAL = 200000.00;

  // Fetch capital management data
  const fetchCapitalData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
      
      if (!idToken) {
        throw new Error("No valid authentication token found");
      }

      const data = await getCapitalManagementData(idToken);
      setCapitalData(data);
    } catch (err) {
      console.error("Error fetching capital data:", err);
      setError("Failed to load capital management data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh capital management data
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
      
      if (!idToken) {
        throw new Error("No valid authentication token found");
      }

      await refreshCapitalManagement(idToken);
      await fetchCapitalData();
    } catch (err) {
      console.error("Error refreshing capital data:", err);
      setError("Failed to refresh capital management data. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchCapitalData();
  }, []);

  // Helper function to format currency
  const formatCurrency = (value) => {
    if (!value) return "0.00";
    return parseFloat(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Helper function to get numeric value
  const getNumericValue = (value) => {
    if (!value) return 0;
    return parseFloat(value);
  };

  // Calculate dynamic total capital
  const calculateTotalCapital = (currentStockValue) => {
    return currentStockValue > INITIAL_CAPITAL ? currentStockValue : INITIAL_CAPITAL;
  };

  // Handle withdraw profit button click
  const handleWithdrawClick = () => {
    setWithdrawAmount("");
    setShowWithdrawModal(true);
  };

  // Handle withdraw amount submission
  const handleWithdrawSubmit = () => {
    const amount = parseFloat(withdrawAmount);
    
    if (isNaN(amount) || amount <= 0) {
      setShowErrorDialog(true);
      return;
    }

    if (amount > data.cashInHand) {
      setShowErrorDialog(true);
      return;
    }

    setShowWithdrawModal(false);
    setShowConfirmDialog(true);
  };

  // Handle confirmed withdrawal
  const handleConfirmWithdraw = async () => {
    try {
      setIsWithdrawing(true);
      const amount = parseFloat(withdrawAmount);
      const newCashInHand = data.cashInHand - amount;

      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
      
      if (!idToken) {
        throw new Error("No valid authentication token found");
      }

      // Update the cash in hand value
      const updates = {
        CashInHand: { N: newCashInHand.toString() }
      };

      await updateCapitalManagementData(idToken, updates);
      await fetchCapitalData();
      
      setShowConfirmDialog(false);
      setWithdrawAmount("");
    } catch (err) {
      console.error("Error withdrawing profit:", err);
      setError("Failed to withdraw profit. Please try again.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Close all modals
  const closeAllModals = () => {
    setShowWithdrawModal(false);
    setShowConfirmDialog(false);
    setShowErrorDialog(false);
    setWithdrawAmount("");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading capital management data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center text-red-700">
          <AlertCircle size={16} className="mr-2" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!capitalData) {
    return (
      <div className="text-center p-8 text-gray-500">
        No capital management data available.
      </div>
    );
  }

  const data = {
    totalCapitalInvestment: getNumericValue(capitalData.TotalCapitalInvestment?.N),
    initialCashInHand: getNumericValue(capitalData.InitialCashInHand?.N),
    valueOfCurrentStock: getNumericValue(capitalData.ValueOfCurrentStock?.N),
    cashInHand: getNumericValue(capitalData.CashInHand?.N),
    cogsForProductSold: getNumericValue(capitalData.COGSForProductSold?.N),
    sellingPrice: getNumericValue(capitalData.SellingPrice?.N),
    netProfit: getNumericValue(capitalData.NetProfit?.N),
    remainingValueOfCurrentStock: getNumericValue(capitalData.RemainingValueOfCurrentStock?.N),
    updatedStock: getNumericValue(capitalData.UpdatedStock?.N)
  };

  // Calculate the dynamic total capital
  const totalCapital = calculateTotalCapital(data.remainingValueOfCurrentStock);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Capital Management Overview</h2>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-6 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Initial Capital */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center">
              <Banknote size={20} className="text-purple-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-purple-700">Initial Capital</p>
                <p className="text-xl font-bold text-purple-900">
                  ${formatCurrency(INITIAL_CAPITAL)}
                </p>
              </div>
            </div>
          </div>

          {/* Total Capital - Dynamic */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <DollarSign size={20} className="text-blue-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-blue-700">Total Capital</p>
                <p className="text-xl font-bold text-blue-900">
                  ${formatCurrency(totalCapital)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <TrendingUp size={20} className="text-green-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-green-700">Stock Value Before Last Sale</p>
                <p className="text-xl font-bold text-green-900">
                  ${formatCurrency(data.valueOfCurrentStock)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center">
              <TrendingUp size={20} className="text-emerald-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-emerald-700">Current Stock Value</p>
                <p className="text-xl font-bold text-emerald-900">
                  ${formatCurrency(data.remainingValueOfCurrentStock)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <TrendingDown size={20} className="text-yellow-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-yellow-700">Cash in Hand</p>
                <p className="text-xl font-bold text-yellow-900">
                  ${formatCurrency(data.cashInHand)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stock Value
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cash in Hand
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                COGS for Product Sold
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Selling Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Net Profit
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Initial State */}
            <tr className="bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                Total Capital Investment
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                -
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${formatCurrency(data.initialCashInHand)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                -
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                -
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                -
              </td>
            </tr>

            {/* Current State */}
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                Stock Value Before Last Sale
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${formatCurrency(data.valueOfCurrentStock)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${formatCurrency(data.cashInHand - data.sellingPrice)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                -
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                -
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                -
              </td>
            </tr>

            {/* Last Transaction */}
            {data.cogsForProductSold > 0 && (
              <>
                <tr className="bg-blue-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-900">
                    ← Latest Sale
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-900">
                    -
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-900">
                    +${formatCurrency(data.sellingPrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-900">
                    ${formatCurrency(data.cogsForProductSold)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-900">
                    ${formatCurrency(data.sellingPrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-900">
                    ${formatCurrency(data.netProfit)}
                  </td>
                </tr>

                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    Value of Current Stock →
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${formatCurrency(data.remainingValueOfCurrentStock)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 relative">
                    <div className="flex flex-col items-start space-y-2">
                      <span>${formatCurrency(data.cashInHand)}</span>
                      <button
                        onClick={handleWithdrawClick}
                        className="flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
                      >
                        <Minus size={12} className="mr-1" />
                        Withdraw Profit
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    -
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    -
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    -
                  </td>
                </tr>
              </>
            )}

            {/* Updated Stock */}
            {data.updatedStock > 0 && (
              <tr className="bg-green-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-900">
                  Updated Stock →
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-900">
                  ${formatCurrency(data.valueOfCurrentStock)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-900">
                  ${formatCurrency(data.cashInHand)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-900">
                  -
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-900">
                  -
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-900">
                  -
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Last Updated */}
      {capitalData.LastUpdated && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Last updated: {new Date(capitalData.LastUpdated.S).toLocaleString()}
          </p>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-90vw">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Withdraw Profit</h3>
              <button
                onClick={closeAllModals}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Available Cash: <span className="font-semibold">${formatCurrency(data.cashInHand)}</span>
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Withdrawal Amount
              </label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount to withdraw"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="0.01"
                min="0"
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={closeAllModals}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdrawSubmit}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-90vw">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Withdraw?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to withdraw <span className="font-semibold">${formatCurrency(parseFloat(withdrawAmount))}</span> from your cash in hand?
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={closeAllModals}
                disabled={isWithdrawing}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                No
              </button>
              <button
                onClick={handleConfirmWithdraw}
                disabled={isWithdrawing}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
              >
                {isWithdrawing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  'Yes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Dialog */}
      {showErrorDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-90vw">
            <h3 className="text-lg font-semibold text-red-600 mb-4">Error</h3>
            <p className="text-sm text-gray-600 mb-6">
              The withdrawal amount cannot exceed your available cash in hand (${formatCurrency(data.cashInHand)}) or be invalid.
            </p>
            
            <button
              onClick={closeAllModals}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CapitalManagementTable;