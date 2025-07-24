// src/utils/stockService.js
import { ScanCommand, DeleteItemCommand, GetItemCommand, UpdateItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { createDynamoDBClient } from "../aws/aws-config";

export const fetchStock = async (tableName, token) => {
    const client = await createDynamoDBClient(token);

    const command = new ScanCommand({
        TableName: tableName,
    });

    const response = await client.send(command);

    const quantityField = tableName === "Retail_Stock" ? "Quantity_pcs" : "Quantity_packets";
    const isRetail = tableName === "Retail_Stock";

    const stock = response.Items?.map((item) => {
        const quantity = Number(item[quantityField]?.N || 0);
        const unitPrice = Number(item.UnitPrice?.N || 0);

        // Calculate total value based on stock type
        const totalValue = isRetail
            ? unitPrice * quantity
            : unitPrice * quantity * 500; // For wholesale: 1 packet = 500 pcs

        return {
            id: `${item.ItemType?.S}-${item.VariationName?.S}`,
            itemType: item.ItemType?.S || "",
            variationName: item.VariationName?.S || "",
            quantity: quantity,
            unitPrice: unitPrice,
            totalValue: totalValue, // Add total value to each item
            lowStockThreshold: Number(item.LowStockThreshold?.N || 10),
        };
    }) || [];

    return stock;
};

export const deleteStockItem = async (tableName, arg1, arg2, arg3, arg4, arg5) => {
    let command;
    if (tableName === "Stock_Entries") {
        // (tableName, date, sortKey, token)
        const date = arg1;
        const sortKey = arg2;
        const token = arg3;
        const client = await createDynamoDBClient(token);
        const keyObj = {
            Date: { S: date },
            StockType_VariationName_Timestamp: { S: sortKey }
        };
        command = new DeleteItemCommand({
            TableName: tableName,
            Key: keyObj
        });
        return await client.send(command);
    } else {
        // (tableName, itemType, variationName, token)
        const itemType = arg1;
        const variationName = arg2;
        const token = arg3;
        const client = await createDynamoDBClient(token);
        command = new DeleteItemCommand({
            TableName: tableName,
            Key: {
                ItemType: { S: itemType },
                VariationName: { S: variationName }
            }
        });
        return await client.send(command);
    }
};

// Helper to deduct quantity from main stock table after deleting a stock entry
export const deductFromMainStock = async ({
    tableName,
    itemType,
    variationName,
    quantityToDeduct,
    token
}) => {
    const client = await createDynamoDBClient(token);
    const quantityField = tableName === "Retail_Stock" ? "Quantity_pcs" : "Quantity_packets";
    // Get current item
    const getCommand = new GetItemCommand({
        TableName: tableName,
        Key: {
            ItemType: { S: itemType },
            VariationName: { S: variationName }
        }
    });
    const response = await client.send(getCommand);
    if (!response.Item) {
        throw new Error(`[deductFromMainStock] Main stock item not found for ItemType='${itemType}', VariationName='${variationName}' in table '${tableName}'.`);
    }
    if (!response.Item[quantityField]) {
        throw new Error(`[deductFromMainStock] quantityField '${quantityField}' not found in item. Item: ${JSON.stringify(response.Item)}`);
    }
    const currentQuantity = Number(response.Item[quantityField]?.N || 0);
    const newQuantity = Math.max(0, currentQuantity - quantityToDeduct);
    const updateCommand = new UpdateItemCommand({
        TableName: tableName,
        Key: {
            ItemType: { S: itemType },
            VariationName: { S: variationName }
        },
        UpdateExpression: `SET ${quantityField} = :q` ,
        ExpressionAttributeValues: {
            ":q": { N: newQuantity.toString() }
        }
    });
    await client.send(updateCommand);
};

export const getStockItem = async (tableName, itemType, variationName, token) => {
    const client = await createDynamoDBClient(token);

    const command = new GetItemCommand({
        TableName: tableName,
        Key: {
            ItemType: { S: itemType },
            VariationName: { S: variationName }
        }
    });

    const response = await client.send(command);

    if (!response.Item) {
        return null;
    }

    const quantityField = tableName === "Retail_Stock" ? "Quantity_pcs" : "Quantity_packets";
    const quantity = Number(response.Item[quantityField]?.N || 0);
    const unitPrice = Number(response.Item.UnitPrice?.N || 0);
    const isRetail = tableName === "Retail_Stock";

    // Calculate total value based on stock type
    const totalValue = isRetail
        ? unitPrice * quantity
        : unitPrice * quantity * 20; // For wholesale: 1 packet = 20 pcs

    return {
        itemType: response.Item.ItemType?.S || "",
        variationName: response.Item.VariationName?.S || "",
        quantity: quantity,
        unitPrice: unitPrice,
        totalValue: totalValue,
        lowStockThreshold: Number(response.Item.LowStockThreshold?.N || 10),
    };
};

/**
 * Decrement stock after a transaction.
 * @param {Object} params
 * @param {string} params.tableName - 'Retail_Stock' or 'Wholesale_Stock'
 * @param {string} params.itemType - ItemType (e.g., 'Non-judicial stamp')
 * @param {string} params.variationName - VariationName (e.g., '30-26')
 * @param {number} params.quantityToSubtract - Number of pcs or packets to subtract
 * @param {string} params.token - Auth token
 */
export const updateStockAfterTransaction = async ({
    tableName,
    itemType,
    variationName,
    quantityToSubtract,
    token,
}) => {
    const client = await createDynamoDBClient(token);
    const quantityField = tableName === "Retail_Stock" ? "Quantity_pcs" : "Quantity_packets";

    // Use DynamoDB's SET with subtraction and a condition to prevent negative stock
    const command = new UpdateItemCommand({
        TableName: tableName,
        Key: {
            ItemType: { S: itemType },
            VariationName: { S: variationName }
        },
        UpdateExpression: `SET ${quantityField} = ${quantityField} - :q` ,
        ConditionExpression: `${quantityField} >= :q`,
        ExpressionAttributeValues: {
            ":q": { N: quantityToSubtract.toString() }
        }
    });

    return client.send(command);
};

export const updateStockEntry = async ({
    originalDate,
    originalItemType,
    originalVariationName,
    newDate,
    newItemType,
    newVariationName,
    quantityPackets,
    quantityPcs,
    unitPrice,
    token
}) => {
    const client = await createDynamoDBClient(token);
    // If any key fields change, delete old and create new
    const keyChanged = originalDate !== newDate || originalItemType !== newItemType || originalVariationName !== newVariationName;
    if (keyChanged) {
        // Delete old
        await client.send(new DeleteItemCommand({
            TableName: "Stock_Entries",
            Key: {
                Date: { S: originalDate },
                ItemType: { S: originalItemType },
                VariationName: { S: originalVariationName }
            }
        }));
        // Put new
        const item = {
            Date: { S: newDate },
            ItemType: { S: newItemType },
            VariationName: { S: newVariationName },
            UnitPrice: { N: unitPrice.toString() }
        };
        if (quantityPackets !== undefined) item.Quantity_Packets = { N: quantityPackets.toString() };
        if (quantityPcs !== undefined) item.Quantity_Pcs = { N: quantityPcs.toString() };
        await client.send(new PutItemCommand({
            TableName: "Stock_Entries",
            Item: item
        }));
    } else {
        // Update in place
        let updateExpr = "SET UnitPrice = :u";
        let exprAttr = { ":u": { N: unitPrice.toString() } };
        if (quantityPackets !== undefined) {
            updateExpr += ", Quantity_Packets = :q";
            exprAttr[":q"] = { N: quantityPackets.toString() };
        }
        if (quantityPcs !== undefined) {
            updateExpr += ", Quantity_Pcs = :p";
            exprAttr[":p"] = { N: quantityPcs.toString() };
        }
        await client.send(new UpdateItemCommand({
            TableName: "Stock_Entries",
            Key: {
                Date: { S: originalDate },
                ItemType: { S: originalItemType },
                VariationName: { S: originalVariationName }
            },
            UpdateExpression: updateExpr,
            ExpressionAttributeValues: exprAttr
        }));
    }
};

export const updateMainStock = async ({
    tableName,
    itemType,
    variationName,
    quantity,
    unitPrice,
    token
}) => {
    const client = await createDynamoDBClient(token);
    const quantityField = tableName === "Retail_Stock" ? "Quantity_pcs" : "Quantity_packets";
    let updateExpr = `SET ${quantityField} = :q, UnitPrice = :u`;
    let exprAttr = {
        ":q": { N: quantity.toString() },
        ":u": { N: unitPrice.toString() }
    };
    await client.send(new UpdateItemCommand({
        TableName: tableName,
        Key: {
            ItemType: { S: itemType },
            VariationName: { S: variationName }
        },
        UpdateExpression: updateExpr,
        ExpressionAttributeValues: exprAttr
    }));
};

export const fetchStockEntries = async (token) => {
    const client = await createDynamoDBClient(token);
    const command = new ScanCommand({ TableName: "Stock_Entries" });
    const response = await client.send(command);
    const entries = (response.Items || []).map((item) => {
        return {
            id: `${item.Date?.S}-${item.ItemType?.S}-${item.VariationName?.S}-${Math.random().toString(36).slice(2, 8)}`,
            date: item.Date?.S || "",
            itemType: item.ItemType?.S || "",
            variationName: item.VariationName?.S || "",
            quantityPcs: item.Quantity_Pcs ? Number(item.Quantity_Pcs.N) : "",
            quantityPackets: item.Quantity_Packets ? Number(item.Quantity_Packets.N) : "",
            unitPrice: Number(item.UnitPrice?.N || 0),
            totalValue: item.Quantity_Packets
                ? Number(item.UnitPrice?.N || 0) * Number(item.Quantity_Packets?.N || 0) * 500
                : Number(item.UnitPrice?.N || 0) * Number(item.Quantity_Pcs?.N || 0),
            isWholesale: !!item.Quantity_Packets,
            StockType_VariationName_Timestamp: item.StockType_VariationName_Timestamp?.S,
        };
    });
    // Sort by date descending
    return entries.sort((a, b) => b.date.localeCompare(a.date));
};