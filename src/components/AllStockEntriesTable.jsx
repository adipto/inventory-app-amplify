import React, { useState } from "react";
import { deleteStockItem, updateMainStock, fetchStockEntries, deductFromMainStock } from "../utils/stockService";
import { fetchAuthSession } from "aws-amplify/auth";
import DeleteConfirmModal from "../utils/DeleteConfirmModal";

function AllStockEntriesTable({ entries, onRefresh, loading }) {
    const [filterDate, setFilterDate] = useState("");
    const [filterItemType, setFilterItemType] = useState("");
    const [deleteEntry, setDeleteEntry] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState("");

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
                quantityToDeduct: deleteEntry.quantityPcs || deleteEntry.quantityPackets || deleteEntry.quantity,
                token
            });
            setDeleteEntry(null);
            if (onRefresh) await onRefresh();
        } catch (err) {
            setError("Failed to delete entry. " + (err.message || ""));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="mt-10 bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
            {loading ? (
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
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.quantityPcs}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{entry.quantityPackets}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">${entry.unitPrice.toFixed(2)}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">${entry.totalValue.toFixed(2)}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <button className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50" title="Delete" onClick={() => handleDeleteClick(entry)}>
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="8" className="px-6 py-12 text-center text-gray-500">No stock entries found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
            {/* Delete Confirm Modal */}
            <DeleteConfirmModal
                isOpen={!!deleteEntry}
                onClose={() => setDeleteEntry(null)}
                onConfirm={handleDeleteConfirm}
            />
            {error && <div className="p-4 text-red-600 text-sm">{error}</div>}
            </>) /* end fragment for loading */}
        </div>
    );
}

export default AllStockEntriesTable; 