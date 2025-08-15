// src/components/TransactionTableContainer.jsx
import { signInWithRedirect, fetchAuthSession } from "aws-amplify/auth";
import { DeleteItemCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { getCurrentUser } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import {
  fetchCustomerDetails,
  fetchRetailTransactions,
  fetchWholesaleTransactions,
} from "../utils/fetchTransactions";
import DeleteConfirmModal from "../utils/DeleteConfirmModal";
import AddTransactionModal from "./AddTransactionModal";
import TransactionTableView from "./TransactionTableView";

function TransactionTableContainer({ initialTransactionType }) {
  // Authentication state
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModifyModalOpen, setIsModifyModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Data state
  const [retailTransactions, setRetailTransactions] = useState([]);
  const [wholesaleTransactions, setWholesaleTransactions] = useState([]);
  const [customerDetails, setCustomerDetails] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Filter and pagination state
  const [transactionType, setTransactionType] = useState(initialTransactionType || "all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 10;
  const [retailLastEvaluatedKeys, setRetailLastEvaluatedKeys] = useState([null]);
  const [wholesaleLastEvaluatedKeys, setWholesaleLastEvaluatedKeys] = useState([null]);
  const [retailTotalPages, setRetailTotalPages] = useState(1);
  const [wholesaleTotalPages, setWholesaleTotalPages] = useState(1);
  const [retailPageTransactions, setRetailPageTransactions] = useState([]);
  const [wholesalePageTransactions, setWholesalePageTransactions] = useState([]);

  // AWS Configuration
  const REGION = import.meta.env.VITE_COGNITO_REGION || "us-east-1";
  const IDENTITY_POOL_ID = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || "us-east-1:e6bcc9cf-e0f5-4d5a-a530-1766da1767f9";

  // Check authentication status
  const checkAuthStatus = useCallback(async () => {
    try {
      setIsAuthLoading(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.log("User not authenticated:", error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  // Get ID token from current session
  const getIdToken = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString();
    } catch (error) {
      console.error("Error getting ID token:", error);
      return null;
    }
  }, []);

  // Create DynamoDB client with Cognito credentials
  const createDynamoDBClient = useCallback(async () => {
    try {
      const idToken = await getIdToken();
      if (!idToken) throw new Error("No ID token available");

      return new DynamoDBClient({
        region: REGION,
        credentials: fromCognitoIdentityPool({
          identityPoolId: IDENTITY_POOL_ID,
          logins: {
            [`cognito-idp.${REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`]: idToken,
          },
        }),
      });
    } catch (error) {
      console.error("Error creating DynamoDB client:", error);
      throw error;
    }
  }, [getIdToken]);

  // Check if user is admin
  const checkAdminStatus = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      const groups = session.tokens?.accessToken?.payload?.["cognito:groups"] || [];
      const adminGroups = ["admin", "Admin", "ADMIN"];
      const userIsAdmin = groups.some((group) => adminGroups.includes(group));
      setIsAdmin(userIsAdmin);
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    }
  }, []);

// Enhanced fetch function that ensures latest transactions appear first
const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
        const idToken = await getIdToken();
        if (!idToken) {
            console.error("No ID token available for fetching data");
            return;
        }

        // Fetch more transactions to ensure we get the latest ones
        const fetchLimit = 100; // Increased limit to get more recent transactions
        
        const [retailData, wholesaleData] = await Promise.all([
            fetchRetailTransactions(idToken, fetchLimit),
            fetchWholesaleTransactions(idToken, fetchLimit),
        ]);

        // Store all transactions with enhanced sorting
        const processedRetailTx = retailData.items.map(tx => ({
            ...tx,
            type: 'retail',
            quantity: tx.Quantity_Pcs,
            sellingPrice: tx.SellingPrice_Per_Pc,
            cogs: tx.COGS_Per_Pc,
            // Create sortable datetime
            sortDateTime: new Date(`${tx.Date}T${tx.Time || '00:00:00'}`)
        }));

        const processedWholesaleTx = wholesaleData.items.map(tx => ({
            ...tx,
            type: 'wholesale',
            quantity: tx.Quantity_Packets,
            sellingPrice: tx.SellingPrice_Per_Packet,
            cogs: tx.COGS_Per_Packet,
            // Create sortable datetime
            sortDateTime: new Date(`${tx.Date}T${tx.Time || '00:00:00'}`)
        }));

        // Sort by datetime, newest first
        processedRetailTx.sort((a, b) => {
            if (isNaN(a.sortDateTime.getTime()) || isNaN(b.sortDateTime.getTime())) {
                return (b.Date || '').localeCompare(a.Date || '');
            }
            return b.sortDateTime - a.sortDateTime;
        });

        processedWholesaleTx.sort((a, b) => {
            if (isNaN(a.sortDateTime.getTime()) || isNaN(b.sortDateTime.getTime())) {
                return (b.Date || '').localeCompare(a.Date || '');
            }
            return b.sortDateTime - a.sortDateTime;
        });

        setRetailTransactions(processedRetailTx);
        setWholesaleTransactions(processedWholesaleTx);

        // Get all unique customer IDs
        const allCustomerIds = [
            ...new Set([
                ...processedRetailTx.map((item) => item.CustomerID),
                ...processedWholesaleTx.map((item) => item.CustomerID),
            ]),
        ];

        // Fetch customer details
        const customers = await fetchCustomerDetails(idToken, allCustomerIds);
        setCustomerDetails(customers);
        
        console.log('Fetched transactions:', {
            retail: processedRetailTx.length,
            wholesale: processedWholesaleTx.length,
            latestRetail: processedRetailTx[0]?.Date,
            latestWholesale: processedWholesaleTx[0]?.Date
        });

    } catch (error) {
        console.error("Error fetching transaction data:", error);
    } finally {
        setIsLoading(false);
    }
}, [isAuthenticated, getIdToken]);

// Updated pagination functions
const fetchRetailPage = useCallback(async (page = 1) => {
    // For better UX, use the already fetched data for pagination
    const startIndex = (page - 1) * transactionsPerPage;
    const endIndex = startIndex + transactionsPerPage;
    const pageData = retailTransactions.slice(startIndex, endIndex);
    
    setRetailPageTransactions(pageData);
    setRetailTotalPages(Math.ceil(retailTransactions.length / transactionsPerPage));
}, [retailTransactions, transactionsPerPage]);

const fetchWholesalePage = useCallback(async (page = 1) => {
    // For better UX, use the already fetched data for pagination
    const startIndex = (page - 1) * transactionsPerPage;
    const endIndex = startIndex + transactionsPerPage;
    const pageData = wholesaleTransactions.slice(startIndex, endIndex);
    
    setWholesalePageTransactions(pageData);
    setWholesaleTotalPages(Math.ceil(wholesaleTransactions.length / transactionsPerPage));
}, [wholesaleTransactions, transactionsPerPage]);

// Enhanced filtered transactions function
const getFilteredTransactions = useCallback(() => {
    let allTransactions = [];
    
    if (transactionType === "retail") {
        allTransactions = retailTransactions;
    } else if (transactionType === "wholesale") {
        allTransactions = wholesaleTransactions;
    } else {
        // Combine both types and sort by datetime
        allTransactions = [...retailTransactions, ...wholesaleTransactions];
        allTransactions.sort((a, b) => {
            if (isNaN(a.sortDateTime?.getTime()) || isNaN(b.sortDateTime?.getTime())) {
                return (b.Date || '').localeCompare(a.Date || '');
            }
            return b.sortDateTime - a.sortDateTime;
        });
    }

    // Apply search filtering
    if (searchTerm) {
        const searchTermLower = searchTerm.toLowerCase();
        allTransactions = allTransactions.filter((transaction) => {
            const customer = customerDetails[transaction.CustomerID];
            if (!customer) return false;
            const customerName = customer.Name || "";
            const customerPhone = customer.PhoneNumber || "";
            const customerId = transaction.CustomerID || "";
            const transactionId = transaction.TransactionID || "";
            return (
                customerName.toLowerCase().includes(searchTermLower) ||
                customerPhone.includes(searchTerm) ||
                customerId.toLowerCase().includes(searchTermLower) ||
                transactionId.toLowerCase().includes(searchTermLower)
            );
        });
    }

    // Apply pagination
    const startIndex = (currentPage - 1) * transactionsPerPage;
    const endIndex = startIndex + transactionsPerPage;
    return allTransactions.slice(startIndex, endIndex);
}, [
    retailTransactions, 
    wholesaleTransactions, 
    transactionType, 
    searchTerm, 
    customerDetails, 
    currentPage, 
    transactionsPerPage
]);

  // Handle edit transaction click
  const handleModifyTransactionClick = (transaction) => {
    // Prepare the transaction data for the modal
    const transactionForEdit = {
      ...transaction,
      TransactionID: transaction.TransactionID,
      CustomerID: transaction.CustomerID,
      Date: transaction.Date,
      Time: transaction.Time,
      ProductName: transaction.ProductName,
      ProductVariation: transaction.ProductVariation,
      NetProfit: transaction.NetProfit,
      // Add type-specific fields
      ...(transaction.type === "retail"
        ? {
          quantity: transaction.Quantity_Pcs,
          sellingPrice: transaction.SellingPrice_Per_Pc,
          cogs: transaction.COGS_Per_Pc,
        }
        : {
          quantity: transaction.Quantity_Packets,
          sellingPrice: transaction.SellingPrice_Per_Packet,
          cogs: transaction.COGS_Per_Packet,
        }),
    };

    setSelectedTransaction(transactionForEdit);
    setIsModifyModalOpen(true);
  };

  // Handle delete transaction click
  const handleDeleteClick = (transaction) => {
    setTransactionToDelete(transaction);
    setIsDeleteModalOpen(true);
  };

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!transactionToDelete) return;

    setIsDeleting(true);
    try {
      const client = await createDynamoDBClient();

      // Determine which table to delete from based on transaction type
      const tableName = transactionToDelete.type === "retail"
        ? "Transaction_Retail"
        : "Transaction_Wholesale";

      // Delete the item from DynamoDB
      await client.send(
        new DeleteItemCommand({
          TableName: tableName,
          Key: {
            TransactionID: { S: transactionToDelete.TransactionID },
          },
        })
      );

      // Close modal and refresh data
      setIsDeleteModalOpen(false);
      setTransactionToDelete(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting transaction:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle modal closures
  const handleModalClose = async () => {
    setIsModalOpen(false);
    
    // Reset pagination and refresh data
    setCurrentPage(1);
    setRetailLastEvaluatedKeys([null]);
    setWholesaleLastEvaluatedKeys([null]);
    
    // Refresh ALL data to ensure new transactions appear
    await fetchData();
    
    // Update capital management after transaction
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
      if (idToken) {
        const { updateAfterTransaction } = await import("../utils/capitalManagementService");
        await updateAfterTransaction(idToken);
      }
    } catch (error) {
      console.error("Error updating capital management:", error);
    }
  };

  const handleModifyModalClose = async () => {
    setIsModifyModalOpen(false);
    setSelectedTransaction(null);
    
    // Reset pagination and refresh data
    setCurrentPage(1);
    setRetailLastEvaluatedKeys([null]);
    setWholesaleLastEvaluatedKeys([null]);
    
    // Refresh ALL data to ensure new transactions appear
    await fetchData();
    
    // Update capital management after transaction modification
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
      if (idToken) {
        const { updateAfterTransaction } = await import("../utils/capitalManagementService");
        await updateAfterTransaction(idToken);
      }
    } catch (error) {
      console.error("Error updating capital management:", error);
    }
  };

  // Handle various actions
  const handleRefresh = async () => {
    // Reset pagination and refresh data
    setCurrentPage(1);
    setRetailLastEvaluatedKeys([null]);
    setWholesaleLastEvaluatedKeys([null]);
    
    // Refresh ALL data to ensure new transactions appear
    await fetchData();
  };

  const handleTransactionTypeChange = (type) => setTransactionType(type);

  const handleNewTransactionClick = async () => {
    if (!isAuthenticated) {
      try {
        await signInWithRedirect({ provider: "Cognito" });
      } catch (err) {
        console.error("Sign-in error:", err);
      }
    } else {
      setIsModalOpen(true);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithRedirect({ provider: "Cognito" });
    } catch (err) {
      console.error("Sign-in error:", err);
    }
  };

  // Set up auth listener and initial auth check
  useEffect(() => {
    checkAuthStatus();

    // Listen for auth state changes
    const unsubscribe = Hub.listen("auth", (data) => {
      const { event } = data.payload;

      switch (event) {
        case "signedIn":
          console.log("User signed in");
          checkAuthStatus();
          break;
        case "signedOut":
          console.log("User signed out");
          setUser(null);
          setIsAuthenticated(false);
          break;
        case "tokenRefresh":
          console.log("Token refreshed");
          break;
        case "tokenRefresh_failure":
          console.log("Token refresh failed");
          setUser(null);
          setIsAuthenticated(false);
          break;
      }
    });

    return () => unsubscribe();
  }, [checkAuthStatus]);

  // Initial data load
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, fetchData]);

  // Update transaction type when prop changes
  useEffect(() => {
    if (initialTransactionType) {
      setTransactionType(initialTransactionType);
    }
  }, [initialTransactionType]);

  // Check admin status when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      checkAdminStatus();
    } else {
      setIsAdmin(false);
    }
  }, [isAuthenticated, user, checkAdminStatus]);

  // Fetch correct page when transactionType or currentPage changes
  useEffect(() => {
    if (!isAuthenticated) return;
    if (transactionType === "retail") {
      fetchRetailPage(currentPage);
    } else if (transactionType === "wholesale") {
      fetchWholesalePage(currentPage);
    }
  }, [isAuthenticated, transactionType, currentPage, fetchRetailPage, fetchWholesalePage]);

  // Authentication loading state
  if (isAuthLoading) {
    return (
      <div className="text-center text-gray-500 py-12">
        Loading authentication...
      </div>
    );
  }

  // Unauthenticated state
  if (!isAuthenticated) {
    return (
      <div className="text-center text-gray-500 py-12">
        <p className="mb-4">Please log in to see the transaction details.</p>
        <button
          onClick={handleLogin}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Sign In
        </button>
      </div>
    );
  }

  const displayTransactions = getFilteredTransactions();
  const totalPages = transactionType === "retail" ? retailTotalPages : transactionType === "wholesale" ? wholesaleTotalPages : 1;

  return (
    <>
      <TransactionTableView
        displayTransactions={displayTransactions}
        customerDetails={customerDetails}
        transactionType={transactionType}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        transactionsPerPage={transactionsPerPage}
        isLoading={isLoading}
        isAdmin={isAdmin}
        onTransactionTypeChange={handleTransactionTypeChange}
        onRefresh={handleRefresh}
        onNewTransaction={handleNewTransactionClick}
        onModifyTransaction={handleModifyTransactionClick}
        onDeleteTransaction={handleDeleteClick}
      />

      {/* Add Transaction Modal */}
      <AddTransactionModal isOpen={isModalOpen} onClose={handleModalClose} />

      {/* Edit Transaction Modal */}
      <AddTransactionModal
        isOpen={isModifyModalOpen}
        onClose={handleModifyModalClose}
        transaction={selectedTransaction}
        customerDetails={customerDetails}
        isEdit={true}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Transaction"
        message={`Are you sure you want to delete this ${transactionToDelete?.type || ""} transaction? This action cannot be undone.`}
        isLoading={isDeleting}
      />
    </>
  );
}

export default TransactionTableContainer;