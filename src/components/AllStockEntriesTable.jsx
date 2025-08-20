import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { deleteStockItem, updateMainStock, fetchStockEntries, deductFromMainStock } from "../utils/stockService";
import { fetchAuthSession } from "aws-amplify/auth";
import DeleteConfirmModal from "../utils/DeleteConfirmModal";

const AllStockEntriesTable = forwardRef(({ onRefresh, loading: parentLoading }, ref) => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterDate, setFilterDate] = useState("");
    const [filterItemType, setFilterItemType] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [deleteEntry, setDeleteEntry] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    
    // Editing states for additional fields
    const [editingEntry, setEditingEntry] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        seriesStartNumber: "",
        seriesEndNumber: "",
        chalanNumber: "",
        chalanDate: ""
    });
    
    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
    const [totalScanned, setTotalScanned] = useState(0);
    const itemsPerPage = 10;

    // Expose loadEntries method to parent component
    useImperativeHandle(ref, () => ({
        loadEntries
    }));

    // Check if user is admin
    const checkAdminStatus = async () => {
        try {
            const session = await fetchAuthSession();
            const groups = session.tokens?.accessToken?.payload?.["cognito:groups"] || [];
            const adminGroups = ["admin", "Admin", "ADMIN"];
            const userIsAdmin = groups.some((group) => adminGroups.includes(group));
            
            console.log('Admin check:', {
                groups: groups,
                adminGroups: adminGroups,
                userIsAdmin: userIsAdmin
            });
            
            setIsAdmin(userIsAdmin);
        } catch (error) {
            console.error("Error checking admin status:", error);
            setIsAdmin(false);
        }
    };

    // Load entries on component mount and when page changes
    useEffect(() => {
        const initializeComponent = async () => {
            await checkAdminStatus();
            await loadEntries(1, null, true); // Reset to first page
        };
        initializeComponent();
    }, []);

    const loadEntries = async (page = 1, startKey = null, resetPagination = false) => {
        setLoading(true);
        setError("");
        
        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
            
            const result = await fetchStockEntries(token, page, itemsPerPage, startKey);
            
            if (resetPagination) {
                setEntries(result.entries);
                setCurrentPage(1);
            } else {
                setEntries(result.entries);
                setCurrentPage(page);
            }
            
            setHasMore(result.hasMore);
            setLastEvaluatedKey(result.lastEvaluatedKey);
            setTotalScanned(result.totalScanned);
            
        } catch (err) {
            console.error("Error loading stock entries:", err);
            setError("Failed to load stock entries: " + (err.message || "Unknown error"));
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        await loadEntries(1, null, true);
        if (onRefresh) {
            await onRefresh();
        }
    };

    const handleExportData = () => {
        const headers = [
            "Date & Time",
            "Item Type",
            "Variation",
            "Stock Type",
            "Quantity (Pcs)",
            "Quantity (Packets)",
            "Unit Price",
            "Total Value",
            "Series Start",
            "Series End",
            "Chalan Number",
            "Chalan Date"
        ];

        const csvData = [
            headers.join(","),
            ...filteredEntries.map(entry => {
                return [
                    entry.timestampDisplay || "",
                    entry.itemType || "",
                    entry.variationName || "",
                    entry.stockType || "",
                    entry.quantityPcs || "",
                    entry.quantityPackets || "",
                    entry.unitPrice?.toFixed(2) || "",
                    entry.totalValue?.toFixed(2) || "",
                    entry.seriesStartNumber || "",
                    entry.seriesEndNumber || "",
                    entry.chalanNumber || "",
                    entry.chalanDate || ""
                ].join(",");
            })
        ].join("\n");

        const blob = new Blob([csvData], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `stock-entries-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const handlePageChange = async (newPage) => {
        if (newPage === currentPage) return;
        
        if (newPage === 1) {
            await loadEntries(1, null, true);
        } else if (newPage > currentPage) {
            // Going forward
            await loadEntries(newPage, lastEvaluatedKey);
        } else {
            // Going backward - we need to restart from page 1 and go to the target page
            // This is a limitation of DynamoDB pagination
            await loadEntries(1, null, true);
            
            // If not going to page 1, we need to simulate going to the target page
            if (newPage > 1) {
                let currentKey = null;
                for (let i = 1; i < newPage; i++) {
                    const session = await fetchAuthSession();
                    const token = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
                    const result = await fetchStockEntries(token, i, itemsPerPage, currentKey);
                    currentKey = result.lastEvaluatedKey;
                }
                await loadEntries(newPage, currentKey);
            }
        }
    };

    const filteredEntries = entries.filter(entry => {
        let matchesDate = true;
        if (filterDate) {
            // Convert filter date to start and end of day timestamps
            const filterDateObj = new Date(filterDate);
            const startOfDay = new Date(filterDateObj.getFullYear(), filterDateObj.getMonth(), filterDateObj.getDate());
            const endOfDay = new Date(filterDateObj.getFullYear(), filterDateObj.getMonth(), filterDateObj.getDate() + 1);
            const startTimestamp = startOfDay.getTime();
            const endTimestamp = endOfDay.getTime();
            
            // Check if entry timestamp falls within the day
            const entryTimestamp = entry.timestamp || entry.Timestamp;
            matchesDate = entryTimestamp >= startTimestamp && entryTimestamp < endTimestamp;
        }
        const matchesType = filterItemType ? entry.itemType === filterItemType : true;
        
        // Apply search filter for chalan number or series start
        let matchesSearch = true;
        if (searchQuery.trim()) {
            const searchTerm = searchQuery.toLowerCase().trim();
            const chalanNumber = (entry.chalanNumber || "").toLowerCase();
            const seriesStart = (entry.seriesStartNumber || "").toLowerCase();
            matchesSearch = chalanNumber.includes(searchTerm) || seriesStart.includes(searchTerm);
        }
        
        return matchesDate && matchesType && matchesSearch;
    });

    const itemTypes = Array.from(new Set(entries.map(e => e.itemType)));

    const handleDeleteClick = (entry) => {
        console.log('Delete clicked for entry:', entry);
        setDeleteEntry(entry);
        setError("");
    };

    const handleEditClick = (entry) => {
        setEditingEntry(entry);
        setEditForm({
            seriesStartNumber: entry.seriesStartNumber || "",
            seriesEndNumber: entry.seriesEndNumber || "",
            chalanNumber: entry.chalanNumber || "",
            chalanDate: entry.chalanDate || ""
        });
        setError("");
    };

    const handleEditCancel = () => {
        setEditingEntry(null);
        setEditForm({
            seriesStartNumber: "",
            seriesEndNumber: "",
            chalanNumber: "",
            chalanDate: ""
        });
        setError("");
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleEditSave();
        } else if (e.key === 'Escape') {
            handleEditCancel();
        }
    };

    const handleEditSave = async () => {
        if (!editingEntry) return;
        
        setIsSaving(true);
        setError("");
        
        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
            
            // Import DynamoDB client and commands
            const { DynamoDBClient, UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");
            const { fromCognitoIdentityPool } = await import("@aws-sdk/credential-provider-cognito-identity");
            
            const REGION = import.meta.env.VITE_COGNITO_REGION || "us-east-1";
            const IDENTITY_POOL_ID = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;
            
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

            // Build update expression and attribute values
            const updateExpressions = [];
            const expressionAttributeValues = {};
            const expressionAttributeNames = {};

                         if (editForm.seriesStartNumber !== "") {
                 updateExpressions.push("#ssn = :ssn");
                 expressionAttributeNames["#ssn"] = "SeriesStartNumber";
                 // Convert to number if possible, otherwise store as string
                 const startNum = Number(editForm.seriesStartNumber);
                 if (!isNaN(startNum)) {
                     expressionAttributeValues[":ssn"] = { N: startNum.toString() };
                 } else {
                     expressionAttributeValues[":ssn"] = { S: editForm.seriesStartNumber };
                 }
             }

             if (editForm.seriesEndNumber !== "") {
                 updateExpressions.push("#sen = :sen");
                 expressionAttributeNames["#sen"] = "SeriesEndNumber";
                 // Convert to number if possible, otherwise store as string
                 const endNum = Number(editForm.seriesEndNumber);
                 if (!isNaN(endNum)) {
                     expressionAttributeValues[":sen"] = { N: endNum.toString() };
                 } else {
                     expressionAttributeValues[":sen"] = { S: editForm.seriesEndNumber };
                 }
             }

            if (editForm.chalanNumber !== "") {
                updateExpressions.push("#cn = :cn");
                expressionAttributeNames["#cn"] = "ChalanNumber";
                expressionAttributeValues[":cn"] = { S: editForm.chalanNumber };
            }

            if (editForm.chalanDate !== "") {
                updateExpressions.push("#cd = :cd");
                expressionAttributeNames["#cd"] = "ChalanDate";
                expressionAttributeValues[":cd"] = { S: editForm.chalanDate };
            }

            if (updateExpressions.length === 0) {
                setError("No changes to save");
                setIsSaving(false);
                return;
            }

            // Debug logging to see the actual structure
            console.log('Editing entry structure:', editingEntry);
            console.log('Key values being used:', {
                Date: editingEntry.date || editingEntry.Date,
                StockType_VariationName_Timestamp: editingEntry.StockType_VariationName_Timestamp
            });

            // Validate that we have the required key fields
            if (!editingEntry.date && !editingEntry.Date) {
                throw new Error("Missing Date field for update");
            }
            if (!editingEntry.StockType_VariationName_Timestamp) {
                throw new Error("Missing StockType_VariationName_Timestamp field for update");
            }

            const updateCommand = new UpdateItemCommand({
                TableName: "Stock_Entries",
                Key: {
                    Date: { S: editingEntry.date || editingEntry.Date },
                    StockType_VariationName_Timestamp: { S: editingEntry.StockType_VariationName_Timestamp }
                },
                UpdateExpression: `SET ${updateExpressions.join(", ")}`,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues
            });

            console.log('Update command:', JSON.stringify(updateCommand, null, 2));

            await client.send(updateCommand);

            // Update the local state
            const updatedEntries = entries.map(entry => {
                if (entry.id === editingEntry.id) {
                    return {
                        ...entry,
                        seriesStartNumber: editForm.seriesStartNumber || entry.seriesStartNumber,
                        seriesEndNumber: editForm.seriesEndNumber || entry.seriesEndNumber,
                        chalanNumber: editForm.chalanNumber || entry.chalanNumber,
                        chalanDate: editForm.chalanDate || entry.chalanDate
                    };
                }
                return entry;
            });

            console.log('Updated entry in local state:', updatedEntries.find(e => e.id === editingEntry.id));

            setEntries(updatedEntries);
            setEditingEntry(null);
            setEditForm({
                seriesStartNumber: "",
                seriesEndNumber: "",
                chalanNumber: "",
                chalanDate: ""
            });

        } catch (err) {
            console.error("Error updating stock entry:", err);
            setError("Failed to update stock entry: " + (err.message || "Unknown error"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteEntry) return;
        setIsDeleting(true);
        setError("");
        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
            
            // --- Validation: Check Total Transaction Quantity before deletion ---
            try {
                const { getStockItem } = await import("../utils/stockService");
                const tableName = deleteEntry.isWholesale ? "Wholesale_Stock" : "Retail_Stock";
                const mainItemType = deleteEntry.itemType || deleteEntry.ItemType;
                const mainVariationName = deleteEntry.variationName || deleteEntry.VariationName;
                
                if (!mainItemType || !mainVariationName) {
                    setError("Failed to validate deletion. Main stock key is missing.");
                    setIsDeleting(false);
                    return;
                }
                
                const stockItem = await getStockItem(tableName, mainItemType, mainVariationName, token);
                if (!stockItem) {
                    setError("Failed to validate deletion. Stock item not found.");
                    setIsDeleting(false);
                    return;
                }
                
                const totalStock = stockItem.quantity;
                const stockEntryQuantity = deleteEntry.quantityPcs || deleteEntry.quantityPackets || deleteEntry.quantity || 0;
                const totalTransactionQty = stockItem.totalTransactionQuantity || 0;
                const remainingStockAfterDeletion = totalStock - stockEntryQuantity;
                
                console.log('Validation check:', {
                    totalStock,
                    stockEntryQuantity,
                    totalTransactionQty,
                    remainingStockAfterDeletion
                });
                
                if (totalTransactionQty > remainingStockAfterDeletion) {
                    const errorMessage = `Cannot delete this stock entry. Total Transaction Quantity (${totalTransactionQty}) is greater than the remaining stock after deletion (${remainingStockAfterDeletion}). This would result in negative transaction quantities.`;
                    setError(errorMessage);
                    setIsDeleting(false);
                    // Show error alert to user
                    alert(errorMessage);
                    return;
                }
                
                console.log('Validation passed. Proceeding with deletion.');
                
            } catch (validationError) {
                console.error('Error during validation:', validationError);
                setError(`Validation failed: ${validationError.message}`);
                setIsDeleting(false);
                return;
            }
            
            // --- Fetch Stock Transaction Details Before Deletion ---
            const { fetchStockEntries } = await import("../utils/stockService");
            const allEntries = await fetchStockEntries(token, 1, 1000, null); // Get all entries to check if this is the last one
            
            // Check if this is the last entry in the table
            const isLastEntry = allEntries.entries.length === 1;
            
                         // Store the stock transaction details before deletion
             const stockTransactionDetails = {
                 quantityRemoved: deleteEntry.quantityPcs || deleteEntry.quantityPackets || deleteEntry.quantity,
                 unitPrice: deleteEntry.unitPrice || deleteEntry.UnitPrice,
                 stockValueRemoved: deleteEntry.totalValue || (deleteEntry.quantityPcs || deleteEntry.quantityPackets || deleteEntry.quantity) * (deleteEntry.unitPrice || deleteEntry.UnitPrice),
                 isLastEntry: isLastEntry
             };
            
                         console.log('Stock Transaction Details Before Deletion:', stockTransactionDetails);
             console.log('Delete Entry Raw Data:', {
                 deleteEntry: deleteEntry,
                 totalValue: deleteEntry.totalValue,
                 quantityPcs: deleteEntry.quantityPcs,
                 quantityPackets: deleteEntry.quantityPackets,
                 quantity: deleteEntry.quantity,
                 unitPrice: deleteEntry.unitPrice,
                 UnitPrice: deleteEntry.UnitPrice
             });
            
            // 1. Delete from Stock_Entries
            console.log('Attempting to delete entry with keys:', {
                StockType_VariationName_Timestamp: deleteEntry.StockType_VariationName_Timestamp,
                entryData: deleteEntry
            });
            
            if (!deleteEntry.StockType_VariationName_Timestamp) {
                setError("Failed to delete entry. Key information is missing.");
                setIsDeleting(false);
                return;
            }
            
            // Use the new key structure for deletion
            const { DynamoDBClient, DeleteItemCommand } = await import("@aws-sdk/client-dynamodb");
            const { fromCognitoIdentityPool } = await import("@aws-sdk/credential-provider-cognito-identity");
            
            const REGION = import.meta.env.VITE_COGNITO_REGION || "us-east-1";
            const IDENTITY_POOL_ID = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID;
            
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

            // Use the correct primary key for deletion
            const stockTypeKey = deleteEntry.StockType_VariationName_Timestamp;
            const entryDate = deleteEntry.date;
            
            console.log('Attempting to delete with keys:', {
                Date: entryDate,
                StockType_VariationName_Timestamp: stockTypeKey
            });
            
            if (!stockTypeKey || !entryDate) {
                throw new Error("Missing required keys for deletion");
            }
            
            // Start with the most likely key combination
            const deleteCommand = new DeleteItemCommand({
                TableName: "Stock_Entries",
                Key: {
                    Date: { S: entryDate },
                    StockType_VariationName_Timestamp: { S: stockTypeKey }
                }
            });
            console.log('Using Date + StockType_VariationName_Timestamp as key');

            console.log('Sending delete command:', JSON.stringify(deleteCommand, null, 2));
            
            try {
                await client.send(deleteCommand);
                console.log('Successfully deleted from Stock_Entries table');
            } catch (deleteError) {
                console.error('Error deleting from Stock_Entries:', deleteError);
                
                // If the first key combination failed, try alternative key structures
                if (deleteError.name === 'ValidationException' && deleteError.message.includes('key element does not match the schema')) {
                    console.log('Trying alternative key structures...');
                    
                    // Try different key combinations
                    const keyCombinations = [
                        {
                            name: 'Date + ItemType',
                            key: {
                                Date: { S: entryDate },
                                ItemType: { S: deleteEntry.itemType }
                            }
                        },
                        {
                            name: 'Date + VariationName',
                            key: {
                                Date: { S: entryDate },
                                VariationName: { S: deleteEntry.variationName }
                            }
                        },
                        {
                            name: 'ItemType + VariationName',
                            key: {
                                ItemType: { S: deleteEntry.itemType },
                                VariationName: { S: deleteEntry.variationName }
                            }
                        },
                        {
                            name: 'StockType_VariationName_Timestamp only',
                            key: {
                                StockType_VariationName_Timestamp: { S: stockTypeKey }
                            }
                        }
                    ];
                    
                    for (const combo of keyCombinations) {
                        try {
                            console.log(`Trying key combination: ${combo.name}`);
                            const altDeleteCommand = new DeleteItemCommand({
                                TableName: "Stock_Entries",
                                Key: combo.key
                            });
                            await client.send(altDeleteCommand);
                            console.log(`Successfully deleted using ${combo.name}`);
                            return; // Success, exit the function
                        } catch (altError) {
                            console.log(`Failed with ${combo.name}:`, altError.message);
                            continue;
                        }
                    }
                    
                    throw new Error('All key combinations failed. Please check the table schema.');
                }
                
                throw new Error(`Failed to delete from Stock_Entries: ${deleteError.message}`);
            }
            
            // 2. Subtract quantity from main stock table
            const tableName = deleteEntry.isWholesale ? "Wholesale_Stock" : "Retail_Stock";
            const mainItemType = deleteEntry.itemType || deleteEntry.ItemType;
            const mainVariationName = deleteEntry.variationName || deleteEntry.VariationName;
            
            console.log('Attempting to deduct from main stock:', {
                tableName,
                mainItemType,
                mainVariationName,
                quantityToDeduct: stockTransactionDetails.quantityRemoved,
                isWholesale: deleteEntry.isWholesale
            });
            
            if (!mainItemType || !mainVariationName) {
                setError("Failed to delete entry. Main stock key is missing.");
                setIsDeleting(false);
                return;
            }
            
            try {
                await deductFromMainStock({
                    tableName,
                    itemType: mainItemType,
                    variationName: mainVariationName,
                    quantityToDeduct: stockTransactionDetails.quantityRemoved,
                    token
                });
                console.log('Successfully deducted from main stock table');
            } catch (deductError) {
                console.error('Error deducting from main stock:', deductError);
                throw new Error(`Failed to deduct from main stock: ${deductError.message}`);
            }
            
                                     // --- Update Capital Management After Stock Deletion ---
            try {
                const { updateAfterStockDeletion } = await import("../utils/capitalManagementService");
                
                console.log('Calling updateAfterStockDeletion with:', {
                    stockValueRemoved: stockTransactionDetails.stockValueRemoved,
                    isLastEntry: stockTransactionDetails.isLastEntry,
                    deletedEntryData: deleteEntry
                });
                
                // Pass the stock transaction details and deleted entry data for proper capital management update
                await updateAfterStockDeletion(token, stockTransactionDetails.stockValueRemoved, stockTransactionDetails.isLastEntry, deleteEntry);
                
                console.log('Capital management update completed successfully');
            } catch (capitalError) {
                console.error("Error updating capital management:", capitalError);
            }
            
            setDeleteEntry(null);
            
            // Refresh the current page
            await loadEntries(currentPage, currentPage === 1 ? null : lastEvaluatedKey);
            
            if (onRefresh) await onRefresh();
            
        } catch (err) {
            console.error("Error in handleDeleteConfirm:", err);
            setError("Failed to delete entry: " + (err.message || "Unknown error occurred"));
        } finally {
            setIsDeleting(false);
        }
    };

    const renderPagination = () => {
        if (totalScanned <= itemsPerPage && !hasMore) return null;
        
        return (
            <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-700">
                    <span>
                        Showing page {currentPage} ({filteredEntries.length} items)
                        {totalScanned && ` • Total scanned: ${totalScanned}`}
                    </span>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || loading}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Previous
                    </button>
                    
                    <span className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded">
                        {currentPage}
                    </span>
                    
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!hasMore || loading}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                    
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Loading..." : "Refresh"}
                    </button>
                </div>
            </div>
        );
    };

    const isLoading = loading || parentLoading;

    return (
        <div className="mt-10 bg-white rounded-lg shadow-sm border border-gray-200">
            {isLoading ? (
                <div className="flex justify-center items-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading stock entries...</span>
                </div>
            ) : (
                <>
                    <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex gap-2 items-center">
                                <label className="text-sm text-gray-600">Filter by Date:</label>
                                <input
                                    type="date"
                                    value={filterDate}
                                    onChange={e => setFilterDate(e.target.value)}
                                    className="border rounded px-2 py-1 text-sm"
                                />
                            </div>
                            <div className="flex gap-2 items-center">
                                <label className="text-sm text-gray-600">Filter by Item Type:</label>
                                <select
                                    value={filterItemType}
                                    onChange={e => setFilterItemType(e.target.value)}
                                    className="border rounded px-2 py-1 text-sm"
                                >
                                    <option value="">All</option>
                                    {itemTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-2 items-center">
                                <label className="text-sm text-gray-600">Search:</label>
                                <input
                                    type="text"
                                    placeholder="Search by chalan number or series start..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="border rounded px-2 py-1 text-sm w-64"
                                />
                            </div>
                        </div>
                        <div className="flex gap-1 items-center">
                            <button
                                onClick={handleExportData}
                                disabled={filteredEntries.length === 0}
                                className="px-1.5 py-1 rounded border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                <svg className="w-2.5 h-2.5 mr-0.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Export
                            </button>
                            <button
                                onClick={handleRefresh}
                                disabled={loading}
                                className="px-1.5 py-1 rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                <svg className="w-2.5 h-2.5 mr-0.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </button>
                        </div>
                    </div>
                    
                    {/* Desktop Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <span>Date & Time</span>
                                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <span>Item Type</span>
                                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <span>Variation</span>
                                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <span>Stock Type</span>
                                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <span>Quantity (Pcs)</span>
                                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <span>Quantity (Packets)</span>
                                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <span>Unit Price</span>
                                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <span>Series Start</span>
                                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <span>Series End</span>
                                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <span>Chalan Number</span>
                                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1">
                                            <span>Chalan Date</span>
                                            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredEntries.length > 0 ? (
                                    filteredEntries.map(entry => (
                                        <tr key={entry.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {entry.timestampDisplay}
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.itemType}</td>
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.variationName}</td>
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                    entry.stockType === 'Wholesale' 
                                                        ? 'bg-orange-100 text-orange-800' 
                                                        : 'bg-green-100 text-green-800'
                                                }`}>
                                                    {entry.stockType || '-'}
                                                </span>
                                            </td>
                                                                                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                                  {entry.quantityPcs || '-'}
                                                </span>
                                              </td>
                                              <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                                  {entry.quantityPackets || '-'}
                                                </span>
                                              </td>
                                                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        BDT {entry.unitPrice.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        BDT {entry.totalValue.toFixed(2)}
                      </span>
                    </td>
                                            
                                            {/* Series Start Number */}
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {editingEntry?.id === entry.id ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.seriesStartNumber}
                                                        onChange={(e) => setEditForm({...editForm, seriesStartNumber: e.target.value})}
                                                        className="w-24 px-2 py-1 border rounded text-sm"
                                                        placeholder="Start"
                                                        onKeyDown={handleKeyDown}
                                                    />
                                                ) : (
                                                    <span 
                                                        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                                                        onClick={() => handleEditClick(entry)}
                                                    >
                                                        {entry.seriesStartNumber || '-'}
                                                    </span>
                                                )}
                                            </td>
                                            
                                            {/* Series End Number */}
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {editingEntry?.id === entry.id ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.seriesEndNumber}
                                                        onChange={(e) => setEditForm({...editForm, seriesEndNumber: e.target.value})}
                                                        className="w-24 px-2 py-1 border rounded text-sm"
                                                        placeholder="End"
                                                        onKeyDown={handleKeyDown}
                                                    />
                                                ) : (
                                                    <span 
                                                        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                                                        onClick={() => handleEditClick(entry)}
                                                    >
                                                        {entry.seriesEndNumber || '-'}
                                                    </span>
                                                )}
                                            </td>
                                            
                                            {/* Chalan Number */}
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {editingEntry?.id === entry.id ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.chalanNumber}
                                                        onChange={(e) => setEditForm({...editForm, chalanNumber: e.target.value})}
                                                        className="w-24 px-2 py-1 border rounded text-sm"
                                                        placeholder="Chalan #"
                                                        onKeyDown={handleKeyDown}
                                                    />
                                                ) : (
                                                    <span 
                                                        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                                                        onClick={() => handleEditClick(entry)}
                                                    >
                                                        {entry.chalanNumber || '-'}
                                                    </span>
                                                )}
                                            </td>
                                            
                                            {/* Chalan Date */}
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {editingEntry?.id === entry.id ? (
                                                    <input
                                                        type="date"
                                                        value={editForm.chalanDate}
                                                        onChange={(e) => setEditForm({...editForm, chalanDate: e.target.value})}
                                                        className="w-32 px-2 py-1 border rounded text-sm"
                                                        onKeyDown={handleKeyDown}
                                                    />
                                                ) : (
                                                    <span 
                                                        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                                                        onClick={() => handleEditClick(entry)}
                                                    >
                                                        {entry.chalanDate || '-'}
                                                    </span>
                                                )}
                                            </td>
                                            
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <div className="flex space-x-1">
                                                    {editingEntry?.id === entry.id ? (
                                                        <>
                                                            <button 
                                                                className="text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-green-50 disabled:opacity-50" 
                                                                title="Save" 
                                                                onClick={handleEditSave}
                                                                disabled={isSaving}
                                                            >
                                                                {isSaving ? "Saving..." : "✓"}
                                                            </button>
                                                            <button 
                                                                className="text-gray-600 hover:text-gray-900 p-1 rounded-full hover:bg-gray-50" 
                                                                title="Cancel" 
                                                                onClick={handleEditCancel}
                                                                disabled={isSaving}
                                                            >
                                                                ✕
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {isAdmin ? (
                                                                <>
                                                                    <button 
                                                                        className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50" 
                                                                        title="Edit" 
                                                                        onClick={() => handleEditClick(entry)}
                                                                        disabled={isDeleting}
                                                                    >
                                                                        ✎
                                                                    </button>
                                                <button 
                                                    className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 disabled:opacity-50" 
                                                    title="Delete" 
                                                    onClick={() => handleDeleteClick(entry)}
                                                    disabled={isDeleting}
                                                >
                                                                        {isDeleting && deleteEntry?.id === entry.id ? "Deleting..." : "🗑"}
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <button 
                                                                    className="text-gray-400 p-1 rounded-full cursor-not-allowed" 
                                                                    title="Admin only" 
                                                                    disabled
                                                                >
                                                                    👁
                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="12" className="px-6 py-12 text-center text-gray-500">
                                            {filterDate || filterItemType ? "No stock entries found matching the filters." : "No stock entries found."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-4">
                        {filteredEntries.length > 0 ? (
                            filteredEntries.map(entry => (
                                <div key={entry.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                                    {/* Header with Date & Actions */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm text-gray-500">
                                            {entry.timestampDisplay}
                                        </div>
                                        <div className="flex space-x-1">
                                            {editingEntry?.id === entry.id ? (
                                                <>
                                                    <button 
                                                        className="text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-green-50 disabled:opacity-50" 
                                                        title="Save" 
                                                        onClick={handleEditSave}
                                                        disabled={isSaving}
                                                    >
                                                        {isSaving ? "Saving..." : "✓"}
                                                    </button>
                                                    <button 
                                                        className="text-gray-600 hover:text-gray-900 p-1 rounded-full hover:bg-gray-50" 
                                                        title="Cancel" 
                                                        onClick={handleEditCancel}
                                                        disabled={isSaving}
                                                    >
                                                        ✕
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {isAdmin ? (
                                                        <>
                                                            <button 
                                                                className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50" 
                                                                title="Edit" 
                                                                onClick={() => handleEditClick(entry)}
                                                                disabled={isDeleting}
                                                            >
                                                                ✎
                                                            </button>
                                                            <button 
                                                                className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 disabled:opacity-50" 
                                                                title="Delete" 
                                                                onClick={() => handleDeleteClick(entry)}
                                                                disabled={isDeleting}
                                                            >
                                                                {isDeleting && deleteEntry?.id === entry.id ? "Deleting..." : "🗑"}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button 
                                                            className="text-gray-400 p-1 rounded-full cursor-not-allowed" 
                                                            title="Admin only" 
                                                            disabled
                                                        >
                                                            👁
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Main Content */}
                                    <div className="space-y-2">
                                        {/* Item Type & Variation */}
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium text-gray-900">{entry.itemType}</div>
                                                <div className="text-sm text-gray-600">{entry.variationName}</div>
                                            </div>
                                            <div>
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                    entry.stockType === 'Wholesale' 
                                                        ? 'bg-orange-100 text-orange-800' 
                                                        : 'bg-green-100 text-green-800'
                                                }`}>
                                                    {entry.stockType || '-'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Quantities */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <span className="text-xs text-gray-500">Quantity (Pcs)</span>
                                                <div className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                                    {entry.quantityPcs || '-'}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-500">Quantity (Packets)</span>
                                                <div className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                                    {entry.quantityPackets || '-'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Pricing */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <span className="text-xs text-gray-500">Unit Price</span>
                                                <div className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                    BDT {entry.unitPrice.toFixed(2)}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-500">Total Value</span>
                                                <div className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                                    BDT {entry.totalValue.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Editable Fields */}
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                                            {/* Series Start */}
                                            <div>
                                                <span className="text-xs text-gray-500">Series Start</span>
                                                {editingEntry?.id === entry.id ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.seriesStartNumber}
                                                        onChange={(e) => setEditForm({...editForm, seriesStartNumber: e.target.value})}
                                                        className="w-full mt-1 px-2 py-1 border rounded text-sm"
                                                        placeholder="Start"
                                                        onKeyDown={handleKeyDown}
                                                    />
                                                ) : (
                                                    <div 
                                                        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-sm mt-1"
                                                        onClick={() => handleEditClick(entry)}
                                                    >
                                                        {entry.seriesStartNumber || '-'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Series End */}
                                            <div>
                                                <span className="text-xs text-gray-500">Series End</span>
                                                {editingEntry?.id === entry.id ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.seriesEndNumber}
                                                        onChange={(e) => setEditForm({...editForm, seriesEndNumber: e.target.value})}
                                                        className="w-full mt-1 px-2 py-1 border rounded text-sm"
                                                        placeholder="End"
                                                        onKeyDown={handleKeyDown}
                                                    />
                                                ) : (
                                                    <div 
                                                        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-sm mt-1"
                                                        onClick={() => handleEditClick(entry)}
                                                    >
                                                        {entry.seriesEndNumber || '-'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Chalan Number */}
                                            <div>
                                                <span className="text-xs text-gray-500">Chalan Number</span>
                                                {editingEntry?.id === entry.id ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.chalanNumber}
                                                        onChange={(e) => setEditForm({...editForm, chalanNumber: e.target.value})}
                                                        className="w-full mt-1 px-2 py-1 border rounded text-sm"
                                                        placeholder="Chalan #"
                                                        onKeyDown={handleKeyDown}
                                                    />
                                                ) : (
                                                    <div 
                                                        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-sm mt-1"
                                                        onClick={() => handleEditClick(entry)}
                                                    >
                                                        {entry.chalanNumber || '-'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Chalan Date */}
                                            <div>
                                                <span className="text-xs text-gray-500">Chalan Date</span>
                                                {editingEntry?.id === entry.id ? (
                                                    <input
                                                        type="date"
                                                        value={editForm.chalanDate}
                                                        onChange={(e) => setEditForm({...editForm, chalanDate: e.target.value})}
                                                        className="w-full mt-1 px-2 py-1 border rounded text-sm"
                                                        onKeyDown={handleKeyDown}
                                                    />
                                                ) : (
                                                    <div 
                                                        className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-sm mt-1"
                                                        onClick={() => handleEditClick(entry)}
                                                    >
                                                        {entry.chalanDate || '-'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                {filterDate || filterItemType ? "No stock entries found matching the filters." : "No stock entries found."}
                            </div>
                        )}
                    </div>
                    
                    {/* Pagination */}
                    {renderPagination()}
                    
                    {/* Delete Confirm Modal */}
                    <DeleteConfirmModal
                        isOpen={!!deleteEntry}
                        onClose={() => {
                            console.log('Delete modal closed');
                            setDeleteEntry(null);
                        }}
                        onConfirm={() => {
                            console.log('Delete confirmed for entry:', deleteEntry);
                            handleDeleteConfirm();
                        }}
                        isLoading={isDeleting}
                    />
                    
                    {error && (
                        <div className="p-4 text-red-600 text-sm bg-red-50 border-t border-red-200">
                            {error}
                        </div>
                    )}
                </>
            )}
        </div>
    );
});

export default AllStockEntriesTable;