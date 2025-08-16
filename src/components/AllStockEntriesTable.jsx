import React, { useState, useEffect } from "react";
import { deleteStockItem, updateMainStock, fetchStockEntries, deductFromMainStock } from "../utils/stockService";
import { fetchAuthSession } from "aws-amplify/auth";
import DeleteConfirmModal from "../utils/DeleteConfirmModal";

function AllStockEntriesTable({ onRefresh, loading: parentLoading }) {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterDate, setFilterDate] = useState("");
    const [filterItemType, setFilterItemType] = useState("");
    const [deleteEntry, setDeleteEntry] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState("");
    
    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [lastEvaluatedKey, setLastEvaluatedKey] = useState(null);
    const [totalScanned, setTotalScanned] = useState(0);
    const itemsPerPage = 10;

    // Load entries on component mount and when page changes
    useEffect(() => {
        loadEntries(1, null, true); // Reset to first page
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
        const matchesDate = filterDate ? entry.date === filterDate : true;
        const matchesType = filterItemType ? entry.itemType === filterItemType : true;
        return matchesDate && matchesType;
    });

    const itemTypes = Array.from(new Set(entries.map(e => e.itemType)));

    const handleDeleteClick = (entry) => {
        setDeleteEntry(entry);
        setError("");
    };

    const handleDeleteConfirm = async () => {
        if (!deleteEntry) return;
        setIsDeleting(true);
        setError("");
        try {
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString() || session.tokens?.accessToken?.toString();
            
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
            const entryDate = deleteEntry.date || deleteEntry.Date;
            const entrySortKey = deleteEntry.StockType_VariationName_Timestamp;
            
            if (!entrySortKey) {
                setError("Failed to delete entry. Sort key is missing.");
                setIsDeleting(false);
                return;
            }
            
            await deleteStockItem("Stock_Entries", entryDate, entrySortKey, token);
            
            // 2. Subtract quantity from main stock table
            const tableName = deleteEntry.isWholesale ? "Wholesale_Stock" : "Retail_Stock";
            const mainItemType = deleteEntry.itemType || deleteEntry.ItemType;
            const mainVariationName = deleteEntry.variationName || deleteEntry.VariationName;
            
            if (!mainItemType || !mainVariationName) {
                setError("Failed to delete entry. Main stock key is missing.");
                setIsDeleting(false);
                return;
            }
            
            await deductFromMainStock({
                tableName,
                itemType: mainItemType,
                variationName: mainVariationName,
                quantityToDeduct: stockTransactionDetails.quantityRemoved,
                token
            });
            
                         // --- Update Capital Management After Stock Deletion ---
             try {
                 const { updateAfterStockDeletion } = await import("../utils/capitalManagementService");
                 
                 console.log('Calling updateAfterStockDeletion with:', {
                     stockValueRemoved: stockTransactionDetails.stockValueRemoved,
                     isLastEntry: stockTransactionDetails.isLastEntry
                 });
                 
                 // Pass the stock transaction details for proper capital management update
                 await updateAfterStockDeletion(token, stockTransactionDetails.stockValueRemoved, stockTransactionDetails.isLastEntry);
                 
                 console.log('Capital management update completed successfully');
             } catch (capitalError) {
                 console.error("Error updating capital management:", capitalError);
             }
            
            setDeleteEntry(null);
            
            // Refresh the current page
            await loadEntries(currentPage, currentPage === 1 ? null : lastEvaluatedKey);
            
            if (onRefresh) await onRefresh();
            
        } catch (err) {
            setError("Failed to delete entry. " + (err.message || ""));
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
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Type</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variation</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity (Pcs)</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity (Packets)</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredEntries.length > 0 ? (
                                    filteredEntries.map(entry => (
                                        <tr key={entry.id} className="hover:bg-gray-50">
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.date}</td>
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.itemType}</td>
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.variationName}</td>
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.quantityPcs || '-'}</td>
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.quantityPackets || '-'}</td>
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">TK {entry.unitPrice.toFixed(2)}</td>
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">TK {entry.totalValue.toFixed(2)}</td>
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {entry.timestampDisplay}
                                            </td>
                                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <button 
                                                    className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 disabled:opacity-50" 
                                                    title="Delete" 
                                                    onClick={() => handleDeleteClick(entry)}
                                                    disabled={isDeleting}
                                                >
                                                    {isDeleting && deleteEntry?.id === entry.id ? "Deleting..." : "Delete"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                                            {filterDate || filterItemType ? "No stock entries found matching the filters." : "No stock entries found."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination */}
                    {renderPagination()}
                    
                    {/* Delete Confirm Modal */}
                    <DeleteConfirmModal
                        isOpen={!!deleteEntry}
                        onClose={() => setDeleteEntry(null)}
                        onConfirm={handleDeleteConfirm}
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
}

export default AllStockEntriesTable;