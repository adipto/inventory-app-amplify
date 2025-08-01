// src/api/fetchTransactions.js
import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { createDynamoDBClient } from "../aws/aws-config";
import { fetchAuthSession } from "aws-amplify/auth";

// Fetch retail transactions
export const fetchRetailTransactions = async (idToken, limit = 10, startKey = null) => {
    try {
        const client = createDynamoDBClient(idToken);
        const params = {
            TableName: "Transaction_Retail",
            Limit: limit,
        };
        if (startKey) {
            params.ExclusiveStartKey = startKey;
        }
        const command = new ScanCommand(params);
        const response = await client.send(command);
        const items = response.Items.map(item => unmarshall(item));
        
        // Sort by date (newest first) to ensure latest transactions appear first
        items.sort((a, b) => {
            const dateA = new Date(a.Date || 0);
            const dateB = new Date(b.Date || 0);
            return dateB - dateA; // Descending order (newest first)
        });
        
        return {
            items: items,
            lastEvaluatedKey: response.LastEvaluatedKey || null,
        };
    } catch (error) {
        console.error("Error fetching retail transactions:", error);
        throw error;
    }
};

// Fetch wholesale transactions
export const fetchWholesaleTransactions = async (idToken, limit = 10, startKey = null) => {
    try {
        const client = createDynamoDBClient(idToken);
        const params = {
            TableName: "Transaction_Wholesale",
            Limit: limit,
        };
        if (startKey) {
            params.ExclusiveStartKey = startKey;
        }
        const command = new ScanCommand(params);
        const response = await client.send(command);
        const items = response.Items.map(item => unmarshall(item));
        
        // Sort by date (newest first) to ensure latest transactions appear first
        items.sort((a, b) => {
            const dateA = new Date(a.Date || 0);
            const dateB = new Date(b.Date || 0);
            return dateB - dateA; // Descending order (newest first)
        });
        
        return {
            items: items,
            lastEvaluatedKey: response.LastEvaluatedKey || null,
        };
    } catch (error) {
        console.error("Error fetching wholesale transactions:", error);
        throw error;
    }
};

// Fetch customer details
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
