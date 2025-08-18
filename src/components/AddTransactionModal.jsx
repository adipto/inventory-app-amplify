// src/components/AddTransactionModal.jsx
import React, { Fragment, useState, useEffect } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Transition, TransitionChild } from "@headlessui/react";
import { X, Check, Search, Clock, Plus } from "lucide-react";
import DatePicker from "react-datepicker";
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import {
    DynamoDBClient,
    PutItemCommand,
    ScanCommand,
} from "@aws-sdk/client-dynamodb";
import {
    fromCognitoIdentityPool,
} from "@aws-sdk/credential-provider-cognito-identity";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { updateStockAfterTransaction } from "../utils/stockService";

import "react-datepicker/dist/react-datepicker.css";

const REGION = import.meta.env.VITE_COGNITO_REGION || "us-east-1";
const IDENTITY_POOL_ID = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || "us-east-1:e6bcc9cf-e0f5-4d5a-a530-1766da1767f9";
const CUSTOMERS_TABLE_NAME = "Customer_Information";
const RETAIL_TABLE_NAME = "Transaction_Retail";
const WHOLESALE_TABLE_NAME = "Transaction_Wholesale";
const RETAIL_STOCK_TABLE = "Retail_Stock";
const WHOLESALE_STOCK_TABLE = "Wholesale_Stock";

function AddTransactionModal({ isOpen, onClose, transaction, customerDetails, isEdit = false }) {
    const [selectedDateTime, setSelectedDateTime] = useState(new Date());
    const [productType, setProductType] = useState("Wholesale");
    const [productCategory, setProductCategory] = useState("Non-judicial stamp");
    const [productVariation, setProductVariation] = useState("");
    const [quantity, setQuantity] = useState("");
    const [sellingPrice, setSellingPrice] = useState("");
    const [cogs, setCogs] = useState("");
    const [netProfit, setNetProfit] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    // Customer search and selection
    const [customers, setCustomers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerId, setCustomerId] = useState("");
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const [lastCustomerUpdate, setLastCustomerUpdate] = useState(null);

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown && !event.target.closest('.customer-search-container')) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown]);

    // Product variations from stock tables
    const [availableVariations, setAvailableVariations] = useState([]);

    // Determine if this is edit mode
    const isEditMode = isEdit && transaction;

    // Check authentication status
    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const user = await getCurrentUser();
            setCurrentUser(user);
            setIsAuthenticated(true);
        } catch (error) {
            console.log('User not authenticated:', error);
            setIsAuthenticated(false);
            setCurrentUser(null);
        }
    };

    // Initialize form with transaction data for edit mode
    useEffect(() => {
        if (isEditMode && isOpen) {
            // Set product type
            setProductType(transaction.type === "retail" ? "Retail" : "Wholesale");

            // Set product category and variation
            setProductCategory(transaction.ProductName || "Non-judicial stamp");
            setProductVariation(transaction.ProductVariation || "");

            // Set quantity and pricing
            setQuantity(transaction.quantity?.toString() || "");
            setSellingPrice(transaction.sellingPrice?.toString() || "");
            setCogs(transaction.cogs?.toString() || "");
            setNetProfit(transaction.NetProfit?.toString() || "");

            // Set customer ID
            setCustomerId(transaction.CustomerID || "");

            // Set date and time
            if (transaction.Date) {
                const date = new Date(transaction.Date);
                if (transaction.Time) {
                    const timeParts = transaction.Time.split(':');
                    if (timeParts.length >= 2) {
                        date.setHours(parseInt(timeParts[0], 10));
                        date.setMinutes(parseInt(timeParts[1], 10));
                        if (timeParts.length > 2) {
                            date.setSeconds(parseInt(timeParts[2], 10));
                        }
                    }
                }
                setSelectedDateTime(date);
            }

            // Set customer information
            if (transaction.CustomerID && customerDetails && customerDetails[transaction.CustomerID]) {
                const customer = customerDetails[transaction.CustomerID];
                setSelectedCustomer(customer);
                setSearchTerm(customer.Name || "");
            }
        } else if (!isEditMode && isOpen) {
            // Reset form for add mode
            resetForm();
            // Clear any existing customer selection for new transactions
            setSelectedCustomer(null);
            setCustomerId("");
            setSearchTerm("");
            setShowDropdown(false);
        }
    }, [transaction, isOpen, customerDetails, isEditMode]);

    // Reset form function
    const resetForm = () => {
        setSelectedDateTime(new Date());
        setProductType("Wholesale");
        setProductCategory("Non-judicial stamp");
        setProductVariation("");
        setQuantity("");
        setSellingPrice("");
        setCogs("");
        setNetProfit("");
        setSearchTerm("");
        setSelectedCustomer(null);
        setCustomerId("");
        setAvailableVariations([]);
        setShowDropdown(false); // Close dropdown when resetting
    };

    // Load customers from DynamoDB
    useEffect(() => {
        if (isAuthenticated && isOpen) {
            fetchCustomers();
        }
    }, [isAuthenticated, isOpen]);

    // Refresh customers when modal opens to ensure fresh data
    useEffect(() => {
        if (isOpen && isAuthenticated) {
            // Small delay to ensure modal is fully rendered
            const timer = setTimeout(() => {
                fetchCustomers();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Fetch product variations when product type or category changes
    useEffect(() => {
        if (isAuthenticated && isOpen && productCategory) {
            fetchProductVariations();
        }
    }, [isAuthenticated, isOpen, productType, productCategory]);

    // Calculate net profit when quantity, sellingPrice, or cogs changes
    useEffect(() => {
        if (quantity && sellingPrice && cogs) {
            const quantityNum = parseFloat(quantity);
            const sellingPriceNum = parseFloat(sellingPrice);
            const cogsNum = parseFloat(cogs);

            if (!isNaN(quantityNum) && !isNaN(sellingPriceNum) && !isNaN(cogsNum)) {
                let profit;
                if (productCategory === "Court Fee") {
                    if (productType === "Retail") {
                        // Retail Court Fee: Net Profit = (Quantity_pieces * Selling price per piece) - (COGS_per_court_fee * Quantity_pieces)
                        profit = (quantityNum * sellingPriceNum) - (cogsNum * quantityNum);
                    } else {
                        // Wholesale Court Fee: Net Profit = (Quantity_bundles * Selling price per bundle) - (COGS_per_court_fee * 40 * 500 * Quantity_bundles)
                        const courtFeesPerBundle = 40 * 500; // 40 court fees per page * 500 pages per bundle
                        profit = (quantityNum * sellingPriceNum) - (cogsNum * courtFeesPerBundle * quantityNum);
                    }
                } else {
                    if (productType === "Retail") {
                        // Retail: Net Profit = (Quantity_pcs * Selling price) - (COGS_pcs * Quantity_pcs)
                        profit = (quantityNum * sellingPriceNum) - (cogsNum * quantityNum);
                    } else {
                        // Wholesale: Net Profit = (Quantity_packets * Selling price per packet) - (COGS_per_piece * 500 * Quantity_packets)
                        const piecesPerPacket = 500;
                        profit = (quantityNum * sellingPriceNum) - (cogsNum * piecesPerPacket * quantityNum);
                    }
                }
                setNetProfit(profit.toFixed(2));
            }
        }
    }, [quantity, sellingPrice, cogs, productType]);

    const fetchCustomers = async () => {
        try {
            setIsLoadingCustomers(true);
            const dynamoClient = await createDynamoDBClient();
            const command = new ScanCommand({ TableName: CUSTOMERS_TABLE_NAME });
            const response = await dynamoClient.send(command);
            const items = response.Items.map((item) => unmarshall(item));
            
            // Filter out any customers that might have been soft-deleted or have invalid data
            const validCustomers = items.filter(customer => 
                customer && 
                customer.CustomerID && 
                customer.Name && 
                customer.Name.trim() !== '' &&
                customer.PhoneNumber && 
                customer.PhoneNumber.trim() !== ''
            );
            
            // Sort customers by name for better UX
            validCustomers.sort((a, b) => a.Name.localeCompare(b.Name));
            
            setCustomers(validCustomers);
            setLastCustomerUpdate(new Date());
            console.log(`Fetched ${validCustomers.length} valid customers from database`);
        } catch (error) {
            console.error("Error fetching customers:", error);
            setCustomers([]);
        } finally {
            setIsLoadingCustomers(false);
        }
    };

    const fetchProductVariations = async () => {
        try {
            const dynamoClient = await createDynamoDBClient();

            // Determine which stock table to query
            const stockTableName = productType === "Retail" ? RETAIL_STOCK_TABLE : WHOLESALE_STOCK_TABLE;

            const command = new ScanCommand({ TableName: stockTableName });
            const response = await dynamoClient.send(command);
            const items = response.Items.map((item) => unmarshall(item));

            // Filter variations based on product category
            const categoryMap = {
                "Non-judicial stamp": "Non-judicial stamp",
                "Cartridge Paper": "Cartridge Paper",
                "Folio Paper": "Folio Paper",
                "Court Fee": "Court Fee"
            };

            // Filter variations by category AND stock quantity > 0
            const filteredVariations = items.filter(item => {
                // Check if item matches the selected category
                const matchesCategory = item.ItemType === categoryMap[productCategory];
                
                if (!matchesCategory) return false;
                
                // Check if stock quantity is greater than 0
                let stockQuantity = 0;
                if (productType === "Retail") {
                    stockQuantity = parseInt(item.Quantity_pcs) || 0;
                } else {
                    stockQuantity = parseInt(item.Quantity_packets) || 0;
                }
                
                return stockQuantity > 0;
            });

            setAvailableVariations(filteredVariations);
        } catch (error) {
            console.error("Error fetching product variations:", error);
            setAvailableVariations([]);
        }
    };

    const createDynamoDBClient = async () => {
        try {
            // Get the current auth session
            const session = await fetchAuthSession();
            const idToken = session.tokens?.idToken?.toString();

            if (!idToken) {
                throw new Error('No ID token available');
            }

            const credentials = fromCognitoIdentityPool({
                identityPoolId: IDENTITY_POOL_ID,
                logins: {
                    [`cognito-idp.${REGION}.amazonaws.com/${import.meta.env.VITE_COGNITO_USER_POOL_ID}`]: idToken,
                },
                clientConfig: { region: REGION },
            });

            return new DynamoDBClient({
                region: REGION,
                credentials,
            });
        } catch (error) {
            console.error('Error creating DynamoDB client:', error);
            throw error;
        }
    };

    const generateTransactionId = () => {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substr(2, 9);
        return `${productType.toLowerCase()}-${timestamp}-${random}`;
    };

    const handleProductTypeChange = (e) => {
        const newProductType = e.target.value;
        setProductType(newProductType);
        
        // Reset related fields when product type changes
        setProductVariation("");
        setQuantity("");
        setSellingPrice("");
        setCogs("");
        setNetProfit("");
        setAvailableVariations([]);
        
        // Clear customer selection when product type changes
        setSelectedCustomer(null);
        setCustomerId("");
        setSearchTerm("");
        setShowDropdown(false);
        
        // Refresh customers to ensure we have the latest data for the new product type
        if (customers.length > 0) {
            fetchCustomers();
        }
        
        // Show a brief message about the change
        console.log(`Product type changed to ${newProductType}. Customer list will be filtered accordingly.`);
    };

    const handleProductCategoryChange = (e) => {
        setProductCategory(e.target.value);
        setProductVariation("");
        setCogs("");
        setNetProfit("");
        setAvailableVariations([]);
    };

    const handleProductVariationChange = (e) => {
        const selectedVariation = e.target.value;
        setProductVariation(selectedVariation);

        // Find the selected variation from available variations to get COGS
        const variationItem = availableVariations.find(item =>
            item.VariationName === selectedVariation
        );

        if (variationItem) {
            // For variations like "20-16", extract the last part (16)
            // For variations like "Folio_6", extract the number part (6)
            let cogsValue = '';
            if (selectedVariation.includes('-')) {
                cogsValue = selectedVariation.split('-').pop();
            } else if (selectedVariation.includes('_')) {
                cogsValue = selectedVariation.split('_').pop();
            } else {
                // Look for any number in the variation name
                const numberMatch = selectedVariation.match(/\d+$/);
                if (numberMatch) {
                    cogsValue = numberMatch[0];
                }
            }

            if (cogsValue && !isNaN(parseInt(cogsValue))) {
                setCogs(cogsValue);
            }
        }
    };

    const handleCustomerSelect = (customer) => {
        // Validate that the selected customer matches the current product type
        if (customer.CustomerType !== productType) {
            alert(`This customer is a ${customer.CustomerType} customer, but you've selected ${productType} as the product type. Please select a customer that matches your product type.`);
            return;
        }
        
        setSelectedCustomer(customer);
        setCustomerId(customer.CustomerID);
        setSearchTerm(customer.Name);
        setShowDropdown(false);
    };

    const filterCustomers = () => {
        // First filter by product type (wholesale/retail)
        let filteredByType = customers.filter(customer => {
            if (!customer || !customer.CustomerType) return false;
            
            if (productType === "Wholesale") {
                return customer.CustomerType === "Wholesale";
            } else if (productType === "Retail") {
                return customer.CustomerType === "Retail";
            }
            return true; // If no specific type selected, show all
        });

        // Then filter by search term if provided
        if (!searchTerm.trim()) return filteredByType;

        return filteredByType.filter(customer =>
            customer && 
            customer.Name && 
            customer.Name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    // Enhanced date/time handling section for AddTransactionModal.jsx
// Replace the handleSubmit function in your AddTransactionModal.jsx

const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedCustomer) {
        alert("Please select a customer");
        return;
    }

    if (!productVariation) {
        alert("Please select product variation");
        return;
    }

    if (availableVariations.length === 0) {
        alert("No stock available for the selected product type and category. Please add stock first.");
        return;
    }

    if (!quantity || !sellingPrice) {
        alert("Please fill in all required fields");
        return;
    }

    // Validate that Selling Price (per packet) is not smaller than COGS (per pc) * 500 for wholesale
    if (productType === "Wholesale") {
        const cogsPerPc = parseFloat(cogs);
        const sellingPricePerPacket = parseFloat(sellingPrice);
        const minimumSellingPrice = cogsPerPc * 500;
        
        if (sellingPricePerPacket < minimumSellingPrice) {
            alert(`Selling Price (per packet) must be at least TK ${minimumSellingPrice.toFixed(2)} (COGS per pc × 500). Current value: TK ${sellingPricePerPacket.toFixed(2)}`);
            return;
        }
    }

    // Validate that Selling Price (per piece) is not smaller than COGS (per pc) for retail
    if (productType === "Retail") {
        const cogsPerPc = parseFloat(cogs);
        const sellingPricePerPc = parseFloat(sellingPrice);
        
        if (sellingPricePerPc < cogsPerPc) {
            alert(`Selling Price (per piece) must be at least TK ${cogsPerPc.toFixed(2)} (COGS per pc). Current value: TK ${sellingPricePerPc.toFixed(2)}`);
            return;
        }
    }

    setIsSubmitting(true);

    try {
        const dynamoClient = await createDynamoDBClient();

        // Use existing transaction ID for edit mode, generate new for add mode
        const transactionId = isEditMode ? transaction.TransactionID : generateTransactionId();

        // FIXED: Proper timezone handling for date/time
        const now = selectedDateTime || new Date();
        
        // Get user's timezone offset in minutes
        const timezoneOffset = now.getTimezoneOffset();
        
        // Adjust for timezone to get local date/time
        const localDateTime = new Date(now.getTime() - (timezoneOffset * 60000));
        
        // Format date as YYYY-MM-DD in local timezone
        const formattedDate = localDateTime.toISOString().split('T')[0];
        
        // Format time as HH:MM:SS in local timezone
        const hours = localDateTime.getHours().toString().padStart(2, '0');
        const minutes = localDateTime.getMinutes().toString().padStart(2, '0');
        const seconds = localDateTime.getSeconds().toString().padStart(2, '0');
        const formattedTime = `${hours}:${minutes}:${seconds}`;

        console.log('Saving transaction with date/time:', {
            originalDateTime: now,
            formattedDate,
            formattedTime,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });

        // Determine which table to use based on product type
        const tableName = productType === "Retail"
            ? RETAIL_TABLE_NAME
            : WHOLESALE_TABLE_NAME;

        // Common fields with NEW GSI attributes
        const transactionData = {
            TransactionID: { S: transactionId },
            CustomerID: { S: customerId },
            Date: { S: formattedDate },
            Time: { S: formattedTime },
            ProductName: { S: productCategory },
            ProductVariation: { S: productVariation },
            NetProfit: { N: netProfit.toString() },
            // NEW: Add GSI attributes for future optimization
            GSI_PK: { S: "ALL" }, // Constant partition key for TimestampIndex
            Timestamp: { N: now.getTime().toString() } // Timestamp for sorting
        };

        // Add type-specific fields
        if (productType === "Retail") {
            transactionData.COGS_Per_Pc = { N: cogs.toString() };
            transactionData.Quantity_Pcs = { N: quantity.toString() };
            transactionData.SellingPrice_Per_Pc = { N: sellingPrice.toString() };
        } else {
            transactionData.COGS_Per_Packet = { N: cogs.toString() };
            transactionData.Quantity_Packets = { N: quantity.toString() };
            transactionData.SellingPrice_Per_Packet = { N: sellingPrice.toString() };
        }

        // --- CREATE TRANSACTION FIRST ---
        await dynamoClient.send(
            new PutItemCommand({
                TableName: tableName,
                Item: transactionData,
            })
        );

        // --- UPDATE STOCK AFTER TRANSACTION IS CREATED ---
        try {
            const session = await fetchAuthSession();
            const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
            const stockTable = productType === "Retail" ? RETAIL_STOCK_TABLE : WHOLESALE_STOCK_TABLE;
            const quantityToSubtract = parseInt(quantity, 10);
            
            await updateStockAfterTransaction({
                tableName: stockTable,
                itemType: productCategory,
                variationName: productVariation,
                quantityToSubtract,
                token: idToken,
            });
        } catch (stockError) {
            console.error("Error updating stock after transaction:", stockError);
            // Don't throw error here as transaction was created successfully
            // Stock update can be retried later if needed
        }

        // --- Update Capital Management After Transaction ---
        try {
            const { updateAfterTransaction } = await import("../utils/capitalManagementService");
            
            // Get the auth token for capital management update
            const session = await fetchAuthSession();
            const idToken = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
            
            // Calculate the total transaction amount (selling price × quantity)
            const quantityNum = parseFloat(quantity);
            const sellingPriceNum = parseFloat(sellingPrice);
            const transactionAmount = quantityNum * sellingPriceNum;
            
            // Get the net profit amount from the form
            const netProfitAmount = parseFloat(netProfit);
            
            console.log('Transaction Amount Calculation:', {
                quantity: quantityNum,
                sellingPrice: sellingPriceNum,
                transactionAmount: transactionAmount,
                netProfitAmount: netProfitAmount
            });
            
            await updateAfterTransaction(idToken, transactionAmount, netProfitAmount);
        } catch (capitalError) {
            console.error("Error updating capital management:", capitalError);
        }

        alert(`Transaction ${isEditMode ? 'updated' : 'added'} successfully!`);
        onClose();

    } catch (error) {
        console.error(`Error ${isEditMode ? 'updating' : 'adding'} transaction:`, error);
        if (error.name === "ConditionalCheckFailedException") {
            alert("Not enough stock available for this product/variation. Please check your stock levels.");
        } else {
            alert(`Failed to ${isEditMode ? 'update' : 'add'} transaction. Please try again.`);
        }
    } finally {
        setIsSubmitting(false);
    }
};

    // Don't render if user is not authenticated
    if (!isAuthenticated) {
        return null;
    }

    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={onClose}>
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm transition-opacity" />
                </TransitionChild>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <DialogPanel className="bg-white p-6 rounded-xl shadow-xl w-full max-w-xl">
                                <div className="flex items-center justify-between mb-4">
                                    <DialogTitle className="text-xl font-semibold text-gray-800">
                                        {isEditMode ? "Edit Transaction" : "New Transaction"}
                                    </DialogTitle>
                                    <button
                                        onClick={onClose}
                                        className="p-1 rounded-full hover:bg-gray-100"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                                    {/* Customer Name Searchable Dropdown */}
                                    <div className="relative customer-search-container">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Customer Name <span className="text-red-500">*</span>
                                            </label>
                                            <span className="text-xs text-gray-500">
                                                {filterCustomers().length} of {customers.length} customer{customers.length !== 1 ? 's' : ''} ({productType})
                                                {lastCustomerUpdate && (
                                                    <span className="ml-1">
                                                        • {lastCustomerUpdate.toLocaleTimeString()}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Search size={16} className="text-gray-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={(e) => {
                                                        setSearchTerm(e.target.value);
                                                        setShowDropdown(true);
                                                        if (e.target.value === "") {
                                                            setSelectedCustomer(null);
                                                            setCustomerId("");
                                                        }
                                                    }}
                                                    onFocus={() => setShowDropdown(true)}
                                                    placeholder={`Search ${productType.toLowerCase()} customers...`}
                                                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={fetchCustomers}
                                                disabled={isLoadingCustomers}
                                                className="px-3 py-2 text-sm text-gray-600 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                                                title="Refresh customer list"
                                            >
                                                {isLoadingCustomers ? (
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>

                                        {showDropdown && (
                                            <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto">
                                                {isLoadingCustomers ? (
                                                    <div className="px-4 py-2 text-gray-500 text-center">
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mx-auto mb-2"></div>
                                                        Loading customers...
                                                    </div>
                                                ) : filterCustomers().length > 0 ? (
                                                    filterCustomers().map((customer) => (
                                                        <div
                                                            key={customer.CustomerID}
                                                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                                                            onClick={() => handleCustomerSelect(customer)}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div className="font-medium">{customer.Name}</div>
                                                                <span className={`text-xs px-2 py-1 rounded-full ${
                                                                    customer.CustomerType === "Wholesale" 
                                                                        ? "bg-indigo-100 text-indigo-700" 
                                                                        : "bg-green-100 text-green-700"
                                                                }`}>
                                                                    {customer.CustomerType}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-gray-500">{customer.PhoneNumber}</div>
                                                        </div>
                                                    ))
                                                ) : searchTerm.trim() ? (
                                                    <div className="px-4 py-2 text-gray-500">No customer found matching "{searchTerm}"</div>
                                                ) : customers.length === 0 ? (
                                                    <div className="px-4 py-2 text-gray-500 text-center">
                                                        <div className="text-sm font-medium mb-1">No customers found</div>
                                                        <div className="text-xs">Please add customers first or refresh the list</div>
                                                    </div>
                                                ) : filterCustomers().length === 0 ? (
                                                    <div className="px-4 py-2 text-gray-500 text-center">
                                                        <div className="text-sm font-medium mb-1">No {productType.toLowerCase()} customers found</div>
                                                        <div className="text-xs">Try changing the product type or add {productType.toLowerCase()} customers</div>
                                                    </div>
                                                ) : (
                                                    <div className="px-4 py-2 text-gray-500">Type to search {productType.toLowerCase()} customers</div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Customer ID (autofilled) */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Customer ID
                                        </label>
                                        <input
                                            type="text"
                                            value={customerId}
                                            readOnly
                                            disabled
                                            className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-700"
                                        />
                                    </div>

                                    {/* Date & Time Picker */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Transaction Date & Time <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Clock size={16} className="text-gray-400" />
                                            </div>
                                            <DatePicker
                                                selected={selectedDateTime}
                                                onChange={(date) => setSelectedDateTime(date)}
                                                dateFormat="yyyy-MM-dd h:mm aa"
                                                showTimeSelect
                                                timeFormat="HH:mm"
                                                timeIntervals={15}
                                                className="w-full pl-10 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholderText="Select date and time"
                                            />
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            Showing only {productType.toLowerCase()} customers • {filterCustomers().length} available
                                        </div>
                                    </div>

                                    {/* Product Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Product Type <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={productType}
                                            onChange={handleProductTypeChange}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="Retail">Retail</option>
                                            <option value="Wholesale">Wholesale</option>
                                        </select>
                                    </div>

                                    {/* Product Category */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Product Category <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={productCategory}
                                            onChange={handleProductCategoryChange}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="Non-judicial stamp">Non-judicial stamp</option>
                                            <option value="Cartridge Paper">Cartridge Paper</option>
                                            <option value="Folio Paper">Folio Paper</option>
                                            <option value="Court Fee">Court Fee</option>
                                        </select>
                                    </div>

                                    {/* Product Variation */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Product Variation <span className="text-red-500">*</span>
                                            {availableVariations.length > 0 && (
                                                <span className="text-xs text-gray-500 ml-2">
                                                    ({availableVariations.length} available)
                                                </span>
                                            )}
                                        </label>
                                        <select
                                            value={productVariation}
                                            onChange={handleProductVariationChange}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            disabled={availableVariations.length === 0}
                                        >
                                            <option value="">
                                                {availableVariations.length === 0 
                                                    ? "No variations with stock available" 
                                                    : "Select Variation"
                                                }
                                            </option>
                                            {availableVariations.map((variation) => {
                                                const stockQuantity = productType === "Retail" 
                                                    ? variation.Quantity_pcs || 0
                                                    : variation.Quantity_packets || 0;
                                                return (
                                                    <option key={variation.VariationName} value={variation.VariationName}>
                                                        {variation.VariationName} (Stock: {stockQuantity})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {availableVariations.length === 0 && (
                                            <p className="mt-1 text-sm text-orange-600">
                                                No stock available for this product type and category. Please add stock first.
                                            </p>
                                        )}
                                    </div>

                                    {/* Quantity */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {productType === "Retail" ? "Quantity (Pcs)" : "Quantity (Packets)"} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={quantity}
                                            min="1"
                                            onChange={(e) => setQuantity(e.target.value)}
                                            placeholder={productType === "Retail" ? "Number of pieces" : "Number of packets"}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    {/* Selling Price */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {productType === "Retail" ? "Selling Price (per pc)" : "Selling Price (per packet)"} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={sellingPrice}
                                            min={productType === "Wholesale" && cogs ? parseFloat(cogs) * 500 : 0}
                                            step="0.01"
                                            onChange={(e) => setSellingPrice(e.target.value)}
                                            placeholder={productType === "Retail" ? "Price per piece" : "Price per packet"}
                                                                                                                                     className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                                (productType === "Wholesale" && cogs && sellingPrice && parseFloat(sellingPrice) < parseFloat(cogs) * (productCategory === "Court Fee" ? 40 * 500 : 500)) ||
                                                (productType === "Retail" && cogs && sellingPrice && parseFloat(sellingPrice) < parseFloat(cogs) * (productCategory === "Court Fee" ? 1 : 1))
                                                    ? 'border-red-500 focus:ring-red-500' 
                                                    : ''
                                            }`}
                                        />
                                        {productType === "Wholesale" && cogs && (
                                            <p className="mt-1 text-sm text-gray-600">
                                                Minimum price: TK {
                                                    productCategory === "Court Fee" 
                                                        ? (parseFloat(cogs) * 40 * 500).toFixed(2) + " (COGS per court fee × 40 × 500)"
                                                        : (parseFloat(cogs) * 500).toFixed(2) + " (COGS per pc × 500)"
                                                }
                                            </p>
                                        )}
                                        {productType === "Retail" && cogs && (
                                            <p className="mt-1 text-sm text-gray-600">
                                                Minimum price: TK {
                                                    productCategory === "Court Fee"
                                                        ? parseFloat(cogs).toFixed(2) + " (COGS per court fee)"
                                                        : parseFloat(cogs).toFixed(2) + " (COGS per pc)"
                                                }
                                            </p>
                                        )}
                                                                                                                         {productType === "Wholesale" && cogs && sellingPrice && parseFloat(sellingPrice) < parseFloat(cogs) * (productCategory === "Court Fee" ? 40 * 500 : 500) && (
                                            <p className="mt-1 text-sm text-red-600">
                                                ⚠️ Selling price must be at least TK {(parseFloat(cogs) * (productCategory === "Court Fee" ? 40 * 500 : 500)).toFixed(2)}
                                            </p>
                                        )}
                                                                                 {productType === "Retail" && cogs && sellingPrice && parseFloat(sellingPrice) < parseFloat(cogs) * (productCategory === "Court Fee" ? 1 : 1) && (
                                            <p className="mt-1 text-sm text-red-600">
                                                ⚠️ Selling price must be at least TK {(parseFloat(cogs) * (productCategory === "Court Fee" ? 1 : 1)).toFixed(2)}
                                            </p>
                                        )}
                                    </div>

                                    {/* COGS (auto-filled) */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            COGS (per pc)
                                        </label>
                                        <input
                                            type="text"
                                            value={cogs}
                                            readOnly
                                            className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-700"
                                        />
                                    </div>

                                    {/* Net Profit (auto-calculated) */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Net Profit
                                        </label>
                                        <input
                                            type="text"
                                            value={netProfit}
                                            readOnly
                                            className="w-full px-3 py-2 border rounded-lg bg-gray-100 text-gray-700"
                                        />
                                    </div>

                                    {/* Submit Button */}
                                    <div className="mt-2">
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || availableVariations.length === 0}
                                            className={`w-full flex items-center justify-center px-4 py-2 text-white rounded-lg transition focus:outline-none focus:ring-2 disabled:opacity-70 ${isEditMode
                                                ? "bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500"
                                                : "bg-green-500 hover:bg-green-600 focus:ring-green-500"
                                                }`}
                                            title={availableVariations.length === 0 ? "No stock available for the selected product type and category" : ""}
                                        >
                                            {isSubmitting ? (
                                                <span className="flex items-center">
                                                    <svg
                                                        className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <circle
                                                            className="opacity-25"
                                                            cx="12"
                                                            cy="12"
                                                            r="10"
                                                            stroke="currentColor"
                                                            strokeWidth="4"
                                                        ></circle>
                                                        <path
                                                            className="opacity-75"
                                                            fill="currentColor"
                                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                        ></path>
                                                    </svg>
                                                    Processing...
                                                </span>
                                            ) : (
                                                <span className="flex items-center">
                                                    {isEditMode ? (
                                                        <>
                                                            <Check size={18} className="mr-2" />
                                                            Update Transaction
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Plus size={18} className="mr-2" />
                                                            Submit Transaction
                                                        </>
                                                    )}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

export default AddTransactionModal;