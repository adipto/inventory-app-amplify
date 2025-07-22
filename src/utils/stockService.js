// src/utils/stockService.js
import { ScanCommand, DeleteItemCommand, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
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
            : unitPrice * quantity * 20; // For wholesale: 1 packet = 20 pcs

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

export const deleteStockItem = async (tableName, itemType, variationName, token) => {
    const client = await createDynamoDBClient(token);

    const command = new DeleteItemCommand({
        TableName: tableName,
        Key: {
            ItemType: { S: itemType },
            VariationName: { S: variationName }
        }
    });

    return await client.send(command);
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