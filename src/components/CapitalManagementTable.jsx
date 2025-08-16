// src/components/CapitalManagementTable.jsx
import React, { useState, useEffect } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { 
  getCapitalManagementData, 
  refreshCapitalManagement,
  getTotalInvestmentFromDB,
  getTotalProfitFromDB,
  updateCapitalManagementData
} from "../utils/capitalManagementService";
import { 
  RefreshCw, 
  DollarSign, 
  TrendingUp, 
  Banknote,
  AlertCircle,
  Plus,
  Clock,
  Calendar
} from "lucide-react";

function CapitalManagementTable() {
  const [capitalData, setCapitalData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalProfit, setTotalProfit] = useState(0);
  const [isTakeProfitModalOpen, setIsTakeProfitModalOpen] = useState(false);
  const [takeProfitAmount, setTakeProfitAmount] = useState("");
  const [isTakingProfit, setIsTakingProfit] = useState(false);
  const [takeProfitTransactions, setTakeProfitTransactions] = useState([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [allTimeProfit, setAllTimeProfit] = useState(null);
  const [isCalculatingAllTimeProfit, setIsCalculatingAllTimeProfit] = useState(false);

  // Fetch capital management data
  const fetchCapitalData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

      if (!idToken) {
        setError("Authentication token not available");
        return;
      }

      const data = await getCapitalManagementData(idToken);
      const totalProfit = await getTotalProfitFromDB(idToken);

      setCapitalData(data);
      setTotalProfit(totalProfit);
    } catch (error) {
      console.error("Error fetching capital data:", error);
      setError("Failed to load capital management data");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch take profit transactions
  const fetchTakeProfitTransactions = async () => {
    try {
      setIsLoadingTransactions(true);
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

      if (!idToken) return;

      // Import DynamoDB client and commands
      const { DynamoDBClient, QueryCommand } = await import("@aws-sdk/client-dynamodb");
      const { fromCognitoIdentityPool } = await import("@aws-sdk/credential-provider-cognito-identity");
      const { unmarshall } = await import("@aws-sdk/util-dynamodb");

      const REGION = import.meta.env.VITE_COGNITO_REGION || "us-east-1";
      const IDENTITY_POOL_ID = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;

      const credentials = fromCognitoIdentityPool({
        identityPoolId: IDENTITY_POOL_ID,
        logins: {
          [`cognito-idp.${REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`]: idToken,
        },
        clientConfig: { region: REGION },
      });

      const client = new DynamoDBClient({
        region: REGION,
        credentials,
      });

      // Query the corrected TimestampIndex GSI using composite key structure
      const command = new QueryCommand({
        TableName: "Take_Profit_Transactions",
        IndexName: "TimestampIndex",
        KeyConditionExpression: "GSI_PK = :pk",
        ExpressionAttributeValues: {
          ":pk": { S: "TAKE_PROFIT" }
        },
        ScanIndexForward: false, // Get latest first (descending by timestamp)
        Limit: 10, // Get last 10 transactions
      });

      const response = await client.send(command);
      
      // Add debugging logs
      console.log('GSI Query Response:', response);
      console.log('Raw Items:', response.Items);
      
      // Filter out invalid entries and unmarshall
      const transactions = (response.Items || [])
        .filter(item => {
          // Check if item has required fields
          const hasRequiredFields = item.TransactionId?.S && 
                                  item.TransactionDate?.S && 
                                  item.Amount?.N;
          
          if (!hasRequiredFields) {
            console.warn('Filtering out invalid item:', item);
          }
          
          return hasRequiredFields;
        })
        .map(item => {
          const unmarshalled = unmarshall(item);
          console.log('Unmarshalled item:', unmarshalled);
          return unmarshalled;
        });
      
      console.log('Final filtered transactions:', transactions);
      setTakeProfitTransactions(transactions);
    } catch (error) {
      console.error("Error fetching take profit transactions:", error);
      // Set empty array on error to avoid showing stale data
      setTakeProfitTransactions([]);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // Calculate all-time profit by scanning the entire Take_Profit_Transactions table
  const calculateAllTimeProfit = async () => {
    try {
      setIsCalculatingAllTimeProfit(true);
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

      if (!idToken) {
        alert("No authentication token available");
        return;
      }

      // Import DynamoDB client and commands
      const { DynamoDBClient, ScanCommand } = await import("@aws-sdk/client-dynamodb");
      const { fromCognitoIdentityPool } = await import("@aws-sdk/credential-provider-cognito-identity");
      const { unmarshall } = await import("@aws-sdk/util-dynamodb");

      const REGION = import.meta.env.VITE_COGNITO_REGION || "us-east-1";
      const IDENTITY_POOL_ID = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;

      const credentials = fromCognitoIdentityPool({
        identityPoolId: IDENTITY_POOL_ID,
        logins: {
          [`cognito-idp.${REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`]: idToken,
        },
        clientConfig: { region: REGION },
      });

      const client = new DynamoDBClient({
        region: REGION,
        credentials,
      });
      
      // Scan the entire Take_Profit_Transactions table
      const scanCommand = new ScanCommand({
        TableName: "Take_Profit_Transactions"
      });
      
      const response = await client.send(scanCommand);
      const allTransactions = response.Items.map(item => unmarshall(item));
      
      // Calculate total profit by summing all Amount fields
      const totalProfit = allTransactions.reduce((sum, transaction) => {
        const amount = parseFloat(transaction.Amount?.N || transaction.Amount || 0);
        return sum + amount;
      }, 0);
      
      setAllTimeProfit(totalProfit);
      
      // Also update the take profit transactions list if it's empty
      if (takeProfitTransactions.length === 0) {
        setTakeProfitTransactions(allTransactions);
      }
      
      console.log("All-time profit calculation completed:", {
        totalTransactions: allTransactions.length,
        totalProfit: totalProfit
      });
      
    } catch (error) {
      console.error("Error calculating all-time profit:", error);
      alert("Failed to calculate all-time profit: " + error.message);
    } finally {
      setIsCalculatingAllTimeProfit(false);
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
      await fetchTakeProfitTransactions(); // Also refresh transactions
    } catch (err) {
      console.error("Error refreshing capital data:", err);
      setError("Failed to refresh capital management data. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle take profit modal open
  const handleTakeProfitClick = () => {
    setTakeProfitAmount("");
    setIsTakeProfitModalOpen(true);
  };

  // Handle take profit modal close
  const handleTakeProfitClose = () => {
    setIsTakeProfitModalOpen(false);
    setTakeProfitAmount("");
    setIsTakingProfit(false);
  };

  // Handle take profit submission
  const handleTakeProfitSubmit = async () => {
    if (!takeProfitAmount || parseFloat(takeProfitAmount) <= 0) {
      alert("Please enter a valid amount to take profit");
      return;
    }

    const amount = parseFloat(takeProfitAmount);
    if (amount > data.cashInHand) {
      alert("Amount cannot exceed available cash in hand");
      return;
    }

    setIsTakingProfit(true);
    try {
      console.log('🚀 Starting take profit process...');
      console.log('💰 Amount to take:', amount);
      console.log('💵 Current cash in hand:', data.cashInHand);
      
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

      if (!idToken) {
        throw new Error("No valid authentication token found");
      }

      console.log('✅ Authentication token obtained');

      // Calculate new cash in hand after taking profit
      const newCashInHand = data.cashInHand - amount;
      console.log('💸 New cash in hand will be:', newCashInHand);
      
      // Update the capital management table
      console.log('📊 Updating capital management table...');
      await updateCapitalManagementData(idToken, {
        CashInHand: { N: newCashInHand.toString() }
      });
      console.log('✅ Capital management table updated');

      // Log the take profit transaction
      console.log('📝 Logging take profit transaction...');
      const transactionId = await logTakeProfitTransaction(idToken, amount, data.cashInHand, newCashInHand);
      
      if (transactionId) {
        console.log('✅ Transaction logged with ID:', transactionId);
      } else {
        console.warn('⚠️ Transaction logging failed but continuing...');
      }

      // Refresh the data to show updated values
      console.log('🔄 Refreshing data...');
      await fetchCapitalData();
      await fetchTakeProfitTransactions(); // Refresh transaction list
      
      console.log('✅ All data refreshed successfully');
      
      // Show success message
      alert(`Profit of TK ${amount.toLocaleString()} has been taken successfully!\n\nNew Cash in Hand: TK ${newCashInHand.toLocaleString()}\nTransaction ID: ${transactionId || 'N/A'}`);
      
      handleTakeProfitClose();
      
    } catch (error) {
      console.error("❌ Error taking profit:", error);
      console.error("❌ Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Show user-friendly error message
      alert(`Failed to take profit. Please try again.\n\nError: ${error.message}`);
    } finally {
      setIsTakingProfit(false);
    }
  };

  // Test logging function for debugging
  const handleTestLogging = async () => {
    try {
      console.log('🧪 Testing transaction logging...');
      
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();

      if (!idToken) {
        throw new Error("No valid authentication token found");
      }

      // Test with dummy values
      const testAmount = 1000;
      const testPreviousCash = 50000;
      const testNewCash = 49000;

      console.log('🧪 Test values:', { testAmount, testPreviousCash, testNewCash });

      const transactionId = await logTakeProfitTransaction(idToken, testAmount, testPreviousCash, testNewCash);
      
      if (transactionId) {
        console.log('✅ Test transaction logged successfully with ID:', transactionId);
        alert('Test transaction logged successfully! Check the console for details.');
        
        // Refresh the transaction list to show the new entry
        await fetchTakeProfitTransactions();
      } else {
        console.log('❌ Test transaction logging failed');
        alert('Test transaction logging failed. Check the console for details.');
      }
      
    } catch (error) {
      console.error("❌ Error in test logging:", error);
      alert(`Test logging failed: ${error.message}`);
    }
  };

  // Log take profit transaction
  const logTakeProfitTransaction = async (token, amount, previousCash, newCash) => {
    try {
      console.log('📝 Starting to log take profit transaction...');
      console.log('📊 Transaction details:', { amount, previousCash, newCash });
      
      const { DynamoDBClient, PutItemCommand } = await import("@aws-sdk/client-dynamodb");
      const { fromCognitoIdentityPool } = await import("@aws-sdk/credential-provider-cognito-identity");

      const REGION = import.meta.env.VITE_COGNITO_REGION || "us-east-1";
      const IDENTITY_POOL_ID = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;

      if (!IDENTITY_POOL_ID) {
        throw new Error('IDENTITY_POOL_ID environment variable is not set');
      }

      const credentials = fromCognitoIdentityPool({
        identityPoolId: IDENTITY_POOL_ID,
        logins: {
          [`cognito-idp.${REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`]: token,
        },
        clientConfig: { region: REGION },
      });

      const client = new DynamoDBClient({
        region: REGION,
        credentials,
      });

      const now = new Date();
      const transactionId = `TP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const transactionDate = now.toISOString().split('T')[0];
      const timestamp = now.getTime();

      // Validate input parameters
      if (!amount || !previousCash || !newCash) {
        console.error('❌ Invalid parameters for take profit transaction:', { amount, previousCash, newCash });
        throw new Error('Invalid parameters for take profit transaction');
      }

      // Ensure all numeric values are properly formatted
      const transactionItem = {
        TransactionId: { S: transactionId },
        TransactionDate: { S: transactionDate },
        TransactionTimestamp: { N: timestamp.toString() },
        Amount: { N: amount.toString() },
        PreviousCashInHand: { N: previousCash.toString() },
        NewCashInHand: { N: newCash.toString() },
        Notes: { S: "Take profit transaction" },
        GSI_PK: { S: "TAKE_PROFIT" }, // Required for the corrected GSI structure
        // Additional useful attributes
        TransactionType: { S: "TAKE_PROFIT" },
        Status: { S: "COMPLETED" },
        CreatedAt: { S: now.toISOString() }
      };

      console.log('📤 Writing take profit transaction to DynamoDB:', JSON.stringify(transactionItem, null, 2));

      const putCommand = new PutItemCommand({
        TableName: "Take_Profit_Transactions",
        Item: transactionItem
      });

      await client.send(putCommand);

      console.log('✅ Take profit transaction logged successfully');
      console.log('🆔 Transaction ID:', transactionId);
      console.log('💰 Amount taken:', amount);
      console.log('📅 Date:', transactionDate);
      
      return transactionId; // Return the transaction ID for potential future use
      
    } catch (error) {
      console.error("❌ Error logging take profit transaction:", error);
      console.error("❌ Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      // Show user-friendly error message
      alert(`Warning: Take profit was processed but the transaction log could not be saved. Error: ${error.message}`);
      
      // Don't throw error as this is not critical for the main functionality
      return null;
    }
  };

  // Initial data fetch with automatic refresh
  useEffect(() => {
    const loadDataWithRefresh = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
        
        if (!idToken) {
          throw new Error("No valid authentication token found");
        }

        // First refresh the capital management data
        await refreshCapitalManagement(idToken);
        
        // Then fetch the updated data
        const data = await getCapitalManagementData(idToken);
        setCapitalData(data);
        
        // Get total profit from database
        const dbTotalProfit = await getTotalProfitFromDB(idToken);
        setTotalProfit(dbTotalProfit);

        // Fetch take profit transactions
        await fetchTakeProfitTransactions();
      } catch (err) {
        console.error("Error loading capital data with refresh:", err);
        setError("Failed to load capital management data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    loadDataWithRefresh();
  }, []);

  // Helper function to format currency
  const formatCurrency = (value) => {
    if (!value) return "0.00";
    const numValue = parseFloat(value);
    const isNegative = numValue < 0;
    const absValue = Math.abs(numValue);
    const formatted = absValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return isNegative ? `-${formatted}` : formatted;
  };

  // Helper function to get numeric value
  const getNumericValue = (value) => {
    return parseFloat(value) || 0;
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  // Extract values from capital data
  const cashInHand = getNumericValue(capitalData?.CashInHand?.N);
  const totalStockValue = getNumericValue(capitalData?.TotalStockValue?.N);
  const totalInvestmentValue = getNumericValue(capitalData?.totalinvestment?.N);
  const totalProfitValue = totalProfit; // This comes from the separate function

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Refreshing capital management data...</span>
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
    totalInvestment: totalInvestmentValue,
    cashInHand: cashInHand,
    totalStockValue: totalStockValue,
    totalProfit: totalProfitValue
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Capital Management Overview</h2>
            <div className="flex items-center gap-3">
                             <button
                 onClick={handleTakeProfitClick}
                 disabled={data.cashInHand <= 0}
                 className="flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 <Plus size={16} className="mr-2" />
                 Take Profit
               </button>
               <button
                 onClick={handleTestLogging}
                 className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                 title="Test transaction logging"
               >
                 🧪 Test Log
               </button>
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
        </div>

        {/* Summary Cards */}
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Investment */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center">
                <Banknote size={20} className="text-purple-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-purple-700">Total Investment</p>
                  <p className="text-xl font-bold text-purple-900">
                    TK {formatCurrency(data.totalInvestment)}
                  </p>
                </div>
              </div>
            </div>

            {/* Cash in Hand */}
            <div className={`${data.cashInHand >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-lg p-4`}>
              <div className="flex items-center">
                <DollarSign size={20} className={`${data.cashInHand >= 0 ? 'text-green-600' : 'text-red-600'} mr-2`} />
                <div>
                  <p className={`text-sm font-medium ${data.cashInHand >= 0 ? 'text-green-700' : 'text-red-700'}`}>Cash in Hand</p>
                  <p className={`text-xl font-bold ${data.cashInHand >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                    TK {formatCurrency(data.cashInHand)}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Total Stock Value */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <TrendingUp size={20} className="text-blue-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-blue-700">Total Stock Value</p>
                  <p className="text-xl font-bold text-blue-900">
                    TK {formatCurrency(data.totalStockValue)}
                  </p>
                </div>
              </div>
            </div>

            {/* Total Profit */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center">
                <TrendingUp size={20} className="text-orange-600 mr-2" />
                <div>
                  <p className="text-sm font-medium text-orange-700">Total Profit</p>
                  <p className="text-xl font-bold text-orange-900">
                    TK {formatCurrency(data.totalProfit)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Table */}
        <div className="p-6 border-b border-gray-200">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Investment:</span>
                <span className="font-semibold">TK {formatCurrency(data.totalInvestment)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Cash in Hand:</span>
                <span className={`font-semibold ${data.cashInHand >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  TK {formatCurrency(data.cashInHand)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Stock Value:</span>
                <span className="font-semibold">TK {formatCurrency(data.totalStockValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Profit:</span>
                <span className="font-semibold text-orange-600">TK {formatCurrency(data.totalProfit)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Take Profit Transactions Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Latest Take Profit Transactions</h3>
            <button
              onClick={fetchTakeProfitTransactions}
              disabled={isLoadingTransactions}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw size={16} className={`mr-2 ${isLoadingTransactions ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          
          {/* All-Time Profit Calculation Section */}
          <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-semibold text-gray-800">All-Time Profit Calculation</h4>
              <button
                onClick={calculateAllTimeProfit}
                disabled={isCalculatingAllTimeProfit}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isCalculatingAllTimeProfit ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Calculating...
                  </>
                ) : (
                  <>
                    <DollarSign size={16} className="mr-2" />
                    Calculate All-Time Profit
                  </>
                )}
              </button>
            </div>
            
            {allTimeProfit !== null && (
              <div className="bg-white p-4 rounded-lg border border-green-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Profit Taken Out:</p>
                    <p className="text-2xl font-bold text-green-600">
                      TK {allTimeProfit.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-1">Total Transactions:</p>
                    <p className="text-lg font-semibold text-gray-800">
                      {takeProfitTransactions.length}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {allTimeProfit === null && !isCalculatingAllTimeProfit && (
              <p className="text-sm text-gray-600">
                Click the button above to calculate the total profit taken out from all transactions.
              </p>
            )}
          </div>
          
          {isLoadingTransactions ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading transactions...</span>
            </div>
          ) : takeProfitTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Previous Cash</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Cash</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction ID</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {takeProfitTransactions.map((transaction) => (
                    <tr key={transaction.TransactionId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <Calendar size={14} className="mr-2 text-gray-400" />
                          {formatDate(transaction.TransactionDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        <span className="font-semibold text-green-600">
                          TK {formatCurrency(transaction.Amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        TK {formatCurrency(transaction.PreviousCashInHand)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        TK {formatCurrency(transaction.NewCashInHand)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {transaction.TransactionId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Clock size={24} className="mx-auto mb-2 text-gray-400" />
              <p>No take profit transactions found.</p>
              <p className="text-sm">Take profit transactions will appear here once you start using the feature.</p>
            </div>
          )}
        </div>

        {/* Last Updated */}
        {capitalData.LastUpdated && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Last updated: {new Date(capitalData.LastUpdated.S).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Take Profit Modal */}
      {isTakeProfitModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Take Profit</h3>
              <button
                onClick={handleTakeProfitClose}
                className="text-gray-400 hover:text-gray-600"
                disabled={isTakingProfit}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Available amount to take profit from:</p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-lg font-bold text-green-900">
                  TK {formatCurrency(data.cashInHand)}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="takeProfitAmount" className="block text-sm font-medium text-gray-700 mb-2">
                Amount to take (TK)
              </label>
              <input
                type="number"
                id="takeProfitAmount"
                value={takeProfitAmount}
                onChange={(e) => setTakeProfitAmount(e.target.value)}
                placeholder="Enter amount"
                min="0"
                max={data.cashInHand}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                disabled={isTakingProfit}
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum: TK {formatCurrency(data.cashInHand)}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleTakeProfitClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                disabled={isTakingProfit}
              >
                Cancel
              </button>
              <button
                onClick={handleTakeProfitSubmit}
                disabled={!takeProfitAmount || parseFloat(takeProfitAmount) <= 0 || parseFloat(takeProfitAmount) > data.cashInHand || isTakingProfit}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTakingProfit ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  "Take Profit"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CapitalManagementTable;