// src/utils/fetchTransactionsForReport.js
import { QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { createDynamoDBClient } from "../aws/aws-config";
import { fetchAuthSession } from "aws-amplify/auth";

/**
 * Fetch retail transactions for a specific month and year using TimestampIndex GSI
 */
export const fetchRetailTransactionsForMonth = async (idToken, month, year) => {
    try {
        const client = createDynamoDBClient(idToken);
        
        // First, let's try to get some sample data to understand the timestamp format
        console.log(`Fetching retail transactions for ${month}/${year}`);
        
        // Let's try a broader query first to see what's available
        let allItems = [];
        let lastEvaluatedKey = null;
        
        // Try querying with just GSI_PK to see all available data first
        const broadParams = {
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
            Limit: 50 // Get some samples first
        };
        
        const broadCommand = new QueryCommand(broadParams);
        const broadResponse = await client.send(broadCommand);
        
        if (broadResponse.Items && broadResponse.Items.length > 0) {
            const sampleItems = broadResponse.Items.map(item => unmarshall(item));
            console.log(`Found ${sampleItems.length} sample retail transactions`);
            console.log('Sample timestamps:', sampleItems.slice(0, 3).map(item => ({
                timestamp: item.Timestamp,
                date: item.Date,
                convertedDate: new Date(parseInt(item.Timestamp) * 1000).toISOString()
            })));
            
            // Filter by date in memory for now
            const filteredItems = sampleItems.filter(item => {
                if (!item.Date) return false;
                const itemDate = new Date(item.Date);
                return itemDate.getFullYear() === year && (itemDate.getMonth() + 1) === month;
            });
            
            allItems.push(...filteredItems);
            console.log(`Filtered to ${filteredItems.length} items for ${month}/${year}`);
        }
        
        // If we need more data, continue with pagination
        lastEvaluatedKey = broadResponse.LastEvaluatedKey;
        while (lastEvaluatedKey && allItems.length < 1000) { // Limit to prevent infinite loops
            const nextParams = {
                ...broadParams,
                ExclusiveStartKey: lastEvaluatedKey,
                Limit: 100
            };
            
            const nextCommand = new QueryCommand(nextParams);
            const nextResponse = await client.send(nextCommand);
            
            if (nextResponse.Items && nextResponse.Items.length > 0) {
                const nextItems = nextResponse.Items.map(item => unmarshall(item));
                const filteredNextItems = nextItems.filter(item => {
                    if (!item.Date) return false;
                    const itemDate = new Date(item.Date);
                    return itemDate.getFullYear() === year && (itemDate.getMonth() + 1) === month;
                });
                allItems.push(...filteredNextItems);
                console.log(`Added ${filteredNextItems.length} more items, total: ${allItems.length}`);
            }
            
            lastEvaluatedKey = nextResponse.LastEvaluatedKey;
        }
        
        console.log(`Total retail transactions for ${month}/${year}: ${allItems.length}`);
        return allItems;
        
    } catch (error) {
        console.error(`Error fetching retail transactions for ${month}/${year}:`, error);
        throw error;
    }
};

/**
 * Fetch wholesale transactions for a specific month and year using TimestampIndex GSI
 */
export const fetchWholesaleTransactionsForMonth = async (idToken, month, year) => {
    try {
        const client = createDynamoDBClient(idToken);
        
        console.log(`Fetching wholesale transactions for ${month}/${year}`);
        
        // Try querying with just GSI_PK to get available data and filter in memory
        let allItems = [];
        let lastEvaluatedKey = null;
        
        const broadParams = {
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
            Limit: 50 // Get some samples first
        };
        
        const broadCommand = new QueryCommand(broadParams);
        const broadResponse = await client.send(broadCommand);
        
        if (broadResponse.Items && broadResponse.Items.length > 0) {
            const sampleItems = broadResponse.Items.map(item => unmarshall(item));
            console.log(`Found ${sampleItems.length} sample wholesale transactions`);
            console.log('Sample timestamps:', sampleItems.slice(0, 3).map(item => ({
                timestamp: item.Timestamp,
                date: item.Date,
                convertedDate: new Date(parseInt(item.Timestamp) * 1000).toISOString()
            })));
            
            // Filter by date in memory
            const filteredItems = sampleItems.filter(item => {
                if (!item.Date) return false;
                const itemDate = new Date(item.Date);
                return itemDate.getFullYear() === year && (itemDate.getMonth() + 1) === month;
            });
            
            allItems.push(...filteredItems);
            console.log(`Filtered to ${filteredItems.length} items for ${month}/${year}`);
        }
        
        // If we need more data, continue with pagination
        lastEvaluatedKey = broadResponse.LastEvaluatedKey;
        while (lastEvaluatedKey && allItems.length < 1000) {
            const nextParams = {
                ...broadParams,
                ExclusiveStartKey: lastEvaluatedKey,
                Limit: 100
            };
            
            const nextCommand = new QueryCommand(nextParams);
            const nextResponse = await client.send(nextCommand);
            
            if (nextResponse.Items && nextResponse.Items.length > 0) {
                const nextItems = nextResponse.Items.map(item => unmarshall(item));
                const filteredNextItems = nextItems.filter(item => {
                    if (!item.Date) return false;
                    const itemDate = new Date(item.Date);
                    return itemDate.getFullYear() === year && (itemDate.getMonth() + 1) === month;
                });
                allItems.push(...filteredNextItems);
                console.log(`Added ${filteredNextItems.length} more items, total: ${allItems.length}`);
            }
            
            lastEvaluatedKey = nextResponse.LastEvaluatedKey;
        }
        
        console.log(`Total wholesale transactions for ${month}/${year}: ${allItems.length}`);
        return allItems;
        
    } catch (error) {
        console.error(`Error fetching wholesale transactions for ${month}/${year}:`, error);
        throw error;
    }
};

/**
 * Fetch all retail transactions using scan operation (for all-time reports)
 */
export const fetchAllRetailTransactions = async (idToken) => {
    try {
        const client = createDynamoDBClient(idToken);
        
        console.log("Fetching all retail transactions using scan...");
        
        let allItems = [];
        let lastEvaluatedKey = null;
        
        do {
            const params = {
                TableName: "Transaction_Retail",
            };
            
            if (lastEvaluatedKey) {
                params.ExclusiveStartKey = lastEvaluatedKey;
            }
            
            const command = new ScanCommand(params);
            const response = await client.send(command);
            
            if (response.Items && response.Items.length > 0) {
                const items = response.Items.map(item => unmarshall(item));
                allItems.push(...items);
                console.log(`Retrieved ${items.length} retail items, total: ${allItems.length}`);
            }
            
            lastEvaluatedKey = response.LastEvaluatedKey;
            
        } while (lastEvaluatedKey);
        
        console.log(`Total retail transactions (all-time): ${allItems.length}`);
        return allItems;
        
    } catch (error) {
        console.error("Error fetching all retail transactions:", error);
        throw error;
    }
};

/**
 * Fetch all wholesale transactions using scan operation (for all-time reports)
 */
export const fetchAllWholesaleTransactions = async (idToken) => {
    try {
        const client = createDynamoDBClient(idToken);
        
        console.log("Fetching all wholesale transactions using scan...");
        
        let allItems = [];
        let lastEvaluatedKey = null;
        
        do {
            const params = {
                TableName: "Transaction_Wholesale",
            };
            
            if (lastEvaluatedKey) {
                params.ExclusiveStartKey = lastEvaluatedKey;
            }
            
            const command = new ScanCommand(params);
            const response = await client.send(command);
            
            if (response.Items && response.Items.length > 0) {
                const items = response.Items.map(item => unmarshall(item));
                allItems.push(...items);
                console.log(`Retrieved ${items.length} wholesale items, total: ${allItems.length}`);
            }
            
            lastEvaluatedKey = response.LastEvaluatedKey;
            
        } while (lastEvaluatedKey);
        
        console.log(`Total wholesale transactions (all-time): ${allItems.length}`);
        return allItems;
        
    } catch (error) {
        console.error("Error fetching all wholesale transactions:", error);
        throw error;
    }
};

/**
 * Fetch retail transactions for entire year (for yearly cumulative reports)
 */
export const fetchRetailTransactionsForYear = async (idToken, year) => {
    try {
        const client = createDynamoDBClient(idToken);
        
        // Calculate start and end timestamps for the year in milliseconds (to match stored Timestamp)
        const startTimestamp = Date.UTC(year, 0, 1); // ms since epoch
        const endTimestamp = Date.UTC(year, 11, 31, 23, 59, 59, 999); // ms since epoch
        
        console.log(`Fetching retail transactions for year ${year} (${startTimestamp} - ${endTimestamp})`);
        
        let allItems = [];
        let lastEvaluatedKey = null;
        
        do {
            const params = {
                TableName: "Transaction_Retail",
                IndexName: "TimestampIndex",
                KeyConditionExpression: "#gsiPk = :gsiPk AND #timestamp BETWEEN :startTime AND :endTime",
                ExpressionAttributeNames: {
                    "#gsiPk": "GSI_PK",
                    "#timestamp": "Timestamp"
                },
                ExpressionAttributeValues: {
                    ":gsiPk": { S: "ALL" },
                    ":startTime": { N: startTimestamp.toString() },
                    ":endTime": { N: endTimestamp.toString() }
                },
                ScanIndexForward: false, // Sort descending by Timestamp
            };
            
            if (lastEvaluatedKey) {
                params.ExclusiveStartKey = lastEvaluatedKey;
            }
            
            const command = new QueryCommand(params);
            const response = await client.send(command);
            
            if (response.Items && response.Items.length > 0) {
                const items = response.Items.map(item => unmarshall(item));
                allItems.push(...items);
                console.log(`Retrieved ${items.length} retail items, total: ${allItems.length}`);
            }
            
            lastEvaluatedKey = response.LastEvaluatedKey;
            
        } while (lastEvaluatedKey);
        
        console.log(`Total retail transactions for year ${year}: ${allItems.length}`);
        return allItems;
        
    } catch (error) {
        console.error(`Error fetching retail transactions for year ${year}:`, error);
        throw error;
    }
};

/**
 * Fetch wholesale transactions for entire year (for yearly cumulative reports)
 */
export const fetchWholesaleTransactionsForYear = async (idToken, year) => {
    try {
        const client = createDynamoDBClient(idToken);
        
        // Calculate start and end timestamps for the year
        const startDate = new Date(year, 0, 1); // January 1st
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999); // December 31st
        
        // const startTimestamp = Math.floor(startDate.getTime() / 1000);
        // const endTimestamp = Math.floor(endDate.getTime() / 1000);
        
        const startTimestamp = Math.floor(Date.UTC(year,0,1)/1000) * 1000; // ms
        const endTimestamp   = Math.floor(Date.UTC(year,11,31,23,59,59,999)/1000) * 1000; // ms

        console.log(`Fetching wholesale transactions for year ${year} (${startTimestamp} - ${endTimestamp})`);
        
        let allItems = [];
        let lastEvaluatedKey = null;
        
        do {
            const params = {
                TableName: "Transaction_Wholesale",
                IndexName: "TimestampIndex",
                KeyConditionExpression: "#gsiPk = :gsiPk AND #timestamp BETWEEN :startTime AND :endTime",
                ExpressionAttributeNames: {
                    "#gsiPk": "GSI_PK",
                    "#timestamp": "Timestamp"
                },
                ExpressionAttributeValues: {
                    ":gsiPk": { S: "ALL" },
                    ":startTime": { N: startTimestamp.toString() },
                    ":endTime": { N: endTimestamp.toString() }
                },
                ScanIndexForward: false, // Sort descending by Timestamp
            };
            
            if (lastEvaluatedKey) {
                params.ExclusiveStartKey = lastEvaluatedKey;
            }
            
            const command = new QueryCommand(params);
            const response = await client.send(command);
            
            if (response.Items && response.Items.length > 0) {
                const items = response.Items.map(item => unmarshall(item));
                allItems.push(...items);
                console.log(`Retrieved ${items.length} wholesale items, total: ${allItems.length}`);
            }
            
            lastEvaluatedKey = response.LastEvaluatedKey;
            
        } while (lastEvaluatedKey);
        
        console.log(`Total wholesale transactions for year ${year}: ${allItems.length}`);
        return allItems;
        
    } catch (error) {
        console.error(`Error fetching wholesale transactions for year ${year}:`, error);
        throw error;
    }
};