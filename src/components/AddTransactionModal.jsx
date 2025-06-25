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

import "react-datepicker/dist/react-datepicker.css";

const REGION = "us-east-1";
const IDENTITY_POOL_ID = "us-east-1:e6bcc9cf-e0f5-4d5a-a530-1766da1767f9";
const CUSTOMERS_TABLE_NAME = "Customer_Information";
const RETAIL_TABLE_NAME = "Transaction_Retail";
const WHOLESALE_TABLE_NAME = "Transaction_Wholesale";
const RETAIL_STOCK_TABLE = "Retail_Stock";
const WHOLESALE_STOCK_TABLE = "Wholesale_Stock";

function AddTransactionModal({ isOpen, onClose, transaction, customerDetails, isEdit = false }) {
    const [selectedDateTime, setSelectedDateTime] = useState(new Date());
    const [productType, setProductType] = useState("Retail");
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
        }
    }, [transaction, isOpen, customerDetails, isEditMode]);

    // Reset form function
    const resetForm = () => {
        setSelectedDateTime(new Date());
        setProductType("Retail");
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
    };

    // Load customers from DynamoDB
    useEffect(() => {
        if (isAuthenticated && isOpen) {
            fetchCustomers();
        }
    }, [isAuthenticated, isOpen]);

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
                if (productType === "Retail") {
                    // Retail: Net Profit = (Quantity_pcs * Selling price) - (COGS_pcs * Quantity_pcs)
                    profit = (quantityNum * sellingPriceNum) - (cogsNum * quantityNum);
                } else {
                    // Wholesale: Net Profit = (Quantity_packets * Selling price per packet) - (COGS_packets * 20 * Quantity_packets)
                    profit = (quantityNum * sellingPriceNum) - (cogsNum * 20 * quantityNum);
                }
                setNetProfit(profit.toFixed(2));
            }
        }
    }, [quantity, sellingPrice, cogs, productType]);

    const fetchCustomers = async () => {
        try {
            const dynamoClient = await createDynamoDBClient();
            const command = new ScanCommand({ TableName: CUSTOMERS_TABLE_NAME });
            const response = await dynamoClient.send(command);
            const items = response.Items.map((item) => unmarshall(item));
            setCustomers(items);
        } catch (error) {
            console.error("Error fetching customers:", error);
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
                "Folio paper": "Folio Paper"
            };

            const filteredVariations = items.filter(item =>
                item.ItemType === categoryMap[productCategory]
            );

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
        setProductType(e.target.value);
        // Reset related fields when product type changes
        setProductVariation("");
        setQuantity("");
        setSellingPrice("");
        setCogs("");
        setNetProfit("");
        setAvailableVariations([]);
    };

    const handleProductCategoryChange = (e) => {
        setProductCategory(e.target.value);
        setProductVariation("");
        setCogs("");
        setNetProfit("");
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
        setSelectedCustomer(customer);
        setCustomerId(customer.CustomerID);
        setSearchTerm(customer.Name);
        setShowDropdown(false);
    };

    const filterCustomers = () => {
        if (!searchTerm.trim()) return customers;

        return customers.filter(customer =>
            customer.Name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

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

        if (!quantity || !sellingPrice) {
            alert("Please fill in all required fields");
            return;
        }

        setIsSubmitting(true);

        try {
            const dynamoClient = await createDynamoDBClient();

            // Use existing transaction ID for edit mode, generate new for add mode
            const transactionId = isEditMode ? transaction.TransactionID : generateTransactionId();

            // Format date as YYYY-MM-DD
            const formattedDate = selectedDateTime.toISOString().split('T')[0];

            // Format time as HH:MM:SS
            const formattedTime = selectedDateTime.toTimeString().split(' ')[0];

            // Determine which table to use based on product type
            const tableName = productType === "Retail"
                ? RETAIL_TABLE_NAME
                : WHOLESALE_TABLE_NAME;

            // Common fields
            const transactionData = {
                TransactionID: { S: transactionId },
                CustomerID: { S: customerId },
                Date: { S: formattedDate },
                Time: { S: formattedTime },
                ProductName: { S: productCategory },
                ProductVariation: { S: productVariation },
                NetProfit: { N: netProfit.toString() },
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

            await dynamoClient.send(
                new PutItemCommand({
                    TableName: tableName,
                    Item: transactionData,
                })
            );

            alert(`Transaction ${isEditMode ? 'updated' : 'added'} successfully!`);
            onClose();

        } catch (error) {
            console.error(`Error ${isEditMode ? 'updating' : 'adding'} transaction:`, error);
            alert(`Failed to ${isEditMode ? 'update' : 'add'} transaction. Please try again.`);
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
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Customer Name <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
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
                                                placeholder="Search customers..."
                                                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>

                                        {showDropdown && (
                                            <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto">
                                                {filterCustomers().length > 0 ? (
                                                    filterCustomers().map((customer) => (
                                                        <div
                                                            key={customer.CustomerID}
                                                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                                                            onClick={() => handleCustomerSelect(customer)}
                                                        >
                                                            {customer.Name}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-2 text-gray-500">No customer found</div>
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
                                            <option value="Folio paper">Folio paper</option>
                                        </select>
                                    </div>

                                    {/* Product Variation */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Product Variation <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={productVariation}
                                            onChange={handleProductVariationChange}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="">Select Variation</option>
                                            {availableVariations.map((variation) => (
                                                <option key={variation.VariationName} value={variation.VariationName}>
                                                    {variation.VariationName}
                                                </option>
                                            ))}
                                        </select>
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
                                            min="0"
                                            step="0.01"
                                            onChange={(e) => setSellingPrice(e.target.value)}
                                            placeholder={productType === "Retail" ? "Price per piece" : "Price per packet"}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    {/* COGS (auto-filled) */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {productType === "Retail" ? "COGS (per pc)" : "COGS (per packet)"}
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
                                            disabled={isSubmitting}
                                            className={`w-full flex items-center justify-center px-4 py-2 text-white rounded-lg transition focus:outline-none focus:ring-2 disabled:opacity-70 ${isEditMode
                                                ? "bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500"
                                                : "bg-green-500 hover:bg-green-600 focus:ring-green-500"
                                                }`}
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