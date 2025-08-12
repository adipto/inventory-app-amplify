// src/components/AddStockModal.jsx
import React, { useState, Fragment, useEffect } from "react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { X, Check, RefreshCw } from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import { createDynamoDBClient } from "../aws/aws-config";
import { PutItemCommand, GetItemCommand, UpdateItemCommand, DeleteItemCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { getStockItem } from "../utils/stockService";

function AddStockModal({ isOpen, onClose, onStockAdded, editItem }) {
    const [itemType, setItemType] = useState("Non-judicial stamp");
    const [variation, setVariation] = useState("");
    const [customVariation, setCustomVariation] = useState("");
    const [stockType, setStockType] = useState("Wholesale");
    const [quantity, setQuantity] = useState("");
    const [lowStockThreshold, setLowStockThreshold] = useState("10");
    const [isLoading, setIsLoading] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [originalItem, setOriginalItem] = useState(null);
    const [date, setDate] = useState(() => {
        // Default to today's date in YYYY-MM-DD format
        const today = new Date();
        return today.toISOString().split('T')[0];
    });
    const [time, setTime] = useState(() => {
        // Default to current time in HH:MM format
        const now = new Date();
        return now.toTimeString().slice(0, 5);
    });
    const [predefinedVariations, setPredefinedVariations] = useState({
        "Non-judicial stamp": [],
        "Cartridge Paper": [],
        "Folio Paper": []
    });
    const [isLoadingVariations, setIsLoadingVariations] = useState(false);

    const isCustomVariation = variation === "__custom__";

    // Helper function to get auth token using AWS Amplify
    const getAuthToken = async () => {
        try {
            const session = await fetchAuthSession();
            const idToken = session.tokens?.idToken?.toString();
            const accessToken = session.tokens?.accessToken?.toString();

            if (!idToken && !accessToken) {
                throw new Error("No valid authentication token found. Please log in again.");
            }

            return idToken || accessToken;
        } catch (error) {
            console.error("Error fetching auth session:", error);
            throw new Error("Authentication failed. Please log in again.");
        }
    };

    // Fetch all available variations from stock tables
    const fetchAvailableVariations = async () => {
        try {
            setIsLoadingVariations(true);
            const idToken = await getAuthToken();
            const dynamoClient = createDynamoDBClient(idToken);

            // Fetch from both retail and wholesale tables
            const [retailResponse, wholesaleResponse] = await Promise.all([
                dynamoClient.send(new ScanCommand({ TableName: "Retail_Stock" })),
                dynamoClient.send(new ScanCommand({ TableName: "Wholesale_Stock" }))
            ]);

            // Process retail items
            const retailItems = retailResponse.Items.map(item => unmarshall(item));
            const wholesaleItems = wholesaleResponse.Items.map(item => unmarshall(item));

            // Group variations by item type and stock type
            const variationsByType = {
                "Non-judicial stamp": { retail: [], wholesale: [] },
                "Cartridge Paper": { retail: [], wholesale: [] },
                "Folio Paper": { retail: [], wholesale: [] }
            };

            // Process retail items
            retailItems.forEach(item => {
                const itemType = item.ItemType;
                const variationName = item.VariationName;
                
                if (itemType && variationName && variationsByType[itemType]) {
                    if (!variationsByType[itemType].retail.includes(variationName)) {
                        variationsByType[itemType].retail.push(variationName);
                    }
                }
            });

            // Process wholesale items
            wholesaleItems.forEach(item => {
                const itemType = item.ItemType;
                const variationName = item.VariationName;
                
                if (itemType && variationName && variationsByType[itemType]) {
                    if (!variationsByType[itemType].wholesale.includes(variationName)) {
                        variationsByType[itemType].wholesale.push(variationName);
                    }
                }
            });

            // Sort variations alphabetically for each type and stock type
            Object.keys(variationsByType).forEach(type => {
                variationsByType[type].retail.sort();
                variationsByType[type].wholesale.sort();
            });

            setPredefinedVariations(variationsByType);
        } catch (error) {
            console.error("Error fetching available variations:", error);
            // Keep the default empty arrays if fetch fails
        } finally {
            setIsLoadingVariations(false);
        }
    };

    // Load variations when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchAvailableVariations();
        }
    }, [isOpen]);

    // Reset variation when stock type changes
    useEffect(() => {
        setVariation("");
    }, [stockType]);

    // Reset fields when modal closes or when switching between add/edit modes
    useEffect(() => {
        if (!isOpen) {
            // Reset form when modal closes
            resetFields();
            return;
        }

        // Handle edit mode
        if (editItem) {
            setIsEdit(true);
            setOriginalItem(editItem);
            setItemType(editItem.itemType || "Non-judicial stamp");
            setVariation(editItem.variation || "");
            setStockType(editItem.stockType || "Retail");
            setQuantity(editItem.quantity?.toString() || "");
            setLowStockThreshold(editItem.lowStockThreshold?.toString() || "10");
            setDate(editItem.date || new Date().toISOString().split('T')[0]);
            setTime(editItem.time || new Date().toTimeString().slice(0, 5));

            // Handle custom variation if needed
            if (
                editItem.variation &&
                !predefinedVariations[editItem.itemType]?.includes(editItem.variation)
            ) {
                setVariation("__custom__");
                setCustomVariation(editItem.variation);
            }
        } else {
            setIsEdit(false);
            setOriginalItem(null);
            resetFields();
        }
    }, [isOpen, editItem]);

    const resetFields = () => {
        setItemType("Non-judicial stamp");
        setVariation("");
        setCustomVariation("");
        setStockType("Wholesale");
        setQuantity("");
        setLowStockThreshold("10");
        setIsEdit(false);
        setOriginalItem(null);
        const today = new Date();
        setDate(today.toISOString().split('T')[0]);
        setTime(today.toTimeString().slice(0, 5));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Get auth token using AWS Amplify
            const idToken = await getAuthToken();
            const dynamoClient = createDynamoDBClient(idToken);

            const finalVariation = isCustomVariation ? customVariation : variation;
            const tableName = stockType === "Retail" ? "Retail_Stock" : "Wholesale_Stock";
            const quantityField = stockType === "Retail" ? "Quantity_pcs" : "Quantity_packets";

            // Extract unit price from variation name (same logic as before)
            let unitPrice = 0;
            if (finalVariation.includes("-")) {
                const pricePart = finalVariation.split("-")[1];
                if (!isNaN(pricePart)) {
                    unitPrice = Number(pricePart);
                }
            } else if (finalVariation.includes("_")) {
                const pricePart = finalVariation.split("_")[1];
                if (!isNaN(pricePart)) {
                    unitPrice = Number(pricePart);
                }
            }

            // --- Insert into Stock_Entries if this is a new item (not edit) ---
            if (!isEdit) {
                // Create a proper datetime from date and time inputs
                const dateTimeString = `${date}T${time}:00.000Z`;
                const timestamp = new Date(dateTimeString).getTime(); // Unix timestamp in milliseconds
                
                const stockTypeKey = `${stockType}#${finalVariation}#${timestamp}`;
                const stockEntryItem = {
                    Date: { S: date },
                    StockType_VariationName_Timestamp: { S: stockTypeKey },
                    ItemType: { S: itemType },
                    VariationName: { S: finalVariation },
                    StockType: { S: stockType },
                    UnitPrice: { N: unitPrice.toString() },
                    Timestamp: { N: timestamp.toString() }, // Single timestamp field
                    GSI_PK: { S: "STOCK_ENTRIES" } // Partition key for GSI
                };
                
                if (stockType === "Wholesale") {
                    stockEntryItem.Quantity_Packets = { N: Number(quantity).toString() };
                } else {
                    stockEntryItem.Quantity_Pcs = { N: Number(quantity).toString() };
                }
                
                // Insert into Stock_Entries table
                const stockEntriesCommand = new PutItemCommand({
                    TableName: "Stock_Entries",
                    Item: stockEntryItem
                });
                await dynamoClient.send(stockEntriesCommand);
            }
            // --- End insert into Stock_Entries ---

            if (isEdit && originalItem) {
                // Get the current item to update
                const currentItem = await getStockItem(
                    tableName,
                    originalItem.itemType,
                    originalItem.variation,
                    idToken
                );

                if (currentItem) {
                    // If we're changing the item type or variation name, we need to delete old and create new
                    if (
                        originalItem.itemType !== itemType ||
                        originalItem.variation !== finalVariation ||
                        originalItem.stockType !== stockType
                    ) {
                        // Determine the correct table for the original item
                        const originalTableName = originalItem.stockType === "Retail" ? "Retail_Stock" : "Wholesale_Stock";

                        // Delete the old item
                        const deleteCommand = new DeleteItemCommand({
                            TableName: originalTableName,
                            Key: {
                                ItemType: { S: originalItem.itemType },
                                VariationName: { S: originalItem.variation }
                            }
                        });
                        await dynamoClient.send(deleteCommand);

                        // Create a new item
                        await createOrUpdateItem(
                            dynamoClient,
                            tableName,
                            itemType,
                            finalVariation,
                            Number(quantity),
                            Number(lowStockThreshold),
                            quantityField,
                            false
                        );

                        alert("Stock item updated successfully (recreated with new key)");
                    } else {
                        // Just update the existing item
                        await createOrUpdateItem(
                            dynamoClient,
                            tableName,
                            itemType,
                            finalVariation,
                            Number(quantity),
                            Number(lowStockThreshold),
                            quantityField,
                            true
                        );

                        alert("Stock item updated successfully");
                    }
                } else {
                    alert("Original item not found. Creating new item instead.");
                    await createOrUpdateItem(
                        dynamoClient,
                        tableName,
                        itemType,
                        finalVariation,
                        Number(quantity),
                        Number(lowStockThreshold),
                        quantityField,
                        false
                    );
                }
            } else {
                // For new items, simply create or update
                await createOrUpdateItem(
                    dynamoClient,
                    tableName,
                    itemType,
                    finalVariation,
                    Number(quantity),
                    Number(lowStockThreshold),
                    quantityField,
                    false
                );

                alert("Stock item added successfully");
            }

            // --- Update Capital Management After Stock Addition ---
            try {
                const { updateAfterStockAddition } = await import("../utils/capitalManagementService");
                await updateAfterStockAddition(idToken);
            } catch (capitalError) {
                console.error("Error updating capital management:", capitalError);
                // Don't throw error here as stock was added successfully
            }
            // --- End Capital Management Update ---

            // Call onStockAdded callback to refresh data
            if (onStockAdded) {
                await onStockAdded();
            }
            
            // Refresh variations after adding stock
            await fetchAvailableVariations();
            
            onClose();
        } catch (err) {
            console.error("Error managing stock:", err);

            // Handle authentication errors specifically
            if (err.message.includes("authentication") || err.message.includes("token")) {
                alert("Authentication error. Please log in again.");
                // Optionally redirect to login
                window.location.href = "/";
            } else {
                alert(err.message || "Error saving item. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Helper function to create or update an item
    const createOrUpdateItem = async (
        client,
        tableName,
        itemType,
        variationName,
        quantity,
        lowStockThreshold,
        quantityField,
        isUpdate
    ) => {
        // First, check if the item already exists (for new items)
        if (!isUpdate) {
            const getItemParams = {
                TableName: tableName,
                Key: {
                    ItemType: { S: itemType },
                    VariationName: { S: variationName }
                }
            };

            try {
                const existingItem = await client.send(new GetItemCommand(getItemParams));

                if (existingItem.Item) {
                    // Item exists, update the quantity
                    const currentQuantity = Number(existingItem.Item[quantityField]?.N || 0);
                    const newQuantity = isEdit ? quantity : currentQuantity + quantity;

                    const updateCommand = new UpdateItemCommand({
                        TableName: tableName,
                        Key: {
                            ItemType: { S: itemType },
                            VariationName: { S: variationName }
                        },
                        UpdateExpression: `SET ${quantityField} = :q, LowStockThreshold = :lst`,
                        ExpressionAttributeValues: {
                            ":q": { N: newQuantity.toString() },
                            ":lst": { N: lowStockThreshold.toString() }
                        }
                    });

                    await client.send(updateCommand);
                    return;
                }
            } catch (error) {
                console.error("Error checking existing item:", error);
                // Continue to create new item if check fails
            }
        }

        // For new items or forced updates
        const item = {
            ItemType: { S: itemType },
            VariationName: { S: variationName },
            [quantityField]: { N: quantity.toString() },
            LowStockThreshold: { N: lowStockThreshold.toString() },
            Date: { S: date } // Add the date field
        };

        // Extract unit price from variation name (assuming the pattern)
        let unitPrice = 0;
        if (variationName.includes("-")) {
            // For patterns like "50-46" where 46 is the price
            const pricePart = variationName.split("-")[1];
            if (!isNaN(pricePart)) {
                unitPrice = Number(pricePart);
            }
        } else if (variationName.includes("_")) {
            // For patterns like "Folio_6" where 6 is the price
            const pricePart = variationName.split("_")[1];
            if (!isNaN(pricePart)) {
                unitPrice = Number(pricePart);
            }
        }

        if (unitPrice > 0) {
            item.UnitPrice = { N: unitPrice.toString() };
        }

        const command = new PutItemCommand({
            TableName: tableName,
            Item: item
        });

        await client.send(command);
    };

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
                    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm transition-opacity" />
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
                            <DialogPanel className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                                <div className="flex items-center justify-between mb-4">
                                    <DialogTitle className="text-xl font-semibold text-gray-800">
                                        {isEdit ? "Edit Stock Item" : "Add Stock Item"}
                                    </DialogTitle>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={fetchAvailableVariations}
                                            disabled={isLoadingVariations}
                                            className="p-1 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
                                            title="Refresh variations"
                                        >
                                            <RefreshCw size={16} className={`${isLoadingVariations ? 'animate-spin' : ''}`} />
                                        </button>
                                        <button
                                            onClick={onClose}
                                            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                                            disabled={isLoading}
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>

                                <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                                    {/* Date and Time Row */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                            <input
                                                type="date"
                                                value={date}
                                                onChange={(e) => setDate(e.target.value)}
                                                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                required
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                                            <input
                                                type="time"
                                                value={time}
                                                onChange={(e) => setTime(e.target.value)}
                                                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                required
                                                disabled={isLoading}
                                            />
                                        </div>
                                    </div>

                                    {/* Item Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
                                        <select
                                            value={itemType}
                                            onChange={(e) => {
                                                setItemType(e.target.value);
                                                setVariation("");
                                            }}
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            disabled={isLoading}
                                        >
                                            {Object.keys(predefinedVariations).map((type) => (
                                                <option key={type} value={type}>
                                                    {type}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Variation Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Variation Name</label>
                                        <select
                                            value={variation}
                                            onChange={(e) => setVariation(e.target.value)}
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            disabled={isLoading || isLoadingVariations}
                                        >
                                            <option value="">
                                                {isLoadingVariations ? "Loading variations..." : "Select a variation"}
                                            </option>
                                                                                         {!isLoadingVariations && predefinedVariations[itemType]?.[stockType.toLowerCase()]?.map((v) => (
                                                 <option key={v} value={v}>
                                                     {v}
                                                 </option>
                                             ))}
                                            <option value="__custom__">Add a new variation manually...</option>
                                        </select>
                                        {isLoadingVariations && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Loading available variations from your stock...
                                            </p>
                                        )}
                                                                                 {!isLoadingVariations && predefinedVariations[itemType]?.[stockType.toLowerCase()]?.length === 0 && (
                                             <p className="text-xs text-gray-500 mt-1">
                                                 No {stockType.toLowerCase()} variations found for this item type. You can add a custom variation.
                                             </p>
                                         )}
                                    </div>

                                    {/* Manual Variation Input */}
                                    {isCustomVariation && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Custom Variation</label>
                                            <input
                                                type="text"
                                                placeholder="Enter custom variation"
                                                value={customVariation}
                                                onChange={(e) => setCustomVariation(e.target.value)}
                                                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                required
                                                disabled={isLoading}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                For price extraction, use format "value-price" (e.g., "100-90") or "name_price" (e.g., "Folio_6")
                                            </p>
                                        </div>
                                    )}

                                    {/* Stock Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Stock Type</label>
                                        <select
                                            value={stockType}
                                            onChange={(e) => setStockType(e.target.value)}
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            disabled={isLoading}
                                        >
                                            <option value="Retail">Retail</option>
                                            <option value="Wholesale">Wholesale</option>
                                        </select>
                                    </div>

                                    {/* Quantity */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {stockType === "Retail" ? "Quantity (pcs)" : "Quantity (packets)"}
                                        </label>
                                        <input
                                            type="number"
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            placeholder={isEdit ? "Enter new quantity" : "Enter quantity to add"}
                                            required
                                            min="1"
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            disabled={isLoading}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            {isEdit
                                                ? "Enter the total quantity you want to set (not the amount to add)"
                                                : "For existing items, this quantity will be added to the current stock."}
                                        </p>
                                    </div>

                                    {/* Low Stock Threshold */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Low Stock Threshold
                                        </label>
                                        <input
                                            type="number"
                                            value={lowStockThreshold}
                                            onChange={(e) => setLowStockThreshold(e.target.value)}
                                            placeholder="Enter low stock threshold"
                                            required
                                            min="1"
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            disabled={isLoading}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Items below this quantity will be marked as low stock
                                        </p>
                                    </div>

                                    {/* Submit */}
                                    <button
                                        type="submit"
                                        className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <span>Processing...</span>
                                        ) : (
                                            <>
                                                <Check size={16} className="inline mr-1" />
                                                {isEdit ? "Update Item" : "Add Item"}
                                            </>
                                        )}
                                    </button>
                                </form>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

export default AddStockModal;