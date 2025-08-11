// src/api/fetchTransactions.js - Optimized with TimestampIndex GSI
import { QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { createDynamoDBClient } from "../aws/aws-config";
import { fetchAuthSession } from "aws-amplify/auth";

// Optimized fetch retail transactions using TimestampIndex GSI
export const fetchRetailTransactions = async (idToken, limit = 10, startKey = null) => {
    try {
        const client = createDynamoDBClient(idToken);
        
        try {
            console.log("Using optimized TimestampIndex GSI for retail transactions...");
            
            // Use the new TimestampIndex GSI for efficient querying
            const params = {
                TableName: "Transaction_Retail",
                IndexName: "TimestampIndex",
                KeyConditionExpression: "#gsiPk = :gsiPk",
                ExpressionAttributeNames: {
                    "#gsiPk": "GSI_PK"
                },
                ExpressionAttributeValues: {
                    ":gsiPk": { S: "ALL" }
                },
                ScanIndexForward: false, // Sort descending by Timestamp
                Limit: limit
            };

            if (startKey) {
                params.ExclusiveStartKey = startKey;
            }

            const command = new QueryCommand(params);
            const response = await client.send(command);
            
            if (response.Items && response.Items.length > 0) {
                const items = response.Items.map(item => unmarshall(item));
                console.log(`TimestampIndex GSI successful, items found: ${items.length}`);
                
                return {
                    items: items,
                    lastEvaluatedKey: response.LastEvaluatedKey || null
                };
            } else {
                console.log("No items found with TimestampIndex GSI, falling back to DateIndex");
                throw new Error("No items found with TimestampIndex GSI");
            }
            
        } catch (gsiError) {
            console.log("TimestampIndex GSI failed, falling back to DateIndex strategy:", gsiError);
            
            // Fallback to the existing DateIndex strategy
            return await fetchRetailTransactionsDateIndex(client, limit, startKey);
        }
    } catch (error) {
        console.error("Error fetching retail transactions:", error);
        throw error;
    }
};

// Optimized fetch wholesale transactions using TimestampIndex GSI
export const fetchWholesaleTransactions = async (idToken, limit = 10, startKey = null) => {
    try {
        const client = createDynamoDBClient(idToken);
        
        try {
            console.log("Using optimized TimestampIndex GSI for wholesale transactions...");
            
            // Use the new TimestampIndex GSI for efficient querying
            const params = {
                TableName: "Transaction_Wholesale",
                IndexName: "TimestampIndex",
                KeyConditionExpression: "#gsiPk = :gsiPk",
                ExpressionAttributeNames: {
                    "#gsiPk": "GSI_PK"
                },
                ExpressionAttributeValues: {
                    ":gsiPk": { S: "ALL" }
                },
                ScanIndexForward: false, // Sort descending by Timestamp
                Limit: limit
            };

            if (startKey) {
                params.ExclusiveStartKey = startKey;
            }

            const command = new QueryCommand(params);
            const response = await client.send(command);
            
            if (response.Items && response.Items.length > 0) {
                const items = response.Items.map(item => unmarshall(item));
                console.log(`TimestampIndex GSI successful, items found: ${items.length}`);
                
                return {
                    items: items,
                    lastEvaluatedKey: response.LastEvaluatedKey || null
                };
            } else {
                console.log("No items found with TimestampIndex GSI, falling back to DateIndex");
                throw new Error("No items found with TimestampIndex GSI");
            }
            
        } catch (gsiError) {
            console.log("TimestampIndex GSI failed, falling back to DateIndex strategy:", gsiError);
            
            // Fallback to the existing DateIndex strategy
            return await fetchWholesaleTransactionsDateIndex(client, limit, startKey);
        }
    } catch (error) {
        console.error("Error fetching wholesale transactions:", error);
        throw error;
    }
};

// Fallback function for retail transactions using DateIndex (existing logic)
const fetchRetailTransactionsDateIndex = async (client, limit, startKey) => {
    let allItems = [];

    // Strategy: Query multiple recent dates to get comprehensive results
    const dates = [];
    for (let i = 0; i < 60; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
    }

    // Query each date until we have enough items
    for (const dateValue of dates) {
        if (allItems.length >= limit * 2) break;
        
        try {
            const params = {
                TableName: "Transaction_Retail",
                IndexName: "DateIndex",
                KeyConditionExpression: "#dateAttr = :dateValue",
                ExpressionAttributeNames: {
                    "#dateAttr": "Date"
                },
                ExpressionAttributeValues: {
                    ":dateValue": { S: dateValue }
                },
                ScanIndexForward: false,
                Limit: 50
            };

            const command = new QueryCommand(params);
            const response = await client.send(command);
            
            if (response.Items && response.Items.length > 0) {
                const items = response.Items.map(item => unmarshall(item));
                allItems.push(...items);
            }
        } catch (dateError) {
            console.log(`Error querying date ${dateValue}:`, dateError.message);
            continue;
        }
    }

    if (allItems.length > 0) {
        // Sort by Timestamp first, then fallback to Date+Time
        allItems.sort((a, b) => {
            if (a.Timestamp && b.Timestamp) {
                return parseInt(b.Timestamp) - parseInt(a.Timestamp);
            }
            
            const dateTimeA = new Date(`${a.Date}T${a.Time || '00:00:00'}`);
            const dateTimeB = new Date(`${b.Date}T${b.Time || '00:00:00'}`);
            
            if (isNaN(dateTimeA.getTime()) || isNaN(dateTimeB.getTime())) {
                return (b.Date || '').localeCompare(a.Date || '');
            }
            
            return dateTimeB - dateTimeA;
        });

        return {
            items: allItems.slice(0, limit),
            lastEvaluatedKey: null
        };
    } else {
        // Return empty result if no items found
        return {
            items: [],
            lastEvaluatedKey: null
        };
    }
};

// Fallback function for wholesale transactions using DateIndex (existing logic)
const fetchWholesaleTransactionsDateIndex = async (client, limit, startKey) => {
    let allItems = [];

    // Strategy: Query multiple recent dates to get comprehensive results
    const dates = [];
    for (let i = 0; i < 60; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
    }

    // Query each date until we have enough items
    for (const dateValue of dates) {
        if (allItems.length >= limit * 2) break;
        
        try {
            const params = {
                TableName: "Transaction_Wholesale",
                IndexName: "DateIndex",
                KeyConditionExpression: "#dateAttr = :dateValue",
                ExpressionAttributeNames: {
                    "#dateAttr": "Date"
                },
                ExpressionAttributeValues: {
                    ":dateValue": { S: dateValue }
                },
                ScanIndexForward: false,
                Limit: 50
            };

            const command = new QueryCommand(params);
            const response = await client.send(command);
            
            if (response.Items && response.Items.length > 0) {
                const items = response.Items.map(item => unmarshall(item));
                allItems.push(...items);
            }
        } catch (dateError) {
            console.log(`Error querying date ${dateValue}:`, dateError.message);
            continue;
        }
    }

    if (allItems.length > 0) {
        // Sort by Timestamp first, then fallback to Date+Time
        allItems.sort((a, b) => {
            if (a.Timestamp && b.Timestamp) {
                return parseInt(b.Timestamp) - parseInt(a.Timestamp);
            }
            
            const dateTimeA = new Date(`${a.Date}T${a.Time || '00:00:00'}`);
            const dateTimeB = new Date(`${b.Date}T${b.Time || '00:00:00'}`);
            
            if (isNaN(dateTimeA.getTime()) || isNaN(dateTimeB.getTime())) {
                return (b.Date || '').localeCompare(a.Date || '');
            }
            
            return dateTimeB - dateTimeA;
        });

        return {
            items: allItems.slice(0, limit),
            lastEvaluatedKey: null
        };
    } else {
        // Return empty result if no items found
        return {
            items: [],
            lastEvaluatedKey: null
        };
    }
};

// Ultra-optimized fetch function for all recent transactions
export const fetchAllRecentTransactions = async (idToken, limit = 50) => {
    try {
        const [retailData, wholesaleData] = await Promise.all([
            fetchRetailTransactions(idToken, limit),
            fetchWholesaleTransactions(idToken, limit),
        ]);

        // Combine and sort all transactions using Timestamp for ultimate precision
        const allTransactions = [
            ...retailData.items.map(tx => ({ ...tx, type: 'retail' })),
            ...wholesaleData.items.map(tx => ({ ...tx, type: 'wholesale' }))
        ];
        console.log("allTransactions", allTransactions);

        // Sort combined transactions with Timestamp priority (most accurate)
        allTransactions.sort((a, b) => {
            // Primary sort: Timestamp (most accurate)
            if (a.Timestamp && b.Timestamp) {
                return parseInt(b.Timestamp) - parseInt(a.Timestamp);
            }
            
            // Fallback sort: Date+Time parsing
            const dateTimeA = new Date(`${a.Date}T${a.Time || '00:00:00'}`);
            const dateTimeB = new Date(`${b.Date}T${b.Time || '00:00:00'}`);
            
            if (isNaN(dateTimeA.getTime()) || isNaN(dateTimeB.getTime())) {
                return (b.Date || '').localeCompare(a.Date || '');
            }
            
            return dateTimeB - dateTimeA;
        });

        return {
            items: allTransactions.slice(0, limit),
            hasMore: allTransactions.length >= limit
        };
    } catch (error) {
        console.error("Error fetching all recent transactions:", error);
        throw error;
    }
};

// Fetch customer details (unchanged)
export const fetchCustomerDetails = async (idToken, customerIds) => {
    if (!customerIds || customerIds.length === 0) return {};
    try {
        const client = createDynamoDBClient(idToken);
        const command = new ScanCommand({ TableName: "Customer_Information" });
        const response = await client.send(command);
        const customers = response.Items.map(item => unmarshall(item));
        const customerMap = {};
        customers.forEach(customer => {
            customerMap[customer.CustomerID] = customer;
        });
        return customerMap;
    } catch (error) {
        console.error("Error fetching customer details:", error);
        throw error;
    }
};