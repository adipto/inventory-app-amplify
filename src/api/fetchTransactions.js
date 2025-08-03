// src/api/fetchTransactions.js
import { QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { createDynamoDBClient } from "../aws/aws-config";
import { fetchAuthSession } from "aws-amplify/auth";

// Fetch retail transactions using Query with GSI for proper sorting
export const fetchRetailTransactions = async (idToken, limit = 10, startKey = null) => {
    try {
        const client = createDynamoDBClient(idToken);
        
        // Use Query with GSI that has Date as sort key
        const params = {
            TableName: "Transaction_Retail",
            IndexName: "DateIndex", // You'll need to create this GSI
            KeyConditionExpression: "#dateAttr = :dateAttr OR #dateAttr BETWEEN :startDate AND :endDate",
            ExpressionAttributeNames: {
                "#dateAttr": "Date"
            },
            ExpressionAttributeValues: {
                ":startDate": { S: "2020-01-01" }, // Adjust range as needed
                ":endDate": { S: new Date().toISOString().split('T')[0] }
            },
            ScanIndexForward: false, // Sort descending (newest first)
            Limit: limit
        };

        if (startKey) {
            params.ExclusiveStartKey = startKey;
        }

        // If GSI is not available yet, fallback to scan with better handling
        let command;
        let response;
        
        try {
            // Try Query first (requires GSI)
            command = new QueryCommand(params);
            response = await client.send(command);
        } catch (gsiError) {
            console.log("GSI not available, using enhanced scan method");
            // Fallback to scan but fetch more items and sort properly
            const scanParams = {
                TableName: "Transaction_Retail",
                Limit: Math.max(limit * 3, 100), // Fetch more items to ensure we get recent ones
            };
            if (startKey) {
                scanParams.ExclusiveStartKey = startKey;
            }
            command = new ScanCommand(scanParams);
            response = await client.send(command);
        }
        
        const items = response.Items.map(item => unmarshall(item));
        
        // Enhanced sorting with proper date/time handling
        items.sort((a, b) => {
            // Create full datetime for comparison
            const dateTimeA = new Date(`${a.Date}T${a.Time || '00:00:00'}`);
            const dateTimeB = new Date(`${b.Date}T${b.Time || '00:00:00'}`);
            
            // If dates are invalid, fall back to string comparison
            if (isNaN(dateTimeA.getTime()) || isNaN(dateTimeB.getTime())) {
                return (b.Date || '').localeCompare(a.Date || '');
            }
            
            return dateTimeB - dateTimeA; // Descending order (newest first)
        });
        
        // If we fetched more than requested, trim to the requested limit
        const trimmedItems = items.slice(0, limit);
        
        return {
            items: trimmedItems,
            lastEvaluatedKey: response.LastEvaluatedKey || null,
        };
    } catch (error) {
        console.error("Error fetching retail transactions:", error);
        throw error;
    }
};

// Fetch wholesale transactions using Query with GSI for proper sorting
export const fetchWholesaleTransactions = async (idToken, limit = 10, startKey = null) => {
    try {
        const client = createDynamoDBClient(idToken);
        
        // Use Query with GSI that has Date as sort key
        const params = {
            TableName: "Transaction_Wholesale",
            IndexName: "DateIndex", // You'll need to create this GSI
            KeyConditionExpression: "#dateAttr BETWEEN :startDate AND :endDate",
            ExpressionAttributeNames: {
                "#dateAttr": "Date"
            },
            ExpressionAttributeValues: {
                ":startDate": { S: "2020-01-01" }, // Adjust range as needed
                ":endDate": { S: new Date().toISOString().split('T')[0] }
            },
            ScanIndexForward: false, // Sort descending (newest first)
            Limit: limit
        };

        if (startKey) {
            params.ExclusiveStartKey = startKey;
        }

        // If GSI is not available yet, fallback to scan with better handling
        let command;
        let response;
        
        try {
            // Try Query first (requires GSI)
            command = new QueryCommand(params);
            response = await client.send(command);
        } catch (gsiError) {
            console.log("GSI not available, using enhanced scan method");
            // Fallback to scan but fetch more items and sort properly
            const scanParams = {
                TableName: "Transaction_Wholesale",
                Limit: Math.max(limit * 3, 100), // Fetch more items to ensure we get recent ones
            };
            if (startKey) {
                scanParams.ExclusiveStartKey = startKey;
            }
            command = new ScanCommand(scanParams);
            response = await client.send(command);
        }
        
        console.log("response", response);
        const items = response.Items.map(item => unmarshall(item));
        console.log("items", items);
        
        // Enhanced sorting with proper date/time handling
        items.sort((a, b) => {
            // Create full datetime for comparison
            const dateTimeA = new Date(`${a.Date}T${a.Time || '00:00:00'}`);
            const dateTimeB = new Date(`${b.Date}T${b.Time || '00:00:00'}`);
            
            // If dates are invalid, fall back to string comparison
            if (isNaN(dateTimeA.getTime()) || isNaN(dateTimeB.getTime())) {
                return (b.Date || '').localeCompare(a.Date || '');
            }
            
            return dateTimeB - dateTimeA; // Descending order (newest first)
        });
        
        // If we fetched more than requested, trim to the requested limit
        const trimmedItems = items.slice(0, limit);
        
        return {
            items: trimmedItems,
            lastEvaluatedKey: response.LastEvaluatedKey || null,
        };
    } catch (error) {
        console.error("Error fetching wholesale transactions:", error);
        throw error;
    }
};

// Enhanced fetch function that gets all recent transactions for proper sorting
export const fetchAllRecentTransactions = async (idToken, limit = 50) => {
    try {
        const [retailData, wholesaleData] = await Promise.all([
            fetchRetailTransactions(idToken, limit),
            fetchWholesaleTransactions(idToken, limit),
        ]);

        // Combine and sort all transactions
        const allTransactions = [
            ...retailData.items.map(tx => ({ ...tx, type: 'retail' })),
            ...wholesaleData.items.map(tx => ({ ...tx, type: 'wholesale' }))
        ];

        // Sort combined transactions by date/time
        allTransactions.sort((a, b) => {
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